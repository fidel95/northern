// Renders the contract blocks from content.js as HTML: the live preview, and
// the pages the browser prints or saves as PDF.

import { buildContract } from './content.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const box = (on) => `<span class="k-box" aria-hidden="true">${on ? '☒' : '☐'}</span><span class="k-sr">${on ? '(checked)' : '(not checked)'}</span>`;

function inline(parts) {
  return [].concat(parts).map((x) => {
    if (x === null || x === undefined || x === '') return '';
    if (typeof x === 'string') return esc(x);
    if ('box' in x) return box(x.box);
    if ('ph' in x) {
      const t = x.v ? `<span class="k-fill">${esc(x.v)}</span>` : `<mark>[${esc(x.ph)}]</mark>`;
      return x.b ? `<b>${t}</b>` : t;
    }
    return `<b>${esc(x.b)}</b>`;
  }).join('');
}

function pClass(o) {
  return ['k-p', o.align && `k-${o.align}`, o.color && `k-${o.color}`, o.rule && 'k-rule', o.box && 'k-boxed',
    o.pageBreak && 'k-break', o.size && o.size <= 18 && 'k-small', o.size === 16 && 'k-tiny', o.size >= 21 && 'k-big',
    o.spaced && 'k-spaced', o.after === 0 && 'k-tight'].filter(Boolean).join(' ');
}

function table(b) {
  const total = b.widths.reduce((x, y) => x + y, 0);
  const cols = b.widths.map((w) => `<col style="width:${(100 * w / total).toFixed(2)}%">`).join('');
  const rows = b.rows.map((r, i) => {
    const header = b.header && i === 0;
    const last = b.total && i === b.rows.length - 1;
    return `<tr${last ? ' class="k-total"' : ''}>${r.map((c, j) => {
      const label = (b.labels === 'first' && j === 0) || (b.labels === 'even' && j % 2 === 0);
      const tag = header || label ? 'th' : 'td';
      const scope = header ? ' scope="col"' : label ? ' scope="row"' : '';
      const cls = b.right && b.right.includes(j) ? ' class="k-num"' : '';
      return `<${tag}${scope}${cls}>${inline(c)}</${tag}>`;
    }).join('')}</tr>`;
  });
  const head = b.header ? `<thead>${rows.shift()}</thead>` : '';
  return `<table class="k-table"><colgroup>${cols}</colgroup>${head}<tbody>${rows.join('')}</tbody></table>`;
}

const line = (caption, value = '') => `<div class="k-line"><span class="k-line__v">${esc(value)}</span><span class="k-line__c">${esc(caption)}</span></div>`;

function block(b) {
  switch (b.t) {
    case 'title': return `<h2 class="k-title">${esc(b.text)}</h2>`;
    case 'h': return `<h3 class="k-h">${esc(b.text)}</h3>`;
    case 'p': return `<p class="${pClass(b.o)}">${inline(b.parts)}</p>`;
    case 'ul': return `<ul class="k-ul">${b.items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`;
    case 'check': return `<p class="k-check">${box(b.on)} ${inline(b.parts)}</p>`;
    case 'checkrow': return `<p class="k-checkrow">${b.items.map((it) => `<span>${box(it.on)} ${esc(it.label)}</span>`).join('')}</p>`;
    case 'table': return table(b);
    case 'signer': return `<div class="k-signer"><p class="k-signer__t">${esc(b.title)}</p>
      <div class="k-sig">${line('Signature')}${line('Date')}${line('Printed name', String(b.name || '').trim())}${line(b.second)}</div></div>`;
    case 'sigline': return `<div class="k-sig k-sig--notice">${b.cols.filter(([, cap]) => cap).map(([, cap]) => line(cap)).join('')}</div>`;
    default: return '';
  }
}

export function contractHTML(c, opts = {}) {
  return `<article class="k-doc">${buildContract(c, opts).map(block).join('')}</article>`;
}
