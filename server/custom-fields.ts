import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from './db';
import { companies, customFields, customValues, deals, people } from './schema';
import { CUSTOM_KINDS, type CustomKind, type CustomValue } from '../shared/custom-fields';

export type CustomObject = 'company' | 'person' | 'deal';
export type CustomField = typeof customFields.$inferSelect;
export class CustomFieldError extends Error { constructor(message: string, public status = 400) { super(message); } }
type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];
export const customLock = (workspaceId: string) => sql`select pg_advisory_xact_lock(hashtext(${workspaceId}), 90771)`;
export function objectType(value: unknown): CustomObject {
  if (value !== 'company' && value !== 'person' && value !== 'deal') throw new CustomFieldError('Choose Company, Person, or Deal.');
  return value;
}
export function kindOf(value: unknown): CustomKind {
  if (!CUSTOM_KINDS.some(kind => kind === value)) throw new CustomFieldError('Choose a supported field type.');
  return value as CustomKind;
}
export function optionsOf(value: unknown, kind: CustomKind) {
  if (kind !== 'single_select') {
    if (value != null && (!Array.isArray(value) || value.length)) throw new CustomFieldError('Only single select fields accept options.');
    return [];
  }
  if (!Array.isArray(value) || value.length < 2 || value.length > 30 || value.some(item => typeof item !== 'string' || !item.trim() || item.trim() !== item || item.length > 80)) throw new CustomFieldError('Provide 2–30 distinct options, each at most 80 characters.');
  if (new Set(value.map(item => item.toLowerCase())).size !== value.length) throw new CustomFieldError('Select options must be distinct.');
  return value as string[];
}
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value; }
export function normalizeValue(field: CustomField, raw: unknown): CustomValue | null {
  if (raw === null || raw === '') return null;
  if (field.kind === 'checkbox') {
    if (typeof raw !== 'boolean') throw new CustomFieldError(`${field.name} must be true or false.`);
    return raw;
  }
  if (field.kind === 'number') {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || Math.abs(raw) > 1_000_000_000_000) throw new CustomFieldError(`${field.name} must be a number between -1 trillion and 1 trillion.`);
    return raw;
  }
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 500) throw new CustomFieldError(`${field.name} must be text of at most 500 characters.`);
  const value = raw.trim();
  switch (field.kind) {
    case 'text': return value;
    case 'date': if (!validDate(value)) throw new CustomFieldError(`${field.name} needs a valid date.`); return value;
    case 'email': if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new CustomFieldError(`${field.name} needs a valid email.`); return value.toLowerCase();
    case 'domain': if (value.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value)) throw new CustomFieldError(`${field.name} needs a valid domain.`); return value.toLowerCase();
    case 'url': {
      let url: URL;
      try { url = new URL(value); } catch { throw new CustomFieldError(`${field.name} needs an http or https URL.`); }
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new CustomFieldError(`${field.name} needs an http or https URL without credentials.`);
      return value;
    }
    case 'single_select': if (!field.options.includes(value)) throw new CustomFieldError(`${field.name} must use a saved option.`); return value;
    default: throw new CustomFieldError('This field type is unsupported.');
  }
}
function inputOf(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new CustomFieldError('Custom values must be a field ID to value map.');
  return raw as Record<string, unknown>;
}
export async function saveCustomValues(tx: Tx, workspaceId: string, type: CustomObject, recordId: number, raw: unknown, creating: boolean) {
  const input = inputOf(raw);
  const fields = await tx.select().from(customFields).where(and(eq(customFields.workspaceId, workspaceId), eq(customFields.objectType, type), isNull(customFields.archivedAt)));
  const byId = new Map(fields.map(field => [field.id, field]));
  for (const key of Object.keys(input)) if (!byId.has(key)) throw new CustomFieldError('A custom field was not found in this workspace.', 404);
  if (creating) for (const field of fields) if (field.required && !(field.id in input)) throw new CustomFieldError(`${field.name} is required.`);
  let changed = false;
  for (const [fieldId, rawValue] of Object.entries(input)) {
    const field = byId.get(fieldId)!;
    const value = normalizeValue(field, rawValue);
    if (field.required && value === null) throw new CustomFieldError(`${field.name} is required.`);
    const [previous] = await tx.select().from(customValues).where(and(eq(customValues.fieldId, fieldId), eq(customValues.recordId, recordId), eq(customValues.workspaceId, workspaceId))).limit(1);
    if (previous?.value === value || (!previous && value === null)) continue;
    changed = true;
    if (value === null) await tx.delete(customValues).where(and(eq(customValues.fieldId, fieldId), eq(customValues.recordId, recordId), eq(customValues.workspaceId, workspaceId)));
    else {
      const uniqueKey = field.unique ? String(value).toLowerCase() : null;
      await tx.insert(customValues).values({ fieldId, workspaceId, recordId, value, uniqueKey }).onConflictDoUpdate({ target: [customValues.fieldId, customValues.recordId], set: { value, uniqueKey } });
    }
  }
  return changed;
}
export const customRecordTable = (type: CustomObject) => ({ company: companies, person: people, deal: deals })[type];
