import assert from 'node:assert/strict';
import { Client } from 'pg';
import { POST as authPost, GET as authGet } from '../app/api/auth/route';
import { POST as crmPost, PATCH as crmPatch, GET as crmGet, DELETE as crmDelete } from '../app/api/crm/route';
import { GET as historyGet } from '../app/api/records/history/route';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const origin = 'http://localhost';
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const users: string[] = [], workspaces: string[] = [];
type Account = { cookie: string; workspaceId: string; email: string };
async function call(handler: (request: Request) => Promise<Response>, method: 'POST' | 'PATCH' | 'GET' | 'DELETE', account?: Account, body?: object, path = '/api/crm') {
  const response = await handler(new Request(`${origin}${path}`, { method, headers: { ...(body ? { origin, 'content-type': 'application/json' } : {}), ...(account ? { cookie: account.cookie, 'x-workspace-id': account.workspaceId } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: response.status, data: await response.json() as Record<string, any> };
}
async function register(label: string): Promise<Account> {
  const email = `${label}-${stamp}@example.test`;
  const response = await call(authPost, 'POST', undefined, { action: 'register', email, password: 'strong test password 123', workspaceName: label }, '/api/auth');
  assert.equal(response.status, 201);
  // The session is an HTTP-only cookie, so read it from the actual response.
  const raw = await authPost(new Request(`${origin}/api/auth`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'login', email, password: 'strong test password 123' }) }));
  assert.equal(raw.status, 200);
  const session = raw.headers.get('set-cookie')!.split(';')[0];
  const me = await call(authGet, 'GET', { cookie: session, workspaceId: '', email }, undefined, '/api/auth');
  users.push(me.data.user.id); workspaces.push(me.data.workspaces[0].id);
  return { cookie: session, workspaceId: me.data.workspaces[0].id, email };
}
async function main() {
  await client.connect();
  try {
    const owner = await register('edit-owner'), member = await register('edit-member');
    const grant = await call(authPost, 'POST', owner, { action: 'setMember', email: member.email, role: 'Member' }, '/api/auth');
    assert.equal(grant.status, 200);
    const second = { ...member, workspaceId: owner.workspaceId };
    const c1 = await call(crmPost, 'POST', owner, { type: 'company', name: 'One' });
    const c2 = await call(crmPost, 'POST', owner, { type: 'company', name: 'Two' });
    assert.equal(c1.status, 201); assert.equal(c2.status, 201);
    const [first, stale] = await Promise.all([
      call(crmPatch, 'PATCH', owner, { type: 'company', id: c1.data.id, version: 1, name: 'Owner edit' }),
      call(crmPatch, 'PATCH', second, { type: 'company', id: c1.data.id, version: 1, name: 'Member edit' }),
    ]);
    assert.deepEqual([first.status, stale.status].sort(), [200, 409]);
    const current = await call(crmGet, 'GET', owner);
    const company = current.data.companies.find((row: { id: number }) => row.id === c1.data.id);
    assert.equal(company.version, 2);
    assert.ok(['Owner edit', 'Member edit'].includes(company.name));
    const unchanged = await call(crmPatch, 'PATCH', owner, { type: 'company', id: c1.data.id, version: 2, name: company.name });
    assert.equal(unchanged.status, 200); assert.equal(unchanged.data.version, 2);
    const [domainA, domainB] = await Promise.all([
      call(crmPatch, 'PATCH', owner, { type: 'company', id: c1.data.id, version: 2, domain: 'Shared.TEST' }),
      call(crmPatch, 'PATCH', second, { type: 'company', id: c2.data.id, version: 1, domain: 'shared.test' }),
    ]);
    assert.deepEqual([domainA.status, domainB.status].sort(), [200, 409]);
    const [createdA, createdB] = await Promise.all([
      call(crmPost, 'POST', owner, { type: 'company', name: 'Third', domain: 'race.example' }),
      call(crmPost, 'POST', second, { type: 'company', name: 'Fourth', domain: 'RACE.EXAMPLE' }),
    ]);
    assert.deepEqual([createdA.status, createdB.status].sort(), [201, 409]);
    assert.equal((await call(crmPatch, 'PATCH', owner, { type: 'company', id: c2.data.id, version: domainB.status === 200 ? 2 : 1, domain: 'bad domain' })).status, 400);
    const p1 = await call(crmPost, 'POST', owner, { type: 'person', name: 'Person one', companyId: c1.data.id });
    const p2 = await call(crmPost, 'POST', owner, { type: 'person', name: 'Person two', companyId: c1.data.id });
    assert.equal(p1.status, 201); assert.equal(p2.status, 201);
    const [emailA, emailB] = await Promise.all([
      call(crmPatch, 'PATCH', owner, { type: 'person', id: p1.data.id, version: 1, email: 'SAM@EXAMPLE.TEST' }),
      call(crmPatch, 'PATCH', second, { type: 'person', id: p2.data.id, version: 1, email: 'sam@example.test' }),
    ]);
    assert.deepEqual([emailA.status, emailB.status].sort(), [200, 409]);
    const foreignCompany = await call(crmPost, 'POST', member, { type: 'company', name: 'Foreign company' });
    assert.equal(foreignCompany.status, 201);
    assert.equal((await call(crmPatch, 'PATCH', owner, { type: 'person', id: p1.data.id, version: emailA.status === 200 ? 2 : 1, companyId: foreignCompany.data.id })).status, 404);
    const deal = await call(crmPost, 'POST', owner, { type: 'deal', name: 'Opportunity', companyId: c1.data.id, personId: p1.data.id, stage: 'Lead', owner: 'Owner', valueCents: 100 });
    assert.equal(deal.status, 201);
    const updatedDeal = await call(crmPatch, 'PATCH', second, { type: 'deal', id: deal.data.id, version: 1, stage: 'Won', valueCents: 200 });
    assert.equal(updatedDeal.status, 200); assert.equal(updatedDeal.data.version, 2);
    assert.equal((await call(crmPatch, 'PATCH', owner, { type: 'deal', id: deal.data.id, version: 1, stage: 'Lost', lostReason: 'Old view' })).status, 409);
    assert.equal((await call(crmPatch, 'PATCH', owner, { type: 'person', id: p1.data.id, version: emailA.status === 200 ? 2 : 1, companyId: c2.data.id })).status, 409);
    const note = await call(crmPost, 'POST', owner, { type: 'note', targetType: 'deal', targetId: deal.data.id, body: 'Initial' });
    assert.equal(note.status, 201);
    const changedNote = await call(crmPatch, 'PATCH', owner, { type: 'note', id: note.data.id, version: 1, body: 'Updated' });
    assert.equal(changedNote.status, 200);
    assert.equal((await call(crmPatch, 'PATCH', second, { type: 'note', id: note.data.id, version: 1, body: 'Stale' })).status, 409);
    assert.equal((await call(crmDelete, 'DELETE', owner, { type: 'note', id: note.data.id, version: 1 })).status, 409);
    const history = await call(historyGet, 'GET', second, undefined, `/api/records/history?type=deal&id=${deal.data.id}`);
    assert.equal(history.status, 200); assert.equal(history.data.changes.length, 1);
    assert.equal(history.data.changes[0].changes.stage.to, 'Won'); assert.equal(history.data.changes[0].actorEmail, member.email);
    const noteHistory = await call(historyGet, 'GET', owner, undefined, `/api/records/history?type=note&id=${note.data.id}`);
    assert.equal(noteHistory.data.changes[0].changes.body.to, 'Updated');
    const companyHistory = await call(historyGet, 'GET', owner, undefined, `/api/records/history?type=company&id=${c1.data.id}`);
    assert.equal(companyHistory.data.changes.filter((entry: { changes: object }) => 'name' in entry.changes).length, 1);
    assert.equal((await call(historyGet, 'GET', member, undefined, `/api/records/history?type=deal&id=${deal.data.id}`)).status, 404);
    assert.equal((await call(crmPatch, 'PATCH', member, { type: 'company', id: c1.data.id, version: 2, name: 'Foreign' })).status, 404);
    assert.equal((await call(crmPatch, 'PATCH', member, { type: 'note', id: note.data.id, version: 2, body: 'Foreign' })).status, 404);
    assert.equal((await call(authPost, 'POST', owner, { action: 'setMember', email: member.email, role: 'Viewer' }, '/api/auth')).status, 200);
    assert.equal((await call(crmPatch, 'PATCH', second, { type: 'note', id: note.data.id, version: 2, body: 'Denied' })).status, 403);
    assert.equal((await call(crmDelete, 'DELETE', second, { type: 'note', id: note.data.id, version: 2 })).status, 403);
    assert.equal((await call(historyGet, 'GET', second, undefined, `/api/records/history?type=note&id=${note.data.id}`)).status, 200);
    console.log('Record edit checks passed: stale concurrent writes, canonical duplicate races, validation, links, history, workspace isolation, and Viewer denial.');
  } finally {
    if (workspaces.length) {
      for (const table of ['record_changes', 'tasks', 'notes', 'deals', 'people', 'companies']) await client.query(`DELETE FROM ${table} WHERE workspace_id = ANY($1::uuid[])`, [workspaces]);
      await client.query('DELETE FROM crm_memberships WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
      await client.query('DELETE FROM crm_workspaces WHERE id = ANY($1::uuid[])', [workspaces]);
    }
    if (users.length) { await client.query('DELETE FROM crm_sessions WHERE user_id = ANY($1::uuid[])', [users]); await client.query('DELETE FROM crm_users WHERE id = ANY($1::uuid[])', [users]); }
    await client.end();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
