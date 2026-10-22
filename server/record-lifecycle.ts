import { createHash } from 'node:crypto';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { getDb } from './db';
import { companies, people, deals, dealStageEvents, notes, tasks, crmLists, crmListEntries, crmListGrants, customFields, customValues, recordLifecycleEvents } from './schema';

export type RecordType = 'company' | 'person' | 'deal';
export type Resolution = 'source' | 'target';
export class LifecycleError extends Error { constructor(message: string, public status = 400) { super(message); } }
type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
const tables = { company: companies, person: people, deal: deals };
const fields: Record<RecordType, string[]> = {
  company: ['name', 'domain', 'description'],
  person: ['name', 'email', 'companyId'],
  deal: ['name', 'companyId', 'personId', 'stage', 'owner', 'valueCents', 'currency', 'lostReason', 'wonClosedAt'],
};
const fieldLabels: Record<string, string> = { name: 'Name', domain: 'Domain', description: 'Description', email: 'Email', companyId: 'Linked company ID', personId: 'Linked person ID', stage: 'Pipeline stage', owner: 'Owner label', valueCents: 'Value in currency minor units', currency: 'Currency', lostReason: 'Lost reason', wonClosedAt: 'Won date' };
const retentionMs = 30 * 86400_000;
export function recordType(value: unknown): RecordType {
  if (value !== 'company' && value !== 'person' && value !== 'deal') throw new LifecycleError('Choose a Company, Person, or Deal.');
  return value;
}
export function recordId(value: unknown) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new LifecycleError('Choose a valid record.');
  return parsed;
}
export function recordVersion(value: unknown) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new LifecycleError('Send the current record version.');
  return parsed;
}
const lock = (workspaceId: string) => sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), 73921)`;
async function getRecord(tx: Tx, workspaceId: string, type: RecordType, id: number) {
  const table = tables[type];
  const [row] = await tx.select().from(table).where(and(eq(table.id, id), eq(table.workspaceId, workspaceId))).limit(1);
  if (!row) throw new LifecycleError('Record not found.', 404);
  return row;
}
function active(row: { deletedAt: Date | null }) {
  if (row.deletedAt) throw new LifecycleError('Record not found.', 404);
}
async function dependentCounts(tx: Tx, workspaceId: string, type: RecordType, id: number) {
  const linkedPeople = type === 'company' ? await tx.select({ id: people.id }).from(people).where(and(eq(people.workspaceId, workspaceId), eq(people.companyId, id), isNull(people.deletedAt))) : [];
  const linkedDeals = type === 'company' ? await tx.select({ id: deals.id }).from(deals).where(and(eq(deals.workspaceId, workspaceId), eq(deals.companyId, id), isNull(deals.deletedAt))) : type === 'person' ? await tx.select({ id: deals.id }).from(deals).where(and(eq(deals.workspaceId, workspaceId), eq(deals.personId, id), isNull(deals.deletedAt))) : [];
  return { people: linkedPeople.length, deals: linkedDeals.length };
}
async function listEntries(tx: Tx, workspaceId: string, userId: string, type: RecordType, sourceId: number, targetId: number) {
  if (type === 'person') return [];
  const rows = await tx.select({ list: crmLists, entry: crmListEntries }).from(crmListEntries).innerJoin(crmLists, eq(crmListEntries.listId, crmLists.id))
    .where(and(eq(crmLists.workspaceId, workspaceId), eq(crmLists.objectType, type), inArray(crmListEntries.recordId, [sourceId, targetId])));
  const privateIds = rows.filter(row => row.list.visibility === 'private' && row.list.creatorId !== userId).map(row => row.list.id);
  if (privateIds.length) {
    const grants = await tx.select().from(crmListGrants).where(and(inArray(crmListGrants.listId, privateIds), eq(crmListGrants.userId, userId)));
    const writable = new Set(grants.filter(grant => grant.access === 'Editor').map(grant => grant.listId));
    if (privateIds.some(id => !writable.has(id))) throw new LifecycleError('A record is in a list you cannot change. Ask its owner to handle the merge.', 403);
  }
  return rows;
}
async function fieldValues(tx: Tx, workspaceId: string, type: RecordType, sourceId: number, targetId: number) {
  return tx.select({ field: customFields, value: customValues }).from(customValues).innerJoin(customFields, eq(customValues.fieldId, customFields.id))
    .where(and(eq(customFields.workspaceId, workspaceId), eq(customFields.objectType, type), eq(customValues.workspaceId, workspaceId), inArray(customValues.recordId, [sourceId, targetId])));
}
export async function previewMerge(tx: Tx, workspaceId: string, userId: string, type: RecordType, sourceId: number, targetId: number) {
  if (sourceId === targetId) throw new LifecycleError('Choose two different records.');
  const source = await getRecord(tx, workspaceId, type, sourceId);
  const target = await getRecord(tx, workspaceId, type, targetId);
  active(source); active(target);
  const entries = await listEntries(tx, workspaceId, userId, type, sourceId, targetId);
  const values = await fieldValues(tx, workspaceId, type, sourceId, targetId);
  const dependencies = await dependentCounts(tx, workspaceId, type, sourceId);
  const conflicts: { key: string; label: string; source: unknown; target: unknown }[] = [];
  for (const field of fields[type]) {
    const a = (source as unknown as Record<string, unknown>)[field], b = (target as unknown as Record<string, unknown>)[field];
    if (JSON.stringify(a) !== JSON.stringify(b)) conflicts.push({ key: field, label: fieldLabels[field] || field, source: a, target: b });
  }
  const byList = new Map<string, { listName: string; source?: typeof crmListEntries.$inferSelect; target?: typeof crmListEntries.$inferSelect }>();
  for (const { list, entry } of entries) {
    const item = byList.get(list.id) || { listName: list.name };
    item[entry.recordId === sourceId ? 'source' : 'target'] = entry;
    byList.set(list.id, item);
  }
  for (const [id, item] of byList) if (item.source && item.target && (item.source.stage !== item.target.stage || item.source.note !== item.target.note))
    conflicts.push({ key: `list:${id}`, label: `List: ${item.listName}`, source: { stage: item.source.stage, note: item.source.note }, target: { stage: item.target.stage, note: item.target.note } });
  const byField = new Map<string, { name: string; source?: typeof customValues.$inferSelect; target?: typeof customValues.$inferSelect }>();
  for (const { field, value } of values) {
    const item = byField.get(field.id) || { name: field.name };
    item[value.recordId === sourceId ? 'source' : 'target'] = value;
    byField.set(field.id, item);
  }
  for (const [id, item] of byField) if (item.source && item.target && item.source.value !== item.target.value)
    conflicts.push({ key: `custom:${id}`, label: `Field: ${item.name}`, source: item.source.value, target: item.target.value });
  const linkImpact = type === 'company' ? { people: dependencies.people, deals: dependencies.deals } : type === 'person' ? { deals: dependencies.deals, moveDealsToCompanyId: (target as typeof people.$inferSelect).companyId } : {};
  const snapshot = createHash('sha256').update(JSON.stringify({ source, target, entries, values, dependencies })).digest('hex');
  return { type, sourceId, targetId, sourceVersion: source.version, targetVersion: target.version, sourceName: source.name, targetName: target.name, conflicts, links: linkImpact, lists: [...byList.entries()].map(([id, item]) => ({ id, name: item.listName, source: item.source ? { stage: item.source.stage, note: item.source.note } : null, target: item.target ? { stage: item.target.stage, note: item.target.note } : null })), notesAndTasks: { notes: (await tx.select({ id: notes.id }).from(notes).where(and(eq(notes.workspaceId, workspaceId), eq(notes.targetType, type), eq(notes.targetId, sourceId)))).length, tasks: (await tx.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.targetType, type), eq(tasks.targetId, sourceId)))).length }, snapshot, source, target, entries, values, byList, byField };
}
export async function softDelete(workspaceId: string, userId: string, type: RecordType, id: number, version: number) {
  return getDb().transaction(async tx => {
    await tx.execute(lock(workspaceId));
    const row = await getRecord(tx, workspaceId, type, id);
    active(row);
    if (row.version !== version) throw new LifecycleError('This record changed. Refresh before deleting it.', 409);
    const dependents = await dependentCounts(tx, workspaceId, type, id);
    if (dependents.people || dependents.deals) throw new LifecycleError('Move or merge this record’s active linked people and deals before deleting it.', 409);
    const table = tables[type], deletedAt = new Date();
    await tx.update(table).set({ deletedAt, version: row.version + 1 }).where(and(eq(table.id, id), eq(table.workspaceId, workspaceId)));
    await tx.update(customValues).set({ uniqueKey: null }).where(and(eq(customValues.workspaceId, workspaceId), eq(customValues.recordId, id), inArray(customValues.fieldId, tx.select({ id: customFields.id }).from(customFields).where(and(eq(customFields.workspaceId, workspaceId), eq(customFields.objectType, type))))));
    await tx.insert(recordLifecycleEvents).values({ workspaceId, actorId: userId, recordType: type, recordId: id, action: 'delete', details: { version, restoreUntil: new Date(deletedAt.getTime() + retentionMs).toISOString() } });
    return { deletedAt, restoreUntil: new Date(deletedAt.getTime() + retentionMs), id, type };
  });
}
export async function restoreRecord(workspaceId: string, userId: string, type: RecordType, id: number, version: number) {
  return getDb().transaction(async tx => {
    await tx.execute(lock(workspaceId));
    const row = await getRecord(tx, workspaceId, type, id);
    if (!row.deletedAt || row.mergedIntoId) throw new LifecycleError('Record is not available to restore.', 404);
    if (row.version !== version) throw new LifecycleError('This record changed. Refresh before restoring it.', 409);
    if (row.deletedAt.getTime() + retentionMs < Date.now()) throw new LifecycleError('The 30-day restore window has ended.', 410);
    if (type === 'person' || type === 'deal') {
      const parent = await getRecord(tx, workspaceId, 'company', (row as typeof people.$inferSelect | typeof deals.$inferSelect).companyId);
      if (parent.deletedAt) throw new LifecycleError('Restore the linked company first.', 409);
    }
    if (type === 'deal') {
      const person = await getRecord(tx, workspaceId, 'person', (row as typeof deals.$inferSelect).personId);
      if (person.deletedAt || (person as typeof people.$inferSelect).companyId !== (row as typeof deals.$inferSelect).companyId) throw new LifecycleError('Restore or repair the linked person first.', 409);
    }
    const identity = type === 'company' ? (row as typeof companies.$inferSelect).domain : type === 'person' ? (row as typeof people.$inferSelect).email : null;
    if (identity) {
      const table = type === 'company' ? companies : people;
      const col = type === 'company' ? companies.domain : people.email;
      const collisions = await tx.select({ id: table.id }).from(table).where(and(eq(table.workspaceId, workspaceId), isNull(table.deletedAt), ne(table.id, id), sql`lower(${col}) = ${identity.toLowerCase()}`)).limit(1);
      if (collisions.length) throw new LifecycleError('An active record now uses this domain or email. Resolve the identity before restoring.', 409);
    }
    const fieldRows = await fieldValues(tx, workspaceId, type, id, id);
    for (const { field, value } of fieldRows) if (field.unique) {
      const key = String(value.value).toLowerCase();
      const collision = await tx.select({ recordId: customValues.recordId }).from(customValues).where(and(eq(customValues.fieldId, field.id), eq(customValues.uniqueKey, key), ne(customValues.recordId, id))).limit(1);
      if (collision.length) throw new LifecycleError(`A custom field identity is already in use. Resolve it before restoring.`, 409);
    }
    const table = tables[type];
    await tx.update(table).set({ deletedAt: null, version: row.version + 1 }).where(and(eq(table.id, id), eq(table.workspaceId, workspaceId)));
    for (const { field, value } of fieldRows) if (field.unique) await tx.update(customValues).set({ uniqueKey: String(value.value).toLowerCase() }).where(and(eq(customValues.fieldId, field.id), eq(customValues.recordId, id)));
    await tx.insert(recordLifecycleEvents).values({ workspaceId, actorId: userId, recordType: type, recordId: id, action: 'restore', details: { version } });
    return { id, type, version: row.version + 1 };
  });
}
export async function mergeRecords(workspaceId: string, userId: string, type: RecordType, sourceId: number, targetId: number, snapshot: string, resolutions: Record<string, Resolution>) {
  return getDb().transaction(async tx => {
    await tx.execute(lock(workspaceId));
    const preview = await previewMerge(tx, workspaceId, userId, type, sourceId, targetId);
    if (preview.snapshot !== snapshot) throw new LifecycleError('These records changed. Review a fresh merge preview.', 409);
    const conflictKeys = new Set(preview.conflicts.map(conflict => conflict.key));
    if (Object.keys(resolutions).some(key => !conflictKeys.has(key) || !['source', 'target'].includes(resolutions[key])) || preview.conflicts.some(conflict => !resolutions[conflict.key])) throw new LifecycleError('Choose a resolution for every conflict.', 400);
    const chosen = (key: string, a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b) ? b : resolutions[key] === 'source' ? a : b;
    const source = preview.source, target = preview.target;
    const selected = Object.fromEntries(fields[type].map(field => [field, chosen(field, (source as unknown as Record<string, unknown>)[field], (target as unknown as Record<string, unknown>)[field])]));
    const identity = type === 'company' ? selected.domain : type === 'person' ? selected.email : null;
    if (identity) {
      const table = type === 'company' ? companies : people;
      const col = type === 'company' ? companies.domain : people.email;
      const collisions = await tx.select({ id: table.id }).from(table).where(and(eq(table.workspaceId, workspaceId), isNull(table.deletedAt), sql`lower(${col}) = ${String(identity).toLowerCase()}`)).limit(501);
      if (collisions.some(row => row.id !== sourceId && row.id !== targetId)) throw new LifecycleError('Another active record uses this domain or email.', 409);
    }
    if (type === 'person') {
      const company = await getRecord(tx, workspaceId, 'company', Number(selected.companyId)); active(company);
    }
    if (type === 'deal') {
      const company = await getRecord(tx, workspaceId, 'company', Number(selected.companyId)); active(company);
      const person = await getRecord(tx, workspaceId, 'person', Number(selected.personId)); active(person);
      if ((person as typeof people.$inferSelect).companyId !== selected.companyId) throw new LifecycleError('The selected person must belong to the selected company.', 409);
      if (selected.stage === 'Lost' && !selected.lostReason) throw new LifecycleError('A Lost deal needs a reason.', 409);
    }
    for (const [fieldId, item] of preview.byField) {
      if (!item.source) continue;
      const value = item.target ? chosen(`custom:${fieldId}`, item.source.value, item.target.value) : item.source.value;
      if (item.target && item.target.value === value) continue;
      const [definition] = await tx.select().from(customFields).where(eq(customFields.id, fieldId)).limit(1);
      const key = definition.unique ? String(value).toLowerCase() : null;
      if (definition.unique) {
        const duplicates = await tx.select({ recordId: customValues.recordId }).from(customValues).where(and(eq(customValues.fieldId, fieldId), eq(customValues.uniqueKey, key!))).limit(501);
        if (duplicates.some(row => row.recordId !== sourceId && row.recordId !== targetId)) throw new LifecycleError('Another active record uses a selected custom field value.', 409);
      }
      await tx.update(customValues).set({ uniqueKey: null }).where(and(eq(customValues.fieldId, fieldId), eq(customValues.recordId, sourceId)));
      await tx.insert(customValues).values({ fieldId, workspaceId, recordId: targetId, value: value as string | number | boolean, uniqueKey: key }).onConflictDoUpdate({ target: [customValues.fieldId, customValues.recordId], set: { value: value as string | number | boolean, uniqueKey: key } });
    }
    await tx.update(customValues).set({ uniqueKey: null }).where(and(eq(customValues.workspaceId, workspaceId), eq(customValues.recordId, sourceId), inArray(customValues.fieldId, tx.select({ id: customFields.id }).from(customFields).where(and(eq(customFields.workspaceId, workspaceId), eq(customFields.objectType, type))))));
    if (type === 'company') {
      await tx.update(companies).set({ name: String(selected.name), domain: selected.domain as string | null, description: selected.description as string | null, version: target.version + 1 }).where(eq(companies.id, targetId));
      await tx.update(people).set({ companyId: targetId, version: sql`${people.version} + 1` }).where(and(eq(people.workspaceId, workspaceId), eq(people.companyId, sourceId)));
      await tx.update(deals).set({ companyId: targetId, version: sql`${deals.version} + 1` }).where(and(eq(deals.workspaceId, workspaceId), eq(deals.companyId, sourceId)));
    } else if (type === 'person') {
      await tx.update(people).set({ name: String(selected.name), email: selected.email as string | null, companyId: Number(selected.companyId), version: target.version + 1 }).where(eq(people.id, targetId));
      await tx.update(deals).set({ personId: targetId, companyId: Number(selected.companyId), version: sql`${deals.version} + 1` }).where(and(eq(deals.workspaceId, workspaceId), eq(deals.personId, sourceId)));
      await tx.update(deals).set({ companyId: Number(selected.companyId), version: sql`${deals.version} + 1` }).where(and(eq(deals.workspaceId, workspaceId), eq(deals.personId, targetId), ne(deals.companyId, Number(selected.companyId))));
    } else {
      await tx.update(deals).set({ name: String(selected.name), companyId: Number(selected.companyId), personId: Number(selected.personId), stage: String(selected.stage), owner: String(selected.owner), valueCents: Number(selected.valueCents), currency: String(selected.currency), lostReason: selected.lostReason as string | null, wonClosedAt: selected.stage === 'Won' ? selected.wonClosedAt as Date | null : null, version: target.version + 1 }).where(eq(deals.id, targetId));
      if ((target as typeof deals.$inferSelect).stage !== selected.stage) await tx.insert(dealStageEvents).values({ workspaceId, dealId: targetId, fromStage: (target as typeof deals.$inferSelect).stage, toStage: String(selected.stage), lostReason: selected.lostReason as string | null });
    }
    await tx.update(notes).set({ targetId }).where(and(eq(notes.workspaceId, workspaceId), eq(notes.targetType, type), eq(notes.targetId, sourceId)));
    await tx.update(tasks).set({ targetId, version: sql`${tasks.version} + 1` }).where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.targetType, type), eq(tasks.targetId, sourceId)));
    for (const item of preview.byList.values()) {
      if (!item.source) continue;
      if (item.target) {
        const listId = item.source.listId;
        if (resolutions[`list:${listId}`] === 'source') await tx.update(crmListEntries).set({ stage: item.source.stage, note: item.source.note }).where(eq(crmListEntries.id, item.target.id));
        await tx.delete(crmListEntries).where(eq(crmListEntries.id, item.source.id));
      } else await tx.update(crmListEntries).set({ recordId: targetId }).where(eq(crmListEntries.id, item.source.id));
    }
    const table = tables[type];
    await tx.update(table).set({ deletedAt: new Date(), mergedIntoId: targetId, version: source.version + 1 }).where(and(eq(table.id, sourceId), eq(table.workspaceId, workspaceId)));
    await tx.insert(recordLifecycleEvents).values({ workspaceId, actorId: userId, recordType: type, recordId: sourceId, action: 'merge', details: { targetId, sourceVersion: source.version, targetVersion: target.version, resolutions } });
    return { type, sourceId, targetId, version: target.version + 1 };
  }, { isolationLevel: 'serializable' });
}
export async function resolveRecord(workspaceId: string, type: RecordType, id: number) {
  let current = id;
  for (let step = 0; step < 20; step++) {
    const [row] = await getDb().select({ id: tables[type].id, deletedAt: tables[type].deletedAt, mergedIntoId: tables[type].mergedIntoId }).from(tables[type]).where(and(eq(tables[type].id, current), eq(tables[type].workspaceId, workspaceId))).limit(1);
    if (!row) throw new LifecycleError('Record not found.', 404);
    if (!row.deletedAt) return { type, id: row.id, redirected: row.id !== id };
    if (!row.mergedIntoId) throw new LifecycleError('Record not found.', 404);
    current = row.mergedIntoId;
  }
  throw new LifecycleError('Record link cannot be resolved.', 409);
}
export async function trashRecords(workspaceId: string) {
  const cutoff = new Date(Date.now() - retentionMs);
  const db = getDb();
  const [c, p, d] = await Promise.all([
    db.select({ id: companies.id, name: companies.name, version: companies.version, deletedAt: companies.deletedAt }).from(companies).where(and(eq(companies.workspaceId, workspaceId), sql`${companies.deletedAt} >= ${cutoff}`, isNull(companies.mergedIntoId))),
    db.select({ id: people.id, name: people.name, version: people.version, deletedAt: people.deletedAt }).from(people).where(and(eq(people.workspaceId, workspaceId), sql`${people.deletedAt} >= ${cutoff}`, isNull(people.mergedIntoId))),
    db.select({ id: deals.id, name: deals.name, version: deals.version, deletedAt: deals.deletedAt }).from(deals).where(and(eq(deals.workspaceId, workspaceId), sql`${deals.deletedAt} >= ${cutoff}`, isNull(deals.mergedIntoId))),
  ]);
  return [...c.map(row => ({ ...row, type: 'company' as const })), ...p.map(row => ({ ...row, type: 'person' as const })), ...d.map(row => ({ ...row, type: 'deal' as const }))];
}
export async function activeRecordIds(workspaceId: string) {
  const db = getDb();
  const [c, p, d] = await Promise.all([
    db.select({ id: companies.id }).from(companies).where(and(eq(companies.workspaceId, workspaceId), isNull(companies.deletedAt))),
    db.select({ id: people.id }).from(people).where(and(eq(people.workspaceId, workspaceId), isNull(people.deletedAt))),
    db.select({ id: deals.id }).from(deals).where(and(eq(deals.workspaceId, workspaceId), isNull(deals.deletedAt))),
  ]);
  const ids = { company: new Set(c.map(row => row.id)), person: new Set(p.map(row => row.id)), deal: new Set(d.map(row => row.id)) };
  return (type: string, id: number) => type in ids && ids[type as RecordType].has(id);
}
