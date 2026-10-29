import { Fragment, useRef, useState, type ReactNode } from 'react';
import { AttioBadge, AttioButton, AttioSelect } from './AttioBlocks';
import { AttioMenu, AttioNotice } from './AttioStates';
import { Icon, type IconName } from './AttioIcon';
import './attio-crm-blocks.css';

export type AttioColumn<Row> = { key: keyof Row & string; label: ReactNode; ariaLabel?: string; icon?: IconName; sortable?: boolean; editable?: boolean; align?: 'left' | 'right'; width?: number; headerAction?: 'add' | 'enrich'; render?: (value: Row[keyof Row], row: Row) => ReactNode };
export type AttioTableSort<Row> = { key: keyof Row & string; direction: 1 | -1 };
export type AttioTableEditResult = boolean | void | Promise<boolean | void>;

export function AttioCollectionToolbar({ view, views, onViewChange, onViewSettings, secondaryAction, primaryAction }: { view: string; views?: string[]; onViewChange?: (value: string) => void; onViewSettings?: () => void; secondaryAction?: ReactNode; primaryAction?: ReactNode }) {
  return <div className="at-collection-toolbar"><div><AttioSelect className="at-collection-toolbar__view" label="View" options={views?.length ? views : [view]} value={view} onChange={onViewChange} icon="grid"/>{onViewSettings && <AttioButton leadingIcon="settings" trailingIcon="chevron" onClick={onViewSettings}>View settings</AttioButton>}</div><div>{secondaryAction}{primaryAction}</div></div>;
}

export function AttioFilterToolbar({ sortLabel, sortOptions, onSortChange, onFilter, filterActive = false, trailingAction }: { sortLabel: string; sortOptions: string[]; onSortChange: (value: string) => void; onFilter: () => void; filterActive?: boolean; trailingAction?: ReactNode }) {
  return <div className="at-filter-toolbar"><AttioMenu className="at-filter-toolbar__sort" label={<><Icon name="sort" size={14}/><span>Sorted by <strong>{sortLabel}</strong></span></>} items={sortOptions.map((option) => ({ id: option, label: option, icon: 'sort' as IconName, onSelect: () => onSortChange(option) }))}/><AttioButton className={filterActive ? 'at-filter-toolbar__filter is-active' : 'at-filter-toolbar__filter'} leadingIcon="filter" onClick={onFilter}>Filter</AttioButton>{trailingAction && <div className="at-filter-toolbar__trailing">{trailingAction}</div>}</div>;
}

export function AttioDataTable<Row extends { id: string }>({ columns, rows, onRowsChange, confirmEdits = false, onHeaderAction, selectable = true, selected = [], onSelectionChange, sort, onSortChange, groupBy, renderGroupHeader, className = '' }: { columns: AttioColumn<Row>[]; rows: Row[]; onRowsChange?: (rows: Row[]) => AttioTableEditResult; confirmEdits?: boolean; onHeaderAction?: (key: keyof Row & string, action: 'add' | 'enrich') => void; selectable?: boolean; selected?: string[]; onSelectionChange?: (ids: string[]) => void; sort?: AttioTableSort<Row> | null; onSortChange?: (sort: AttioTableSort<Row>) => void; groupBy?: (row: Row) => string; renderGroupHeader?: (group: string, rows: Row[]) => ReactNode; className?: string }) {
  const [localSort, setLocalSort] = useState<AttioTableSort<Row> | null>(null);
  const activeSort = onSortChange ? sort ?? null : localSort;
  const [editing, setEditing] = useState<{ id: string; key: keyof Row & string } | null>(null);
  const [draft, setDraft] = useState('');
  const [editPending, setEditPending] = useState(false);
  const editPendingRef = useRef(false);
  const [editError, setEditError] = useState('');
  const ordered = !onSortChange && activeSort ? [...rows].sort((a, b) => String(a[activeSort.key] ?? '').localeCompare(String(b[activeSort.key] ?? ''), undefined, { numeric: true }) * activeSort.direction) : rows;
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));
  const commit = async () => {
    if (!editing || !onRowsChange || editPendingRef.current) return;
    editPendingRef.current = true;
    setEditPending(true);
    setEditError('');
    try {
      const result = await onRowsChange(rows.map((row) => row.id === editing.id ? { ...row, [editing.key]: draft } : row));
      if (result === false || (confirmEdits && result !== true)) {
        setEditError('Changes could not be saved. Please try again.');
        return;
      }
      setEditing(null);
    } catch {
      setEditError('Changes could not be saved. Please try again.');
    } finally {
      editPendingRef.current = false;
      setEditPending(false);
    }
  };
  const sortColumn = (column: AttioColumn<Row>) => { if (column.sortable) { const next: AttioTableSort<Row> = { key: column.key, direction: activeSort?.key === column.key && activeSort.direction === 1 ? -1 : 1 }; if (onSortChange) onSortChange(next); else setLocalSort(next); } };
  const groups = groupBy ? [...ordered.reduce((map, row) => { const group = groupBy(row); map.set(group, [...(map.get(group) ?? []), row]); return map; }, new Map<string, Row[]>())] : [['', ordered] as [string, Row[]]];
  return <div className={`at-table-scroll at-data-table ${className}`}><table className="at-table"><colgroup>{selectable && <col className="at-data-table__select-column"/>}{columns.map((column) => <col key={column.key} style={column.width ? { width: column.width } : undefined}/>)}</colgroup><thead><tr>{selectable && <th className="at-data-table__select"><input type="checkbox" aria-label="Select all records" checked={allSelected} onChange={(event) => onSelectionChange?.(event.target.checked ? rows.map((row) => row.id) : [])}/></th>}{columns.map((column) => <th key={column.key} className={column.align === 'right' ? 'is-right' : ''}><div className="at-data-table__head"><button type="button" className="at-data-table__sort" aria-label={column.sortable ? `Sort by ${column.ariaLabel ?? (typeof column.label === 'string' ? column.label : column.key)}` : undefined} disabled={!column.sortable} onClick={() => sortColumn(column)}>{column.icon && <Icon name={column.icon} size={14}/>}<span>{column.label}</span>{activeSort?.key === column.key && <Icon name="chevron" size={12}/>}</button>{column.headerAction && onHeaderAction && <button type="button" className="at-data-table__header-action" aria-label={column.headerAction === 'add' ? 'Add column' : `Configure ${column.ariaLabel ?? (typeof column.label === 'string' ? column.label : column.key)}`} onClick={() => onHeaderAction?.(column.key, column.headerAction!)}><Icon name={column.headerAction === 'add' ? 'plus' : 'bolt'} size={14}/></button>}</div></th>)}</tr></thead><tbody>{groups.map(([group, groupRows]) => <Fragment key={group || 'rows'}>{groupBy && <tr className="at-data-table__group"><td colSpan={columns.length + (selectable ? 1 : 0)}>{renderGroupHeader ? renderGroupHeader(group, groupRows) : <><strong>{group}</strong><AttioBadge>{groupRows.length}</AttioBadge></>}</td></tr>}{groupRows.map((row) => <tr key={row.id} className={selected.includes(row.id) ? 'is-selected' : ''}>{selectable && <td className="at-data-table__select"><input type="checkbox" aria-label={`Select ${row.id}`} checked={selected.includes(row.id)} onChange={(event) => onSelectionChange?.(event.target.checked ? [...selected, row.id] : selected.filter((id) => id !== row.id))}/></td>}{columns.map((column, columnIndex) => <td key={column.key} data-label={typeof column.label === 'string' ? column.label : column.ariaLabel ?? column.key} data-primary={columnIndex === 0 ? 'true' : undefined} className={column.align === 'right' ? 'is-right' : ''} onDoubleClick={() => { if (column.editable && onRowsChange && !editPendingRef.current) { setEditError(''); setEditing({ id: row.id, key: column.key }); setDraft(String(row[column.key])); } }}>{editing?.id === row.id && editing.key === column.key ? <input autoFocus disabled={editPending} aria-invalid={!!editError} className="at-data-table__editor" aria-label={`Edit ${column.key} for ${row.id}`} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { void commit(); }} onKeyDown={(event) => { if (event.key === 'Enter') { void commit(); } if (event.key === 'Escape' && !editPendingRef.current) { event.preventDefault(); event.stopPropagation(); setEditing(null); setEditError(''); } }}/> : <>{column.render ? column.render(row[column.key], row) : String(row[column.key])}{column.editable && onRowsChange && !editPending && <button className="at-data-table__edit" type="button" aria-label={`Edit ${column.key} for ${row.id}`} onClick={() => { setEditError(''); setEditing({ id: row.id, key: column.key }); setDraft(String(row[column.key])); }}><Icon name="note" size={11}/></button>}</>}</td>)}</tr>)}</Fragment>)}</tbody></table>{editError && <AttioNotice tone="error" onDismiss={() => setEditError('')}>{editError}</AttioNotice>}</div>;
}

export function AttioRecordHeader({ name, avatar, meta, actions }: { name: string; avatar: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return <div className="at-record-title at-record-header">{avatar}<strong>{name}</strong>{meta}{actions && <div className="at-record-header__actions">{actions}</div>}</div>;
}

export function AttioRelatedRecord({ name, detail, avatar, onOpen }: { name: string; detail: string; avatar: ReactNode; onOpen: () => void }) {
  return <button type="button" className="at-related at-related-record" onClick={onOpen}>{avatar}<span><strong>{name}</strong><small>{detail}</small></span><Icon name="chevron"/></button>;
}

export function AttioSequenceStep({ number, subject, children, onAction }: { number: number; subject: string; children?: ReactNode; onAction: (action: 'duplicate' | 'delete', number: number) => void }) {
  return <article className="at-step"><div className="at-step-head"><Icon name="mail"/><strong>Step {number}</strong><span className="at-faint">Automated email</span><span className="at-spacer"/><AttioMenu label="Step actions" items={[{ id: 'duplicate', label: 'Duplicate step', icon: 'copy', onSelect: () => onAction('duplicate', number) }, { id: 'delete', label: 'Delete step', icon: 'close', danger: true, onSelect: () => onAction('delete', number) }]}/></div><div className="at-subject"><span className="at-faint">Subject</span>{subject}</div>{children && <div className="at-message">{children}</div>}</article>;
}

export type AttioActivity = { id: string; actor: string; time: string; action: string; icon: IconName; detail?: ReactNode };
export function AttioActivityTimeline({ title, events, avatar }: { title: string; events: AttioActivity[]; avatar: (name: string) => ReactNode }) {
  return <div className="at-timeline"><h2>{title}</h2>{events.map((event) => <div className="at-event at-activity-item" key={event.id}><span className="at-event-dot"><Icon name={event.icon}/></span>{avatar(event.actor)}<strong>{event.actor}</strong><span>{event.action}</span><span className="at-faint">{event.time}</span>{event.detail && <div className="at-activity-item__detail">{event.detail}</div>}</div>)}</div>;
}

export type AttioPipelineCardData = { id: string; name: string; role: string; description: string };
export type AttioPipelineStage = { name: string; color: string; cards: AttioPipelineCardData[] };
export function AttioPipelineCard({ card, stages, currentStage, onMove, avatar }: { card: AttioPipelineCardData; stages: string[]; currentStage: string; onMove: (cardId: string, stage: string) => void; avatar: ReactNode }) {
  return <article className="at-kanban-card"><div className="at-kanban-name">{avatar}<u>{card.name}</u></div><div className="at-kanban-field"><Icon name="note"/>{card.role}</div><div className="at-kanban-field"><Icon name="activity"/>{card.description}</div><div className="at-kanban-field at-faint"><Icon name="globe"/>Set location</div><div className="at-kanban-meta"><Icon name="note"/><Icon name="check"/>3 <Icon name="mail"/>3 <span className="at-spacer"/><label className="at-pipeline-move-label">Move to <select aria-label={`Move ${card.name} to stage`} value={currentStage} onChange={(event) => onMove(card.id, event.target.value)}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label></div></article>;
}
export function AttioPipelineColumn({ stage, allStages, onMove, onSettings, avatar }: { stage: AttioPipelineStage; allStages: string[]; onMove: (cardId: string, stage: string) => void; onSettings: () => void; avatar: (name: string) => ReactNode }) {
  return <section className="at-column"><div className="at-column-head"><span className={`at-stage-dot at-stage-dot--${stage.color}`}>▾</span><strong>{stage.name}</strong><AttioBadge>{stage.cards.length}</AttioBadge><span className="at-spacer"/><AttioButton variant="ghost" leadingIcon="more" aria-label="Column settings" onClick={onSettings}/></div>{stage.cards.map((card) => <AttioPipelineCard key={card.id} card={card} stages={allStages} currentStage={stage.name} onMove={onMove} avatar={avatar(card.name)}/>)}</section>;
}
export function AttioPipelineBoard({ stages, visible, onMove, onSettings, avatar }: { stages: AttioPipelineStage[]; visible: Record<string, boolean>; onMove: (cardId: string, stage: string) => void; onSettings: () => void; avatar: (name: string) => ReactNode }) {
  return <div className="at-board">{stages.filter((stage) => visible[stage.name]).map((stage) => <AttioPipelineColumn key={stage.name} stage={stage} allStages={stages.map((item) => item.name)} onMove={onMove} onSettings={onSettings} avatar={avatar}/>)}</div>;
}
