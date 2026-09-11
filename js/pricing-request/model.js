// The opening record, its option lists, and everything that validates it.
// Nothing here touches the DOM.

export const LABELS = {
  product: { window: 'Window', patio: 'Patio door', entry: 'Entry door' },
  tier: { good: 'Good', better: 'Better', best: 'Best' },
  frame: { white: 'White', black: 'Black', bronze: 'Bronze', gray: 'Stone Gray' },
  glass: { lowe: 'Low-E', triple: 'Triple-pane', clear: 'Clear', obscure: 'Obscure', tinted: 'Tinted / privacy' },
  grille: { none: 'None', sixoversix: '6-over-6', prairie: 'Prairie' },
  finish: { paint: 'Paint-grade', stain: 'Stain-grade wood look', fiberglass: 'Premium fiberglass' },
  hardware: { standard: 'Standard', designer: 'Designer' },
  swing: { in: 'Inswing', out: 'Outswing' },
  sizeBasis: { unit: 'Unit size', rough: 'Rough opening' },
  op: { fixed: 'Fixed', casement: 'Casement', awning: 'Awning', doublehung: 'Double hung', slider: 'Slider', hinged: 'Hinged' },
  side: { left: 'Left', right: 'Right' }
};

export const OPS = {
  window: ['fixed', 'casement', 'awning', 'doublehung', 'slider'],
  patio: ['fixed', 'slider', 'hinged'],
  entry: ['fixed', 'hinged']
};

// Casements and hinged leaves take a hinge side; sliders take the side they slide toward.
export const hasSide = (op) => op === 'casement' || op === 'hinged' || op === 'slider';
export const isSlab = (item, pane) => item.product === 'entry' && pane.op === 'hinged';

export const FRAME_HEX = { white: '#ffffff', black: '#1b1c1e', bronze: '#7a5c3e', gray: '#55555d' };
export const SLAB_HEX = { paint: '#e9e5dc', stain: '#8b6a4a', fiberglass: '#bdb8ae' };

const SIXTEENTH = 16;
const snap = (v) => Math.round(v * SIXTEENTH) / SIXTEENTH;

/** Splits a length into n parts on 1/16" steps that add back up exactly. */
export function even(total, n) {
  const part = Math.floor((total * SIXTEENTH) / n) / SIXTEENTH;
  const parts = Array(n).fill(part);
  parts[n - 1] = snap(total - part * (n - 1));
  return parts;
}

const pane = (w, op, side) => (side ? { w, op, side } : { w, op });

export const PRESETS = {
  window: [
    { id: 'one', name: 'Single', build: (w, h) => [{ h, cols: [pane(w, 'doublehung')] }] },
    { id: 'twin', name: 'Two wide', build: (w, h) => { const [a, b] = even(w, 2); return [{ h, cols: [pane(a, 'casement', 'left'), pane(b, 'casement', 'right')] }]; } },
    { id: 'triple', name: 'Three wide', build: (w, h) => { const [a, b, c] = even(w, 3); return [{ h, cols: [pane(a, 'casement', 'left'), pane(b, 'fixed'), pane(c, 'casement', 'right')] }]; } },
    { id: 'transom', name: 'Three wide + transom', build: (w, h) => {
      const [a, b, c] = even(w, 3);
      const top = snap(h * 0.25);
      return [
        { h: top, cols: [pane(a, 'fixed'), pane(b, 'fixed'), pane(c, 'fixed')] },
        { h: snap(h - top), cols: [pane(a, 'casement', 'left'), pane(b, 'fixed'), pane(c, 'casement', 'right')] }
      ];
    } },
    { id: 'slider', name: 'Slider', build: (w, h) => { const [a, b] = even(w, 2); return [{ h, cols: [pane(a, 'fixed'), pane(b, 'slider', 'left')] }]; } }
  ],
  patio: [
    { id: 'sliding', name: 'Sliding', build: (w, h) => { const [a, b] = even(w, 2); return [{ h, cols: [pane(a, 'fixed'), pane(b, 'slider', 'left')] }]; } },
    { id: 'french', name: 'French', build: (w, h) => { const [a, b] = even(w, 2); return [{ h, cols: [pane(a, 'hinged', 'left'), pane(b, 'hinged', 'right')] }]; } }
  ],
  entry: [
    { id: 'single', name: 'Single', build: (w, h) => [{ h, cols: [pane(w, 'hinged', 'left')] }] },
    { id: 'sidelights', name: 'With sidelights', build: (w, h) => {
      const side = w > 44 ? 14 : snap(w / 4);
      return [{ h, cols: [pane(side, 'fixed'), pane(snap(w - 2 * side), 'hinged', 'left'), pane(side, 'fixed')] }];
    } },
    { id: 'double', name: 'Double', build: (w, h) => { const [a, b] = even(w, 2); return [{ h, cols: [pane(a, 'hinged', 'left'), pane(b, 'hinged', 'right')] }]; } }
  ]
};

const DEFAULTS = {
  window: { tier: 'better', frame: 'white', glass: 'lowe', grille: 'none', size: { w: 36, h: 60 }, preset: 'one' },
  patio: { frame: 'white', glass: 'lowe', grille: 'none', swing: 'in', size: { w: 72, h: 80 }, preset: 'sliding' },
  entry: { frame: 'white', glass: 'obscure', grille: 'none', finish: 'paint', hardware: 'standard', swing: 'in', size: { w: 36, h: 80 }, preset: 'single' }
};

const PREFIX = { window: 'W', patio: 'P', entry: 'D' };

export function nextItemId(job, product) {
  const p = PREFIX[product];
  const used = job.items.map((it) => it.id).filter((id) => id.startsWith(p)).map((id) => parseInt(id.slice(1), 10) || 0);
  return p + (Math.max(0, ...used) + 1);
}

export function newItem(job, product) {
  const d = DEFAULTS[product];
  const { preset, size, ...opts } = d;
  const build = PRESETS[product].find((x) => x.id === preset).build;
  return {
    id: nextItemId(job, product), product, supplier: '', location: '', qty: 1, sizeBasis: 'unit',
    ...opts, size: { ...size }, rows: build(size.w, size.h)
  };
}

// Local date, not toISOString(): that is UTC, which is already tomorrow on an Indiana evening.
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const newJob = () => ({ id: uid(), ref: '', date: today(), items: [] });

/** Reads 35, 35.75, 35 3/4, 35-3/4 or 3/4, with or without a trailing ". */
export function parseInches(text) {
  const m = String(text).trim().replace(/["”″]$/, '').trim()
    .match(/^(?:(\d+(?:\.\d+)?))?(?:(?:^|[\s-]+)(\d+)\/(\d+))?$/);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  let v = m[1] !== undefined ? parseFloat(m[1]) : 0;
  if (m[2] !== undefined) {
    const den = parseInt(m[3], 10);
    if (!den) return null;
    v += parseInt(m[2], 10) / den;
  }
  return v > 0 ? snap(v) : null;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function fmtInches(v) {
  const whole = Math.floor(v + 1e-9);
  const num = Math.round((v - whole) * SIXTEENTH);
  if (num === 0) return whole + '"';
  if (num === SIXTEENTH) return (whole + 1) + '"';
  const g = gcd(num, SIXTEENTH);
  return (whole ? whole + ' ' : '') + (num / g) + '/' + (SIXTEENTH / g) + '"';
}

const close = (a, b) => Math.abs(a - b) < 1 / 32;

/** Everything that would make a sheet wrong or unsendable. Empty means printable. */
export function problems(item) {
  const out = [];
  if (!item.supplier.trim()) out.push('No supplier chosen.');
  const heights = item.rows.reduce((a, r) => a + r.h, 0);
  if (!close(heights, item.size.h)) out.push(`Row heights add up to ${fmtInches(heights)}, not the overall ${fmtInches(item.size.h)}.`);
  item.rows.forEach((r, i) => {
    const widths = r.cols.reduce((a, c) => a + c.w, 0);
    if (!close(widths, item.size.w)) out.push(`Row ${i + 1} widths add up to ${fmtInches(widths)}, not the overall ${fmtInches(item.size.w)}.`);
  });
  return out;
}

// --- Sanitising anything that comes back from storage or an imported file ---

const pick = (table, v, fallback) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(table, v) ? v : fallback);
const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const len = (v) => (typeof v === 'number' && isFinite(v) && v > 0 && v <= 600 ? snap(v) : null);

function cleanItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const product = pick(LABELS.product, raw.product, null);
  if (!product) return null;
  const w = len(raw.size && raw.size.w), h = len(raw.size && raw.size.h);
  if (!w || !h || !Array.isArray(raw.rows) || !raw.rows.length || raw.rows.length > 4) return null;
  const rows = [];
  for (const r of raw.rows) {
    const rh = len(r && r.h);
    if (!rh || !Array.isArray(r.cols) || !r.cols.length || r.cols.length > 8) return null;
    const cols = [];
    for (const c of r.cols) {
      const cw = len(c && c.w);
      if (!cw || !OPS[product].includes(c.op)) return null;
      const p = { w: cw, op: c.op };
      if (hasSide(c.op)) p.side = pick(LABELS.side, c.side, 'left');
      if (c.grille !== undefined) p.grille = pick(LABELS.grille, c.grille, 'none');
      cols.push(p);
    }
    rows.push({ h: rh, cols });
  }
  const d = DEFAULTS[product];
  const item = {
    id: /^[WPD]\d{1,3}$/.test(raw.id) ? raw.id : null,
    product,
    supplier: text(raw.supplier, 60),
    location: text(raw.location, 80),
    qty: Number.isInteger(raw.qty) && raw.qty > 0 && raw.qty < 1000 ? raw.qty : 1,
    sizeBasis: pick(LABELS.sizeBasis, raw.sizeBasis, 'unit'),
    frame: pick(LABELS.frame, raw.frame, d.frame),
    glass: pick(LABELS.glass, raw.glass, d.glass),
    grille: pick(LABELS.grille, raw.grille, d.grille),
    size: { w, h },
    rows
  };
  if (product === 'window') item.tier = pick(LABELS.tier, raw.tier, d.tier);
  if (product === 'entry') {
    item.finish = pick(LABELS.finish, raw.finish, d.finish);
    item.hardware = pick(LABELS.hardware, raw.hardware, d.hardware);
  }
  if (product !== 'window') item.swing = pick(LABELS.swing, raw.swing, d.swing);
  return item;
}

export function cleanJob(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return null;
  const job = {
    id: typeof raw.id === 'string' && /^[a-z0-9]{4,40}$/.test(raw.id) ? raw.id : uid(),
    ref: text(raw.ref, 40),
    date: typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : today(),
    items: []
  };
  raw.items.slice(0, 200).forEach((r) => {
    const it = cleanItem(r);
    if (!it) return;
    if (!it.id || job.items.some((x) => x.id === it.id)) it.id = nextItemId(job, it.product);
    job.items.push(it);
  });
  return job;
}

export { uid };
