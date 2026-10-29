'use client';
import { useCallback, useEffect, useState } from 'react';

import { Dialog } from './workspace-ui';

type RecordType = 'company' | 'person' | 'deal';
type Item = { id: number; name: string; version: number };
type Conflict = { key: string; label: string; source: unknown; target: unknown };
type Preview = { type: RecordType; sourceId: number; targetId: number; sourceName: string; targetName: string; snapshot: string; conflicts: Conflict[]; links: Record<string, number>; lists: { id: string; name: string; source: unknown; target: unknown }[]; notesAndTasks: { notes: number; tasks: number } };
async function request(workspaceId: string, method: 'POST' | 'DELETE', body: object) {
  const response = await fetch('/api/records/lifecycle', { method, headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Record change failed.');
  return data;
}
const show = (value: unknown) => value === null ? 'Empty' : typeof value === 'object' ? JSON.stringify(value) : String(value);
export function RecordLifecycle({ workspaceId, type, record, records, onChanged, onRemoved, onMerged }: { workspaceId: string; type: RecordType; record: Item; records: Item[]; onChanged: () => Promise<void>; onRemoved: () => void; onMerged: (id: number) => void }) {
  const [deleteOpen,setDeleteOpen]=useState(false);
  const [targetId, setTargetId] = useState(''), [preview, setPreview] = useState<Preview | null>(null), [resolutions, setResolutions] = useState<Record<string, 'source' | 'target'>>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Record change failed.'); } finally { setBusy(false); } }
  return <details className="disclosure"><summary>Merge or move to Trash</summary><p className="muted">Merging keeps the surviving record and moves notes, tasks, links and list entries. Review every conflict before confirming.</p>
    <label className="field">Merge this record into<select value={targetId} onChange={e => { setTargetId(e.target.value); setPreview(null); setResolutions({}); }}><option value="">Choose the record to keep</option>{records.filter(item => item.id !== record.id).map(item => <option value={item.id} key={item.id}>{item.name} · #{item.id}</option>)}</select></label>
    <button className="textlink" disabled={busy || !targetId} onClick={() => void run(async () => { const result = await request(workspaceId, 'POST', { action: 'previewMerge', type, sourceId: record.id, targetId: Number(targetId) }); setPreview(result); setResolutions({}); })}>Review merge</button>
    {preview && <div className="merge-preview"><h3>Merge preview</h3><p>Keep {preview.targetName} · #{preview.targetId}; merge in {preview.sourceName} · #{preview.sourceId}.</p><p>{preview.notesAndTasks.notes} notes and {preview.notesAndTasks.tasks} tasks move with this record. {Object.entries(preview.links).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>
      {preview.lists.length > 0 && <><h3>List memberships</h3>{preview.lists.map(list => <p key={list.id}>{list.name}: {list.source ? 'source is listed' : 'source is not listed'}; {list.target ? 'survivor is listed' : 'survivor is not listed'}</p>)}</>}
      {preview.conflicts.map(conflict => <label className="field" key={conflict.key}>{conflict.label}: choose the value to keep<select value={resolutions[conflict.key] || ''} onChange={e => setResolutions(old => ({ ...old, [conflict.key]: e.target.value as 'source' | 'target' }))}><option value="">Choose a resolution</option><option value="target">Keep survivor: {show(conflict.target)}</option><option value="source">Use merged record: {show(conflict.source)}</option></select></label>)}
      <button className="primary" disabled={busy || preview.conflicts.some(conflict => !resolutions[conflict.key])} onClick={() => void run(async () => { const saved = await request(workspaceId, 'POST', { action: 'merge', type, sourceId: record.id, targetId: preview.targetId, snapshot: preview.snapshot, resolutions }); await onChanged(); onMerged(saved.targetId); })}>Confirm merge</button>
    </div>}
    <div className="delete-control"><button className="textlink" disabled={busy} onClick={() => setDeleteOpen(true)}>Move to Trash</button><small>Linked active people and deals must be moved or merged first.</small></div>
    {error && <p role="alert" className="alert">{error}</p>}
    <Dialog open={deleteOpen} onClose={()=>setDeleteOpen(false)} title="Move record to Trash?"><p>{record.name} can be restored within 30 days. Its notes, tasks and list memberships stay attached.</p>{error&&<p role="alert" className="alert">{error}</p>}<button className="danger-button" disabled={busy} onClick={()=>void run(async()=>{await request(workspaceId,'DELETE',{type,id:record.id,version:record.version});await onChanged();setDeleteOpen(false);onRemoved()})}>{busy?'Moving…':'Move to Trash'}</button></Dialog>
  </details>;
}
export function TrashSection({ workspaceId, onChanged }: { workspaceId: string; onChanged: () => Promise<void> }) {
  const [items, setItems] = useState<(Item & { type: RecordType; deletedAt: string })[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const response = await fetch('/api/records/lifecycle?action=trash', { headers: { 'x-workspace-id': workspaceId }, cache: 'no-store' }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Trash is unavailable.'); setItems(data.records); }, [workspaceId]);
  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : 'Trash is unavailable.')); }, [load]);
  return <section className="panel"><h1>Trash</h1><p className="muted">Records can be restored for 30 days. Notes, tasks and list memberships stay attached while a record is in Trash.</p>{items.map(item => <div className="detailrow" key={`${item.type}-${item.id}`}><span>{item.type} · {item.name} · removed {new Date(item.deletedAt).toLocaleDateString()}</span><button className="textlink" disabled={busy} onClick={() => void (async () => { setBusy(true); setError(''); try { await request(workspaceId, 'POST', { action: 'restore', type: item.type, id: item.id, version: item.version }); await Promise.all([load(), onChanged()]); } catch (e) { setError(e instanceof Error ? e.message : 'Restore failed.'); } finally { setBusy(false); } })()}>Restore</button></div>)}{!items.length && <p>No records are awaiting restore.</p>}{error && <p role="alert" className="alert">{error}</p>}</section>;
}
export function LifecycleHistory({ workspaceId, type, id, version }: { workspaceId: string; type: RecordType; id: number; version: number }) {
  const [events, setEvents] = useState<{ id: number; action: string; recordId: number; details: Record<string, unknown>; createdAt: string; actorEmail: string }[]>([]);
  useEffect(() => { const controller = new AbortController(); void fetch(`/api/records/lifecycle?action=history&type=${type}&id=${id}`, { headers: { 'x-workspace-id': workspaceId }, signal: controller.signal, cache: 'no-store' }).then(response => response.ok ? response.json() : { events: [] }).then(data => { if (!controller.signal.aborted) setEvents(data.events); }).catch(() => {}); return () => controller.abort(); }, [workspaceId, type, id, version]);
  if (!events.length) return null;
  return <section><h3>Record lifecycle</h3>{events.map(event => <p className="activityitem" key={event.id}>{event.action === 'merge' ? `Merged record #${event.recordId} into this record` : event.action === 'delete' ? 'Moved to Trash' : 'Restored from Trash'} · {event.actorEmail} · {new Date(event.createdAt).toLocaleString()}</p>)}</section>;
}
