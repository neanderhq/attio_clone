import { CSV_FIELDS, type ImportMode, type ImportType, type RowOutcome } from '../shared/csv';

export type CompanyRow = { id: number; name: string; description: string | null; domain: string | null };
export type PersonRow = { id: number; name: string; email: string | null; companyId: number };
export type PlannedRow = RowOutcome & { value?: { domain?: string; name: string; description?: string | null; email?: string; companyId?: number } };
const domainPattern = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function planRows(type: ImportType, mode: ImportMode, headers: string[], rows: { row: number; cells: string[] }[], mapping: Record<string, string>, companies: CompanyRow[], people: PersonRow[]): PlannedRow[] {
  const fields: readonly string[] = CSV_FIELDS[type];
  const required = type === 'companies' ? ['domain', 'name'] : ['email', 'name', 'companyDomain'];
  if (Object.keys(mapping).some(key => !fields.includes(key))) throw new Error('The header mapping contains an unsupported field.');
  if (required.some(key => !mapping[key] || !headers.includes(mapping[key]))) throw new Error(`Map the required ${required.join(', ')} headers.`);
  if (Object.values(mapping).filter(Boolean).some(value => !headers.includes(value)) || new Set(Object.values(mapping).filter(Boolean)).size !== Object.values(mapping).filter(Boolean).length) throw new Error('Each mapped field needs a different existing CSV header.');
  const index = (field: string) => headers.indexOf(mapping[field]);
  const seen = new Set<string>();
  return rows.map(({ row, cells }): PlannedRow => {
    const error = (message: string): PlannedRow => ({ row, action: 'error', message });
    if (cells.length !== headers.length) return error(`Expected ${headers.length} cells, found ${cells.length}.`);
    const get = (field: string) => index(field) < 0 ? '' : cells[index(field)].trim();
    const identity = get(type === 'companies' ? 'domain' : 'email').toLowerCase();
    if (!identity) return error(type === 'companies' ? 'Domain is required.' : 'Email is required.');
    if (seen.has(identity)) return error(`Duplicate ${type === 'companies' ? 'domain' : 'email'} in this file.`);
    seen.add(identity);
    const name = get('name');
    if (!name || name.length > 120) return error('Name must be 1–120 characters.');
    if (type === 'companies') {
      if (identity.length > 253 || !domainPattern.test(identity)) return error('Enter a valid canonical domain, such as example.com.');
      const description = mapping.description ? get('description') : undefined;
      if (description !== undefined && description.length > 500) return error('Description must be at most 500 characters.');
      const candidates = companies.filter(c => c.domain?.toLowerCase() === identity);
      if (candidates.length > 1) return error('Multiple companies have this domain. Resolve duplicates before importing.');
      const existing = candidates[0];
      if (existing && mode === 'create-only') return existing.name === name && (description === undefined || (existing.description || '') === description) ? { row, action: 'unchanged', id: existing.id, message: 'Already exists with the same values.' } : error('A company with this domain already exists.');
      if (!existing && mode === 'update-only') return error('No company has this domain.');
      if (!existing && companies.length >= 500) return error('The workspace has reached its 500-company limit.');
      const value = { domain: identity, name, ...(description !== undefined ? { description: description || null } : {}) };
      if (existing && existing.name === name && (description === undefined || (existing.description || '') === description)) return { row, action: 'unchanged', id: existing.id, message: 'Values already match.' };
      if (!existing) companies.push({ id: -row, domain: identity, name, description: description || null });
      return { row, action: existing ? 'update' : 'create', id: existing?.id, message: existing ? 'Will update company.' : 'Will create company.', value };
    }
    if (identity.length > 254 || !emailPattern.test(identity)) return error('Enter a valid email address.');
    const companyDomain = get('companyDomain').toLowerCase();
    if (!companyDomain || !domainPattern.test(companyDomain)) return error('A valid company domain is required.');
    const companyMatches = companies.filter(c => c.domain?.toLowerCase() === companyDomain);
    if (companyMatches.length !== 1 || companyMatches[0].id < 1) return error(companyMatches.length ? 'Company domain is ambiguous or not yet saved.' : 'No company in this workspace has this domain. Import companies first.');
    const companyId = companyMatches[0].id;
    const candidates = people.filter(p => p.email?.toLowerCase() === identity);
    if (candidates.length > 1) return error('Multiple people have this email. Resolve duplicates before importing.');
    const existing = candidates[0];
    if (existing && mode === 'create-only') return existing.name === name && existing.companyId === companyId ? { row, action: 'unchanged', id: existing.id, message: 'Already exists with the same values.' } : error('A person with this email already exists.');
    if (!existing && mode === 'update-only') return error('No person has this email.');
    if (!existing && people.length >= 500) return error('The workspace has reached its 500-person limit.');
    if (existing && existing.name === name && existing.companyId === companyId) return { row, action: 'unchanged', id: existing.id, message: 'Values already match.' };
    if (!existing) people.push({ id: -row, email: identity, name, companyId });
    return { row, action: existing ? 'update' : 'create', id: existing?.id, message: existing ? 'Will update person.' : 'Will create person.', value: { email: identity, name, companyId } };
  });
}
