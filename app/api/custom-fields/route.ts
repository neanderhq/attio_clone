import { NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../../../server/db';
import { customFields, customValues } from '../../../server/schema';
import { AccessError, sameOrigin, workspaceAccess } from '../../../server/auth';
import { CustomFieldError, customLock, customRecordTable, kindOf, objectType, optionsOf, saveCustomValues } from '../../../server/custom-fields';
import { activeRecordIds } from '../../../server/record-lifecycle';

export const dynamic = 'force-dynamic';
function fail(error: unknown) {
  if (error instanceof AccessError || error instanceof CustomFieldError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error && typeof error === 'object' && 'cause' in error && error.cause && typeof error.cause === 'object' && 'constraint' in error.cause && error.cause.constraint === 'crm_custom_values_unique_idx') return NextResponse.json({ error: 'This field value must be unique in the workspace.' }, { status: 409 });
  console.error('Custom field request failed', error);
  return NextResponse.json({ error: 'Custom fields are unavailable. Try again.' }, { status: 503 });
}
async function bodyOf(request: Request) {
  const body = await request.text();
  if (body.length > 16_384) throw new CustomFieldError('Form is too large.', 413);
  try { const parsed: unknown = JSON.parse(body); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>; } catch { /* handled below */ }
  throw new CustomFieldError('Provide a valid JSON form.');
}
export async function GET(request: Request) {
  try {
    const { workspaceId } = await workspaceAccess(request);
    const db = getDb();
    const [fields, values] = await Promise.all([
      db.select().from(customFields).where(eq(customFields.workspaceId, workspaceId)).orderBy(customFields.createdAt, customFields.id),
      db.select({ fieldId: customValues.fieldId, recordId: customValues.recordId, value: customValues.value }).from(customValues).innerJoin(customFields, and(eq(customFields.id, customValues.fieldId), eq(customFields.workspaceId, workspaceId))).where(eq(customValues.workspaceId, workspaceId)),
    ]);
    const visible = await activeRecordIds(workspaceId);
    const typeByField = new Map(fields.map(field => [field.id, field.objectType]));
    return NextResponse.json({ fields, values: values.filter(value => visible(typeByField.get(value.fieldId) || '', value.recordId)) });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { workspaceId, role } = await workspaceAccess(request, true);
    if (role !== 'Admin') throw new AccessError('Only an Admin can define fields.', 403);
    const body = await bodyOf(request);
    const type = objectType(body.objectType), kind = kindOf(body.kind);
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) throw new CustomFieldError('Field name must be 1–80 characters.');
    const name = body.name.trim(), options = optionsOf(body.options, kind);
    if (typeof body.required !== 'boolean' || typeof body.unique !== 'boolean') throw new CustomFieldError('Required and unique must be true or false.');
    const db = getDb();
    const saved = await db.transaction(async tx => {
      await tx.execute(customLock(workspaceId));
      const existing = await tx.select().from(customFields).where(and(eq(customFields.workspaceId, workspaceId), eq(customFields.objectType, type), isNull(customFields.archivedAt)));
      if (existing.length >= 32) throw new CustomFieldError('This record type has reached its 32 active custom field limit.', 409);
      if (existing.some(field => field.name.toLowerCase() === name.toLowerCase())) throw new CustomFieldError('A field with this name already exists.', 409);
      if (body.required) {
        const table = customRecordTable(type);
        const records = await tx.select({ id: table.id }).from(table).where(eq(table.workspaceId, workspaceId)).limit(1);
        if (records.length) throw new CustomFieldError('Required fields can only be added before records exist. Backfill existing records first.', 409);
      }
      const [field] = await tx.insert(customFields).values({ workspaceId, objectType: type, kind, name, options, required: body.required as boolean, unique: body.unique as boolean }).returning();
      return field;
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) { return fail(error); }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { workspaceId, role } = await workspaceAccess(request, true);
    if (role !== 'Admin') throw new AccessError('Only an Admin can archive fields.', 403);
    const body = await bodyOf(request);
    if (body.action !== 'archive' || typeof body.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)) throw new CustomFieldError('Choose a field to archive.');
    const fieldId = body.id;
    const [field] = await getDb().transaction(async tx => {
      await tx.execute(customLock(workspaceId));
      return tx.update(customFields).set({ archivedAt: new Date() }).where(and(eq(customFields.id, fieldId), eq(customFields.workspaceId, workspaceId), isNull(customFields.archivedAt))).returning();
    });
    if (!field) throw new CustomFieldError('Active field not found.', 404);
    return NextResponse.json(field);
  } catch (error) { return fail(error); }
}
export async function PUT(request: Request) {
  try {
    sameOrigin(request);
    const { workspaceId } = await workspaceAccess(request, true);
    const body = await bodyOf(request);
    const type = objectType(body.objectType), recordId = Number(body.recordId), version = Number(body.version);
    if (!Number.isSafeInteger(recordId) || recordId <= 0 || !Number.isSafeInteger(version) || version <= 0 || !body.values || typeof body.values !== 'object' || Array.isArray(body.values) || !Object.keys(body.values).length) throw new CustomFieldError('Choose a record, version, and field values.');
    const table = customRecordTable(type);
    const result = await getDb().transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), 73921)`);
      await tx.execute(customLock(workspaceId));
      const [record] = await tx.select().from(table).where(and(eq(table.id, recordId), eq(table.workspaceId, workspaceId), isNull(table.deletedAt))).for('update').limit(1);
      if (!record) throw new CustomFieldError('Record not found.', 404);
      if (record.version !== version) throw new CustomFieldError('This record changed since you opened it. Your custom field draft is still here; load the latest version before saving.', 409);
      const changed = await saveCustomValues(tx, workspaceId, type, recordId, body.values, false);
      if (!changed) return { version };
      const [updated] = await tx.update(table).set({ version: version + 1 }).where(and(eq(table.id, recordId), eq(table.workspaceId, workspaceId), eq(table.version, version))).returning({ version: table.version });
      return updated;
    });
    return NextResponse.json(result);
  } catch (error) { return fail(error); }
}
