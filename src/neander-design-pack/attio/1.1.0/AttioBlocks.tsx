import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Icon, type IconName } from './AttioIcon';
import './attio-blocks.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  leadingIcon?: IconName;
  trailingIcon?: IconName;
};

export function AttioButton({ variant = 'secondary', leadingIcon, trailingIcon, children, className = '', ...props }: ButtonProps) {
  const hasLabel = children !== undefined && children !== null && children !== '' && typeof children !== 'boolean';
  return <button type="button" className={`at-block-button at-block-button--${variant}${!hasLabel && (leadingIcon || trailingIcon) ? ' at-block-button--icon' : ''} ${className}`} {...props}>
    {leadingIcon && <Icon name={leadingIcon} />}
    {hasLabel && <span>{children}</span>}
    {trailingIcon && <Icon name={trailingIcon} size={14} />}
  </button>;
}

export function AttioInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`at-block-input ${className}`} {...props} />;
}

export function AttioTextarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`at-block-textarea ${className}`} {...props} />;
}

export function AttioSearch({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <label className={`at-block-search ${className}`}><Icon name="search" /><AttioInput type="search" {...props} /></label>;
}

export function AttioField({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string, descriptionId?: string) => ReactNode }) {
  const id = useId();
  const descriptionId = hint || error ? `${id}-description` : undefined;
  return <div className={`at-block-field${error ? ' is-invalid' : ''}`}>
    <label htmlFor={id}>{label}</label>
    {children(id, descriptionId)}
    {(hint || error) && <small id={descriptionId} role={error ? 'alert' : undefined}>{error ?? hint}</small>}
  </div>;
}

export function AttioBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`at-pill at-pill--${tone}`}>{children}</span>;
}

export function AttioSidebar({ header, search, footer, children }: { header: ReactNode; search?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return <aside className="at-sidebar"><div className="at-sidebar-head">{header}</div>{search}{children}{footer}</aside>;
}

export function AttioNavItem({ icon, children, active = false, inset = false, badge, iconTone, onClick, title }: { icon: IconName; children: ReactNode; active?: boolean; inset?: boolean; badge?: ReactNode; iconTone?: 'blue' | 'cyan' | 'orange' | 'purple'; onClick?: () => void; title?: string }) {
  const className = `at-nav-row${active ? ' is-active' : ''}${inset ? ' is-inset' : ''}`;
  const content = <>{iconTone ? <span className={`at-nav-row__object-icon at-nav-row__object-icon--${iconTone}`} aria-hidden="true"><Icon name={icon} size={13}/></span> : <Icon name={icon} />}<span className="at-nav-row__label">{children}</span>{badge !== undefined && <span className="at-nav-row__badge">{badge}</span>}</>;
  return onClick ? <button type="button" aria-current={active ? 'page' : undefined} aria-label={title} title={title} className={className} onClick={onClick}>{content}</button> : <div aria-current={active ? 'page' : undefined} title={title} className={className}>{content}</div>;
}

export function AttioHeader({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return <header className="at-main-head at-block-header"><strong>{children}</strong>{actions && <div className="at-block-header__actions">{actions}</div>}</header>;
}

export function AttioTabs({ tabs, active, onChange, ariaLabel = 'Sections' }: { tabs: { id: string; label: string; icon?: IconName; count?: number }[]; active: string; onChange: (id: string) => void; ariaLabel?: string }) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    onChange(tab.id);
    window.requestAnimationFrame(() => tabRefs.current[index]?.focus());
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    select(next);
  };
  return <div className="at-tabs at-block-tabs" role="tablist" aria-label={ariaLabel}>{tabs.map((tab, index) => <button ref={(node) => { tabRefs.current[index] = node; }} key={tab.id} type="button" role="tab" tabIndex={active === tab.id ? 0 : -1} aria-selected={active === tab.id} className={active === tab.id ? 'is-active' : ''} onKeyDown={(event) => onKeyDown(event, index)} onClick={() => onChange(tab.id)}>{tab.icon && <Icon name={tab.icon}/>}<span>{tab.label}</span>{tab.count !== undefined && <AttioBadge>{tab.count}</AttioBadge>}</button>)}</div>;
}

export function AttioSelect({ id, label, ariaLabel, options, icon, className = '', disabled = false, value: controlledValue, onChange }: { id?: string; label: string; ariaLabel?: string; options: string[]; icon?: IconName; className?: string; disabled?: boolean; value?: string; onChange?: (value: string) => void }) {
  const [internalValue, setInternalValue] = useState(label);
  const value = controlledValue ?? internalValue;
  const choose = (next: string) => { setInternalValue(next); onChange?.(next); close(); };
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();
  const focusOption = (index: number) => window.requestAnimationFrame(() => optionRefs.current[index]?.focus());
  const openAt = (index: number) => { setActiveIndex(index); setOpen(true); focusOption(index); };
  const moveTo = (index: number) => { setActiveIndex(index); focusOption(index); };
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = open ? (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : event.key === 'ArrowDown' ? Math.max(0, options.indexOf(value)) : options.length - 1;
      open ? moveTo(next) : openAt(next);
    }
    if (open && (event.key === 'Home' || event.key === 'End')) { event.preventDefault(); moveTo(event.key === 'Home' ? 0 : options.length - 1); }
    if (open && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(options[activeIndex]); }
  };
  const onOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      moveTo(next);
    }
  };
  return <div className={`at-block-select ${className}`} ref={root}>
    <button id={id} ref={trigger} type="button" className="at-block-select__trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-controls={listId} aria-expanded={open} disabled={disabled} onKeyDown={onTriggerKeyDown} onClick={() => open ? setOpen(false) : openAt(Math.max(0, options.indexOf(value)))}>
      {icon && <Icon name={icon} />}<span>{value}</span><Icon name="chevron" size={14} />
    </button>
    <div id={listId} className={`at-block-select__menu${open ? ' is-open' : ''}`} role="listbox" aria-label={label} aria-hidden={!open}>
      {options.map((option, index) => <button ref={(node) => { optionRefs.current[index] = node; }} type="button" role="option" aria-selected={value === option} tabIndex={open ? 0 : -1} key={option} onKeyDown={(event) => onOptionKeyDown(event, index)} onClick={() => choose(option)}><span>{option}</span>{value === option && <Icon name="check" size={14}/>}</button>)}
    </div>
  </div>;
}

export function AttioModal({ open, onClose, title, children, footer, size = 'default' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'default' | 'wide' }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      node.showModal();
    }
    if (!open && node.open) {
      node.close();
      returnFocus.current?.focus();
      returnFocus.current = null;
    }
  }, [open]);
  return <dialog
    ref={dialog}
    className={`at-block-modal at-block-modal--${size}`}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    aria-label={title}
    aria-modal="true"
  >
    <div className="at-block-modal__head"><h2>{title}</h2><AttioButton variant="ghost" leadingIcon="close" aria-label="Close dialog" onClick={onClose}/></div>
    <div className="at-block-modal__body">{children}</div>
    {footer && <div className="at-block-modal__footer">{footer}</div>}
  </dialog>;
}

export function AttioFormGrid({ children }: { children: ReactNode }) {
  return <div className="at-block-form-grid">{children}</div>;
}

export function AttioCheckbox({ label, ariaLabel, defaultChecked = false, checked, onChange, disabled = false }: { label: string; ariaLabel?: string; defaultChecked?: boolean; checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="at-block-check"><input type="checkbox" aria-label={ariaLabel} defaultChecked={checked === undefined ? defaultChecked : undefined} checked={checked} onChange={(event) => onChange?.(event.target.checked)} disabled={disabled} /><span>{label}</span></label>;
}

export function AttioRadio({ label, ariaLabel, name, defaultChecked = false, disabled = false }: { label: string; ariaLabel?: string; name: string; defaultChecked?: boolean; disabled?: boolean }) {
  return <label className="at-block-radio"><input type="radio" aria-label={ariaLabel} name={name} defaultChecked={defaultChecked} disabled={disabled} /><span>{label}</span></label>;
}

export function AttioSwitch({ label, ariaLabel, defaultChecked = false, checked, onChange, disabled = false }: { label: string; ariaLabel?: string; defaultChecked?: boolean; checked?: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }) {
  return <label className="at-block-switch"><span>{label}</span><input type="checkbox" role="switch" aria-label={ariaLabel} defaultChecked={checked === undefined ? defaultChecked : undefined} checked={checked} onChange={(event) => onChange?.(event.target.checked)} disabled={disabled} /><span className="at-block-switch__track" aria-hidden="true" /></label>;
}

export function AttioTable({ headers, rows }: { headers: ReactNode[]; rows: { key: string; cells: ReactNode[] }[] }) {
  return <div className="at-table-scroll"><table className="at-table"><thead><tr>{headers.map((header, index) => <th key={index}>{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export function AttioThresholdScale() {
  const [first, setFirst] = useState(34);
  const [second, setSecond] = useState(67);
  const [unit, setUnit] = useState<'percent' | 'number'>('percent');
  const updateFirst = (value: number) => setFirst(Math.max(0, Math.min(second, value)));
  const updateSecond = (value: number) => setSecond(Math.max(first, Math.min(100, value)));
  return <div className="at-threshold">
    <div className="at-threshold__track" aria-hidden="true"><span/><span/><span/></div>
    <div className="at-threshold__values"><label>First threshold <input type="number" min="0" max={second} value={first} onChange={(event) => updateFirst(Number(event.target.value))}/> %</label><label>Second threshold <input type="number" min={first} max="100" value={second} onChange={(event) => updateSecond(Number(event.target.value))}/> %</label></div>
    <div className="at-threshold__unit" role="group" aria-label="Threshold unit"><button type="button" aria-pressed={unit === 'percent'} onClick={() => setUnit('percent')}>%</button><button type="button" aria-pressed={unit === 'number'} onClick={() => setUnit('number')}>#</button></div>
  </div>;
}
