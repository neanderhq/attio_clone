import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AttioButton, AttioInput } from './AttioBlocks';
import { Icon, type IconName } from './AttioIcon';
import './attio-states.css';

export type AttioMenuItem = { id: string; label: string; icon?: IconName; danger?: boolean; disabled?: boolean; onSelect: () => void };
export function AttioMenu({ label, items, open: controlledOpen, onOpenChange, className = '', triggerClassName = '', triggerVariant = 'secondary', ariaLabel, align = 'start' }: {
  label: ReactNode;
  items: AttioMenuItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  triggerClassName?: string;
  triggerVariant?: 'secondary' | 'ghost';
  ariaLabel?: string;
  align?: 'start' | 'end';
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const setOpen = (next: boolean) => { setInternalOpen(next); onOpenChange?.(next); };
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key); };
  }, [open, onOpenChange]);
  return <div className={`at-menu at-menu--${align} ${className}`} ref={root}><button ref={trigger} type="button" className={`at-block-button at-block-button--${triggerVariant} ${triggerClassName}`} aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => itemRefs.current[0]?.focus()); } }}>{label}</button>{open && <div className="at-menu__list" role="menu">{items.map((item, index) => <button key={item.id} ref={(node) => { itemRefs.current[index] = node; }} type="button" role="menuitem" disabled={item.disabled} className={item.danger ? 'is-danger' : ''} onClick={() => { item.onSelect(); setOpen(false); trigger.current?.focus(); }} onKeyDown={(event) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); itemRefs.current[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); } }}>{item.icon && <Icon name={item.icon}/>}<span>{item.label}</span></button>)}</div>}</div>;
}

export function AttioTooltip({ text, children }: { text: string; children: ReactNode }) {
  const id = useId();
  return <span className="at-tooltip" aria-describedby={id}>{children}<span id={id} role="tooltip" className="at-tooltip__bubble">{text}</span></span>;
}

export function AttioNotice({ tone = 'info', children, onDismiss }: { tone?: 'info' | 'success' | 'error'; children: ReactNode; onDismiss?: () => void }) {
  return <div className={`at-notice at-notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}><Icon name={tone === 'error' ? 'close' : 'check'}/><span>{children}</span>{onDismiss && <AttioButton variant="ghost" leadingIcon="close" aria-label="Dismiss notice" onClick={onDismiss}/>}</div>;
}

export function AttioChoiceCard({ name, description, selected, group, onSelect, icon = 'mail' }: { name: string; description: string; selected: boolean; group: string; onSelect: () => void; icon?: IconName }) {
  return <label className={`at-share-card${selected ? ' is-selected' : ''}`}><span className="at-share-thumb"><Icon name={icon} size={24}/></span><span><strong>{name}</strong><small>{description}</small></span><input type="radio" name={group} checked={selected} onChange={onSelect}/></label>;
}

export function AttioDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return <label className="at-special-field" htmlFor={id}><span>{label}</span><AttioInput id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)}/></label>;
}
export function AttioCurrencyField({ label, value, onChange, currency = 'USD' }: { label: string; value: number; onChange: (value: number) => void; currency?: string }) {
  const id = useId();
  return <label className="at-special-field" htmlFor={id}><span>{label}</span><span className="at-currency-input"><span>{currency}</span><AttioInput id={id} type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))}/></span></label>;
}
export function AttioRelationField({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (selected: string[]) => void }) {
  const id = useId();
  return <fieldset className="at-relation-field"><legend>{label}</legend><div className="at-relation-field__chips">{selected.map((name) => <button type="button" key={name} aria-label={`Remove ${name}`} onClick={() => onChange(selected.filter((item) => item !== name))}>{name} ×</button>)}</div><select id={id} aria-label={`Add ${label}`} value="" onChange={(event) => { if (event.target.value) onChange([...selected, event.target.value]); }}><option value="">Add relation…</option>{options.filter((option) => !selected.includes(option)).map((option) => <option key={option}>{option}</option>)}</select></fieldset>;
}

export function AttioLoading({ label = 'Loading records' }: { label?: string }) { return <div className="at-state" role="status"><span className="at-state__spinner" aria-hidden="true"/>{label}</div>; }
export function AttioEmpty({ title, description, action, secondaryAction, variant = 'compact', icon = 'grid' }: {
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  variant?: 'compact' | 'records';
  icon?: IconName;
}) {
  return <div className={`at-state at-state--${variant}`}>
    {variant === 'records' ? <div className="at-state__record-illustration" aria-hidden="true"><span><Icon name={icon} size={23}/><i/><i/></span></div> : <Icon name={icon} size={26}/>}
    <h2>{title}</h2>
    {description && <p>{description}</p>}
    {(secondaryAction || action) && <div className="at-state__actions">{secondaryAction}{action}</div>}
  </div>;
}
export function AttioError({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="at-state at-state--error" role="alert"><Icon name="close" size={26}/><strong>{message}</strong>{onRetry && <AttioButton onClick={onRetry}>Try again</AttioButton>}</div>; }
