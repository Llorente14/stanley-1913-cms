import { STORAGE_PREFIX } from './db.ts';

// Prototype-only credentials (no real security; documented in README).
export const ADMIN = { email: 'admin@stanley1913.id', password: 'Stanley1913!', name: 'Admin Stanley' };
const KEY = STORAGE_PREFIX + 'session';

export function login(email: string, password: string) {
  if (email.trim().toLowerCase() !== ADMIN.email || password !== ADMIN.password) return false;
  localStorage.setItem(KEY, JSON.stringify({ email: ADMIN.email, name: ADMIN.name, at: new Date().toISOString() }));
  return true;
}
export function logout() {
  localStorage.removeItem(KEY);
}
export function session(): { email: string; name: string } | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
}
