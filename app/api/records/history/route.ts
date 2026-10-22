import { and, eq, isNull } from 'drizzle-orm';
import { AccessError, workspaceAccess } from '../../../../server/auth';
import { getDb } from '../../../../server/db';
import { companies, people, deals, notes, recordChanges, users } from '../../../../server/schema';
import { activeRecordIds } from '../../../../server/record-lifecycle';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const { workspaceId } = await workspaceAccess(request);
    const params = new URL(request.url).searchParams;
    const type = params.get('type');
    const id = Number(params.get('id'));
    if (type !== 'company' && type !== 'person' && type !== 'deal' && type !== 'note') return Response.json({ error: 'Choose a record type.' }, { status: 400 });
    if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: 'Choose a valid record.' }, { status: 400 });
    const table = { company: companies, person: people, deal: deals, note: notes }[type];
    const found = await getDb().select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.workspaceId, workspaceId))).limit(1);
    if (!found.length) return Response.json({ error: 'The record was not found.' }, { status: 404 });
    const visible = await activeRecordIds(workspaceId);
    if (type !== 'note' && !visible(type, id)) return Response.json({ error: 'The record was not found.' }, { status: 404 });
    if (type === 'note') {
      const [note] = await getDb().select({ targetType: notes.targetType, targetId: notes.targetId }).from(notes).where(and(eq(notes.id, id), eq(notes.workspaceId, workspaceId))).limit(1);
      if (!note || !visible(note.targetType, note.targetId)) return Response.json({ error: 'The record was not found.' }, { status: 404 });
    }
    const changes = await getDb().select({ id: recordChanges.id, actorEmail: users.email, changes: recordChanges.changes, changedAt: recordChanges.changedAt, version: recordChanges.version }).from(recordChanges).innerJoin(users, eq(recordChanges.actorId, users.id)).where(and(eq(recordChanges.workspaceId, workspaceId), eq(recordChanges.recordType, type), eq(recordChanges.recordId, id))).orderBy(recordChanges.id).limit(500);
    return Response.json({ changes }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
    console.error('Record history failed', error);
    return Response.json({ error: 'Record history is unavailable.' }, { status: 503 });
  }
}
