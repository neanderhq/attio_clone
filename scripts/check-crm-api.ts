import assert from 'node:assert/strict';
import { Client } from 'pg';
import { GET as crmGet, POST as crmPost, PATCH as crmPatch, DELETE as crmDelete } from '../app/api/crm/route';
import { GET as authGet, POST as authPost } from '../app/api/auth/route';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const origin = 'http://localhost';
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
async function call(handler: (request: Request) => Promise<Response>, method: Method, body?: object, cookie = '', workspaceId = '') {
  const headers: Record<string,string> = { ...(body ? { origin, 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}) };
  const response = await handler(new Request(`${origin}/api/${handler === authGet || handler === authPost ? 'auth' : 'crm'}`, { method, headers, body: body ? JSON.stringify(body) : undefined }));
  return { response, data: await response.json() as Record<string,any> };
}
async function main() {
await client.connect();
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const emails = [`owner-${suffix}@example.test`, `viewer-${suffix}@example.test`];
const users: string[] = [], workspaces: string[] = [], companyIds: number[] = [];
try {
  assert.equal((await call(crmGet, 'GET')).response.status, 401);
  assert.equal((await call(crmPost, 'POST', { type: 'company', name: 'Anonymous' })).response.status, 401);
  assert.equal((await call(crmPatch, 'PATCH', { type: 'task', id: 1, done: true })).response.status, 401);
  assert.equal((await call(crmDelete, 'DELETE', { type: 'task', id: 1 })).response.status, 401);
  const register = async (email: string, name: string) => {
    const r = await call(authPost, 'POST', { action: 'register', email, password: 'a strong test password 123', workspaceName: name });
    assert.equal(r.response.status, 201);
    const cookie = r.response.headers.get('set-cookie')!.split(';')[0];
    const me = await call(authGet, 'GET', undefined, cookie);
    assert.equal(me.response.status, 200);
    users.push(me.data.user.id); workspaces.push(me.data.workspaces[0].id);
    return { cookie, workspaceId: me.data.workspaces[0].id };
  };
  const owner = await register(emails[0], 'Owner workspace');
  const viewer = await register(emails[1], 'Other workspace');
  assert.equal((await call(authPost, 'POST', { action: 'login', email: emails[0], password: 'wrong password' })).response.status, 401);
  const login = await call(authPost, 'POST', { action: 'login', email: emails[0], password: 'a strong test password 123' });
  assert.equal(login.response.status, 200);
  const loginCookie = login.response.headers.get('set-cookie')!.split(';')[0];
  assert.equal((await call(authGet, 'GET', undefined, loginCookie)).response.status, 200);
  const newWorkspace = await call(crmGet, 'GET', undefined, owner.cookie, owner.workspaceId);
  assert.equal(newWorkspace.response.status, 200); assert.equal(newWorkspace.data.companies.length, 0);
  const company = await call(crmPost, 'POST', { type: 'company', name: 'Isolated company' }, owner.cookie, owner.workspaceId);
  assert.equal(company.response.status, 201); companyIds.push(company.data.id);
  assert.equal((await call(crmGet, 'GET', undefined, viewer.cookie, owner.workspaceId)).response.status, 404);
  assert.equal((await call(crmPatch, 'PATCH', { type: 'deal', id: company.data.id, stage: 'Won' }, viewer.cookie, owner.workspaceId)).response.status, 404);
  const ownData = await call(crmGet, 'GET', undefined, viewer.cookie, viewer.workspaceId);
  assert.equal(ownData.response.status, 200); assert.equal(ownData.data.companies.length, 0);
  const grant = await call(authPost, 'POST', { action: 'setMember', email: emails[1], role: 'Viewer' }, owner.cookie, owner.workspaceId);
  assert.equal(grant.response.status, 200);
  const visible = await call(crmGet, 'GET', undefined, viewer.cookie, owner.workspaceId);
  assert.equal(visible.response.status, 200); assert.equal(visible.data.companies[0].id, company.data.id);
  assert.equal((await call(crmPost, 'POST', { type: 'company', name: 'Denied' }, viewer.cookie, owner.workspaceId)).response.status, 403);
  assert.equal((await call(crmPatch, 'PATCH', { type: 'task', id: 1, done: true }, viewer.cookie, owner.workspaceId)).response.status, 403);
  assert.equal((await call(crmDelete, 'DELETE', { type: 'task', id: 1 }, viewer.cookie, owner.workspaceId)).response.status, 403);
  assert.equal((await call(authPost, 'POST', { action: 'setMember', email: emails[0], role: 'Viewer' }, viewer.cookie, owner.workspaceId)).response.status, 403);
  assert.equal((await call(crmPost, 'POST', { type: 'person', name: 'Bad link', companyId: company.data.id }, viewer.cookie, viewer.workspaceId)).response.status, 409);
  assert.equal((await call(crmGet, 'GET', undefined, viewer.cookie, viewer.workspaceId)).data.people.length, 0);
  const memberGrant = await call(authPost, 'POST', { action: 'setMember', email: emails[1], role: 'Member' }, owner.cookie, owner.workspaceId);
  assert.equal(memberGrant.response.status, 200);
  const memberWrite = await call(crmPost, 'POST', { type: 'person', name: 'Member contact', companyId: company.data.id }, viewer.cookie, owner.workspaceId);
  assert.equal(memberWrite.response.status, 201);
  const deal = await call(crmPost, 'POST', { type: 'deal', name: 'Private opportunity', companyId: company.data.id, personId: memberWrite.data.id, stage: 'Lead', owner: 'Test', valueCents: 2500 }, owner.cookie, owner.workspaceId);
  assert.equal(deal.response.status, 201);
  const note = await call(crmPost, 'POST', { type: 'note', targetType: 'deal', targetId: deal.data.id, body: 'Test note' }, owner.cookie, owner.workspaceId);
  const task = await call(crmPost, 'POST', { type: 'task', targetType: 'deal', targetId: deal.data.id, title: 'Follow up' }, owner.cookie, owner.workspaceId);
  assert.equal(note.response.status, 201); assert.equal(task.response.status, 201);
  assert.equal((await call(crmPatch, 'PATCH', { type: 'deal', id: deal.data.id, version: deal.data.version, stage: 'Proposal' }, owner.cookie, owner.workspaceId)).response.status, 200);
  assert.equal((await call(crmPatch, 'PATCH', { type: 'task', id: task.data.id, version: task.data.version, done: true }, owner.cookie, owner.workspaceId)).response.status, 200);
  const records = await call(crmGet, 'GET', undefined, viewer.cookie, owner.workspaceId);
  assert.equal(records.data.deals[0].stage, 'Proposal'); assert.equal(records.data.tasks[0].done, true); assert.equal(records.data.notes[0].body, 'Test note');
  assert.equal((await call(crmDelete, 'DELETE', { type: 'note', id: note.data.id, version: note.data.version }, owner.cookie, owner.workspaceId)).response.status, 200);
  assert.equal((await call(crmDelete, 'DELETE', { type: 'task', id: task.data.id, version: task.data.version + 1 }, owner.cookie, owner.workspaceId)).response.status, 200);
  const privateCompany = await call(crmPost, 'POST', { type: 'company', name: 'Other private company' }, viewer.cookie, viewer.workspaceId);
  assert.equal(privateCompany.response.status, 201);
  assert.equal((await call(crmPost, 'POST', { type: 'person', name: 'Cross workspace link', companyId: privateCompany.data.id }, owner.cookie, owner.workspaceId)).response.status, 409);
  assert.equal((await call(crmGet, 'GET', undefined, owner.cookie, owner.workspaceId)).data.people.length, 1);
  const noOrigin = await crmPost(new Request(`${origin}/api/crm`, { method: 'POST', headers: { cookie: owner.cookie, 'x-workspace-id': owner.workspaceId }, body: JSON.stringify({ type: 'company', name: 'No origin' }) }));
  assert.equal(noOrigin.status, 403);
  console.log('Anonymous denial, sign-in, workspace isolation, Admin/Member/Viewer roles, and link isolation passed.');
} finally {
  if (workspaces.length) {
    await client.query('DELETE FROM record_changes WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM tasks WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM notes WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM deals WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM people WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM companies WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM crm_memberships WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM crm_workspaces WHERE id = ANY($1::uuid[])', [workspaces]);
  }
  if (users.length) { await client.query('DELETE FROM crm_sessions WHERE user_id = ANY($1::uuid[])', [users]); await client.query('DELETE FROM crm_users WHERE id = ANY($1::uuid[])', [users]); }
  await client.end();
}

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
