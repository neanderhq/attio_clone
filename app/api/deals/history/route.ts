import { NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { AccessError, workspaceAccess } from '../../../../server/auth';
import { getDb } from '../../../../server/db';
import { deals, dealStageEvents, recordLifecycleEvents } from '../../../../server/schema';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) { try {
  const { workspaceId } = await workspaceAccess(request);
  const dealId = Number(new URL(request.url).searchParams.get('dealId'));
  if (!Number.isSafeInteger(dealId) || dealId < 1) throw new AccessError('Deal not found.', 404);
  const db = getDb();
  const [deal] = await db.select({ id: deals.id, createdAt: deals.createdAt, stage: deals.stage }).from(deals).where(and(eq(deals.id, dealId), eq(deals.workspaceId, workspaceId), isNull(deals.deletedAt))).limit(1);
  if (!deal) throw new AccessError('Deal not found.', 404);
  const events = await db.select().from(dealStageEvents).where(and(eq(dealStageEvents.dealId, dealId), eq(dealStageEvents.workspaceId, workspaceId))).orderBy(dealStageEvents.changedAt, dealStageEvents.id);
  const merges = await db.select({ sourceId: recordLifecycleEvents.recordId, details: recordLifecycleEvents.details }).from(recordLifecycleEvents).where(and(eq(recordLifecycleEvents.workspaceId, workspaceId), eq(recordLifecycleEvents.recordType, 'deal'), eq(recordLifecycleEvents.action, 'merge')));
  const mergedIds = new Set<number>();
  for (let changed = true; changed;) {
    changed = false;
    for (const merge of merges) if (typeof merge.details.targetId === 'number' && (merge.details.targetId === dealId || mergedIds.has(merge.details.targetId)) && !mergedIds.has(merge.sourceId)) { mergedIds.add(merge.sourceId); changed = true; }
  }
  const mergedEvents = mergedIds.size ? await db.select().from(dealStageEvents).where(and(eq(dealStageEvents.workspaceId, workspaceId), inArray(dealStageEvents.dealId, [...mergedIds]))).orderBy(dealStageEvents.changedAt, dealStageEvents.id) : [];
  return NextResponse.json({ events, mergedEvents, historyIncomplete: events.length === 0 || events[0].fromStage !== null });
} catch (error) {
  if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Deal history request failed', error);
  return NextResponse.json({ error: 'Deal history is unavailable.' }, { status: 503 });
} }
