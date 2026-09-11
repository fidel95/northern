// Turns an opening record into a pricing-request sheet: an elevation drawn to
// scale plus the spec and pane tables. Returns HTML strings; every piece of
// typed text goes through esc(), because records come back out of
// localStorage and imported files and are untrusted by then.

import { LABELS, FRAME_HEX, SLAB_HEX, isSlab, fmtInches } from './model.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const INK = '#161618', OP = '#2e9e45', GRILLE = '#8d979b', GLASS = '#e6edef', MUTED = '#6b6b72';
const MONO = 'font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="12"';
const n = (v) => +v.toFixed(2);

const rect = (x, y, w, h, a) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${a}/>`;
const line = (x1, y1, x2, y2, a) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${a}/>`;

function arrow(x1, y1, x2, y2) {
  const ang = Math.atan2(y2 - y1, x2 - x1), k = 8;
  const p = (da) => `${n(x2 - k * Math.cos(ang + da))},${n(y2 - k * Math.sin(ang + da))}`;
  return line(x1, y1, x2, y2, `stroke="${OP}" stroke-width="2"`)
    + `<polygon points="${n(x2)},${n(y2)} ${p(0.45)} ${p(-0.45)}" fill="${OP}"/>`;
}

function hdim(x1, x2, y, edgeY, label) {
  const a = `stroke="${INK}" stroke-width="1"`, ext = `stroke="${INK}" stroke-width=".6"`;
  return line(x1, edgeY, x1, y + 5, ext) + line(x2, edgeY, x2, y + 5, ext)
    + line(x1, y, x2, y, a) + line(x1 - 4, y + 4, x1 + 4, y - 4, a) + line(x2 - 4, y + 4, x2 + 4, y - 4, a)
    + `<text x="${n((x1 + x2) / 2)}" y="${n(y - 5)}" text-anchor="middle" fill="${INK}" ${MONO}>${esc(label)}</text>`;
}

function vdim(y1, y2, x, edgeX, label) {
  const a = `stroke="${INK}" stroke-width="1"`, ext = `stroke="${INK}" stroke-width=".6"`;
  const out = x > edgeX, dir = out ? 5 : -5, tx = out ? x + 14 : x - 6, ty = (y1 + y2) / 2;
  return line(edgeX, y1, x + dir, y1, ext) + line(edgeX, y2, x + dir, y2, ext)
    + line(x, y1, x, y2, a) + line(x - 4, y1 + 4, x + 4, y1 - 4, a) + line(x - 4, y2 + 4, x + 4, y2 - 4, a)
    + `<text x="${n(tx)}" y="${n(ty)}" text-anchor="middle" transform="rotate(-90 ${n(tx)} ${n(ty)})" fill="${INK}" ${MONO}>${esc(label)}</text>`;
}

function grilleLines(kind, gx, gy, gw, gh, twoSashes) {
  const a = `stroke="${GRILLE}" stroke-width="1.4"`;
  let o = '';
  if (kind === 'prairie') {
    const p = Math.min(gw, gh) * 0.16;
    o += line(gx + p, gy, gx + p, gy + gh, a) + line(gx + gw - p, gy, gx + gw - p, gy + gh, a);
    o += line(gx, gy + p, gx + gw, gy + p, a) + line(gx, gy + gh - p, gx + gw, gy + gh - p, a);
  } else if (kind === 'sixoversix') {
    const bands = twoSashes ? [[gy, gh / 2, 2], [gy + gh / 2, gh / 2, 2]] : [[gy, gh, 4]];
    bands.forEach(([by, bh, rows]) => {
      for (let i = 1; i < 3; i++) o += line(gx + (gw * i) / 3, by, gx + (gw * i) / 3, by + bh, a);
      for (let j = 1; j < rows; j++) o += line(gx, by + (bh * j) / rows, gx + gw, by + (bh * j) / rows, a);
    });
  }
  return o;
}

// Elevation convention: the dashed lines leave the hinge-side corners and meet at the handle.
function opSymbol(p, gx, gy, gw, gh) {
  const i = Math.min(gw, gh) * 0.07;
  const dash = `fill="none" stroke="${OP}" stroke-width="1.8" stroke-dasharray="7 5" stroke-linejoin="round"`;
  if (p.op === 'casement' || p.op === 'hinged') {
    const hx = p.side === 'left' ? gx + i : gx + gw - i;
    const lx = p.side === 'left' ? gx + gw - i : gx + i;
    return `<path d="M ${n(hx)} ${n(gy + i)} L ${n(lx)} ${n(gy + gh / 2)} L ${n(hx)} ${n(gy + gh - i)}" ${dash}/>`;
  }
  if (p.op === 'awning') {
    return `<path d="M ${n(gx + i)} ${n(gy + i)} L ${n(gx + gw / 2)} ${n(gy + gh - i)} L ${n(gx + gw - i)} ${n(gy + i)}" ${dash}/>`;
  }
  if (p.op === 'doublehung') {
    const cx = gx + gw / 2, m = gy + gh / 2;
    return line(gx, m, gx + gw, m, `stroke="${INK}" stroke-width="3"`)
      + arrow(cx, gy + gh * 0.14, cx, gy + gh * 0.36) + arrow(cx, gy + gh * 0.86, cx, gy + gh * 0.64);
  }
  if (p.op === 'slider') {
    const cy = gy + gh / 2;
    return p.side === 'left' ? arrow(gx + gw * 0.75, cy, gx + gw * 0.25, cy) : arrow(gx + gw * 0.25, cy, gx + gw * 0.75, cy);
  }
  return '';
}

export function drawItem(item) {
  const W = item.size.w, H = item.size.h;
  const s = Math.min(460 / W, 400 / H);
  const pw = W * s, ph = H * s;
  const multiRow = item.rows.length > 1;
  const L = multiRow ? 78 : 36, T = 52, R = 70, B = 64;
  const t = 2.25 * s;
  const frame = FRAME_HEX[item.frame] || FRAME_HEX.white;
  const stroke = `stroke="${INK}" stroke-width="1"`;
  let o = rect(L, T, pw, ph, `fill="${frame}" stroke="${INK}" stroke-width="2"`);

  const panes = [];
  let y = T;
  item.rows.forEach((row) => {
    const rh = row.h * s;
    let x = L;
    row.cols.forEach((p) => {
      const cw = p.w * s, f = t * 0.6;
      let gx = x + f, gy = y + f, gw = cw - 2 * f, gh = rh - 2 * f;
      o += rect(gx, gy, gw, gh, `fill="${frame}" ${stroke}`);
      if (p.op !== 'fixed') {
        const si = t * 0.5;
        gx += si; gy += si; gw -= 2 * si; gh -= 2 * si;
      }
      const slab = isSlab(item, p);
      const grille = slab ? null : (p.grille || item.grille);
      if (slab) {
        o += rect(gx, gy, gw, gh, `fill="${SLAB_HEX[item.finish] || SLAB_HEX.paint}" ${stroke}`);
        o += rect(gx + gw * 0.24, gy + gh * 0.08, gw * 0.52, gh * 0.3, `fill="${GLASS}" ${stroke}`);
        const kx = p.side === 'left' ? gx + gw * 0.86 : gx + gw * 0.14;
        o += `<circle cx="${n(kx)}" cy="${n(gy + gh * 0.54)}" r="${n(Math.max(3, 0.9 * s))}" fill="${INK}"/>`;
      } else {
        o += rect(gx, gy, gw, gh, `fill="${GLASS}" ${stroke}`);
        if (grille && grille !== 'none') o += grilleLines(grille, gx, gy, gw, gh, p.op === 'doublehung');
      }
      o += opSymbol(p, gx, gy, gw, gh);
      const letter = String.fromCharCode(65 + panes.length);
      const clearOfSwing = (p.op === 'casement' || p.op === 'hinged') && p.side === 'left';
      o += `<text x="${n(clearOfSwing ? gx + gw - 5 : gx + 5)}" y="${n(gy + 14)}" text-anchor="${clearOfSwing ? 'end' : 'start'}" fill="${MUTED}" ${MONO}>${letter}</text>`;
      panes.push({ letter, pane: p, slab, grille });
      x += cw;
    });
    y += rh;
  });

  o += hdim(L, L + pw, T - 28, T, fmtInches(W));
  const last = item.rows[item.rows.length - 1];
  if (last.cols.length > 1) {
    let x = L;
    last.cols.forEach((p) => { o += hdim(x, x + p.w * s, T + ph + 28, T + ph, fmtInches(p.w)); x += p.w * s; });
  }
  o += vdim(T, T + ph, L + pw + 30, L + pw, fmtInches(H));
  if (multiRow) {
    let yy = T;
    item.rows.forEach((r) => { o += vdim(yy, yy + r.h * s, L - 30, L, fmtInches(r.h)); yy += r.h * s; });
  }

  const vw = L + pw + R, vh = T + ph + B;
  const svg = `<svg viewBox="0 0 ${n(vw)} ${n(vh)}" width="${n(vw)}" height="${n(vh)}" role="img" aria-label="Elevation of ${esc(item.id)}, viewed from outside">${o}</svg>`;
  return { svg, panes };
}

const allPanes = (item) => item.rows.flatMap((r) => r.cols);

function describe(item) {
  const ps = allPanes(item);
  if (item.product === 'entry') {
    const leaves = ps.filter((p) => p.op === 'hinged').length;
    return (leaves > 1 ? 'Double entry door' : 'Entry door') + (ps.some((p) => p.op === 'fixed') ? ' with sidelights' : '');
  }
  const word = (op) => (item.product === 'patio' && op === 'hinged' ? 'hinged (French)' : LABELS.op[op].toLowerCase());
  const ops = [...new Set(ps.map((p) => word(p.op)))];
  return `${LABELS.product[item.product]}: ${ops.join(', ')}`;
}

function handing(item) {
  if (item.product === 'window') return null;
  const leaves = allPanes(item).filter((p) => p.op === 'hinged');
  const swing = LABELS.swing[item.swing].toLowerCase();
  if (leaves.length > 1) return `Double, ${swing}`;
  if (!leaves.length) return null;
  return `${LABELS.side[leaves[0].side]}-hand ${swing} (from outside)`;
}

function paneOp(p) {
  if (p.op === 'slider') return `Slider, slides ${p.side}`;
  if (p.op === 'hinged') return `Hinged ${p.side}`;
  if (p.op === 'casement') return `Casement, hinged ${p.side}`;
  return LABELS.op[p.op];
}

const fmtDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function sheetHTML(item, job, idx, total) {
  const { svg, panes } = drawItem(item);
  const spec = [
    item.tier && ['Tier', LABELS.tier[item.tier]],
    item.finish && ['Slab finish', LABELS.finish[item.finish]],
    item.hardware && ['Hardware', LABELS.hardware[item.hardware]],
    ['Frame color', LABELS.frame[item.frame]],
    ['Glass', LABELS.glass[item.glass]],
    handing(item) && ['Handing', handing(item)],
    ['Overall size', `${fmtInches(item.size.w)} W × ${fmtInches(item.size.h)} H`],
    ['Size basis', LABELS.sizeBasis[item.sizeBasis]]
  ].filter(Boolean);
  const paneRows = panes.map(({ letter, pane, slab, grille }) =>
    `<tr><td>${letter}</td><td>${paneOp(pane)}</td><td>${slab ? 'Door lite' : LABELS.glass[item.glass]}</td><td>${grille ? LABELS.grille[grille] : 'n/a'}</td></tr>`).join('');
  const swingNote = allPanes(item).some((p) => p.op === 'casement' || p.op === 'hinged' || p.op === 'awning')
    ? 'Dashed lines start at the hinge side; the apex marks the handle. ' : '';
  const ref = esc(job.ref || 'No job ref'), supplier = esc(item.supplier);

  return `<article class="sheet">
    <header class="sheet__head">
      <div class="sheet__id"><img class="sheet__logo" src="/assets/logo-full.png" alt="Northern Pines Construction Services" width="243" height="192">
        <div><div class="sheet__title">Pricing request</div><div class="sheet__notorder">This is not an order</div></div></div>
      <dl class="sheet__meta"><dt>Job</dt><dd>${ref}</dd><dt>Requested</dt><dd>${esc(fmtDate(job.date))}</dd><dt>Supplier</dt><dd>${supplier}</dd><dt>Item</dt><dd>${idx} of ${total} (${esc(item.id)})</dd></dl>
    </header>
    <div class="sheet__fields">
      <div><b>Location</b>${esc(item.location) || '&nbsp;'}</div>
      <div><b>Product</b>${esc(describe(item))}</div>
      <div><b>Qty</b>${item.qty}</div>
      <div><b>Unit price (supplier)</b><span class="sheet__blank"></span></div>
    </div>
    <div class="sheet__drawing"><div class="sheet__view">Viewed from outside</div>${svg}</div>
    <div class="sheet__specs">
      <div><h3>Specification</h3><table><tbody>${spec.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div>
      <div><h3>Panes</h3><table><thead><tr><th>Pane</th><th>Operation</th><th>Glass</th><th>Grille</th></tr></thead><tbody>${paneRows}</tbody></table></div>
    </div>
    <footer class="sheet__foot"><span>${swingNote}All dimensions in inches.</span><span>${ref} · ${supplier} · ${idx}/${total}</span></footer>
  </article>`;
}
