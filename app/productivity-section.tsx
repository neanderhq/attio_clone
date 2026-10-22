'use client';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

export type Task = { id: number; version: number; targetType: string; targetId: number; title: string; dueDate: string | null; done: boolean; assigneeId: string | null; createdAt: string };
export type Member = { id: string; email: string; role: string };
type InboxItem = { id: number; kind: string; taskId: number; taskTitle: string; targetType: string; targetId: number; createdAt: string; readAt: string | null };
type Props = { mode: 'Tasks' | 'Notifications'; workspaceId: string; userId: string; tasks: Task[]; canWrite: boolean; recordName: (type: string, id: number) => string | undefined; openRecord: (type: 'company' | 'person' | 'deal', id: number) => void; onSaved: () => Promise<void> };

function localDate() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function bucket(task: Task, today: string) { return task.done ? 'Completed' : !task.dueDate ? 'No due date' : task.dueDate < today ? 'Overdue' : task.dueDate === today ? 'Today' : 'Upcoming'; }

export function TaskItem({ task, members, workspaceId, canWrite, recordName, openRecord, onSaved }: { task: Task; members: Member[]; workspaceId: string; canWrite: boolean; recordName: Props['recordName']; openRecord: Props['openRecord']; onSaved: Props['onSaved'] }) {
  const [title, setTitle] = useState(task.title), [dueDate, setDueDate] = useState(task.dueDate || ''), [assigneeId, setAssigneeId] = useState(task.assigneeId || ''), [done, setDone] = useState(task.done);
  const [version, setVersion] = useState(task.version), [state, setState] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle'), [message, setMessage] = useState(''), [conflict, setConflict] = useState(false);
  useEffect(() => { if (state === 'saved') { setTitle(task.title); setDueDate(task.dueDate || ''); setAssigneeId(task.assigneeId || ''); setDone(task.done); setVersion(task.version); } }, [task, state]);
  async function save(event: FormEvent) {
    event.preventDefault(); setState('pending'); setMessage('Saving…');
    try {
      const response = await fetch('/api/crm', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-workspace-id': workspaceId }, body: JSON.stringify({ type: 'task', id: task.id, version, title, dueDate, assigneeId, done }) });
      const result = await response.json();
      if (!response.ok) { if (response.status === 409) { setConflict(true); await onSaved(); } throw new Error(result.error || 'Could not save task.'); }
      setVersion(result.version); setConflict(false); setState('saved'); setMessage('Saved.'); await onSaved();
    } catch (error) { setState('error'); setMessage(error instanceof Error ? error.message : 'Could not save task.'); }
  }
  return <form className="productivity-task" onSubmit={save}>
    <label className="task-check"><input type="checkbox" checked={done} disabled={!canWrite || state === 'pending'} onChange={event => { setDone(event.target.checked); setState('idle'); }} /><span>Completed</span></label>
    <label className="field">Task<input required maxLength={160} value={title} disabled={!canWrite || state === 'pending'} onChange={event => { setTitle(event.target.value); setState('idle'); }} /></label>
    <label className="field">Due date<input type="date" value={dueDate} disabled={!canWrite || state === 'pending'} onChange={event => { setDueDate(event.target.value); setState('idle'); }} /></label>
    <label className="field">Assigned to<select value={assigneeId} disabled={!canWrite || state === 'pending'} onChange={event => { setAssigneeId(event.target.value); setState('idle'); }}><option value="">Unassigned</option>{members.map(member => <option value={member.id} key={member.id}>{member.email}</option>)}</select></label>
    <button type="button" className="textlink" onClick={() => openRecord(task.targetType as 'company' | 'person' | 'deal', task.targetId)}>{recordName(task.targetType, task.targetId) || 'Open record'}</button>
    {canWrite && <div className="productivity-actions"><button className="primary" disabled={state === 'pending' || conflict}>{state === 'pending' ? 'Saving…' : 'Save task'}</button>{conflict && <button type="button" onClick={() => { setVersion(task.version); setConflict(false); setMessage('Latest version loaded. Your draft is still here; review it before saving.'); }}>Load latest version, keep draft</button>}</div>}
    {message && <p role={state === 'error' ? 'alert' : 'status'} className={state === 'error' ? 'alert' : 'muted'}>{message}</p>}
  </form>;
}

export default function ProductivitySection({ mode, workspaceId, userId, tasks, canWrite, recordName, openRecord, onSaved }: Props) {
  const [members, setMembers] = useState<Member[]>([]), [inbox, setInbox] = useState<InboxItem[]>([]), [unreadCount, setUnreadCount] = useState(0), [error, setError] = useState(''), [pendingId, setPendingId] = useState<number | null>(null);
  const [scope, setScope] = useState<'My' | 'Team'>('My'), [period, setPeriod] = useState<'All' | 'Overdue' | 'Today' | 'Upcoming' | 'No due date' | 'Completed'>('All'), [query, setQuery] = useState('');
  const load = useCallback(async () => { try { const response = await fetch('/api/productivity', { headers: { 'x-workspace-id': workspaceId }, cache: 'no-store' }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not load workspace activity.'); setMembers(result.members); setInbox(result.notifications); setUnreadCount(result.unreadCount); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load workspace activity.'); } }, [workspaceId]);
  useEffect(() => { void load(); }, [load, tasks]);
  const today = localDate();
  const visible = useMemo(() => tasks.filter(task => (scope === 'Team' || task.assigneeId === userId) && (period === 'All' || bucket(task, today) === period) && `${task.title} ${recordName(task.targetType, task.targetId) || ''}`.toLowerCase().includes(query.toLowerCase().trim())), [tasks, scope, period, query, userId, today, recordName]);
  async function markRead(id: number) { setPendingId(id); try { const response = await fetch('/api/productivity', { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-workspace-id': workspaceId }, body: JSON.stringify({ id }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not mark notification read.'); await load(); await onSaved(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not mark notification read.'); } finally { setPendingId(null); } }
  return <section className="productivity-section"><div className="heading"><div><p className="eyebrow">WORKSPACE ACTIVITY</p><h1>{mode}</h1><p className="subtitle">{mode === 'Tasks' ? 'Assignments and follow-ups tied to your records.' : `${unreadCount} unread assignment ${unreadCount === 1 ? 'notification' : 'notifications'}.`}</p></div></div>
    {error && <p role="alert" className="alert">{error} <button onClick={() => void load()}>Retry</button></p>}
    {mode === 'Notifications' ? <div className="panel"><h2>Inbox</h2>{inbox.map(item => <div className="notification-row" key={item.id}><div><strong>{item.readAt ? 'Task assigned' : '● Task assigned'}</strong><p>{item.taskTitle}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div><button className="textlink" onClick={() => openRecord(item.targetType as 'company' | 'person' | 'deal', item.targetId)}>Open record</button>{!item.readAt && <button disabled={pendingId === item.id} onClick={() => void markRead(item.id)}>Mark read</button>}</div>)}{!inbox.length && <p className="empty">No notifications yet. Assignments from teammates will appear here.</p>}{inbox.length === 200 && <p className="muted">Showing the latest 200 notifications.</p>}</div>
      : <><div className="toolbar productivity-filters"><div className="segmented"><button className={scope === 'My' ? 'selected' : ''} onClick={() => setScope('My')}>My tasks</button><button className={scope === 'Team' ? 'selected' : ''} onClick={() => setScope('Team')}>Team tasks</button></div><label className="search">Search tasks<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title or record" /></label><label className="field">Due status<select value={period} onChange={event => setPeriod(event.target.value as typeof period)}>{['All', 'Overdue', 'Today', 'Upcoming', 'No due date', 'Completed'].map(value => <option key={value}>{value}</option>)}</select></label></div><div className="panel"><h2>{scope} tasks · {period}</h2>{visible.map(task => <TaskItem key={`${workspaceId}-${task.id}`} task={task} members={members} workspaceId={workspaceId} canWrite={canWrite} recordName={recordName} openRecord={openRecord} onSaved={onSaved} />)}{!visible.length && <p className="empty">{scope === 'My' && period === 'All' && !query ? 'No tasks assigned to you yet. Try Team tasks to see all workspace work.' : 'No tasks match this view.'}</p>}</div></>}
  </section>;
}
