import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { workspaceAccess, AccessError } from '../../../server/auth';
import { getDb } from '../../../server/db';
import { deals, tasks } from '../../../server/schema';
import { currentReport } from '../../../server/reports';
import { activeRecordIds } from '../../../server/record-lifecycle';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) { try {
  const { workspaceId } = await workspaceAccess(request);
  const url = new URL(request.url), timeZone = url.searchParams.get('timeZone') || 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone }).format(); } catch { throw new AccessError('Choose a valid time zone.', 400); }
  if (timeZone.length > 100) throw new AccessError('Choose a valid time zone.', 400);
  const db = getDb();
  const [dealRows, taskRows] = await Promise.all([
    db.select().from(deals).where(and(eq(deals.workspaceId, workspaceId), isNull(deals.deletedAt))).limit(501),
    db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId)).limit(501),
  ]);
  if (dealRows.length > 500 || taskRows.length > 500) throw new AccessError('Reports require a workspace below the 500-record limit.', 409);
  const visible = await activeRecordIds(workspaceId);
  const activeTasks = taskRows.filter(task => visible(task.targetType, task.targetId));
  const report = currentReport(dealRows, activeTasks, timeZone);
  const metric = url.searchParams.get('metric');
  if (!metric) return NextResponse.json(report);
  const currency = url.searchParams.get('currency');
  const bucket = report.currencies.find(c => c.currency === currency);
  let dealIds: number[] = [], taskIds: number[] = [];
  if (metric === 'open' && bucket) dealIds = bucket.open.dealIds;
  else if (metric === 'wonMonth' && bucket) dealIds = bucket.wonThisMonth.dealIds;
  else if (metric === 'stage') {
    const stage = report.stages.find(s => s.stage === url.searchParams.get('stage'));
    if (!stage) throw new AccessError('Choose a valid stage.', 400);
    dealIds = stage.dealIds;
  } else if (metric === 'overdue') taskIds = report.overdue.taskIds;
  else throw new AccessError('Choose a valid report metric and currency.', 400);
  return NextResponse.json({ metric, currency: bucket?.currency || null, month: report.month, timeZone, deals: dealRows.filter(d => dealIds.includes(d.id)), tasks: activeTasks.filter(t => taskIds.includes(t.id)) });
} catch (error) {
  if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Report request failed', error);
  return NextResponse.json({ error: 'Reports are unavailable.' }, { status: 503 });
} }
