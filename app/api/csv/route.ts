import { and, eq, isNull, sql } from 'drizzle-orm';
import { AccessError, sameOrigin, workspaceAccess } from '../../../server/auth';
import { getDb } from '../../../server/db';
import { companies, people, deals, recordChanges, customFields } from '../../../server/schema';
import { customLock } from '../../../server/custom-fields';
import { planRows } from '../../../server/csv-transfer';
import { CSV_MAX_BYTES, CSV_MAX_ROWS, parseCsv, serializeCsv, type ImportMode, type ImportType, type RowOutcome } from '../../../shared/csv';

export const dynamic = 'force-dynamic';
class CsvError extends Error { constructor(message: string, public status = 400) { super(message); } }
function typeOf(value: unknown): ImportType { if (value !== 'companies' && value !== 'people') throw new CsvError('Choose Companies or People.'); return value; }
function fail(error: unknown) {
  if (error instanceof CsvError || error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
  console.error('CSV transfer failed', error);
  return Response.json({ error: 'CSV transfer is unavailable. Check the database and try again.' }, { status: 503 });
}
async function boundedForm(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new CsvError('Choose a CSV file.');
  const max = CSV_MAX_BYTES + 64 * 1024;
  if (Number(request.headers.get('content-length')) > max) throw new CsvError('CSV file exceeds the 10 MB limit.', 413);
  if (!request.body) throw new CsvError('Choose a CSV file.');
  const reader = request.body.getReader(), parts: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > max) { await reader.cancel().catch(() => {}); throw new CsvError('CSV file exceeds the 10 MB limit.', 413); } parts.push(value); }
  return new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type')! }, body: Buffer.concat(parts) }).formData();
}
export async function GET(request: Request) { try {
  const { workspaceId } = await workspaceAccess(request);
  const type = typeOf(new URL(request.url).searchParams.get('type'));
  const db = getDb();
  const rows = type === 'companies'
    ? await db.select({ domain: companies.domain, name: companies.name, description: companies.description }).from(companies).where(and(eq(companies.workspaceId, workspaceId), isNull(companies.deletedAt))).orderBy(companies.id).limit(CSV_MAX_ROWS + 1)
    : await db.select({ email: people.email, name: people.name, companyDomain: companies.domain }).from(people).innerJoin(companies, and(eq(people.companyId, companies.id), eq(companies.workspaceId, workspaceId), isNull(companies.deletedAt))).where(and(eq(people.workspaceId, workspaceId), isNull(people.deletedAt))).orderBy(people.id).limit(CSV_MAX_ROWS + 1);
  if (rows.length > CSV_MAX_ROWS) throw new CsvError(`Export exceeds ${CSV_MAX_ROWS} records.`, 409);
  const headers = type === 'companies' ? ['domain', 'name', 'description'] : ['email', 'name', 'companyDomain'];
  const csv = serializeCsv([headers, ...rows.map(row => headers.map(field => (row as Record<string, string | null>)[field]))]);
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="ledger-${type}.csv"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
} catch (error) { return fail(error); } }

export async function POST(request: Request) { try {
  sameOrigin(request);
  await workspaceAccess(request);
  const form = await boundedForm(request);
  const action = form.get('action');
  if (action !== 'preview' && action !== 'import') throw new CsvError('Choose Preview or Import.');
  const { workspaceId, user } = await workspaceAccess(request, action === 'import');
  const type = typeOf(form.get('type'));
  const mode = form.get('mode');
  if (mode !== 'create-only' && mode !== 'update-only' && mode !== 'upsert') throw new CsvError('Choose a valid import mode.');
  const file = form.get('file');
  if (!(file instanceof File)) throw new CsvError('Choose a CSV file.');
  if (file.size > CSV_MAX_BYTES) throw new CsvError('CSV file exceeds the 10 MB limit.', 413);
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new CsvError('CSV file must be valid UTF-8.'); }
  let parsed: ReturnType<typeof parseCsv>;
  try { parsed = parseCsv(text); } catch (error) { throw new CsvError(error instanceof Error ? error.message : 'Malformed CSV.'); }
  const rawMapping = form.get('mapping'); let mapping: Record<string, string>;
  try { const candidate: unknown = JSON.parse(String(rawMapping)); if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate) || Object.values(candidate).some(x => typeof x !== 'string')) throw new Error(); mapping = candidate as Record<string, string>; }
  catch { throw new CsvError('Choose a valid header mapping.'); }
  const db = getDb();
  const plan = async (reader: typeof db) => {
    const [companyRows, personRows] = await Promise.all([
      reader.select({ id: companies.id, name: companies.name, domain: companies.domain, description: companies.description }).from(companies).where(and(eq(companies.workspaceId, workspaceId), isNull(companies.deletedAt))).limit(501),
      reader.select({ id: people.id, name: people.name, email: people.email, companyId: people.companyId }).from(people).where(and(eq(people.workspaceId, workspaceId), isNull(people.deletedAt))).limit(501),
    ]);
    if (companyRows.length > 500 || personRows.length > 500) throw new CsvError('This workspace exceeds the 500-record collection limit.', 409);
    try { return planRows(type, mode as ImportMode, parsed.headers, parsed.rows, mapping, companyRows, personRows); }
    catch (error) { throw new CsvError(error instanceof Error ? error.message : 'Invalid mapping.'); }
  };
  if (action === 'preview') {
    const outcomes = await plan(db);
    return Response.json({ status: 'preview', headers: parsed.headers, total: outcomes.length, outcomes: outcomes.map(({ row, action, id, message }) => ({ row, action, id, message })), counts: count(outcomes) });
  }
  const outcomes = await db.transaction(async tx => {
    // Serialize imports for one workspace. Each request rechecks identity under the lock.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), 73921)`);
    await tx.execute(customLock(workspaceId));
    const planned = await plan(tx as typeof db);
    if (planned.some(item => item.action === 'create')) {
      const requiredFields = await tx.select({ id: customFields.id }).from(customFields).where(and(eq(customFields.workspaceId, workspaceId), eq(customFields.objectType, type === 'companies' ? 'company' : 'person'), eq(customFields.required, true), isNull(customFields.archivedAt))).limit(1);
      if (requiredFields.length) throw new CsvError('CSV cannot create records while this type has required custom fields. Create those records in the CRM.', 409);
    }
    const result: RowOutcome[] = [];
    for (const item of planned) {
      if (!item.value || item.action === 'error' || item.action === 'unchanged') { result.push(item); continue; }
      if (type === 'companies') {
        const value = item.value;
        const [before] = item.action === 'update' ? await tx.select().from(companies).where(and(eq(companies.id, item.id!), eq(companies.workspaceId, workspaceId), isNull(companies.deletedAt))).limit(1) : [];
        const saved = item.action === 'create'
          ? await tx.insert(companies).values({ workspaceId, domain: value.domain!, name: value.name, description: value.description ?? null }).returning({ id: companies.id })
          : await tx.update(companies).set({ name: value.name, ...(value.description !== undefined ? { description: value.description } : {}), version: sql`${companies.version} + 1` }).where(and(eq(companies.id, item.id!), eq(companies.workspaceId, workspaceId), isNull(companies.deletedAt))).returning({ id: companies.id });
        if (before) {
          const changes: Record<string, { from: string | null; to: string | null }> = {};
          if (before.name !== value.name) changes.name = { from: before.name, to: value.name };
          if (value.description !== undefined && before.description !== value.description) changes.description = { from: before.description, to: value.description };
          await tx.insert(recordChanges).values({ workspaceId, actorId: user.id, recordType: 'company', recordId: before.id, version: before.version + 1, changes });
        }
        result.push({ row: item.row, action: item.action, id: saved[0].id, message: item.action === 'create' ? 'Company created.' : 'Company updated.' });
      } else {
        const value = item.value;
        const [before] = item.action === 'update' ? await tx.select().from(people).where(and(eq(people.id, item.id!), eq(people.workspaceId, workspaceId), isNull(people.deletedAt))).limit(1) : [];
        if (before && before.companyId !== value.companyId) {
          const linked = await tx.select({ id: deals.id }).from(deals).where(and(eq(deals.workspaceId, workspaceId), eq(deals.personId, before.id))).limit(1);
          if (linked.length) { result.push({ row: item.row, action: 'error', id: before.id, message: 'Move this person’s deals before changing their company.' }); continue; }
        }
        const saved = item.action === 'create'
          ? await tx.insert(people).values({ workspaceId, email: value.email!, name: value.name, companyId: value.companyId! }).returning({ id: people.id })
          : await tx.update(people).set({ name: value.name, companyId: value.companyId!, version: sql`${people.version} + 1` }).where(and(eq(people.id, item.id!), eq(people.workspaceId, workspaceId), isNull(people.deletedAt))).returning({ id: people.id });
        if (before) {
          const changes: Record<string, { from: string | number | null; to: string | number | null }> = {};
          if (before.name !== value.name) changes.name = { from: before.name, to: value.name };
          if (before.companyId !== value.companyId) changes.companyId = { from: before.companyId, to: value.companyId! };
          await tx.insert(recordChanges).values({ workspaceId, actorId: user.id, recordType: 'person', recordId: before.id, version: before.version + 1, changes });
        }
        result.push({ row: item.row, action: item.action, id: saved[0].id, message: item.action === 'create' ? 'Person created.' : 'Person updated.' });
      }
    }
    return result;
  });
  return Response.json({ status: 'completed', total: outcomes.length, outcomes, counts: count(outcomes) });
} catch (error) { return fail(error); } }

function count(rows: RowOutcome[]) { return { create: rows.filter(x => x.action === 'create').length, update: rows.filter(x => x.action === 'update').length, unchanged: rows.filter(x => x.action === 'unchanged').length, error: rows.filter(x => x.action === 'error').length }; }
