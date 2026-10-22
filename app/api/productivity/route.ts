import { NextResponse } from 'next/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../../server/db';
import { memberships, notifications, tasks, users } from '../../../server/schema';
import { AccessError, sameOrigin, workspaceAccess } from '../../../server/auth';
import { activeRecordIds } from '../../../server/record-lifecycle';

export const dynamic = 'force-dynamic';

function fail(error: unknown) {
  if (error instanceof AccessError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error('Productivity request failed', error);
  return NextResponse.json({ error: 'The workspace is unavailable. Try again.' }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const { workspaceId, user } = await workspaceAccess(request);
    const db = getDb();
    const [members, inbox, unreadTargets] = await Promise.all([
      db.select({ id: users.id, email: users.email, role: memberships.role }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(memberships.workspaceId, workspaceId)).orderBy(users.email),
      db.select({ id: notifications.id, kind: notifications.kind, taskId: tasks.id, taskTitle: tasks.title, targetType: tasks.targetType, targetId: tasks.targetId, createdAt: notifications.createdAt, readAt: notifications.readAt })
        .from(notifications).innerJoin(tasks, and(eq(tasks.id, notifications.taskId), eq(tasks.workspaceId, workspaceId)))
        .where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.recipientId, user.id)))
        .orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(200),
      db.select({ targetType: tasks.targetType, targetId: tasks.targetId }).from(notifications).innerJoin(tasks, and(eq(tasks.id, notifications.taskId), eq(tasks.workspaceId, workspaceId)))
        .where(and(eq(notifications.workspaceId, workspaceId), eq(notifications.recipientId, user.id), isNull(notifications.readAt))),
    ]);
    const visible = await activeRecordIds(workspaceId);
    const visibleInbox = inbox.filter(item => visible(item.targetType, item.targetId));
    return NextResponse.json({ members, notifications: visibleInbox, unreadCount: unreadTargets.filter(item => visible(item.targetType, item.targetId)).length });
  } catch (error) { return fail(error); }
}

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { workspaceId, user } = await workspaceAccess(request);
    let body: unknown;
    try {
      if (Number(request.headers.get('content-length')) > 1024) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
      const text = await request.text();
      if (text.length > 1024) return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
      body = JSON.parse(text);
    } catch { return NextResponse.json({ error: 'Provide a valid request.' }, { status: 400 }); }
    const rawId = body && typeof body === 'object' && 'id' in body ? body.id : null;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Choose a notification.' }, { status: 400 });
    const [saved] = await getDb().update(notifications).set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.workspaceId, workspaceId), eq(notifications.recipientId, user.id), isNull(notifications.readAt))).returning({ id: notifications.id, readAt: notifications.readAt });
    if (saved) return NextResponse.json(saved);
    const [existing] = await getDb().select({ id: notifications.id, readAt: notifications.readAt }).from(notifications).where(and(eq(notifications.id, id), eq(notifications.workspaceId, workspaceId), eq(notifications.recipientId, user.id))).limit(1);
    if (!existing) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    return NextResponse.json(existing);
  } catch (error) { return fail(error); }
}
