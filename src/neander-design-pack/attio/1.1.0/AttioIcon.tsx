export type IconName = 'search' | 'chevron' | 'people' | 'company' | 'task' | 'note' | 'mail' | 'chat' | 'comments' | 'help' | 'more' | 'settings' | 'filter' | 'sort' | 'plus' | 'bolt' | 'clock' | 'panel' | 'close' | 'send' | 'chart' | 'folder' | 'grid' | 'activity' | 'check' | 'star' | 'link' | 'copy' | 'arrow' | 'globe' | 'spark' | 'download' | 'undo' | 'redo' | 'hand' | 'cursor' | 'fit';

const iconPaths: Record<IconName, string> = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 4 4', chevron: 'm6 9 6 6 6-6',
  people: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-16a4 4 0 0 1 0 8m6 8v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  company: 'M3 21V4a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v17M3 21h18M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2',
  task: 'M9 12l2 2 4-4M4 4h16v16H4z', note: 'M5 3h10l4 4v14H5zM15 3v5h4', mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  chat: 'M21 15a4 4 0 0 1-4 4H8l-5 3v-7a4 4 0 0 1-1-2.65V8a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v4a4 4 0 0 1-1 3Z',
  comments: 'M4 4h11a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H9l-4 3v-3l1-4a4 4 0 0 1-3-3V8a4 4 0 0 1 4-4Zm15 5h1a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-1',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-3-13a3 3 0 1 1 4.5 2.6c-1 .58-1.5 1.15-1.5 2.4m0 4h.01',
  more: 'M12 5h.01M12 12h.01M12 19h.01', settings: 'M12 2v3m0 14v3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M2 12h3m14 0h3M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  filter: 'M3 4h18l-7 8v6l-4 2v-8z', sort: 'M8 3v18m0-18-4 4m4-4 4 4m4 14V3m0 18-4-4m4 4 4-4',
  plus: 'M12 4v16M4 12h16', bolt: 'm13 2-9 12h7l-1 8 10-13h-7z', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-15v5l3 2',
  panel: 'M3 4h18v16H3zM8 4v16', close: 'M4 4l16 16M20 4 4 20', send: 'm3 3 18 9-18 9 4-9z',
  chart: 'M4 20V5m5 15V9m5 11V3m5 17v-7', folder: 'M3 6h7l2 2h9v12H3z', grid: 'M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z',
  activity: 'M2 12h4l3-8 5 16 3-8h5', check: 'M4 12l5 5L20 6', star: 'm12 2 3 7 7 .6-5.4 4.7 1.8 7-6.4-3.8-6.4 3.8 1.8-7L2 9.6 9 9z',
  link: 'M10 13a5 5 0 0 0 7 .3l3-3a5 5 0 0 0-7-7l-2 2m3 5a5 5 0 0 0-7-.3l-3 3a5 5 0 0 0 7 7l2-2',
  copy: 'M8 8h13v13H8zM4 16H3V3h13v1', arrow: 'M5 12h14m-6-6 6 6-6 6', globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2c-5 5-5 15 0 20m0-20c5 5 5 15 0 20',
  undo: 'M3 9h10a6 6 0 0 1 0 12H9M3 9l5-5M3 9l5 5',
  redo: 'M21 9H11a6 6 0 0 0 0 12h4M21 9l-5-5M21 9l-5 5',
  hand: 'M8 13V6a2 2 0 0 1 4 0v6m0-7a2 2 0 0 1 4 0v7m0-5a2 2 0 0 1 4 0v7c0 5-3 8-7 8h-1c-3 0-4-2-6-4l-3-4a2 2 0 0 1 3-2l2 2M8 8V4a2 2 0 0 1 4 0',
  cursor: 'M4 3l6 18 3-8 8-3L4 3Z',
  fit: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  spark: 'm12 2 2 7 7 2-7 2-2 7-2-7-7-2 7-2z', download: 'M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3',
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name]} /></svg>;
}
