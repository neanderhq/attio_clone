import assert from 'node:assert/strict';
import { Client } from 'pg';
import { POST as authPost, GET as authGet } from '../app/api/auth/route';
import { POST as crmPost, PATCH as crmPatch } from '../app/api/crm/route';
import { GET as reportsGet } from '../app/api/reports/route';
import { GET as historyGet } from '../app/api/deals/history/route';
import { currentReport } from '../server/reports';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const origin = 'http://localhost';
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const users: string[] = [], workspaces: string[] = [];
async function call(handler: (r: Request) => Promise<Response>, path: string, method: string, body?: object, cookie = '', workspaceId = '', query = '') {
  const r = await handler(new Request(`${origin}/api/${path}${query}`, { method, headers: { ...(body ? { origin, 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: r.status, data: await r.json() as any, response: r };
}
async function register(label: string) {
  const email = `${label}-${stamp}@example.test`;
  const r = await call(authPost, 'auth', 'POST', { action: 'register', email, password: 'strong test password 123', workspaceName: label });
  assert.equal(r.status, 201);
  const cookie = r.response.headers.get('set-cookie')!.split(';')[0];
  const me = await call(authGet, 'auth', 'GET', undefined, cookie);
  users.push(me.data.user.id); workspaces.push(me.data.workspaces[0].id);
  return { email, cookie, workspaceId: me.data.workspaces[0].id as string };
}
async function main() {
  await client.connect();
  try {
    assert.equal((await call(reportsGet, 'reports', 'GET')).status, 401);
    const owner = await register('report-owner'), other = await register('report-other');
    assert.equal((await call(authPost, 'auth', 'POST', { action: 'setMember', email: other.email, role: 'Viewer' }, owner.cookie, owner.workspaceId)).status, 200);
    const c = await call(crmPost, 'crm', 'POST', { type: 'company', name: 'Report company' }, owner.cookie, owner.workspaceId);
    const p = await call(crmPost, 'crm', 'POST', { type: 'person', name: 'Report person', companyId: c.data.id }, owner.cookie, owner.workspaceId);
    const add = async (name: string, currency: string, valueCents: number) => {
      const r = await call(crmPost, 'crm', 'POST', { type: 'deal', name, companyId: c.data.id, personId: p.data.id, stage: 'Lead', owner: 'Test', currency, valueCents }, owner.cookie, owner.workspaceId);
      assert.equal(r.status, 201); return r.data.id as number;
    };
    const usd = await add('USD deal', 'USD', 10000), eur = await add('EUR deal', 'EUR', 20000);
    assert.equal((await call(crmPatch, 'crm', 'PATCH', { type: 'deal', id: usd, version: 1, stage: 'Lost' }, owner.cookie, owner.workspaceId)).status, 400);
    assert.equal((await call(crmPatch, 'crm', 'PATCH', { type: 'deal', id: usd, version: 1, stage: 'Won' }, owner.cookie, owner.workspaceId)).status, 200);
    assert.equal((await call(crmPatch, 'crm', 'PATCH', { type: 'deal', id: usd, version: 2, stage: 'Lead' }, owner.cookie, owner.workspaceId)).status, 200);
    const lost = await call(crmPatch, 'crm', 'PATCH', { type: 'deal', id: usd, version: 3, stage: 'Lost', lostReason: 'Budget changed' }, owner.cookie, owner.workspaceId);
    assert.equal(lost.status, 200); assert.equal(lost.data.wonClosedAt, null); assert.equal(lost.data.lostReason, 'Budget changed');
    assert.equal((await call(crmPatch, 'crm', 'PATCH', { type: 'deal', id: usd, version: 4, stage: 'Won' }, owner.cookie, owner.workspaceId)).status, 200);
    assert.equal((await call(crmPatch, 'crm', 'PATCH', { type: 'deal', id: usd, version: 5, stage: 'Won' }, owner.cookie, owner.workspaceId)).status, 200);
    const events = await client.query('SELECT from_stage,to_stage,lost_reason FROM deal_stage_events WHERE deal_id=$1 ORDER BY id', [usd]);
    assert.deepEqual(events.rows.map(x => x.to_stage), ['Lead', 'Won', 'Lead', 'Lost', 'Won']);
    assert.equal(events.rows[3].lost_reason, 'Budget changed');
    const report = await call(reportsGet, 'reports', 'GET', undefined, owner.cookie, owner.workspaceId, '?timeZone=UTC');
    assert.equal(report.status, 200);
    assert.equal(report.data.currencies.find((x: any) => x.currency === 'USD').open.valueCents, 0);
    assert.equal(report.data.currencies.find((x: any) => x.currency === 'EUR').open.valueCents, 20000);
    assert.equal(report.data.currencies.find((x: any) => x.currency === 'USD').wonThisMonth.valueCents, 10000);
    assert.equal('lists' in report.data, false);
    const won = await call(reportsGet, 'reports', 'GET', undefined, owner.cookie, owner.workspaceId, '?timeZone=UTC&metric=wonMonth&currency=USD');
    assert.deepEqual(won.data.deals.map((x: any) => x.id), [usd]);
    assert.equal(won.data.deals.reduce((n: number, d: any) => n + d.valueCents, 0), report.data.currencies.find((x: any) => x.currency === 'USD').wonThisMonth.valueCents);
    const stageRows = await call(reportsGet, 'reports', 'GET', undefined, owner.cookie, owner.workspaceId, '?metric=stage&stage=Lead');
    assert.equal(stageRows.data.deals.length, report.data.stages.find((x: any) => x.stage === 'Lead').count);
    const open = await call(reportsGet, 'reports', 'GET', undefined, other.cookie, owner.workspaceId, '?metric=open&currency=EUR');
    assert.equal(open.status, 200); assert.deepEqual(open.data.deals.map((x: any) => x.id), [eur]);
    const otherReport = await call(reportsGet, 'reports', 'GET', undefined, other.cookie, other.workspaceId);
    assert.equal(otherReport.data.currencies.length, 0);
    assert.equal((await call(reportsGet, 'reports', 'GET', undefined, owner.cookie, other.workspaceId, '?metric=stage&stage=Lead')).status, 404);
    const history = await call(historyGet, 'deals/history', 'GET', undefined, owner.cookie, owner.workspaceId, `?dealId=${usd}`);
    assert.equal(history.status, 200); assert.equal(history.data.events.length, 5); assert.equal(history.data.historyIncomplete, false);
    assert.equal((await call(historyGet, 'deals/history', 'GET', undefined, other.cookie, other.workspaceId, `?dealId=${usd}`)).status, 404);
    assert.equal((await call(reportsGet, 'reports', 'GET', undefined, owner.cookie, owner.workspaceId, '?timeZone=Invalid/Zone')).status, 400);
    const task = await call(crmPost, 'crm', 'POST', { type: 'task', targetType: 'deal', targetId: usd, title: 'Overdue task', dueDate: '2020-01-01' }, owner.cookie, owner.workspaceId);
    assert.equal(task.status, 201);
    const taskReport = await call(reportsGet, 'reports', 'GET', undefined, owner.cookie, owner.workspaceId, '?metric=overdue&timeZone=UTC');
    assert.deepEqual(taskReport.data.tasks.map((x: any) => x.id), [task.data.id]);
    const boundary = [{ id: 1, name: 'Boundary', stage: 'Won', currency: 'USD', valueCents: 123, wonClosedAt: new Date('2026-03-01T00:30:00Z') }];
    assert.equal(currentReport(boundary, [], 'UTC', new Date('2026-03-01T01:00:00Z')).currencies[0].wonThisMonth.count, 1);
    assert.equal(currentReport(boundary, [], 'America/Los_Angeles', new Date('2026-03-01T01:00:00Z')).currencies[0].wonThisMonth.count, 1);
    assert.equal(currentReport(boundary, [], 'Asia/Kolkata', new Date('2026-02-28T18:00:00Z')).currencies[0].wonThisMonth.count, 0);
    assert.equal(currentReport(boundary, [], 'Asia/Kolkata', new Date('2026-02-28T19:00:00Z')).currencies[0].wonThisMonth.count, 1);
    assert.equal(currentReport(boundary, [], 'UTC', new Date('2026-03-01T01:00:00Z')).month, '2026-03');
    assert.equal(currentReport(boundary, [], 'America/Los_Angeles', new Date('2026-03-01T01:00:00Z')).month, '2026-02');
    assert.equal(currentReport([], [{ id: 1, title: 'Due yesterday', targetType: 'deal', targetId: usd, dueDate: '2026-02-28', done: false }], 'UTC', new Date('2026-03-01T01:00:00Z')).overdue.count, 1);
    console.log('Reports: transition history and reopening, lost reason, currency separation, timezone month boundaries, workspace access, and drilldown reconciliation passed.');
  } finally {
    for (const table of ['record_changes', 'tasks', 'notes', 'deals', 'people', 'companies']) if (workspaces.length) await client.query(`DELETE FROM ${table} WHERE workspace_id = ANY($1::uuid[])`, [workspaces]);
    if (workspaces.length) { await client.query('DELETE FROM crm_memberships WHERE workspace_id = ANY($1::uuid[])', [workspaces]); await client.query('DELETE FROM crm_workspaces WHERE id = ANY($1::uuid[])', [workspaces]); }
    if (users.length) { await client.query('DELETE FROM crm_sessions WHERE user_id = ANY($1::uuid[])', [users]); await client.query('DELETE FROM crm_users WHERE id = ANY($1::uuid[])', [users]); }
    await client.end();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
