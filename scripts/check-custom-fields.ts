import assert from 'node:assert/strict';
import { Client } from 'pg';
import { POST as authPost, GET as authGet } from '../app/api/auth/route';
import { POST as crmPost } from '../app/api/crm/route';
import { GET as fieldsGet, POST as fieldsPost, PATCH as fieldsPatch, PUT as fieldsPut } from '../app/api/custom-fields/route';
import { POST as csvPost } from '../app/api/csv/route';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const origin = 'http://localhost';
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const users: string[] = [], workspaces: string[] = [];
type Account = { cookie: string; workspaceId: string; id: string; email: string };
async function call(handler: (request: Request) => Promise<Response>, method: 'GET' | 'POST' | 'PATCH' | 'PUT', account?: Account, body?: object) {
  const path = handler === authPost || handler === authGet ? '/api/auth' : handler === crmPost ? '/api/crm' : '/api/custom-fields';
  const response = await handler(new Request(`${origin}${path}`, { method, headers: { ...(body ? { origin, 'content-type': 'application/json' } : {}), ...(account ? { cookie: account.cookie, 'x-workspace-id': account.workspaceId } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: response.status, data: await response.json() as Record<string, any> };
}
async function register(label: string): Promise<Account> {
  const email = `${label}-${stamp}@example.test`;
  assert.equal((await call(authPost, 'POST', undefined, { action: 'register', email, password: 'strong test password 123', workspaceName: label })).status, 201);
  const raw = await authPost(new Request(`${origin}/api/auth`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'login', email, password: 'strong test password 123' }) }));
  assert.equal(raw.status, 200);
  const cookie = raw.headers.get('set-cookie')!.split(';')[0];
  const me = await call(authGet, 'GET', { cookie, workspaceId: '', id: '', email });
  const id = me.data.user.id, workspaceId = me.data.workspaces[0].id;
  users.push(id); workspaces.push(workspaceId);
  return { cookie, workspaceId, id, email };
}
async function main() {
  await client.connect();
  try {
    const owner = await register('fields-owner'), memberAccount = await register('fields-member'), outsider = await register('fields-outsider');
    assert.equal((await call(fieldsGet, 'GET')).status, 401);
    assert.equal((await call(authPost, 'POST', owner, { action: 'setMember', email: memberAccount.email, role: 'Member' })).status, 200);
    const member = { ...memberAccount, workspaceId: owner.workspaceId };
    const define = async (account: Account, objectType: string, name: string, kind: string, required = false, unique = false, options: string[] = []) => call(fieldsPost, 'POST', account, { objectType, name, kind, required, unique, options });
    assert.equal((await define(member, 'company', 'Denied', 'text')).status, 403);
    assert.equal((await define(owner, 'company', 'Unsupported', 'currency')).status, 400);
    assert.equal((await define(owner, 'company', 'Bad options', 'single_select', false, false, ['Same', 'same'])).status, 400);
    const required = await define(owner, 'company', 'Account code', 'text', true, true); assert.equal(required.status, 201);
    const email = await define(owner, 'company', 'Contact email', 'email'); assert.equal(email.status, 201);
    const domain = await define(owner, 'company', 'Web domain', 'domain'); assert.equal(domain.status, 201);
    const url = await define(owner, 'company', 'Website URL', 'url'); assert.equal(url.status, 201);
    const number = await define(owner, 'company', 'Score', 'number'); assert.equal(number.status, 201);
    const checkbox = await define(owner, 'company', 'Priority', 'checkbox'); assert.equal(checkbox.status, 201);
    const date = await define(owner, 'company', 'Renewal', 'date'); assert.equal(date.status, 201);
    const select = await define(owner, 'company', 'Tier', 'single_select', false, false, ['Starter', 'Growth']); assert.equal(select.status, 201);
    const form = new FormData(); form.set('action', 'import'); form.set('type', 'companies'); form.set('mode', 'upsert'); form.set('mapping', JSON.stringify({ domain: 'Domain', name: 'Name' })); form.set('file', new File(['Domain,Name\nexample.test,CSV bypass\n'], 'fields.csv'));
    const csv = await csvPost(new Request(`${origin}/api/csv`, { method: 'POST', headers: { origin, cookie: owner.cookie, 'x-workspace-id': owner.workspaceId }, body: form }));
    assert.equal(csv.status, 409);
    assert.equal((await define(owner, 'company', 'account CODE', 'text')).status, 409);
    assert.equal((await call(crmPost, 'POST', owner, { type: 'company', name: 'Missing code' })).status, 400);
    const one = await call(crmPost, 'POST', owner, { type: 'company', name: 'Fictional One', customValues: { [required.data.id]: 'AC-1', [email.data.id]: 'TEST@EXAMPLE.TEST', [domain.data.id]: 'Example.test', [url.data.id]: 'https://example.test', [number.data.id]: 12.5, [checkbox.data.id]: false, [date.data.id]: '2026-10-21', [select.data.id]: 'Growth' } });
    assert.equal(one.status, 201);
    const all = await call(fieldsGet, 'GET', owner); assert.equal(all.status, 200); assert.equal(all.data.fields.length, 8);
    assert.equal(all.data.values.find((value: any) => value.fieldId === email.data.id).value, 'test@example.test');
    assert.equal(all.data.values.find((value: any) => value.fieldId === checkbox.data.id).value, false);
    assert.equal((await call(crmPost, 'POST', member, { type: 'company', name: 'Duplicate', customValues: { [required.data.id]: 'ac-1' } })).status, 409);
    assert.equal((await call(crmPost, 'POST', owner, { type: 'company', name: 'Bad URL', customValues: { [required.data.id]: 'AC-2', [url.data.id]: 'javascript:alert(1)' } })).status, 400);
    assert.equal((await call(crmPost, 'POST', owner, { type: 'company', name: 'Bad option', customValues: { [required.data.id]: 'AC-2', [select.data.id]: 'Unknown' } })).status, 400);
    const two = await call(crmPost, 'POST', owner, { type: 'company', name: 'Fictional Two', customValues: { [required.data.id]: 'AC-2' } }); assert.equal(two.status, 201);
    const personField = await define(owner, 'person', 'Role', 'single_select', false, false, ['Buyer', 'Sponsor']); assert.equal(personField.status, 201);
    const dealField = await define(owner, 'deal', 'Forecast score', 'number'); assert.equal(dealField.status, 201);
    assert.equal((await call(crmPost, 'POST', owner, { type: 'person', name: 'Wrong field', companyId: one.data.id, customValues: { [dealField.data.id]: 5 } })).status, 404);
    const person = await call(crmPost, 'POST', owner, { type: 'person', name: 'Fictional Person', companyId: one.data.id, customValues: { [personField.data.id]: 'Buyer' } }); assert.equal(person.status, 201);
    const deal = await call(crmPost, 'POST', owner, { type: 'deal', name: 'Fictional Deal', companyId: one.data.id, personId: person.data.id, stage: 'Lead', owner: 'Tester', currency: 'USD', valueCents: 100, customValues: { [dealField.data.id]: 75 } }); assert.equal(deal.status, 201);
    const otherValues = (await call(fieldsGet, 'GET', member)).data.values;
    assert.equal(otherValues.find((value: any) => value.fieldId === personField.data.id && value.recordId === person.data.id).value, 'Buyer');
    assert.equal(otherValues.find((value: any) => value.fieldId === dealField.data.id && value.recordId === deal.data.id).value, 75);
    const update = await call(fieldsPut, 'PUT', member, { objectType: 'company', recordId: two.data.id, version: 1, values: { [number.data.id]: 0 } }); assert.equal(update.status, 200); assert.equal(update.data.version, 2);
    assert.equal((await call(fieldsPut, 'PUT', owner, { objectType: 'company', recordId: two.data.id, version: 1, values: { [number.data.id]: 3 } })).status, 409);
    assert.equal((await call(fieldsPut, 'PUT', owner, { objectType: 'company', recordId: two.data.id, version: 2, values: { [required.data.id]: null } })).status, 400);
    assert.equal((await call(fieldsPut, 'PUT', owner, { objectType: 'company', recordId: two.data.id, version: 2, values: { [required.data.id]: 'AC-1' } })).status, 409);
    assert.equal((await call(fieldsPut, 'PUT', owner, { objectType: 'company', recordId: two.data.id, version: 2, values: { [email.data.id]: 'not-an-email' } })).status, 400);
    assert.equal((await call(fieldsPut, 'PUT', owner, { objectType: 'company', recordId: two.data.id, version: 2, values: { [select.data.id]: 'Starter' } })).status, 200);
    assert.equal((await call(fieldsPut, 'PUT', owner, { objectType: 'company', recordId: two.data.id, version: 3, values: { [select.data.id]: 'Starter' } })).data.version, 3);
    assert.equal((await call(fieldsPut, 'PUT', owner, { objectType: 'company', recordId: two.data.id, version: 3, values: { ['00000000-0000-0000-0000-000000000000']: 'injection' } })).status, 404);
    assert.equal((await call(fieldsPut, 'PUT', outsider, { objectType: 'company', recordId: one.data.id, version: 1, values: { [number.data.id]: 9 } })).status, 404);
    assert.equal((await call(fieldsGet, 'GET', { ...outsider, workspaceId: owner.workspaceId })).status, 404);
    assert.equal((await call(fieldsGet, 'GET', outsider)).data.fields.length, 0);
    assert.equal((await define(owner, 'company', 'Late required', 'text', true)).status, 409);
    assert.equal((await call(authPost, 'POST', owner, { action: 'setMember', email: member.email, role: 'Viewer' })).status, 200);
    assert.equal((await call(fieldsPut, 'PUT', member, { objectType: 'company', recordId: two.data.id, version: 3, values: { [number.data.id]: 4 } })).status, 403);
    assert.equal((await call(fieldsGet, 'GET', member)).status, 200);
    assert.equal((await call(fieldsPatch, 'PATCH', member, { action: 'archive', id: select.data.id })).status, 403);
    assert.equal((await call(fieldsPatch, 'PATCH', owner, { action: 'archive', id: select.data.id })).status, 200);
    const retained = await call(fieldsGet, 'GET', owner); assert.equal(retained.data.fields.find((field: any) => field.id === select.data.id).archivedAt !== null, true);
    assert.equal(retained.data.values.find((value: any) => value.fieldId === select.data.id && value.recordId === two.data.id).value, 'Starter');
    assert.equal((await call(fieldsPut, 'PUT', owner, { objectType: 'company', recordId: two.data.id, version: 3, values: { [select.data.id]: 'Growth' } })).status, 404);
    console.log('Custom field checks passed: typed values, required creation, uniqueness, archive retention, stale edits, role and workspace boundaries.');
  } finally {
    await client.query('DELETE FROM crm_custom_values WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM crm_custom_fields WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    for (const table of ['crm_notifications', 'record_changes', 'tasks', 'notes', 'deals', 'people', 'companies']) await client.query(`DELETE FROM ${table} WHERE workspace_id = ANY($1::uuid[])`, [workspaces]);
    await client.query('DELETE FROM crm_memberships WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM crm_workspaces WHERE id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM crm_sessions WHERE user_id = ANY($1::uuid[])', [users]);
    await client.query('DELETE FROM crm_users WHERE id = ANY($1::uuid[])', [users]);
    await client.end();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
