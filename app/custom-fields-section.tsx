'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Dialog } from './workspace-ui';
import { AttioButton } from '../src/neander-design-pack/attio/1.1.0/AttioBlocks';
import { CUSTOM_KINDS, type CustomKind, type CustomValue } from '../shared/custom-fields';

export type Field = { id: string; objectType: 'company' | 'person' | 'deal'; name: string; kind: CustomKind; options: string[]; required: boolean; unique: boolean; archivedAt: string | null };
export type Value = { fieldId: string; recordId: number; value: CustomValue };
export type FieldData = { fields: Field[]; values: Value[] };
export const emptyFieldData: FieldData = { fields: [], values: [] };
const displayKind = (kind: string) => kind.replace('_', ' ');
function fieldInput(field: Field, value: string | number | boolean | null, change: (value: string | boolean) => void, disabled = false) {
  if (field.kind === 'checkbox') return <input type="checkbox" disabled={disabled} checked={value === true} onChange={event => change(event.target.checked)} />;
  if (field.kind === 'single_select') return <select disabled={disabled} value={String(value ?? '')} onChange={event => change(event.target.value)}><option value="">Choose an option</option>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select>;
  return <input disabled={disabled} type={field.kind === 'date' ? 'date' : field.kind === 'email' ? 'email' : field.kind === 'number' ? 'number' : field.kind === 'url' ? 'url' : 'text'} maxLength={500} step={field.kind === 'number' ? 'any' : undefined} value={String(value ?? '')} onChange={event => change(event.target.value)} />;
}
export function CreationFields({ type, fields, values, change }: { type: Field['objectType']; fields: Field[]; values: Record<string, string | boolean>; change: (id: string, value: string | boolean) => void }) {
  const matching = fields.filter(field => field.objectType === type && !field.archivedAt);
  if (!matching.length) return null;
  return <fieldset className="custom-fieldset"><legend>Custom fields</legend>{matching.map(field => <label className="field" key={field.id}>{field.name}{field.required ? ' · required' : ''}{fieldInput(field, values[field.id] ?? (field.kind === 'checkbox' ? false : ''), value => change(field.id, value))}</label>)}</fieldset>;
}
export function CustomRecordFields({ type, id, version, workspaceId, data, canWrite, onSaved }: { type: Field['objectType']; id: number; version: number; workspaceId: string; data: FieldData; canWrite: boolean; onSaved: () => Promise<void> }) {
  const fields = data.fields.filter(field => field.objectType === type);
  const current = Object.fromEntries(data.values.filter(value => value.recordId === id && fields.some(field => field.id === value.fieldId)).map(value => [value.fieldId, value.value]));
  const [draft, setDraft] = useState<Record<string, string | boolean | number | null>>(current);
  const [baseVersion, setBaseVersion] = useState(version);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => { setBaseVersion(version); }, [version]);
  async function save(event: FormEvent) {
    event.preventDefault(); setPending(true); setMessage('');
    const values: Record<string, CustomValue | null> = {};
    for (const field of fields.filter(field => !field.archivedAt)) {
      const raw = draft[field.id] ?? null;
      if (field.kind === 'number' && raw !== null && raw !== '' && !Number.isFinite(Number(raw))) { setMessage(`${field.name} needs a valid number.`); setPending(false); return; }
      values[field.id] = field.kind === 'number' ? raw === null || raw === '' ? null : Number(raw) : field.kind === 'checkbox' ? raw === true : raw === '' ? null : raw as CustomValue | null;
    }
    try {
      const response = await fetch('/api/custom-fields', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId }, body: JSON.stringify({ objectType: type, recordId: id, version: baseVersion, values }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save custom fields.');
      setBaseVersion(result.version); await onSaved(); setMessage('Custom fields saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save custom fields.'); }
    finally { setPending(false); }
  }
  return <section className="custom-record-fields"><h3>Custom fields</h3>{!fields.length && <p className="muted">No custom fields for this record type yet.</p>}{fields.length > 0 && <form onSubmit={save}>{fields.map(field => <label className="field" key={field.id}>{field.name}{field.required ? ' · required' : ''}{field.archivedAt ? ' · archived' : ''}{fieldInput(field, draft[field.id] ?? current[field.id] ?? null, value => { setDraft(old => ({ ...old, [field.id]: value })); setMessage(''); }, !canWrite || !!field.archivedAt || pending)}</label>)}{canWrite && fields.some(field => !field.archivedAt) && <button className="primary" disabled={pending}>{pending ? 'Saving…' : 'Save custom fields'}</button>}</form>}{message && <p role="status">{message}</p>}{message.includes('changed since') && <button className="textlink" onClick={async () => { await onSaved(); setMessage('Latest version loaded. Review your draft before saving again.'); }}>Load latest version, keep draft</button>}</section>;
}
export default function CustomFieldsSection({ workspaceId, role, data, onSaved }: { workspaceId: string; role: string; data: FieldData; onSaved: () => Promise<void> }) {
  const [creating,setCreating]=useState(false);
  const [type, setType] = useState<Field['objectType']>('company');
  const [kind, setKind] = useState<CustomKind>('text');
  const [name, setName] = useState(''), [options, setOptions] = useState(''), [required, setRequired] = useState(false), [unique, setUnique] = useState(false);
  const [message, setMessage] = useState(''), [pending, setPending] = useState(false);
  async function call(method: 'POST' | 'PATCH', body: object) {
    setPending(true); setMessage('');
    try {
      const response = await fetch('/api/custom-fields', { method, headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save field.');
      await onSaved(); setMessage(method === 'POST' ? 'Field added.' : 'Field archived. Existing values are retained.');
      if (method === 'POST') { setCreating(false); setName(''); setOptions(''); setRequired(false); setUnique(false); }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save field.'); }
    finally { setPending(false); }
  }
  return <><div className="heading"><div><p className="eyebrow">WORKSPACE SETTINGS</p><h1>Custom fields</h1><p className="subtitle">Fields belong to this workspace and appear on Company, Person, or Deal records.</p></div>{role === 'Admin'&&<AttioButton variant="primary" leadingIcon="plus" onClick={()=>setCreating(true)}>New field</AttioButton>}</div>{role === 'Admin' && <Dialog open={creating} onClose={()=>setCreating(false)} title="New field"><form className="panel" onSubmit={event => { event.preventDefault(); void call('POST', { objectType: type, kind, name, options: kind === 'single_select' ? options.split('\n').map(x => x.trim()).filter(Boolean) : [], required, unique }); }}><div className="formgrid"><label className="field">Record type<select value={type} onChange={event => setType(event.target.value as Field['objectType'])}><option value="company">Company</option><option value="person">Person</option><option value="deal">Deal</option></select></label><label className="field">Field type<select value={kind} onChange={event => setKind(event.target.value as CustomKind)}>{CUSTOM_KINDS.map(item => <option key={item} value={item}>{displayKind(item)}</option>)}</select></label><label className="field">Field name<input required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>{kind === 'single_select' && <label className="field">Options · one per line<textarea required value={options} onChange={event => setOptions(event.target.value)} /></label>}</div><div className="custom-checks"><label><input type="checkbox" checked={required} onChange={event => setRequired(event.target.checked)} /> Required from record creation</label><label><input type="checkbox" checked={unique} onChange={event => setUnique(event.target.checked)} /> Unique within this field</label></div><p className="muted">A required field can be added only before this record type has any records. Field type, options, and rules stay fixed after creation.</p><button className="primary" disabled={pending}>Add field</button>{message&&<p role="status">{message}</p>}</form></Dialog>}{message && <p role="status" className="panel">{message}</p>}<div className="panel"><h2>Saved fields</h2>{!data.fields.length && <p className="empty">No custom fields yet. An Admin can add one above.</p>}{data.fields.map(field => <div className="custom-field-row" key={field.id}><div><strong>{field.name}</strong><small>{field.objectType} · {displayKind(field.kind)}{field.required ? ' · required' : ''}{field.unique ? ' · unique' : ''}{field.archivedAt ? ' · archived' : ''}</small>{field.options.length > 0 && <small>{field.options.join(', ')}</small>}</div>{role === 'Admin' && !field.archivedAt && <button type="button" className="textlink" disabled={pending} onClick={() => void call('PATCH', { action: 'archive', id: field.id })}>Archive</button>}</div>)}</div></>;
}
