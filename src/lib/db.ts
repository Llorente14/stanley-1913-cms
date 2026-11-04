// Tiny relational engine over localStorage. Every write is validated against SCHEMA
// (NOT NULL, ENUM, length, CHECK, UNIQUE, FK) and deletes follow ON DELETE actions.
import { SCHEMA, TABLES, type Row, type TableName, type TableDef, type Column } from './schema.ts';

export const STORAGE_PREFIX = 'stanley-admin:';
const DB_KEY = STORAGE_PREFIX + 'db';
export const DB_VERSION = 1;

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

interface DbState {
  version: number;
  tables: Record<TableName, Row[]>;
  seq: Record<TableName, number>;
}

export class DbError extends Error {
  constraint: string;
  field?: string;
  constructor(message: string, constraint: string, field?: string) {
    super(message);
    this.name = 'DbError';
    this.constraint = constraint;
    this.field = field;
  }
}

type Listener = () => void;

let storage: StorageLike | null = null;
let state: DbState | null = null;
let seedProvider: (() => Record<TableName, Row[]>) | null = null;
let inTx = false;
const listeners = new Set<Listener>();

export function configure(opts: { storage: StorageLike; seed: () => Record<TableName, Row[]> }) {
  storage = opts.storage;
  seedProvider = opts.seed;
  state = null;
}

function emptyState(): DbState {
  const tables = {} as Record<TableName, Row[]>;
  const seq = {} as Record<TableName, number>;
  for (const t of TABLES) {
    tables[t] = [];
    seq[t] = 0;
  }
  return { version: DB_VERSION, tables, seq };
}

function ensure(): DbState {
  if (state) return state;
  if (!storage) throw new Error('db not configured');
  const raw = storage.getItem(DB_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed.version === DB_VERSION) {
        state = parsed;
        return state;
      }
    } catch {
      /* fall through to reseed */
    }
  }
  state = emptyState();
  if (seedProvider) loadSeed(seedProvider());
  return state;
}

/** Insert a full dataset through the validating path (used for seeding and check:seed). */
export function loadSeed(data: Record<TableName, Row[]>) {
  state = emptyState();
  const order: TableName[] = [
    'customer', 'membership', 'customer_address', 'category', 'product', 'promo_code',
    'store', 'orders', 'order_item', 'payment', 'shipment', 'review', 'warranty_claim',
  ];
  transaction(() => {
    for (const t of order) for (const row of data[t] ?? []) insert(t, row);
  });
}

function persist() {
  if (inTx || !storage || !state) return;
  try {
    storage.setItem(DB_KEY, JSON.stringify(state));
  } catch {
    throw new DbError('Penyimpanan browser penuh (kuota localStorage). Hapus atau perkecil gambar yang diunggah.', 'storage_quota');
  }
  listeners.forEach((l) => l());
}

export function onChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function storageBytes(): number {
  if (!storage) return 0;
  return (storage.getItem(DB_KEY) ?? '').length * 2;
}

// ---------- reads ----------
export function all<T extends Row = Row>(t: TableName): T[] {
  return ensure().tables[t] as T[];
}

export function keyOf(t: TableName, row: Row): string {
  return SCHEMA[t].pk.map((c) => String(row[c])).join('|');
}

export function get<T extends Row = Row>(t: TableName, key: string | number): T | undefined {
  const k = String(key);
  return all<T>(t).find((r) => keyOf(t, r) === k);
}

export function where<T extends Row = Row>(t: TableName, pred: (r: T) => boolean): T[] {
  return all<T>(t).filter(pred);
}

// ---------- normalisation & validation ----------
const isEmpty = (v: unknown) => v === null || v === undefined || v === '';

function normalise(col: Column, v: unknown): unknown {
  if (isEmpty(v)) return null;
  switch (col.type) {
    case 'int': {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d-]/g, ''));
      return Number.isFinite(n) ? Math.trunc(n) : NaN;
    }
    case 'money':
    case 'decimal': {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : NaN;
    }
    case 'bool':
      return v === true || v === 'true' || v === 1 || v === '1' || v === 'on';
    default:
      return typeof v === 'string' ? v.trim() : String(v);
  }
}

function validate(def: TableDef, row: Row, selfKey: string | null) {
  for (const col of def.columns) {
    const v = row[col.name];
    if (col.auto && isEmpty(v)) continue;
    if (isEmpty(v)) {
      if (col.required && col.type !== 'bool') throw new DbError(`${col.label} (${col.name}) wajib diisi.`, 'NOT NULL', col.name);
      continue;
    }
    if ((col.type === 'int' || col.type === 'money' || col.type === 'decimal') && Number.isNaN(v))
      throw new DbError(`${col.label} (${col.name}) harus berupa angka.`, 'domain', col.name);
    if (col.values && !col.values.includes(v)) throw new DbError(`${col.label}: nilai "${v}" tidak ada di ENUM.`, 'ENUM', col.name);
    if (typeof v === 'string') {
      if (col.max && v.length > col.max && !(col.name === 'image_url'))
        throw new DbError(`${col.label} maksimal ${col.max} karakter (VARCHAR(${col.max})).`, 'domain', col.name);
      if (col.exact && v.length !== col.exact)
        throw new DbError(`${col.label} harus tepat ${col.exact} karakter (CHAR(${col.exact})).`, 'domain', col.name);
      if (col.pattern && !col.pattern.test(v))
        throw new DbError(`${col.label} tidak valid: ${col.patternHint ?? 'format salah'}.`, 'domain', col.name);
      if ((col.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) || (col.type === 'datetime' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)))
        throw new DbError(`${col.label} bukan tanggal yang valid.`, 'domain', col.name);
    }
    if (typeof v === 'number') {
      if (col.min !== undefined && v < col.min) throw new DbError(`${col.label} tidak boleh kurang dari ${col.min}.`, `CHECK (${col.name} >= ${col.min})`, col.name);
      if (col.maxValue !== undefined && v > col.maxValue)
        throw new DbError(`${col.label} tidak boleh lebih dari ${col.maxValue}.`, `CHECK (${col.name} <= ${col.maxValue})`, col.name);
    }
  }

  for (const chk of def.checks) if (!chk.test(row)) throw new DbError(chk.message, chk.name);

  const rows = ensure().tables[def.name];
  // Entity integrity (composite PK) + alternate keys
  const keys = [def.pk, ...def.unique];
  for (const cols of keys) {
    if (cols.some((c) => isEmpty(row[c]))) continue;
    const clash = rows.find((r) => keyOf(def.name, r) !== selfKey && cols.every((c) => r[c] === row[c]));
    if (clash) {
      const label = cols.map((c) => def.columns.find((x) => x.name === c)?.label ?? c).join(' + ');
      throw new DbError(`${label} "${cols.map((c) => row[c]).join(', ')}" sudah dipakai. Nilai harus unik.`, `UNIQUE (${cols.join(', ')})`, cols[0]);
    }
  }

  // Referential integrity (MATCH SIMPLE: any NULL column skips the check)
  for (const fk of def.fks) {
    const vals = fk.columns.map((c) => row[c]);
    if (vals.some(isEmpty)) {
      if (!fk.nullable) throw new DbError(`${fk.columns.join(', ')} wajib diisi.`, 'NOT NULL', fk.columns[0]);
      continue;
    }
    const parent = ensure().tables[fk.refTable].find((p) => fk.refColumns.every((rc, i) => p[rc] === vals[i]));
    if (!parent)
      throw new DbError(
        `Referensi tidak ditemukan: ${def.name}.${fk.columns.join(', ')} → ${fk.refTable}(${fk.refColumns.join(', ')}).`,
        `FOREIGN KEY (${fk.columns.join(', ')})`,
        fk.columns[0],
      );
  }
}

function coerce(def: TableDef, input: Row): Row {
  const out: Row = {};
  for (const col of def.columns) out[col.name] = normalise(col, input[col.name]);
  return out;
}

// ---------- writes ----------
export function insert<T extends Row = Row>(t: TableName, input: Row): T {
  const s = ensure();
  const def = SCHEMA[t];
  const row = coerce(def, input);
  const autoCol = def.columns.find((c) => c.auto);
  if (autoCol) {
    if (isEmpty(row[autoCol.name])) row[autoCol.name] = s.seq[t] + 1;
  }
  validate(def, row, null);
  if (autoCol) s.seq[t] = Math.max(s.seq[t], row[autoCol.name]);
  s.tables[t].push(row);
  persist();
  return row as T;
}

export function update<T extends Row = Row>(t: TableName, key: string | number, patch: Row): T {
  const s = ensure();
  const def = SCHEMA[t];
  const k = String(key);
  const idx = s.tables[t].findIndex((r) => keyOf(t, r) === k);
  if (idx < 0) throw new DbError(`Baris ${def.label} #${k} tidak ditemukan.`, 'not_found');
  const current = s.tables[t][idx];
  const next = coerce(def, { ...current, ...patch });
  for (const c of def.pk) next[c] = current[c];
  validate(def, next, k);
  s.tables[t][idx] = next;
  persist();
  return next as T;
}

interface DeletePlan {
  remove: Array<{ t: TableName; key: string }>;
  setNull: Array<{ t: TableName; key: string; cols: string[] }>;
}

function planDelete(t: TableName, row: Row, plan: DeletePlan, seen: Set<string>) {
  const tag = t + ':' + keyOf(t, row);
  if (seen.has(tag)) return;
  seen.add(tag);
  plan.remove.push({ t, key: keyOf(t, row) });
  for (const child of TABLES) {
    for (const fk of SCHEMA[child].fks) {
      if (fk.refTable !== t) continue;
      const kids = ensure().tables[child].filter((c) => fk.columns.every((col, i) => c[col] === row[fk.refColumns[i]]));
      if (!kids.length) continue;
      if (fk.onDelete === 'RESTRICT') {
        throw new DbError(
          `Tidak bisa dihapus: masih dipakai ${kids.length} baris di ${SCHEMA[child].label} (${child}.${fk.columns.join(', ')}). Aturan ON DELETE RESTRICT menjaga histori.`,
          `ON DELETE RESTRICT ${child}.${fk.columns.join(', ')}`,
        );
      }
      for (const kid of kids) {
        if (fk.onDelete === 'CASCADE') planDelete(child, kid, plan, seen);
        else plan.setNull.push({ t: child, key: keyOf(child, kid), cols: fk.columns.filter((c) => !SCHEMA[child].pk.includes(c)) });
      }
    }
  }
}

/** Delete with ON DELETE semantics. Returns the cascade summary. */
export function remove(t: TableName, key: string | number): DeletePlan {
  const s = ensure();
  const row = get(t, key);
  if (!row) throw new DbError(`Baris tidak ditemukan.`, 'not_found');
  const plan: DeletePlan = { remove: [], setNull: [] };
  planDelete(t, row, plan, new Set());
  const removing = new Set(plan.remove.map((r) => r.t + ':' + r.key));
  for (const sn of plan.setNull) {
    if (removing.has(sn.t + ':' + sn.key)) continue;
    const r = s.tables[sn.t].find((x) => keyOf(sn.t, x) === sn.key);
    if (r) for (const c of sn.cols) r[c] = null;
  }
  for (const tn of TABLES) s.tables[tn] = s.tables[tn].filter((r) => !removing.has(tn + ':' + keyOf(tn, r)));
  persist();
  return plan;
}

/** Atomic multi-write: all or nothing, one persist at the end. */
export function transaction<R>(fn: () => R): R {
  const s = ensure();
  if (inTx) return fn();
  const snapshot = JSON.stringify(s);
  inTx = true;
  try {
    const out = fn();
    inTx = false;
    persist();
    return out;
  } catch (e) {
    inTx = false;
    state = JSON.parse(snapshot);
    throw e;
  }
}

export function nextId(t: TableName): number {
  return ensure().seq[t] + 1;
}
