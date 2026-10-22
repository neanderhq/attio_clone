import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from './db';
import { memberships, sessions, users, workspaces } from './schema';

export type Role = 'Admin' | 'Member' | 'Viewer';
export class AccessError extends Error { constructor(message: string, public status: number) { super(message); } }
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  const protocol = request.headers.get('x-forwarded-proto') || url.protocol.slice(0, -1);
  if (!origin || origin !== `${protocol}://${host}`) throw new AccessError('Invalid request origin.', 403);
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function validPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected || expected.length !== 128) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export async function newSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await getDb().insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 14 * 86400_000) });
  return token;
}
export function sessionCookie(request: Request, token: string, remove = false) {
  const secure = new URL(request.url).protocol === 'https:' || process.env.NODE_ENV === 'production';
  return `ledger_session=${remove ? '' : token}; Path=/; HttpOnly; SameSite=Lax; ${secure ? 'Secure; ' : ''}Max-Age=${remove ? 0 : 14 * 86400}`;
}
export function tokenFrom(request: Request) {
  return request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('ledger_session='))?.slice(15) || '';
}
export async function currentUser(request: Request) {
  const token = tokenFrom(request);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AccessError('Sign in to continue.', 401);
  const found = await getDb().select({ id: users.id, email: users.email }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!found.length) throw new AccessError('Sign in to continue.', 401);
  return found[0];
}
export async function workspaceAccess(request: Request, write = false) {
  const user = await currentUser(request);
  const workspaceId = request.headers.get('x-workspace-id');
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) throw new AccessError('Choose a workspace.', 400);
  const found = await getDb().select({ role: memberships.role, name: workspaces.name }).from(memberships).innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id)).where(and(eq(memberships.userId, user.id), eq(memberships.workspaceId, workspaceId))).limit(1);
  if (!found.length) throw new AccessError('Workspace not found.', 404);
  if (write && found[0].role === 'Viewer') throw new AccessError('Viewers cannot change records.', 403);
  return { user, workspaceId, role: found[0].role as Role, workspaceName: found[0].name };
}
export async function signOut(request: Request) {
  const token = tokenFrom(request);
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
