import { LABELS, OPS, PRESETS, hasSide, isSlab, even, newItem, newJob, nextItemId, cleanJob, parseInches, fmtInches, problems, uid } from './model.js';
import { sheetHTML, esc } from './draw.js';

const KEY = 'npcs.pricing-requests.v1';
const $ = (id) => document.getElementById(id);

const store = load();
const job = () => store.jobs.find((j) => j.id === store.current);
const item = () => job().items.find((i) => i.id === store.selected) || null;

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* unreadable storage starts fresh */ }
  const jobs = raw && Array.isArray(raw.jobs) ? raw.jobs.map(cleanJob).filter(Boolean) : [];
  if (!jobs.length) jobs.push(newJob());
  const current = raw && jobs.some((j) => j.id === raw.current) ? raw.current : jobs[0].id;
  const first = jobs.find((j) => j.id === current).items[0];
  return { jobs, current, selected: first ? first.id : null };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ jobs: store.jobs, current: store.current }));
  } catch (e) {
    say('This browser would not save the job. Export it now so nothing is lost.');
  }
}

let sayTimer = null;
function say(msg) {
  $('status').textContent = msg;
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => { $('status').textContent = ''; }, 7000);
}

/** Items grouped by supplier, in the order they were added. */
function batches(j) {
  const map = new Map();
  j.items.forEach((it) => {
    const s = it.supplier.trim();
    if (!s) return;
    if (!map.has(s)) map.set(s, []);
    map.get(s).push(it);
  });
  return [...map.entries()];
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// --- rendering -----------------------------------------------------------

function renderJobSelect() {
  $('job-select').innerHTML = store.jobs.map((j) =>
    `<option value="${esc(j.id)}"${j.id === store.current ? ' selected' : ''}>${esc(j.ref || 'Untitled job')} (${plural(j.items.length, 'opening')})</option>`).join('');
}

function renderJob() {
  renderJobSelect();
  $('job-ref').value = job().ref;
  $('job-date').value = job().date;
}

function renderList() {
  const j = job();
  $('item-list').innerHTML = j.items.length ? j.items.map((it) => {
    const bad = problems(it).length;
    return `<li><button type="button" data-id="${esc(it.id)}" aria-current="${it.id === store.selected}">
      <span><span class="items__id">${esc(it.id)}</span> <span class="items__sub">${LABELS.product[it.product]}${it.qty > 1 ? ' ×' + it.qty : ''}</span></span>
      <span class="items__sub">${esc(it.location || 'No location')} · ${esc(it.supplier || 'no supplier')}</span>
      ${bad ? `<span class="items__warn">${plural(bad, 'problem')}</span>` : ''}</button></li>`;
  }).join('') : '<li class="items__empty">No openings yet. Add one below.</li>';
}

function renderPrintBar() {
  const j = job();
  const groups = batches(j);
  const unassigned = j.items.filter((i) => !i.supplier.trim()).length;
  let h = groups.length ? groups.map(([s, list]) => {
    const bad = list.filter((i) => problems(i).length).length;
    return `<button type="button" class="btn btn--primary" data-supplier="${esc(s)}"${bad ? ' disabled' : ''}>${esc(s)}: ${plural(list.length, 'sheet')}</button>`
      + (bad ? `<p class="hint">${plural(bad, 'opening')} for ${esc(s)} ${bad === 1 ? 'needs' : 'need'} fixing before this can print.</p>` : '');
  }).join('') : '<p class="hint">Give each opening a supplier to print.</p>';
  if (unassigned && groups.length) h += `<p class="hint">${plural(unassigned, 'opening')} with no supplier yet.</p>`;
  $('print-bar').innerHTML = h;
}

function renderPreview() {
  const it = item();
  if (!it) { $('preview').innerHTML = '<p class="empty">Select or add an opening to see its sheet.</p>'; return; }
  const group = batches(job()).find(([s]) => s === it.supplier.trim());
  const list = group ? group[1] : [it];
  $('preview').innerHTML = sheetHTML(it, job(), list.indexOf(it) + 1, list.length);
}

function renderProblems() {
  const el = $('problems');
  const it = item();
  if (!el || !it) return;
  const ps = problems(it);
  el.hidden = !ps.length;
  el.innerHTML = ps.map((p) => `<li>${esc(p)}</li>`).join('');
}

function select(f, table, value, attrs = '') {
  return `<select data-f="${f}" ${attrs}>${Object.entries(table).map(([k, v]) =>
    `<option value="${esc(k)}"${k === value ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
}
const fieldSelect = (label, f, table, value) => `<label class="field"><span>${label}</span>${select(f, table, value)}</label>`;
const lenInput = (attrs, v, label) => `<input ${attrs} data-kind="len" inputmode="decimal" autocomplete="off" aria-label="${esc(label)}" value="${esc(fmtInches(v))}">`;

function layoutHTML(it) {
  const ops = Object.fromEntries(OPS[it.product].map((o) => [o, LABELS.op[o]]));
  const grilles = { '': 'As unit', ...LABELS.grille };
  let letter = 0;
  const rows = it.rows.map((r, ri) => {
    const panes = r.cols.map((c, ci) => {
      const L = String.fromCharCode(65 + letter++);
      const at = `data-row="${ri}" data-col="${ci}"`;
      const side = hasSide(c.op)
        ? select('side', LABELS.side, c.side, `${at} aria-label="Pane ${L} ${c.op === 'slider' ? 'slides toward' : 'hinge side'}"`)
        : '<span class="hint">n/a</span>';
      const grille = isSlab(it, c) ? '<span class="hint">n/a</span>' : select('grille', grilles, c.grille || '', `${at} aria-label="Pane ${L} grille"`);
      const del = r.cols.length > 1 ? `<button type="button" class="btn btn--small" data-act="del-pane" ${at} aria-label="Remove pane ${L}" title="Remove pane ${L}">×</button>` : '';
      return `<tr><td>${L}</td><td>${lenInput(`${at} data-f="w"`, c.w, `Pane ${L} width`)}</td>
        <td>${select('op', ops, c.op, `${at} aria-label="Pane ${L} operation"`)}</td><td>${side}</td><td>${grille}</td><td>${del}</td></tr>`;
    }).join('');
    return `<div class="layout-row">
      <div class="layout-row__head"><strong>Row ${ri + 1}</strong>
        <label class="field"><span>Height</span>${lenInput(`data-row="${ri}" data-f="h"`, r.h, `Row ${ri + 1} height`)}</label>
        ${it.rows.length > 1 ? `<button type="button" class="btn btn--small" data-act="del-row" data-row="${ri}">Remove row</button>` : ''}</div>
      <div class="table-scroll"><table class="panes"><thead><tr><th>Pane</th><th>Width</th><th>Operation</th><th>Hinge / slides</th><th>Grille</th><th></th></tr></thead><tbody>${panes}</tbody></table></div>
      ${r.cols.length < 8 ? `<div><button type="button" class="btn btn--small" data-act="add-pane" data-row="${ri}">+ Add pane</button></div>` : ''}
    </div>`;
  }).join('');
  return rows + (it.rows.length < 4 ? '<div><button type="button" class="btn btn--small" data-act="add-row">+ Add row</button></div>' : '');
}

function renderEditor(focusFrom) {
  const it = item();
  const ed = $('editor');
  if (!it) { ed.innerHTML = '<p class="empty">Add a window or door on the left to start.</p>'; return; }
  const key = focusFrom && focusFrom.dataset ? { ...focusFrom.dataset } : null;
  const suppliers = [...new Set(job().items.map((i) => i.supplier.trim()).filter(Boolean))];
  ed.innerHTML = `<div class="editor panel">
    <div class="editor__head"><h2>${esc(it.id)} · ${LABELS.product[it.product]}</h2>
      <div class="row"><button type="button" class="btn btn--small" data-act="dup">Duplicate</button>
      <button type="button" class="btn btn--small btn--danger" data-act="del">Delete</button></div></div>
    <ul class="problems" id="problems" hidden></ul>
    <div class="fields">
      <label class="field"><span>Location</span><input data-f="location" maxlength="80" autocomplete="off" placeholder="e.g. Kitchen, rear wall" value="${esc(it.location)}"></label>
      <label class="field"><span>Supplier</span><input data-f="supplier" maxlength="60" autocomplete="off" list="supplier-list" placeholder="Who prices this" value="${esc(it.supplier)}"></label>
      <label class="field"><span>Qty</span><input data-f="qty" type="number" min="1" max="999" inputmode="numeric" value="${it.qty}"></label>
    </div>
    <datalist id="supplier-list">${suppliers.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
    <div class="fields">
      <label class="field"><span>Overall width</span>${lenInput('data-f="size-w"', it.size.w, 'Overall width')}</label>
      <label class="field"><span>Overall height</span>${lenInput('data-f="size-h"', it.size.h, 'Overall height')}</label>
      ${fieldSelect('Size is', 'sizeBasis', LABELS.sizeBasis, it.sizeBasis)}
    </div>
    <div class="fields">
      ${it.product === 'window' ? fieldSelect('Tier', 'tier', LABELS.tier, it.tier) : ''}
      ${it.product === 'entry' ? fieldSelect('Slab finish', 'finish', LABELS.finish, it.finish) + fieldSelect('Hardware', 'hardware', LABELS.hardware, it.hardware) : ''}
      ${it.product !== 'window' && it.rows.some((r) => r.cols.some((c) => c.op === 'hinged')) ? fieldSelect('Swing', 'swing', LABELS.swing, it.swing) : ''}
      ${fieldSelect('Frame color', 'frame', LABELS.frame, it.frame)}
      ${fieldSelect('Glass', 'glass', LABELS.glass, it.glass)}
      ${fieldSelect('Grilles', 'grille', LABELS.grille, it.grille)}
    </div>
    <div class="editor__layout">
      <h3>Layout</h3>
      <p class="hint">Viewed from outside. Start from a layout, then adjust sizes and how each pane opens. Sizes take 35 3/4, 35-3/4 or 35.75.</p>
      <div class="row">${PRESETS[it.product].map((p) => `<button type="button" class="btn btn--small" data-act="preset" data-id="${p.id}">${esc(p.name)}</button>`).join('')}</div>
    </div>
    ${layoutHTML(it)}
  </div>`;
  renderProblems();
  if (key && key.f) {
    let sel = `[data-f="${key.f}"]`;
    sel += key.row !== undefined ? `[data-row="${key.row}"]` : ':not([data-row])';
    sel += key.col !== undefined ? `[data-col="${key.col}"]` : ':not([data-col])';
    const again = ed.querySelector(sel);
    if (again) again.focus();
  }
}

function renderAll() {
  renderJob();
  renderList();
  renderEditor();
  renderPreview();
  renderPrintBar();
}

function persist() {
  save();
  renderList();
  renderPreview();
  renderPrintBar();
  renderProblems();
}

// --- editing -------------------------------------------------------------

function target(it, el) {
  const { row, col } = el.dataset;
  if (col !== undefined) return it.rows[+row].cols[+col];
  if (row !== undefined) return it.rows[+row];
  return it;
}

function syncLen(row, col, f, v) {
  let sel = `[data-f="${f}"][data-row="${row}"]`;
  sel += col !== undefined ? `[data-col="${col}"]` : ':not([data-col])';
  const el = $('editor').querySelector(sel);
  if (el) { el.value = fmtInches(v); el.setAttribute('aria-invalid', 'false'); }
}

function applyField(el, final) {
  const it = item();
  const f = el.dataset.f;
  if (!it || !f) return;
  const t = target(it, el);

  if (el.dataset.kind === 'len') {
    const v = parseInches(el.value);
    el.setAttribute('aria-invalid', v ? 'false' : 'true');
    if (!v) return;
    if (f === 'size-w') {
      it.size.w = v;
      it.rows.forEach((r, ri) => { if (r.cols.length === 1) { r.cols[0].w = v; syncLen(ri, 0, 'w', v); } });
    } else if (f === 'size-h') {
      it.size.h = v;
      if (it.rows.length === 1) { it.rows[0].h = v; syncLen(0, undefined, 'h', v); }
    } else {
      t[f] = v;
    }
    if (final) el.value = fmtInches(v);
  } else if (f === 'qty') {
    const q = parseInt(el.value, 10);
    const ok = Number.isInteger(q) && q > 0 && q < 1000;
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (!ok) return;
    it.qty = q;
  } else if (f === 'location' || f === 'supplier') {
    it[f] = final ? el.value.trim() : el.value;
    if (final) el.value = it[f];
  } else if (el.tagName === 'SELECT') {
    if (!final) return;
    if (f === 'grille' && el.dataset.col !== undefined) {
      if (el.value) t.grille = el.value; else delete t.grille;
    } else {
      t[f] = el.value;
    }
    if (f === 'op') {
      if (hasSide(t.op)) t.side = t.side || 'left'; else delete t.side;
      persist();
      renderEditor(el);
      return;
    }
  }
  persist();
}

$('editor').addEventListener('input', (e) => applyField(e.target, false));
$('editor').addEventListener('change', (e) => applyField(e.target, true));

$('editor').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  const it = item();
  if (!b || !it) return;
  const j = job();
  const ri = +b.dataset.row, ci = +b.dataset.col;
  switch (b.dataset.act) {
    case 'preset':
      if (!confirm('Replace this layout? Changes to its panes will be lost.')) return;
      it.rows = PRESETS[it.product].find((p) => p.id === b.dataset.id).build(it.size.w, it.size.h);
      break;
    case 'add-row': {
      const last = it.rows[it.rows.length - 1];
      const [a, rest] = even(last.h, 2);
      last.h = a;
      it.rows.push({ h: rest, cols: last.cols.map((c) => ({ w: c.w, op: 'fixed' })) });
      break;
    }
    case 'del-row': {
      const [gone] = it.rows.splice(ri, 1);
      it.rows[Math.max(0, ri - 1)].h += gone.h;
      break;
    }
    case 'add-pane': {
      const cols = it.rows[ri].cols;
      const last = cols[cols.length - 1];
      const [a, rest] = even(last.w, 2);
      last.w = a;
      cols.push({ w: rest, op: 'fixed' });
      break;
    }
    case 'del-pane': {
      const cols = it.rows[ri].cols;
      const [gone] = cols.splice(ci, 1);
      cols[Math.max(0, ci - 1)].w += gone.w;
      break;
    }
    case 'dup': {
      const copy = JSON.parse(JSON.stringify(it));
      copy.id = nextItemId(j, it.product);
      j.items.splice(j.items.indexOf(it) + 1, 0, copy);
      store.selected = copy.id;
      say(`Copied ${it.id} as ${copy.id}.`);
      break;
    }
    case 'del': {
      if (!confirm(`Delete ${it.id}${it.location ? ' (' + it.location + ')' : ''}?`)) return;
      j.items.splice(j.items.indexOf(it), 1);
      store.selected = j.items[0] ? j.items[0].id : null;
      break;
    }
    default:
      return;
  }
  save();
  renderAll();
});

// --- openings list, job controls, printing -------------------------------

$('item-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  store.selected = b.dataset.id;
  renderList();
  renderEditor();
  renderPreview();
});

['window', 'patio', 'entry'].forEach((product) => {
  $('add-' + product).addEventListener('click', () => {
    const j = job();
    const it = newItem(j, product);
    const last = j.items[j.items.length - 1];
    if (last) it.supplier = last.supplier;
    j.items.push(it);
    store.selected = it.id;
    save();
    renderAll();
    $('editor').querySelector('[data-f="location"]').focus();
  });
});

$('job-select').addEventListener('change', (e) => {
  store.current = e.target.value;
  const first = job().items[0];
  store.selected = first ? first.id : null;
  save();
  renderAll();
});

$('job-ref').addEventListener('input', (e) => {
  job().ref = e.target.value.slice(0, 40);
  save();
  renderJobSelect();
  renderPreview();
});

$('job-date').addEventListener('change', (e) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) { e.target.value = job().date; return; }
  job().date = e.target.value;
  save();
  renderPreview();
});

$('job-new').addEventListener('click', () => {
  const j = newJob();
  store.jobs.push(j);
  store.current = j.id;
  store.selected = null;
  save();
  renderAll();
  $('job-ref').focus();
});

$('job-delete').addEventListener('click', () => {
  const j = job();
  if (!confirm(`Delete ${j.ref || 'this untitled job'} and its ${plural(j.items.length, 'opening')}? This cannot be undone unless you exported it.`)) return;
  store.jobs.splice(store.jobs.indexOf(j), 1);
  if (!store.jobs.length) store.jobs.push(newJob());
  store.current = store.jobs[0].id;
  const first = job().items[0];
  store.selected = first ? first.id : null;
  save();
  renderAll();
});

$('job-export').addEventListener('click', () => {
  const j = job();
  const url = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(j.ref || 'pricing-job').replace(/[^\w-]+/g, '_')}-${j.date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  say('Exported. Import brings the file back on any device.');
});

$('job-import').addEventListener('click', () => $('job-import-file').click());

$('job-import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 2e6) { say('That file is too large to be a job export.'); return; }
  let raw = null, j = null;
  try { raw = JSON.parse(await file.text()); j = cleanJob(raw); } catch (err) { /* reported below */ }
  if (!j) { say('That file is not a pricing-request job.'); return; }
  if (store.jobs.some((x) => x.id === j.id)) j.id = uid();
  store.jobs.push(j);
  store.current = j.id;
  store.selected = j.items[0] ? j.items[0].id : null;
  save();
  renderAll();
  const dropped = raw.items.length - j.items.length;
  say(`Imported ${j.ref || 'job'} with ${plural(j.items.length, 'opening')}.` + (dropped > 0 ? ` ${plural(dropped, 'entry')} could not be read and were skipped.` : ''));
});

function printFor(supplier) {
  const j = job();
  const group = batches(j).find(([s]) => s === supplier);
  if (!group) return;
  const list = group[1];
  const root = $('print-root');
  root.innerHTML = list.map((it, k) => sheetHTML(it, j, k + 1, list.length)).join('');
  const title = document.title;
  // Browsers name the saved PDF after the page title.
  document.title = `${j.ref || 'Pricing request'} - ${supplier}`.replace(/[\\/:*?"<>|]+/g, ' ');
  window.addEventListener('afterprint', () => { document.title = title; root.innerHTML = ''; }, { once: true });
  const pending = [...root.querySelectorAll('img')].filter((img) => !img.complete)
    .map((img) => new Promise((r) => { img.addEventListener('load', r); img.addEventListener('error', r); }));
  Promise.all(pending).then(() => window.print());
}

$('print-bar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-supplier]');
  if (b && !b.disabled) printFor(b.dataset.supplier);
});

renderAll();
