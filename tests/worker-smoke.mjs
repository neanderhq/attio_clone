import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.POC_URL || 'http://localhost:18787';
const users = [];
for (const name of ['A', 'B']) {
  const response = await fetch(`${base}/api/auth`, {
    method: 'POST', headers: {Origin: base, 'Content-Type': 'application/json'},
    body: JSON.stringify({action: 'register', email: `poc-${randomUUID()}@example.test`, password: 'PocOnly-long-password-123', workspaceName: `POC ${name}`}),
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 201, await response.text());
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const profile = await fetch(`${base}/api/auth`, {headers: {cookie}, signal: AbortSignal.timeout(15000)});
  assert.equal(profile.status, 200, 'Authenticated follow-up request must succeed');
  users.push({cookie, profile: await profile.json()});
}
assert.notEqual(users[0].profile.workspaces[0].id, users[1].profile.workspaces[0].id);
const denied = await fetch(`${base}/api/crm`, {headers: {cookie: users[1].cookie, 'x-workspace-id': users[0].profile.workspaces[0].id}, signal: AbortSignal.timeout(15000)});
assert.equal(denied.status, 404, 'User B must not read user A workspace');
assert.equal((await denied.json()).error, 'Workspace not found.');
const headersFor = user => ({Origin: base, cookie: user.cookie, 'Content-Type': 'application/json', 'x-workspace-id': user.profile.workspaces[0].id});
const created = await fetch(`${base}/api/crm`, {method: 'POST', headers: headersFor(users[0]), body: JSON.stringify({type: 'company', name: 'Private A company'}), signal: AbortSignal.timeout(15000)});
assert.equal(created.status, 201, await created.text());
for (const [index, user] of users.entries()) {
  const response = await fetch(`${base}/api/crm`, {headers: headersFor(user), signal: AbortSignal.timeout(15000)});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.companies.some(c => c.name === 'Private A company'), index === 0);
}
const writeDenied = await fetch(`${base}/api/crm`, {method: 'POST', headers: {...headersFor(users[1]), 'x-workspace-id': users[0].profile.workspaces[0].id}, body: JSON.stringify({type: 'company', name: 'Forbidden'}), signal: AbortSignal.timeout(15000)});
assert.equal(writeDenied.status, 404);
console.log('PASS: sequential users, authenticated follow-up, independent workspaces, cross-user read rejected');
