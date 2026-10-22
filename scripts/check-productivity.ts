import assert from 'node:assert/strict';
import { Client } from 'pg';
import { POST as authPost, GET as authGet } from '../app/api/auth/route';
import { POST as crmPost, PATCH as crmPatch, GET as crmGet, DELETE as crmDelete } from '../app/api/crm/route';
import { GET as productivityGet, PATCH as productivityPatch } from '../app/api/productivity/route';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const origin = 'http://localhost';
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const users: string[] = [], workspaces: string[] = [];
type Account = { cookie: string; workspaceId: string; id: string; email: string };
async function call(handler: (request: Request) => Promise<Response>, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', account?: Account, body?: object) {
  const path = handler === productivityGet || handler === productivityPatch ? '/api/productivity' : handler === authPost || handler === authGet ? '/api/auth' : '/api/crm';
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
    const owner = await register('product-owner'), teammate = await register('product-teammate'), outsider = await register('product-outsider');
    assert.equal((await call(authPost, 'POST', owner, { action: 'setMember', email: teammate.email, role: 'Member' })).status, 200);
    const member = { ...teammate, workspaceId: owner.workspaceId };
    const company = await call(crmPost, 'POST', owner, { type: 'company', name: 'Fictional company' });
    assert.equal(company.status, 201);
    const foreign = await call(crmPost, 'POST', outsider, { type: 'company', name: 'Foreign company' });
    assert.equal(foreign.status, 201);
    assert.equal((await call(crmPost, 'POST', owner, { type: 'task', targetType: 'company', targetId: foreign.data.id, title: 'Foreign link', assigneeId: teammate.id })).status, 404);
    assert.equal((await call(crmPost, 'POST', owner, { type: 'task', targetType: 'company', targetId: company.data.id, title: 'Foreign assignee', assigneeId: outsider.id })).status, 404);
    const task = await call(crmPost, 'POST', owner, { type: 'task', targetType: 'company', targetId: company.data.id, title: 'Call customer', dueDate: '2026-10-22', assigneeId: teammate.id });
    assert.equal(task.status, 201); assert.equal(task.data.version, 1);
    let inbox = await call(productivityGet, 'GET', member);
    assert.equal(inbox.status, 200); assert.equal(inbox.data.unreadCount, 1); assert.equal(inbox.data.notifications.length, 1);
    assert.equal(inbox.data.notifications[0].taskId, task.data.id);
    assert.equal((await call(productivityGet, 'GET', owner)).data.notifications.length, 0);
    assert.equal((await call(productivityGet, 'GET', outsider)).data.notifications.length, 0);
    const notificationId = inbox.data.notifications[0].id;
    assert.equal((await call(productivityPatch, 'PATCH', owner, { id: notificationId })).status, 404);
    assert.equal((await call(productivityPatch, 'PATCH', outsider, { id: notificationId })).status, 404);
    assert.equal((await call(productivityPatch, 'PATCH', member, { id: notificationId })).status, 200);
    assert.equal((await call(productivityPatch, 'PATCH', member, { id: notificationId })).status, 200);
    inbox = await call(productivityGet, 'GET', member);
    assert.equal(inbox.data.unreadCount, 0); assert.ok(inbox.data.notifications[0].readAt);
    const [first, stale] = await Promise.all([
      call(crmPatch, 'PATCH', owner, { type: 'task', id: task.data.id, version: 1, done: true }),
      call(crmPatch, 'PATCH', member, { type: 'task', id: task.data.id, version: 1, title: 'Conflicting edit' }),
    ]);
    assert.deepEqual([first.status, stale.status].sort(), [200, 409]);
    const current = (await call(crmGet, 'GET', owner)).data.tasks.find((item: { id: number }) => item.id === task.data.id);
    assert.equal(current.version, 2);
    assert.equal(current.done, first.status === 200);
    assert.equal((await call(crmPatch, 'PATCH', owner, { type: 'task', id: task.data.id, version: 2, done: current.done })).data.version, 2);
    assert.equal((await call(productivityGet, 'GET', member)).data.notifications.length, 1);
    assert.equal((await call(crmPatch, 'PATCH', owner, { type: 'task', id: task.data.id, version: 2, assigneeId: owner.id })).status, 200);
    assert.equal((await call(productivityGet, 'GET', owner)).data.notifications.length, 0);
    assert.equal((await call(crmPatch, 'PATCH', owner, { type: 'task', id: task.data.id, version: 3, assigneeId: teammate.id })).status, 200);
    assert.equal((await call(productivityGet, 'GET', member)).data.notifications.length, 2);
    assert.equal((await call(crmPatch, 'PATCH', owner, { type: 'task', id: task.data.id, version: 4, assigneeId: teammate.id })).data.version, 4);
    assert.equal((await call(productivityGet, 'GET', member)).data.notifications.length, 2);
    const completed = await call(crmPatch, 'PATCH', owner, { type: 'task', id: task.data.id, version: 4, done: true });
    assert.equal(completed.status, 200); assert.equal(completed.data.done, true);
    assert.equal((await call(crmGet, 'GET', member)).data.tasks.find((item: { id: number }) => item.id === task.data.id).done, true);
    assert.equal((await call(productivityGet, 'GET', member)).data.notifications.length, 2);
    const latestVersion = completed.data.version;
    assert.equal((await call(crmPatch, 'PATCH', outsider, { type: 'task', id: task.data.id, version: latestVersion, done: true })).status, 404);
    assert.equal((await call(productivityGet, 'GET', { ...outsider, workspaceId: owner.workspaceId })).status, 404);
    assert.equal((await call(authPost, 'POST', owner, { action: 'setMember', email: teammate.email, role: 'Viewer' })).status, 200);
    assert.equal((await call(crmPatch, 'PATCH', member, { type: 'task', id: task.data.id, version: latestVersion, done: true })).status, 403);
    assert.equal((await call(crmPost, 'POST', member, { type: 'task', targetType: 'company', targetId: company.data.id, title: 'Denied' })).status, 403);
    assert.equal((await call(crmDelete, 'DELETE', member, { type: 'task', id: task.data.id, version: latestVersion })).status, 403);
    assert.equal((await call(productivityGet, 'GET', member)).status, 200);
    const latestNotice = (await call(productivityGet, 'GET', member)).data.notifications.find((item: { readAt: string | null }) => !item.readAt);
    assert.equal((await call(productivityPatch, 'PATCH', member, { id: latestNotice.id })).status, 200);
    assert.equal((await call(productivityGet, 'GET', member)).data.unreadCount, 0);
    assert.equal((await call(crmDelete, 'DELETE', owner, { type: 'task', id: task.data.id, version: 3 })).status, 409);
    assert.equal((await call(crmDelete, 'DELETE', owner, { type: 'task', id: task.data.id, version: latestVersion })).status, 200);
    console.log('Productivity checks passed: assignment notifications, self suppression, read privacy, stale task writes, completion, Viewer denial, and workspace isolation.');
  } finally {
    for (const table of ['crm_notifications', 'record_changes', 'tasks', 'notes', 'deals', 'people', 'companies']) await client.query(`DELETE FROM ${table} WHERE workspace_id = ANY($1::uuid[])`, [workspaces]);
    await client.query('DELETE FROM crm_memberships WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM crm_workspaces WHERE id = ANY($1::uuid[])', [workspaces]);
    await client.query('DELETE FROM crm_sessions WHERE user_id = ANY($1::uuid[])', [users]);
    await client.query('DELETE FROM crm_users WHERE id = ANY($1::uuid[])', [users]);
    await client.end();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
