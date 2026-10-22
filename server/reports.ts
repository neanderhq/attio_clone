import { STAGES } from '../shared/crm';

export type ReportDeal = { id: number; name: string; stage: string; currency: string; valueCents: number; wonClosedAt: Date | null };
export type ReportTask = { id: number; title: string; targetType: string; targetId: number; dueDate: string | null; done: boolean };

export function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return { month: `${get('year')}-${get('month')}`, day: `${get('year')}-${get('month')}-${get('day')}` };
}

export function currentReport(deals: ReportDeal[], tasks: ReportTask[], timeZone: string, now = new Date()) {
  const { month, day } = localParts(now, timeZone);
  const stages = STAGES.map(stage => ({ stage, count: deals.filter(d => d.stage === stage).length, dealIds: deals.filter(d => d.stage === stage).map(d => d.id) }));
  const currencies = [...new Set(deals.map(d => d.currency))].sort().map(currency => {
    const open = deals.filter(d => d.currency === currency && d.stage !== 'Won' && d.stage !== 'Lost');
    const wonThisMonth = deals.filter(d => d.currency === currency && d.stage === 'Won' && d.wonClosedAt && localParts(d.wonClosedAt, timeZone).month === month);
    return { currency, open: { count: open.length, valueCents: open.reduce((n, d) => n + d.valueCents, 0), dealIds: open.map(d => d.id) }, wonThisMonth: { count: wonThisMonth.length, valueCents: wonThisMonth.reduce((n, d) => n + d.valueCents, 0), dealIds: wonThisMonth.map(d => d.id) } };
  });
  const overdue = tasks.filter(t => !t.done && t.dueDate && t.dueDate < day);
  return { asOf: now.toISOString(), timeZone, month, today: day, stages, currencies, overdue: { count: overdue.length, taskIds: overdue.map(t => t.id) }, legacyCloseDatesUnknown: deals.filter(d => d.stage === 'Won' && !d.wonClosedAt).length };
}
