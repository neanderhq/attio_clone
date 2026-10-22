import assert from 'node:assert/strict';
import { Client } from 'pg';
import { GET as authGet, POST as authPost } from '../app/api/auth/route';
import { GET as crmGet, POST as crmPost } from '../app/api/crm/route';
import { GET as listsGet, POST as listsPost, PATCH as listsPatch, DELETE as listsDelete } from '../app/api/lists/route';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const origin = 'http://localhost';
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const users: string[] = [], workspaces: string[] = [];
async function call(handler: (r: Request) => Promise<Response>, method: string, body?: object, cookie = '', workspaceId = '', query = '') {
  const path = handler === authGet || handler === authPost ? 'auth' : handler === crmGet || handler === crmPost ? 'crm' : 'lists';
  const response = await handler(new Request(`${origin}/api/${path}${query}`, { method, headers: { ...(body ? { origin, 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: response.status, data: await response.json() as any, response };
}
async function register(label: string) {
  const email = `${label}-${suffix}@example.test`;
  const response = await call(authPost, 'POST', { action: 'register', email, password: 'strong test password 123', workspaceName: `${label} workspace` });
  assert.equal(response.status, 201);
  const cookie = response.response.headers.get('set-cookie')!.split(';')[0];
  const me = await call(authGet, 'GET', undefined, cookie);
  users.push(me.data.user.id); workspaces.push(me.data.workspaces[0].id);
  return { email, cookie, workspaceId: me.data.workspaces[0].id };
}
async function main() {
await client.connect();
try {
  assert.equal((await call(listsGet, 'GET')).status, 401);
  assert.equal((await call(listsPost, 'POST', { action: 'create', name: 'Public?', objectType: 'deal', visibility: 'shared' })).status, 401);
  const owner = await register('owner'), viewer = await register('viewer'), outsider = await register('outsider');
  const member = await call(authPost, 'POST', { action: 'setMember', email: viewer.email, role: 'Viewer' }, owner.cookie, owner.workspaceId);
  assert.equal(member.status, 200);
  const c = await call(crmPost, 'POST', { type: 'company', name: 'Fixture company' }, owner.cookie, owner.workspaceId);
  const p = await call(crmPost, 'POST', { type: 'person', name: 'Fixture person', companyId: c.data.id }, owner.cookie, owner.workspaceId);
  const d = await call(crmPost, 'POST', { type: 'deal', name: 'Fixture deal', companyId: c.data.id, personId: p.data.id, stage: 'Lead', owner: 'Fixture', valueCents: 100 }, owner.cookie, owner.workspaceId);
  assert.equal(d.status, 201);
  const makeList = async (name: string, visibility: string) => {
    const r = await call(listsPost, 'POST', { action: 'create', name, objectType: 'deal', visibility }, owner.cookie, owner.workspaceId);
    assert.equal(r.status, 201); return r.data.list.id as string;
  };
  const first = await makeList('Private process', 'private'), second = await makeList('Shared process', 'shared');
  const add = (listId: string, cookie = owner.cookie, workspaceId = owner.workspaceId, recordId = d.data.id) => call(listsPost, 'POST', { action: 'addEntry', listId, recordId }, cookie, workspaceId);
  const a = await add(first), b = await add(second);
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  assert.notEqual(a.data.entry.id, b.data.entry.id);
  assert.equal((await add(first)).status, 409);
  assert.equal((await call(listsGet, 'GET', undefined, viewer.cookie, owner.workspaceId, `?listId=${first}`)).status, 404);
  const viewerIndex = await call(listsGet, 'GET', undefined, viewer.cookie, owner.workspaceId);
  assert.deepEqual(viewerIndex.data.lists.map((l: any) => l.id), [second]);
  assert.equal((await call(listsGet, 'GET', undefined, outsider.cookie, outsider.workspaceId, `?listId=${second}`)).status, 404);
  assert.equal((await call(listsPost, 'POST', { action: 'addEntry', listId: second, recordId: d.data.id }, viewer.cookie, owner.workspaceId)).status, 403);
  assert.equal((await call(listsPatch, 'PATCH', { listId: second, entryId: b.data.entry.id, stage: 'Done', note: '' }, viewer.cookie, owner.workspaceId)).status, 403);
  assert.equal((await call(listsDelete, 'DELETE', { listId: second, entryId: b.data.entry.id }, viewer.cookie, owner.workspaceId)).status, 403);
  assert.equal((await call(listsPost, 'POST', { action: 'addEntry', listId: second, recordId: d.data.id }, outsider.cookie, outsider.workspaceId)).status, 404);
  const outsiderCompany = await call(crmPost, 'POST', { type: 'company', name: 'Outside company' }, outsider.cookie, outsider.workspaceId);
  assert.equal((await add(first, owner.cookie, owner.workspaceId, outsiderCompany.data.id)).status, 404);
  assert.equal((await call(listsPost, 'POST', { action: 'grant', listId: first, email: viewer.email, access: 'Reader' }, owner.cookie, owner.workspaceId)).status, 200);
  assert.equal((await call(listsGet, 'GET', undefined, viewer.cookie, owner.workspaceId, `?listId=${first}`)).status, 200);
  assert.equal((await call(listsPatch, 'PATCH', { listId: first, entryId: a.data.entry.id, stage: 'Done', note: 'Private' }, viewer.cookie, owner.workspaceId)).status, 403);
  assert.equal((await call(authPost, 'POST', { action: 'setMember', email: outsider.email, role: 'Member' }, owner.cookie, owner.workspaceId)).status, 200);
  assert.equal((await call(listsGet, 'GET', undefined, outsider.cookie, owner.workspaceId, `?listId=${first}`)).status, 404);
  assert.equal((await call(listsPost, 'POST', { action: 'grant', listId: first, email: outsider.email, access: 'Editor' }, owner.cookie, owner.workspaceId)).status, 200);
  assert.equal((await call(listsPatch, 'PATCH', { listId: first, entryId: a.data.entry.id, stage: 'In progress', note: 'Member edit' }, outsider.cookie, owner.workspaceId)).status, 200);
  assert.equal((await call(listsPost, 'POST', { action: 'grant', listId: first, email: viewer.email, access: 'Editor' }, outsider.cookie, owner.workspaceId)).status, 403);
  assert.equal((await call(listsPatch, 'PATCH', { listId: first, entryId: a.data.entry.id, stage: 'Done', note: 'Private' }, owner.cookie, owner.workspaceId)).status, 200);
  const firstReload = await call(listsGet, 'GET', undefined, owner.cookie, owner.workspaceId, `?listId=${first}`);
  const secondReload = await call(listsGet, 'GET', undefined, owner.cookie, owner.workspaceId, `?listId=${second}`);
  assert.equal(firstReload.data.entries[0].stage, 'Done');
  assert.equal(secondReload.data.entries[0].stage, 'New');
  assert.equal(secondReload.data.entries[0].record.stage, 'Lead');
  const viewId = firstReload.data.views.find((v: any) => v.kind === 'table').id;
  assert.equal((await call(listsPost, 'POST', { action: 'saveView', listId: first, viewId, config: { filterStage: '', sort: 'name', columns: ['name'] } }, viewer.cookie, owner.workspaceId)).status, 403);
  assert.equal((await call(listsPost, 'POST', { action: 'saveView', listId: first, viewId, config: { filterStage: 'Done', sort: 'newest', columns: ['name', 'stage'] } }, owner.cookie, owner.workspaceId)).status, 200);
  const saved = await call(listsGet, 'GET', undefined, owner.cookie, owner.workspaceId, `?listId=${first}`);
  assert.equal(saved.data.views.find((v: any) => v.id === viewId).config.filterStage, 'Done');
  assert.equal((await call(listsDelete, 'DELETE', { listId: first, entryId: a.data.entry.id }, owner.cookie, owner.workspaceId)).status, 200);
  assert.equal((await call(listsGet, 'GET', undefined, owner.cookie, owner.workspaceId, `?listId=${first}`)).data.entries.length, 0);
  assert.equal((await call(crmGet, 'GET', undefined, owner.cookie, owner.workspaceId)).data.deals.some((x: any) => x.id === d.data.id), true);
  assert.equal((await call(listsGet, 'GET', undefined, owner.cookie, owner.workspaceId, `?listId=${second}`)).data.entries.length, 1);
  console.log('Lists: private/shared access, grants, viewer denial, workspace isolation, unique entries, independent stages, saved view reload, and record-preserving removal passed.');
} finally {
  if (workspaces.length) {
    for (const table of ['crm_lists', 'tasks', 'notes', 'deals', 'people', 'companies']) await client.query(`DELETE FROM ${table} WHERE workspace_id = ANY($1::uuid[])`, [workspaces]);
    await client.query('DELETE FROM crm_memberships WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM crm_workspaces WHERE id = ANY($1::uuid[])', [workspaces]);
  }
  if (users.length) { await client.query('DELETE FROM crm_sessions WHERE user_id = ANY($1::uuid[])', [users]); await client.query('DELETE FROM crm_users WHERE id = ANY($1::uuid[])', [users]); }
  await client.end();
}
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
