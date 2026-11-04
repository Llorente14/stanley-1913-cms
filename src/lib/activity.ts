import { STORAGE_PREFIX } from './db.ts';

const KEY = STORAGE_PREFIX + 'activity';
export type Action = 'create' | 'update' | 'delete' | 'status' | 'login' | 'export';
export interface Entry { at: string; action: Action; table: string; title: string; detail?: string[] }

export function log(action: Action, table: string, title: string, detail?: string[]) {
  try {
    const list = entries();
    list.unshift({ at: new Date().toISOString(), action, table, title, detail });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 300)));
  } catch { /* log is best-effort */ }
}

export function entries(): Entry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}
