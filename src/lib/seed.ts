// Loads seed-data.json and shifts every timestamp so the demo is always "recent":
// the generator anchored dates to `anchor`; we move them by (today − anchor) whole days.
import raw from './seed-data.json' with { type: 'json' };
import { SCHEMA, TABLES, type Row, type TableName } from './schema.ts';

const KEEP = new Set(['birth_date']);

function shift(value: string, days: number): string {
  const isDate = value.length === 10;
  const d = new Date(isDate ? value + 'T12:00:00' : value);
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return isDate ? date : `${date}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function seedData(today = new Date()): Record<TableName, Row[]> {
  const anchor = new Date(raw.anchor + 'T12:00:00');
  const t = new Date(today);
  t.setHours(12, 0, 0, 0);
  let days = Math.round((t.getTime() - anchor.getTime()) / 86400000);
  const tables = raw.tables as unknown as Record<TableName, Row[]>;
  // Never let a shifted event land in the future (seed hours can be later than "now").
  const p = (n: number) => String(n).padStart(2, '0');
  const nowStr = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}T${p(today.getHours())}:${p(today.getMinutes())}`;
  const events: Array<[TableName, string]> = [['orders', 'ordered_at'], ['payment', 'paid_at'], ['shipment', 'shipped_at'], ['shipment', 'delivered_at'], ['review', 'created_at'], ['warranty_claim', 'submitted_at'], ['warranty_claim', 'resolved_at']];
  const latest = events.flatMap(([tn, col]) => (tables[tn] ?? []).map((r) => r[col]).filter(Boolean)).sort().pop();
  if (latest && shift(latest, days) > nowStr) days -= 1;
  const out = {} as Record<TableName, Row[]>;
  for (const name of TABLES) {
    const cols = SCHEMA[name].columns.filter((c) => (c.type === 'date' || c.type === 'datetime') && !KEEP.has(c.name));
    out[name] = (tables[name] ?? []).map((r) => {
      const row = { ...r };
      for (const c of cols) if (typeof row[c.name] === 'string') row[c.name] = shift(row[c.name], days);
      return row;
    });
  }
  return out;
}
