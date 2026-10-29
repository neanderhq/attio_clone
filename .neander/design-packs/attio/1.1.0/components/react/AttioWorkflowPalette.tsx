import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AttioButton, AttioSearch } from './AttioBlocks';
import { Icon } from './AttioIcon';
import type { WorkflowBlockType, WorkflowPoint } from './AttioWorkflowGraph';

/** Searchable anchored block picker. Categories and choices are supplied by the host. */
export function AttioWorkflowPalette({ types, anchor, onSelect, onClose }: { types: WorkflowBlockType[]; anchor: WorkflowPoint; onSelect: (type: WorkflowBlockType) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState(anchor);
  const root = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  const choices = types.filter((type) => `${type.label} ${type.category}`.toLowerCase().includes(query.toLowerCase()));
  const close = () => { onClose(); previousFocus.current?.focus(); };
  useLayoutEffect(() => {
    const box = root.current!.getBoundingClientRect();
    setPosition({ x: Math.max(12, Math.min(anchor.x, window.innerWidth - box.width - 12)), y: Math.max(12, Math.min(anchor.y, window.innerHeight - box.height - 12)) });
    root.current?.querySelector('input')?.focus();
  }, [anchor.x, anchor.y]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  return <div ref={root} className="at-workflow-palette" role="dialog" aria-label="Choose workflow block" style={{ left: position.x, top: position.y }} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); const buttons = [...root.current!.querySelectorAll<HTMLButtonElement>('[data-block-choice]')]; const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1) + buttons.length) % buttons.length]?.focus();
    }
  }}>
    <div className="at-workflow-palette__search"><AttioSearch aria-label="Search workflow blocks" placeholder="Search blocks…" value={query} onChange={(event) => setQuery(event.target.value)}/><AttioButton variant="ghost" leadingIcon="close" aria-label="Close block picker" onClick={close}/></div>
    <div className="at-workflow-palette__choices">{[...new Set(choices.map((type) => type.category))].map((category) => <section key={category}><h3>{category}</h3>{choices.filter((type) => type.category === category).map((type) => <button data-block-choice type="button" key={type.id} onClick={() => { const editor = root.current?.closest('.at-editor'); onSelect(type); onClose(); requestAnimationFrame(() => editor?.querySelector<HTMLButtonElement>('.at-editor__inspector .at-block-select__trigger')?.focus()); }}><Icon name={type.icon}/><span>{type.label}</span></button>)}</section>)}{!choices.length && <p>No matching blocks</p>}</div>
  </div>;
}
