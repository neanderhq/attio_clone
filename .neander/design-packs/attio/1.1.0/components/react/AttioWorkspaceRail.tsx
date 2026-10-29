import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AttioNavItem } from './AttioBlocks';
import { Icon, type IconName } from './AttioIcon';

export type AttioWorkspaceOption = { id: string; name: string; initials: string; color?: string };
export type AttioRailItem = { id: string; label: string; icon: IconName; active?: boolean; badge?: number; meta?: string; iconTone?: 'blue' | 'cyan' | 'orange' | 'purple' };
export type AttioWorkspaceRailModel = {
  workspace: AttioWorkspaceOption;
  collapsed?: boolean;
  workspaces?: AttioWorkspaceOption[];
  primary: AttioRailItem[];
  favorites?: AttioRailItem[];
  records: AttioRailItem[];
  lists?: AttioRailItem[];
  chats?: AttioRailItem[];
  trialDays?: number;
  upgradeLabel?: string;
};
export type AttioWorkspaceRailActions = {
  onNavigate: (id: string) => void;
  onSearch: () => void;
  onToggleCollapsed?: () => void;
  onInbox?: () => void;
  onSwitchWorkspace?: (id: string) => void;
  onCreateWorkspace?: () => void;
  onAccountSettings?: () => void;
  onWorkspaceSettings?: () => void;
  onInviteMembers?: () => void;
  onCreateList?: () => void;
  onCreateChat?: () => void;
  onUpgrade?: () => void;
  onSignOut?: () => void;
};

function WorkspaceMark({ workspace }: { workspace: AttioWorkspaceOption }) {
  return <span className="at-workspace-rail__mark" style={{ '--at-workspace-mark': workspace.color ?? '#ef4591' } as CSSProperties} aria-hidden="true">{workspace.initials.slice(0, 1).toUpperCase()}</span>;
}

function RailSection({ label, items, actions, collapsed = false }: { label: string; items?: AttioRailItem[]; actions: AttioWorkspaceRailActions; collapsed?: boolean }) {
  const [open, setOpen] = useState(true);
  if (!items?.length) return null;
  return <section className="at-workspace-rail__section">
    <button type="button" className="at-workspace-rail__section-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Icon name="chevron" size={13}/><span>{label}</span></button>
    <div className={`at-workspace-rail__section-items${open ? ' is-open' : ''}`} aria-hidden={!open}><div>{items.map((item) => <AttioNavItem key={item.id} icon={item.icon} iconTone={item.iconTone} badge={item.badge} active={item.active} title={collapsed ? item.label : undefined} onClick={() => actions.onNavigate(item.id)}>{item.label}{item.meta && <small>{item.meta}</small>}</AttioNavItem>)}</div></div>
  </section>;
}

export function AttioWorkspaceRail({ model, actions }: { model: AttioWorkspaceRailModel; actions: AttioWorkspaceRailActions }) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!workspaceOpen) return;
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setWorkspaceOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setWorkspaceOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [workspaceOpen]);
  const chooseWorkspace = (id: string) => { actions.onSwitchWorkspace?.(id); setWorkspaceOpen(false); };
  const workspaceActions = [
    { label: 'Account settings', icon: 'people' as IconName, action: actions.onAccountSettings },
    { label: 'Workspace settings', icon: 'settings' as IconName, action: actions.onWorkspaceSettings },
    { label: 'Invite members', icon: 'plus' as IconName, action: actions.onInviteMembers },
  ].filter((item) => item.action);
  return <aside className={`at-sidebar at-workspace-rail${model.collapsed ? ' is-collapsed' : ''}`}>
    <div className="at-workspace-rail__workspace" ref={menuRef}>
      {model.collapsed ? <button type="button" className="at-workspace-rail__workspace-trigger at-workspace-rail__workspace-trigger--collapsed" aria-label="Expand navigation" title="Expand navigation" onClick={actions.onToggleCollapsed}><WorkspaceMark workspace={model.workspace}/><strong>{model.workspace.name}</strong><span className="at-workspace-rail__expand-icon"><Icon name="panel" size={17}/></span></button> : <div className="at-workspace-rail__workspace-row"><button ref={triggerRef} type="button" className="at-workspace-rail__workspace-trigger" aria-haspopup="menu" aria-expanded={workspaceOpen} onClick={() => setWorkspaceOpen((value) => !value)}><WorkspaceMark workspace={model.workspace}/><strong>{model.workspace.name}</strong><Icon name="chevron" size={14}/></button>{actions.onToggleCollapsed && <button type="button" className="at-workspace-rail__collapse" aria-label="Collapse navigation" title="Collapse navigation" onClick={actions.onToggleCollapsed}><Icon name="panel" size={17}/></button>}</div>}
      {workspaceOpen && <div className="at-workspace-rail__workspace-menu" role="menu">
        {(model.workspaces?.length ? model.workspaces : [model.workspace]).map((workspace) => <button type="button" role="menuitemradio" aria-checked={workspace.id === model.workspace.id} key={workspace.id} onClick={() => chooseWorkspace(workspace.id)}><WorkspaceMark workspace={workspace}/><span>{workspace.name}</span>{workspace.id === model.workspace.id && <Icon name="check" size={14}/>}</button>)}
        {actions.onCreateWorkspace && <button type="button" role="menuitem" onClick={() => { actions.onCreateWorkspace?.(); setWorkspaceOpen(false); }}><Icon name="plus"/><span>New workspace</span></button>}
        {!!workspaceActions.length && <div className="at-workspace-rail__menu-divider"/>}
        {workspaceActions.map((item) => <button type="button" role="menuitem" key={item.label} onClick={() => { item.action?.(); setWorkspaceOpen(false); }}><Icon name={item.icon}/><span>{item.label}</span></button>)}
        {actions.onSignOut && <><div className="at-workspace-rail__menu-divider"/><button type="button" role="menuitem" onClick={() => { actions.onSignOut?.(); setWorkspaceOpen(false); }}><Icon name="arrow"/><span>Sign out</span></button></>}
      </div>}
    </div>
    <div className={`at-workspace-rail__search-row${actions.onInbox ? '' : ' at-workspace-rail__search-row--single'}`}><button type="button" className="at-framework__search-trigger" onClick={actions.onSearch}><Icon name="search"/><span>Search</span><kbd>⌘</kbd><kbd>K</kbd></button>{actions.onInbox && <button type="button" className="at-workspace-rail__inbox" aria-label="Inbox" onClick={actions.onInbox}><Icon name="mail"/></button>}</div>
    <nav className="at-workspace-rail__body" aria-label="Workspace">
      <div className="at-workspace-rail__primary">{model.primary.map((item) => <AttioNavItem key={item.id} icon={item.icon} iconTone={item.iconTone} badge={item.badge} active={item.active} title={model.collapsed ? item.label : undefined} onClick={() => actions.onNavigate(item.id)}>{item.label}</AttioNavItem>)}</div>
      <RailSection label="Favorites" items={model.favorites} actions={actions} collapsed={model.collapsed}/>
      <RailSection label="Records" items={model.records} actions={actions} collapsed={model.collapsed}/>
      <RailSection label="Lists" items={model.lists} actions={actions} collapsed={model.collapsed}/>
      {actions.onCreateList && <button type="button" className="at-workspace-rail__create" onClick={actions.onCreateList}><Icon name="plus"/>New list</button>}
      <RailSection label="Chats" items={model.chats} actions={actions} collapsed={model.collapsed}/>
      {actions.onCreateChat && <button type="button" className="at-workspace-rail__create" onClick={actions.onCreateChat}><Icon name="plus"/>New chat</button>}
    </nav>
    <div className="at-workspace-rail__footer">
      {actions.onInviteMembers && <button type="button" onClick={actions.onInviteMembers}><Icon name="people"/><span>Invite members</span></button>}
      {model.trialDays !== undefined && <div className="at-workspace-rail__trial"><Icon name="spark"/><span>{model.trialDays} days left on trial!</span>{actions.onUpgrade && <button type="button" onClick={actions.onUpgrade}>{model.upgradeLabel ?? 'Keep Pro'}</button>}</div>}
    </div>
  </aside>;
}
