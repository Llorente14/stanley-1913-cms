import { ENUM_LABELS } from './schema.ts';

const rp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
export const rupiah = (n: number | null | undefined) => (n == null ? '—' : rp.format(n).replace(/ /g, ' '));
export const number = (n: number) => new Intl.NumberFormat('id-ID').format(n);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export function date(v: string | null | undefined) {
  if (!v) return '—';
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function dateTime(v: string | null | undefined) {
  if (!v) return '—';
  return `${date(v)}, ${v.slice(11, 16)}`;
}
export function relative(v: string) {
  const diff = (Date.now() - new Date(v).getTime()) / 1000;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} hari lalu`;
  return date(v);
}
export const enumLabel = (v: string | null | undefined) => (v ? ENUM_LABELS[v] ?? v : '—');

export function esc(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const TONE: Record<string, string> = {
  completed: 'ok', paid: 'ok', delivered: 'ok', approved: 'ok',
  confirmed: 'info', packed: 'info', shipped: 'info', under_review: 'info',
  pending: 'warn', awaiting_payment: 'warn', submitted: 'warn',
  cancelled: 'bad', failed: 'bad', expired: 'bad', rejected: 'bad',
};
export const badge = (v: string) => `<span class="badge ${TONE[v] ?? ''}">${esc(enumLabel(v))}</span>`;
export const tier = (v: string) => `<span class="tier ${v}">${esc(enumLabel(v))}</span>`;
