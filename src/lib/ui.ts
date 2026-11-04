// Small UI kit: toasts, confirm dialog, schema-aware form dialog, data table.
import { DbError, onChange } from './db.ts';
import { esc } from './format.ts';
import { icon } from './icons.ts';
import { compressImage } from './image.ts';
import { downloadCsv } from './csv.ts';
import type { Row } from './schema.ts';

// ---------- toast ----------
function host() {
  let h = document.querySelector<HTMLElement>('.toasts');
  if (!h) {
    h = document.createElement('div');
    h.className = 'toasts';
    h.setAttribute('role', 'status');
    h.setAttribute('aria-live', 'polite');
    document.body.append(h);
  }
  return h;
}

export function toast(title: string, opts: { detail?: string[]; tone?: 'bad'; code?: string; ms?: number } = {}) {
  const t = document.createElement('div');
  t.className = 'toast' + (opts.tone ? ' ' + opts.tone : '');
  t.innerHTML = `<b>${esc(title)}</b>${opts.code ? `<code>${esc(opts.code)}</code>` : ''}${
    opts.detail?.length ? `<ul>${opts.detail.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''
  }`;
  host().append(t);
  setTimeout(() => {
    t.classList.add('leaving');
    setTimeout(() => t.remove(), 260);
  }, opts.ms ?? (opts.tone ? 6500 : 4200));
}

export function handleError(e: unknown) {
  if (e instanceof DbError) toast(e.message, { tone: 'bad', code: e.constraint });
  else toast(e instanceof Error ? e.message : 'Terjadi kesalahan.', { tone: 'bad' });
}

/** Run a write; on success toast + optional effects list. Returns true on success. */
export function attempt(fn: () => string[] | void, success: string): boolean {
  try {
    const fx = fn();
    toast(success, { detail: fx || undefined });
    return true;
  } catch (e) {
    handleError(e);
    return false;
  }
}

// ---------- dialogs ----------
function makeDialog(cls = '') {
  const d = document.createElement('dialog');
  d.className = 'modal ' + cls;
  document.body.append(d);
  d.addEventListener('close', () => setTimeout(() => d.remove(), 50));
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  return d;
}

export function confirmDialog(o: { title: string; body: string; confirm: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const d = makeDialog('sm');
    d.innerHTML = `<form method="dialog">
      <div class="modal-head"><div><h2>${esc(o.title)}</h2><p>${o.body}</p></div></div>
      <div class="modal-foot">
        <button class="c-btn c-btn--outline c-btn--sm" value="no">batal</button>
        <button class="c-btn ${o.danger ? 'c-btn--danger' : ''} c-btn--sm" value="yes">${esc(o.confirm)}</button>
      </div></form>`;
    d.addEventListener('close', () => resolve(d.returnValue === 'yes'));
    d.showModal();
  });
}

export type FieldType = 'text' | 'email' | 'tel' | 'number' | 'money' | 'decimal' | 'textarea' | 'select' | 'checkbox' | 'date' | 'datetime' | 'image';
export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  options?: Array<[string | number, string]>;
  required?: boolean;
  help?: string;
  full?: boolean;
  placeholder?: string;
  col?: string | false;
  min?: number;
  max?: number;
}

function fieldHtml(f: FieldDef, value: unknown) {
  const id = 'f_' + f.name;
  const v = value ?? '';
  const col = f.col === false ? '' : `<span class="col">${esc(f.col ?? f.name)}</span>`;
  const req = f.required ? '<span class="req" aria-hidden="true">*</span>' : '';
  const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
  const common = `id="${id}" name="${f.name}" ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}`;
  let control = '';
  switch (f.type ?? 'text') {
    case 'textarea':
      control = `<textarea class="textarea" ${common}>${esc(v)}</textarea>`;
      break;
    case 'select':
      control = `<select class="select" ${common}>${f.required ? '' : '<option value="">— kosong (NULL) —</option>'}${(f.options ?? [])
        .map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`)
        .join('')}</select>`;
      break;
    case 'checkbox':
      return `<div class="field ${f.full ? 'full' : ''}" data-field="${f.name}"><span class="label">&nbsp;</span>
        <label class="check"><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}/> ${esc(f.label)} ${col}</label>${help}<span class="error" hidden></span></div>`;
    case 'image':
      return `<div class="field full" data-field="${f.name}"><span class="label">${esc(f.label)} ${col}</span>
        <div class="img-field">
          <div class="preview">${v ? `<img src="${esc(v)}" alt="">` : icon('image')}</div>
          <div class="stack">
            <input type="hidden" name="${f.name}" value="${esc(v)}">
            <input class="input" type="url" data-url placeholder="https://… atau unggah file" value="${String(v).startsWith('data:') ? '' : esc(v)}">
            <div class="inline-actions">
              <label class="c-btn c-btn--outline c-btn--sm">${icon('image')} unggah gambar<input type="file" accept="image/*" hidden data-file></label>
              <button type="button" class="c-btn c-btn--ghost c-btn--sm" data-clear>hapus gambar</button>
            </div>
            <span class="help">${String(v).startsWith('data:') ? 'Gambar unggahan tersimpan di browser (WebP 400px).' : 'Unggahan dikompres otomatis ke WebP 400px agar muat di localStorage.'}</span>
          </div>
        </div><span class="error" hidden></span></div>`;
    default: {
      const t = f.type ?? 'text';
      const type = t === 'money' || t === 'number' || t === 'decimal' ? 'number' : t === 'datetime' ? 'datetime-local' : t;
      const step = t === 'decimal' ? 'any' : t === 'money' ? '1000' : '1';
      control = `<input class="input ${t === 'money' || t === 'number' ? 'num' : ''}" type="${type}" ${type === 'number' ? `step="${step}" inputmode="decimal"` : ''} ${
        f.min !== undefined ? `min="${f.min}"` : ''
      } ${f.max !== undefined ? `max="${f.max}"` : ''} value="${esc(v)}" ${common}>`;
    }
  }
  return `<div class="field ${f.full ? 'full' : ''}" data-field="${f.name}"><label for="${id}">${esc(f.label)} ${req} ${col}</label>${control}${help}<span class="error" hidden></span></div>`;
}

export function openForm(o: {
  title: string;
  subtitle?: string;
  fields: FieldDef[];
  values?: Row;
  submit: string;
  danger?: boolean;
  onSubmit: (values: Row) => string[] | void;
  success?: string;
}) {
  const d = makeDialog(o.fields.length <= 2 ? 'sm' : '');
  d.innerHTML = `<form novalidate>
    <div class="modal-head"><div><h2>${esc(o.title)}</h2>${o.subtitle ? `<p>${o.subtitle}</p>` : ''}</div>
      <button type="button" class="c-btn c-btn--ghost c-btn--icon" data-close aria-label="Tutup">${icon('x')}</button></div>
    <div class="modal-body">${o.fields.map((f) => fieldHtml(f, o.values?.[f.name])).join('')}</div>
    <div class="modal-foot">
      <button type="button" class="c-btn c-btn--outline c-btn--sm" data-close>batal</button>
      <button type="submit" class="c-btn c-btn--sm ${o.danger ? 'c-btn--danger' : ''}">${esc(o.submit)}</button>
    </div></form>`;
  const form = d.querySelector('form')!;
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));

  // image fields
  d.querySelectorAll<HTMLElement>('.img-field').forEach((wrap) => {
    const hidden = wrap.querySelector<HTMLInputElement>('input[type=hidden]')!;
    const url = wrap.querySelector<HTMLInputElement>('[data-url]')!;
    const prev = wrap.querySelector<HTMLElement>('.preview')!;
    const set = (v: string) => {
      hidden.value = v;
      prev.innerHTML = v ? `<img src="${esc(v)}" alt="">` : icon('image');
    };
    url.addEventListener('input', () => set(url.value.trim()));
    wrap.querySelector('[data-clear]')!.addEventListener('click', () => {
      url.value = '';
      set('');
    });
    wrap.querySelector<HTMLInputElement>('[data-file]')!.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const data = await compressImage(file);
        url.value = '';
        set(data);
        toast(`Gambar dikompres: ${Math.round((data.length * 0.75) / 1024)} KB`);
      } catch (err) {
        handleError(err);
      }
    });
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('.field').forEach((f) => {
      f.classList.remove('invalid');
      f.querySelector('.error')?.setAttribute('hidden', '');
    });
    form.querySelector('.form-error')?.remove();
    const values: Row = {};
    for (const f of o.fields) {
      const el = form.elements.namedItem(f.name) as HTMLInputElement | null;
      if (!el) continue;
      values[f.name] = f.type === 'checkbox' ? el.checked : el.value;
    }
    try {
      const fx = o.onSubmit(values);
      d.close();
      if (o.success) toast(o.success, { detail: fx || undefined });
    } catch (err) {
      if (err instanceof DbError) {
        const box = err.field ? form.querySelector<HTMLElement>(`.field[data-field="${err.field}"]`) : null;
        if (box) {
          box.classList.add('invalid');
          const msg = box.querySelector<HTMLElement>('.error')!;
          msg.textContent = `${err.message} (${err.constraint})`;
          msg.removeAttribute('hidden');
          box.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea')?.focus();
        } else {
          const div = document.createElement('div');
          div.className = 'form-error';
          div.setAttribute('role', 'alert');
          div.innerHTML = `<span>${esc(err.message)}</span><code>${esc(err.constraint)}</code>`;
          form.querySelector('.modal-body')!.prepend(div);
        }
      } else handleError(err);
    }
  });
  d.showModal();
  return d;
}

// ---------- data table ----------
export interface ColumnDef {
  key: string;
  label: string;
  code?: string | false;
  html: (r: Row) => string;
  sort?: (r: Row) => string | number;
  csv?: (r: Row) => unknown;
  cls?: string;
  hidden?: boolean; // CSV-only column
}
export interface FilterDef {
  key: string;
  label: string;
  options: Array<[string, string]>;
  test: (r: Row, v: string) => boolean;
}
export interface TableConfig {
  rows: () => Row[];
  columns: ColumnDef[];
  search?: (r: Row) => string;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  actions?: (r: Row) => string;
  onRow?: (r: Row) => void;
  rowKey: (r: Row) => string;
  csvName?: string;
  empty?: string;
  pageSize?: number;
  defaultSort?: { key: string; dir: 1 | -1 };
  toolbarExtra?: string;
}

export function mountTable(el: HTMLElement, cfg: TableConfig) {
  const st = { q: '', f: {} as Record<string, string>, sort: cfg.defaultSort ?? null, page: 0 };
  const size = cfg.pageSize ?? 15;
  const shown = cfg.columns.filter((c) => !c.hidden);
  // restore filters from URL (e.g. /orders?status=pending)
  const params = new URLSearchParams(location.search);
  for (const f of cfg.filters ?? []) if (params.get(f.key)) st.f[f.key] = params.get(f.key)!;
  if (params.get('q')) st.q = params.get('q')!;

  el.classList.add('panel');
  el.innerHTML = `<div class="toolbar">
      ${cfg.search ? `<label class="search"><span class="sr-only">Cari</span>${icon('search')}<input class="input" type="search" placeholder="${esc(cfg.searchPlaceholder ?? 'Cari…')}" value="${esc(st.q)}" data-q></label>` : ''}
      ${(cfg.filters ?? [])
        .map(
          (f) => `<label><span class="sr-only">${esc(f.label)}</span><select class="select" data-filter="${f.key}"><option value="">${esc(f.label)}: semua</option>${f.options
            .map(([v, l]) => `<option value="${esc(v)}" ${st.f[f.key] === v ? 'selected' : ''}>${esc(l)}</option>`)
            .join('')}</select></label>`,
        )
        .join('')}
      ${cfg.toolbarExtra ?? ''}
      <span class="info" data-info></span>
      ${cfg.csvName ? `<button class="c-btn c-btn--outline c-btn--sm" data-csv>${icon('download')} export csv</button>` : ''}
    </div>
    <div class="table-wrap"><table class="data"><thead><tr>${shown
      .map((c) => {
        const code = c.code === false ? '' : `<span class="col">${esc(c.code ?? c.key)}</span>`;
        const inner = c.sort ? `<button type="button" data-sort="${c.key}"><span class="sort">${esc(c.label)} ${icon('sort')}</span>${code}</button>` : `${esc(c.label)}${code}`;
        return `<th class="${c.cls ?? ''}" data-col="${c.key}">${inner}</th>`;
      })
      .join('')}${cfg.actions ? '<th class="right"><span class="sr-only">Aksi</span></th>' : ''}</tr></thead><tbody></tbody></table></div>
    <div class="pager" data-pager></div>`;

  const tbody = el.querySelector('tbody')!;
  const info = el.querySelector<HTMLElement>('[data-info]')!;
  const pager = el.querySelector<HTMLElement>('[data-pager]')!;

  const visible = () => {
    let rows = cfg.rows();
    const q = st.q.trim().toLowerCase();
    if (q && cfg.search) rows = rows.filter((r) => cfg.search!(r).toLowerCase().includes(q));
    for (const f of cfg.filters ?? []) if (st.f[f.key]) rows = rows.filter((r) => f.test(r, st.f[f.key]));
    if (st.sort) {
      const col = shown.find((c) => c.key === st.sort!.key);
      if (col?.sort) {
        const dir = st.sort.dir;
        rows = [...rows].sort((a, b) => {
          const x = col.sort!(a), y = col.sort!(b);
          return (x > y ? 1 : x < y ? -1 : 0) * dir;
        });
      }
    }
    return rows;
  };

  const render = () => {
    const rows = visible();
    const pages = Math.max(1, Math.ceil(rows.length / size));
    st.page = Math.min(st.page, pages - 1);
    const slice = rows.slice(st.page * size, st.page * size + size);
    const total = cfg.rows().length;
    info.textContent = rows.length === total ? `${total} baris` : `${rows.length} dari ${total} baris`;
    el.querySelectorAll<HTMLElement>('th[data-col]').forEach((th) => {
      if (st.sort && th.dataset.col === st.sort.key) th.setAttribute('aria-sort', st.sort.dir === 1 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="${shown.length + (cfg.actions ? 1 : 0)}"><div class="empty">${icon('inbox')}<span>${
        total ? 'Tidak ada baris yang cocok dengan pencarian atau filter.' : esc(cfg.empty ?? 'Belum ada data.')
      }</span></div></td></tr>`;
    } else {
      tbody.innerHTML = slice
        .map(
          (r) =>
            `<tr data-key="${esc(cfg.rowKey(r))}" class="${cfg.onRow ? 'clickable' : ''}">${shown
              .map((c) => `<td class="${c.cls ?? ''}">${c.html(r)}</td>`)
              .join('')}${cfg.actions ? `<td class="actions">${cfg.actions(r)}</td>` : ''}</tr>`,
        )
        .join('');
    }
    pager.innerHTML =
      pages > 1
        ? `<span class="num">Hal. ${st.page + 1} / ${pages}</span>
           <button class="c-btn c-btn--outline c-btn--sm" data-page="-1" ${st.page === 0 ? 'disabled' : ''}>sebelumnya</button>
           <button class="c-btn c-btn--outline c-btn--sm" data-page="1" ${st.page >= pages - 1 ? 'disabled' : ''}>berikutnya</button>`
        : '';
    pager.hidden = pages <= 1;
  };

  el.querySelector<HTMLInputElement>('[data-q]')?.addEventListener('input', (e) => {
    st.q = (e.target as HTMLInputElement).value;
    st.page = 0;
    render();
  });
  el.querySelectorAll<HTMLSelectElement>('[data-filter]').forEach((s) =>
    s.addEventListener('change', () => {
      st.f[s.dataset.filter!] = s.value;
      st.page = 0;
      render();
    }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.sort!;
      st.sort = st.sort?.key === k ? { key: k, dir: st.sort.dir === 1 ? -1 : 1 } : { key: k, dir: 1 };
      render();
    }),
  );
  pager.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-page]');
    if (!b) return;
    st.page += Number(b.dataset.page);
    render();
  });
  tbody.addEventListener('click', (e) => {
    const tr = (e.target as HTMLElement).closest('tr');
    if (!tr?.dataset.key || (e.target as HTMLElement).closest('button,a,input,select,label')) return;
    const row = cfg.rows().find((r) => cfg.rowKey(r) === tr.dataset.key);
    if (row && cfg.onRow) cfg.onRow(row);
  });
  el.querySelector('[data-csv]')?.addEventListener('click', () => {
    const cols = cfg.columns.filter((c) => c.csv);
    downloadCsv(cfg.csvName!, cols.map((c) => c.code || c.key), visible().map((r) => cols.map((c) => c.csv!(r))));
    toast(`CSV ${cfg.csvName} diunduh`);
  });

  render();
  onChange(render);
  return { render, el, rowFromEvent: (e: Event) => {
    const tr = (e.target as HTMLElement).closest('tr');
    return tr?.dataset.key ? cfg.rows().find((r) => cfg.rowKey(r) === tr.dataset.key) : undefined;
  } };
}

export function stars(n: number) {
  return `<span class="stars" aria-label="${n} dari 5 bintang">${[1, 2, 3, 4, 5].map((i) => icon('review').replace('<svg', `<svg class="${i <= n ? 'on' : 'off'}" ${i <= n ? 'fill="currentColor"' : ''}`)).join('')}</span>`;
}

export function rowButtons(btns: Array<{ act: string; label: string; ic: Parameters<typeof icon>[0]; danger?: boolean }>) {
  return btns
    .map((b) => `<button type="button" class="c-btn c-btn--ghost c-btn--icon" data-act="${b.act}" title="${esc(b.label)}" aria-label="${esc(b.label)}">${icon(b.ic)}</button>`)
    .join('');
}
