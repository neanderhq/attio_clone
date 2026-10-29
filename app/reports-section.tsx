'use client';
import { useEffect, useState } from 'react';

type Bucket = { count: number; valueCents: number; dealIds: number[] };
type Report = { asOf: string; timeZone: string; month: string; stages: { stage: string; count: number; dealIds: number[] }[]; currencies: { currency: string; open: Bucket; wonThisMonth: Bucket }[]; overdue: { count: number; taskIds: number[] }; legacyCloseDatesUnknown: number };
type Drilldown = { deals: { id: number; name: string; currency: string; valueCents: number; stage: string }[]; tasks: { id: number; title: string; targetType: string; targetId: number }[] };
export default function ReportsSection({ workspaceId, openRecord, embedded = false }: { workspaceId: string; openRecord: (type: 'company' | 'person' | 'deal', id: number) => void; embedded?: boolean }) {
  const [report, setReport] = useState<Report | null>(null), [drilldown, setDrilldown] = useState<Drilldown | null>(null);
  const [loading, setLoading] = useState(true), [drilling, setDrilling] = useState(false), [error, setError] = useState('');
  const [selection, setSelection] = useState('');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  async function get(query = '') {
    const response = await fetch(`/api/reports?timeZone=${encodeURIComponent(timeZone)}${query}`, { cache: 'no-store', headers: { 'x-workspace-id': workspaceId } });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Could not load reports.');
    return json;
  }
  useEffect(() => { let live = true; get().then(j => { if (live) { setReport(j); setError(''); } }).catch(e => { if (live) setError(e.message); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [workspaceId]);
  async function select(label: string, query: string) { setSelection(label); setDrilldown(null); setDrilling(true); setError(''); try { setDrilldown(await get(query)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load matching records.'); } finally { setDrilling(false); } }
  const money = (cents: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  return <>{!embedded && <div className="heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Reports</h1><p className="subtitle">Current records and verified stage changes.</p></div></div>}
    {loading && <div className="panel" role="status">Loading reports…</div>}
    {error && <div className="alert" role="alert">{error} <button onClick={() => { setLoading(true); get().then(j => { setReport(j); setError(''); }).catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Retry</button></div>}
    {report && <><p className="muted">As of {new Date(report.asOf).toLocaleString()} · {report.timeZone}. Won this month: {report.month}.</p>
      {report.legacyCloseDatesUnknown > 0 && <p className="warning">{report.legacyCloseDatesUnknown} older won deal(s) have no recorded close date and are excluded from monthly won totals.</p>}
      <div className="metrics"><button className="metric-card" onClick={() => void select('Overdue tasks', '&metric=overdue')}><span>Overdue tasks</span><strong>{report.overdue.count}</strong><small>Follow-ups needing attention</small></button>{report.currencies.flatMap(c => [<button key={`${c.currency}-open`} className="metric-card" onClick={() => void select(`Open pipeline · ${c.currency}`, `&metric=open&currency=${c.currency}`)}><span>Open pipeline · {c.currency}</span><strong>{money(c.open.valueCents, c.currency)}</strong><small>{c.open.count} deal(s)</small></button>,<button key={`${c.currency}-won`} className="metric-card" onClick={() => void select(`Won this month · ${c.currency}`, `&metric=wonMonth&currency=${c.currency}`)}><span>Won this month · {c.currency}</span><strong>{money(c.wonThisMonth.valueCents, c.currency)}</strong><small>{c.wonThisMonth.count} deal(s)</small></button>])}</div>
      {!report.currencies.length && <p className="panel empty">No deals yet. Create a deal to see pipeline and won values.</p>}
      <div className="panel"><h2>Current pipeline by stage</h2>{report.stages.map(s => <button className="listrow" key={s.stage} onClick={() => void select(`${s.stage} deals`, `&metric=stage&stage=${encodeURIComponent(s.stage)}`)}><span>{s.stage}</span><strong>{s.count}</strong></button>)}</div>
      {selection && <div className="panel"><h2>{selection}</h2>{drilling && <p role="status">Loading matching records…</p>}{drilldown && <>{drilldown.deals.map(d => <button className="listrow" key={d.id} onClick={() => openRecord('deal', d.id)}><span>{d.name} · {d.stage}</span><strong>{money(d.valueCents, d.currency)}</strong></button>)}{drilldown.tasks.map(t => <button className="listrow" key={t.id} onClick={() => openRecord(t.targetType as 'company' | 'person' | 'deal', t.targetId)}><span>{t.title}</span><small>Open related record →</small></button>)}{!drilldown.deals.length && !drilldown.tasks.length && <p className="empty">No matching records.</p>}</>}</div>}</>}
  </>;
}
