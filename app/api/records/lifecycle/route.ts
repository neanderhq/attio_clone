import { NextResponse } from 'next/server';
import { AccessError, sameOrigin, workspaceAccess } from '../../../../server/auth';
import { getDb } from '../../../../server/db';
import { recordLifecycleEvents, users } from '../../../../server/schema';
import { and, eq, or, sql } from 'drizzle-orm';
import { LifecycleError, mergeRecords, previewMerge, recordId, recordType, recordVersion, resolveRecord, restoreRecord, softDelete, trashRecords, type Resolution } from '../../../../server/record-lifecycle';

export const dynamic = 'force-dynamic';
function fail(error: unknown) {
  if (error instanceof AccessError || error instanceof LifecycleError) return NextResponse.json({ error: error.message }, { status: error.status });
  const cause = error && typeof error === 'object' && 'cause' in error ? error.cause : error;
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : null;
  if (code === '40001') return NextResponse.json({ error: 'These records changed. Review a fresh merge preview.' }, { status: 409 });
  if (code === '23505') return NextResponse.json({ error: 'An identity or list entry now conflicts. Review the records and try again.' }, { status: 409 });
  console.error('Record lifecycle request failed', error);
  return NextResponse.json({ error: 'This record change is unavailable. Try again.' }, { status: 503 });
}
async function bodyOf(request: Request) {
  const raw = await request.text();
  if (raw.length > 16_384) throw new LifecycleError('Form is too large.', 413);
  try { const body: unknown = JSON.parse(raw); if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>; } catch { /* invalid JSON */ }
  throw new LifecycleError('Provide a valid JSON form.');
}
export async function GET(request: Request) { try {
  const access = await workspaceAccess(request);
  const params = new URL(request.url).searchParams;
  if (params.get('action') === 'resolve') return NextResponse.json(await resolveRecord(access.workspaceId, recordType(params.get('type')), recordId(params.get('id'))));
  if (params.get('action') === 'history') {
    const type = recordType(params.get('type')), id = recordId(params.get('id'));
    await resolveRecord(access.workspaceId, type, id);
    const events = await getDb().select({ id: recordLifecycleEvents.id, action: recordLifecycleEvents.action, recordId: recordLifecycleEvents.recordId, details: recordLifecycleEvents.details, createdAt: recordLifecycleEvents.createdAt, actorEmail: users.email }).from(recordLifecycleEvents).innerJoin(users, eq(recordLifecycleEvents.actorId, users.id))
      .where(and(eq(recordLifecycleEvents.workspaceId, access.workspaceId), eq(recordLifecycleEvents.recordType, type), or(eq(recordLifecycleEvents.recordId, id), sql`${recordLifecycleEvents.details}->>'targetId' = ${String(id)}`))).orderBy(recordLifecycleEvents.id).limit(500);
    return NextResponse.json({ events });
  }
  if (params.get('action') === 'trash') {
    if (access.role === 'Viewer') throw new AccessError('Viewers cannot inspect deleted records.', 403);
    return NextResponse.json({ records: await trashRecords(access.workspaceId) });
  }
  throw new LifecycleError('Choose a record action.');
} catch (error) { return fail(error); } }
export async function POST(request: Request) { try {
  sameOrigin(request);
  const access = await workspaceAccess(request, true);
  const body = await bodyOf(request), type = recordType(body.type);
  if (body.action === 'previewMerge' || body.action === 'merge') {
    const sourceId = recordId(body.sourceId), targetId = recordId(body.targetId);
    if (body.action === 'previewMerge') {
      const result = await getDb().transaction(tx => previewMerge(tx, access.workspaceId, access.user.id, type, sourceId, targetId));
      const { source, target, entries, values, byList, byField, ...publicResult } = result;
      return NextResponse.json(publicResult);
    }
    if (typeof body.snapshot !== 'string' || !/^[0-9a-f]{64}$/.test(body.snapshot) || !body.resolutions || typeof body.resolutions !== 'object' || Array.isArray(body.resolutions)) throw new LifecycleError('Review the merge and resolve its conflicts first.');
    return NextResponse.json(await mergeRecords(access.workspaceId, access.user.id, type, sourceId, targetId, body.snapshot, body.resolutions as Record<string, Resolution>));
  }
  if (body.action === 'restore') return NextResponse.json(await restoreRecord(access.workspaceId, access.user.id, type, recordId(body.id), recordVersion(body.version)));
  throw new LifecycleError('Choose a record action.');
} catch (error) { return fail(error); } }
export async function DELETE(request: Request) { try {
  sameOrigin(request);
  const access = await workspaceAccess(request, true);
  const body = await bodyOf(request);
  return NextResponse.json(await softDelete(access.workspaceId, access.user.id, recordType(body.type), recordId(body.id), recordVersion(body.version)));
} catch (error) { return fail(error); } }
