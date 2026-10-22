import assert from 'node:assert/strict';
import { Client } from 'pg';
import { POST as authPost, GET as authGet } from '../app/api/auth/route';
import { GET as csvGet, POST as csvPost } from '../app/api/csv/route';
import { csvCell, parseCsv } from '../shared/csv';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const client = new Client({ connectionString: process.env.DATABASE_URL });
const origin = 'http://localhost';
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const users: string[] = [], workspaces: string[] = [];
async function register(label: string) {
  const email = `${label}-${stamp}@example.test`;
  const response = await authPost(new Request(`${origin}/api/auth`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'register', email, password: 'strong test password 123', workspaceName: label }) }));
  assert.equal(response.status, 201);
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  const me = await authGet(new Request(`${origin}/api/auth`, { headers: { cookie } }));
  const data = await me.json(); users.push(data.user.id); workspaces.push(data.workspaces[0].id);
  return { email, cookie, workspaceId: data.workspaces[0].id as string };
}
function csvRequest(account: { cookie: string; workspaceId: string }, type: string, csv: string, action = 'import', mode = 'upsert', mapping?: object) {
  const form = new FormData(); form.set('action', action); form.set('type', type); form.set('mode', mode);
  form.set('mapping', JSON.stringify(mapping || (type === 'companies' ? { domain: 'Domain', name: 'Name', description: 'Description' } : { email: 'Email', name: 'Name', companyDomain: 'Company' })));
  form.set('file', new File([csv], 'test.csv', { type: 'text/csv' }));
  return new Request(`${origin}/api/csv`, { method: 'POST', headers: { origin, cookie: account.cookie, 'x-workspace-id': account.workspaceId }, body: form });
}
async function main() {
  await client.connect();
  try {
    const a = await register('csv-a'), b = await register('csv-b');
    const companyCsv = 'Domain,Name,Description\r\nexample.test,"=HYPERLINK(\""bad\"" )",Safe\r\nexample.test,Second,Duplicate\r\nbad domain,Bad,Bad\r\n';
    const preview = await csvPost(csvRequest(a, 'companies', companyCsv, 'preview'));
    assert.equal(preview.status, 200); const previewData = await preview.json();
    assert.deepEqual(previewData.outcomes.map((x: { action: string }) => x.action), ['create', 'error', 'error']);
    const imported = await csvPost(csvRequest(a, 'companies', companyCsv));
    assert.equal(imported.status, 200); const result = await imported.json();
    assert.deepEqual(result.outcomes.map((x: { action: string }) => x.action), ['create', 'error', 'error']);
    const retry = await csvPost(csvRequest(a, 'companies', companyCsv, 'import', 'create-only'));
    assert.equal((await retry.json()).outcomes[0].action, 'unchanged');
    const companyId = result.outcomes[0].id;
    const exported = await csvGet(new Request(`${origin}/api/csv?type=companies`, { headers: { cookie: a.cookie, 'x-workspace-id': a.workspaceId } }));
    assert.equal(exported.status, 200); const text = await exported.text();
    assert.ok(text.includes("'=HYPERLINK")); assert.equal(parseCsv(text).rows.length, 1);
    for (const value of ['=1+1', '+1', '-1', '@SUM(1)', '  =1']) assert.ok(csvCell(value).startsWith('"\''));
    const updateOnly = await csvPost(csvRequest(a, 'companies', 'Domain,Name\r\nexample.test,Renamed\r\nmissing.test,Missing\r\n', 'import', 'update-only', { domain: 'Domain', name: 'Name' }));
    assert.deepEqual((await updateOnly.json()).outcomes.map((x: { action: string }) => x.action), ['update', 'error']);
    const upsertRetry = await csvPost(csvRequest(a, 'companies', 'Domain,Name\r\nexample.test,Renamed\r\n', 'import', 'upsert', { domain: 'Domain', name: 'Name' }));
    assert.equal((await upsertRetry.json()).outcomes[0].action, 'unchanged');
    const otherExport = await csvGet(new Request(`${origin}/api/csv?type=companies`, { headers: { cookie: b.cookie, 'x-workspace-id': b.workspaceId } }));
    assert.equal(parseCsv(await otherExport.text()).rows.length, 0);
    assert.equal((await csvGet(new Request(`${origin}/api/csv?type=companies`))).status, 401);
    assert.equal((await csvPost(csvRequest({ cookie: '', workspaceId: a.workspaceId }, 'companies', 'Domain,Name\nno.test,No', 'preview', 'upsert', { domain: 'Domain', name: 'Name' }))).status, 401);
    assert.equal((await csvGet(new Request(`${origin}/api/csv?type=companies`, { headers: { cookie: b.cookie, 'x-workspace-id': a.workspaceId } }))).status, 404);
    const personCsv = 'Email,Name,Company\r\nSAM@EXAMPLE.TEST,Sam,example.test\r\n';
    const peopleResult = await csvPost(csvRequest(a, 'people', personCsv)); assert.equal(peopleResult.status, 200);
    assert.equal((await peopleResult.json()).outcomes[0].action, 'create');
    const peopleRetry = await csvPost(csvRequest(a, 'people', personCsv)); assert.equal((await peopleRetry.json()).outcomes[0].action, 'unchanged');
    await client.query('INSERT INTO people (workspace_id,company_id,name,email) VALUES ($1,$2,$3,$4)', [a.workspaceId, companyId, 'Duplicate person', 'sam@example.test']);
    const peopleDuplicate = await csvPost(csvRequest(a, 'people', personCsv, 'preview'));
    assert.equal((await peopleDuplicate.json()).outcomes[0].action, 'error');
    await client.query('DELETE FROM people WHERE workspace_id=$1 AND name=$2', [a.workspaceId, 'Duplicate person']);
    const missingCompany = await csvPost(csvRequest(b, 'people', personCsv, 'preview'));
    assert.equal((await missingCompany.json()).outcomes[0].action, 'error');
    assert.equal((await csvPost(csvRequest(a, 'companies', 'Domain,Name\n"unfinished', 'preview', 'upsert', { domain: 'Domain', name: 'Name' }))).status, 400);
    const invalidUtf8 = new FormData(); invalidUtf8.set('action', 'preview'); invalidUtf8.set('type', 'companies'); invalidUtf8.set('mode', 'upsert'); invalidUtf8.set('mapping', JSON.stringify({ domain: 'Domain', name: 'Name' })); invalidUtf8.set('file', new File([new Uint8Array([0xff, 0xfe])], 'bad.csv'));
    assert.equal((await csvPost(new Request(`${origin}/api/csv`, { method: 'POST', headers: { origin, cookie: a.cookie, 'x-workspace-id': a.workspaceId }, body: invalidUtf8 }))).status, 400);
    const tooLarge = new FormData(); tooLarge.set('action', 'preview'); tooLarge.set('type', 'companies'); tooLarge.set('mode', 'upsert'); tooLarge.set('mapping', '{}'); tooLarge.set('file', new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.csv'));
    assert.equal((await csvPost(new Request(`${origin}/api/csv`, { method: 'POST', headers: { origin, cookie: a.cookie, 'x-workspace-id': a.workspaceId }, body: tooLarge }))).status, 413);
    assert.equal((await csvPost(csvRequest(a, 'companies', 'Domain,Name\nexample.test,Changed', 'preview', 'upsert', { domain: 'Domain', name: 'Missing' }))).status, 400);
    await client.query('INSERT INTO companies (workspace_id,domain,name) VALUES ($1,$2,$3)', [a.workspaceId, 'example.test', 'Duplicate candidate']);
    const duplicate = await csvPost(csvRequest(a, 'companies', 'Domain,Name\nexample.test,Changed', 'preview', 'upsert', { domain: 'Domain', name: 'Name' }));
    assert.equal((await duplicate.json()).outcomes[0].action, 'error');
    await client.query('DELETE FROM companies WHERE workspace_id=$1 AND domain=$2 AND id<>$3', [a.workspaceId, 'example.test', companyId]);
    const viewer = await register('csv-viewer');
    const grant = await authPost(new Request(`${origin}/api/auth`, { method: 'POST', headers: { origin, cookie: a.cookie, 'x-workspace-id': a.workspaceId, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'setMember', email: viewer.email, role: 'Viewer' }) }));
    assert.equal(grant.status, 200);
    const viewerAccount = { cookie: viewer.cookie, workspaceId: a.workspaceId };
    assert.equal((await csvPost(csvRequest(viewerAccount, 'companies', 'Domain,Name\nnew.test,New', 'import', 'upsert', { domain: 'Domain', name: 'Name' }))).status, 403);
    assert.equal((await csvGet(new Request(`${origin}/api/csv?type=companies`, { headers: { cookie: viewer.cookie, 'x-workspace-id': a.workspaceId } }))).status, 200);
    console.log('CSV checks passed: mapping, malformed and invalid rows, duplicate identities, formula safety, retries, workspace isolation, and Viewer denial.');
  } finally {
    if (workspaces.length) await client.query('DELETE FROM record_changes WHERE workspace_id = ANY($1::uuid[])', [workspaces]);
    for (const table of ['tasks', 'notes', 'deals', 'people', 'companies']) if (workspaces.length) await client.query(`DELETE FROM ${table} WHERE workspace_id = ANY($1::uuid[])`, [workspaces]);
    if (workspaces.length) { await client.query('DELETE FROM crm_memberships WHERE workspace_id = ANY($1::uuid[])', [workspaces]); await client.query('DELETE FROM crm_workspaces WHERE id = ANY($1::uuid[])', [workspaces]); }
    if (users.length) { await client.query('DELETE FROM crm_sessions WHERE user_id = ANY($1::uuid[])', [users]); await client.query('DELETE FROM crm_users WHERE id = ANY($1::uuid[])', [users]); }
    await client.end();
  }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
