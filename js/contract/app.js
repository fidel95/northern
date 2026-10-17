import { SERVICES, newContract, newLine, cleanContract, totals, payments, pctSum, directPart, fmtMoney, problems, companyGaps, cancelDeadline, fmtDate, isDate } from './model.js';
import { contractHTML, esc } from './html.js';
import { contractDocx } from './docx.js';

const KEY = 'npcs.contracts.v1';
const $ = (id) => document.getElementById(id);
const form = $('form');

const store = load();
const draft = () => store.drafts.find((d) => d.id === store.current);

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* unreadable storage starts fresh */ }
  const rep = raw && raw.rep && typeof raw.rep === 'object' ? { repName: String(raw.rep.repName || ''), repPhone: String(raw.rep.repPhone || '') } : {};
  const drafts = raw && Array.isArray(raw.drafts) ? raw.drafts.map(cleanContract).filter(Boolean) : [];
  if (!drafts.length) drafts.push(newContract(rep));
  const current = raw && drafts.some((d) => d.id === raw.current) ? raw.current : drafts[0].id;
  return { drafts, current, rep };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch (e) {
    say('This browser would not save the draft. Download the Word file now so nothing is lost.');
  }
}

let sayTimer = null;
function say(msg) {
  $('status').textContent = msg;
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => { $('status').textContent = ''; }, 9000);
}

// --- form <-> record ---------------------------------------------------------

const getPath = (o, path) => path.split('.').reduce((x, k) => (x ? x[k] : undefined), o);
function setPath(o, path, v) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((x, k) => x[k], o)[last] = v;
}

function fillForm() {
  const c = draft();
  form.querySelectorAll('[data-f]').forEach((el) => {
    const v = getPath(c, el.dataset.f);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'radio') el.checked = v === el.value;
    else el.value = v ?? '';
  });
  $('services').innerHTML = SERVICES.map((s) =>
    `<label class="check"><input type="checkbox" data-service="${esc(s)}"${c.services.includes(s) ? ' checked' : ''}> ${esc(s)}</label>`).join('');
  renderLines();
}

function renderLines() {
  const c = draft();
  $('lines').innerHTML = c.lines.map((l, i) => `
    <fieldset class="line">
      <legend>Line ${i + 1}</legend>
      ${c.lines.length > 1 ? `<button type="button" class="btn btn--small line__del" data-act="del-line" data-line="${esc(l.id)}" aria-label="Remove line ${i + 1}">Remove</button>` : ''}
      <label class="field"><span>Item</span><input data-line="${esc(l.id)}" data-lf="item" type="text" value="${esc(l.item)}" placeholder="e.g. Replacement windows"></label>
      <label class="field"><span>Product and specifications</span><textarea data-line="${esc(l.id)}" data-lf="spec" rows="2" placeholder="Brand, series, size, color, finish">${esc(l.spec)}</textarea></label>
      <div class="fields fields--2">
        <label class="field"><span>Qty</span><input data-line="${esc(l.id)}" data-lf="qty" type="text" value="${esc(l.qty)}"></label>
        <label class="field"><span>Price ($)</span><input data-line="${esc(l.id)}" data-lf="price" type="text" inputmode="decimal" value="${esc(l.price)}"></label>
      </div>
    </fieldset>`).join('');
}

function readValue(el) {
  if (el.type === 'checkbox') return el.checked;
  return el.value;
}

function onEdit(e) {
  const el = e.target;
  const c = draft();
  if (el.dataset.f) {
    if (el.type === 'radio' && !el.checked) return;
    setPath(c, el.dataset.f, readValue(el));
    if (el.dataset.f === 'repName' || el.dataset.f === 'repPhone') store.rep[el.dataset.f] = el.value;
  } else if (el.dataset.service) {
    const s = el.dataset.service;
    c.services = SERVICES.filter((x) => (x === s ? el.checked : c.services.includes(x)));
  } else if (el.dataset.lf) {
    const line = c.lines.find((l) => l.id === el.dataset.line);
    if (!line) return;
    line[el.dataset.lf] = el.value;
  } else return;
  save();
  refresh();
}

// --- everything that follows from the record --------------------------------

const label = (d) => `${d.no.trim() || 'No number'} \u00b7 ${d.cust1.trim() || 'New customer'}`;

function renderDraftSelect() {
  $('draft-select').innerHTML = store.drafts.map((d) =>
    `<option value="${esc(d.id)}"${d.id === store.current ? ' selected' : ''}>${esc(label(d))}</option>`).join('');
}

const cssString = (s) => '"' + String(s).replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' ') + '"';

function refresh() {
  const c = draft();
  $('project-field').hidden = c.projectSame;
  $('sub-field').hidden = !c.sub;
  $('finance-fields').hidden = c.method !== 'finance';
  $('claim-fields').hidden = c.method !== 'insurance';
  $('hoa-fields').hidden = !c.hoa;

  const t = totals(c);
  $('subtotal').textContent = t ? fmtMoney(t.subtotal) : 'n/a';
  $('total').textContent = t ? fmtMoney(t.total) : 'n/a';
  const pay = payments(c);
  [0, 1, 2].forEach((i) => { $('pay-' + i).textContent = pay ? fmtMoney(pay[i]) : ''; });
  const sum = pctSum(c);
  $('pct-hint').textContent = sum === null ? 'Enter all three percentages.' : sum === 100 ? '' : `These add up to ${sum}%. They need to add up to 100%.`;
  const direct = directPart(c);
  $('pay-hint').textContent = !t ? ''
    : c.method === 'cash' ? `The customer pays ${fmtMoney(t.total)} at signing. No work starts until it's received.`
      : c.method === 'finance' ? (direct === null ? 'Enter the amount financed.' : `The customer pays ${fmtMoney(direct)} at signing; the loan covers the rest. No work starts until both are received.`)
        : c.method === 'insurance' ? 'No work starts until the first payment is received.' : '';

  const calc = cancelDeadline(c.signed);
  $('cancel-hint').textContent = !isDate(c.signed) ? 'Enter the signing date to work out the cancel-by date.'
    : isDate(c.cancelBy) ? `Using your date, midnight of ${fmtDate(c.cancelBy, true)}. The calculated date is ${fmtDate(calc, true)}.`
      : `The customer can cancel until midnight of ${fmtDate(calc, true)}. That is three business days, not counting Sundays or federal holidays.`;

  const ps = problems(c);
  $('problems-wrap').hidden = !ps.length;
  $('ready').hidden = !!ps.length;
  $('problems').innerHTML = ps.map((p) => `<li>${esc(p)}</li>`).join('');

  $('preview').innerHTML = contractHTML(c);
  $('page-style').textContent = `@page { @bottom-left { content: ${cssString(`Agreement no. ${c.no.trim() || '________'}  \u00b7  Page `)} counter(page) " of " counter(pages); }
    @bottom-right { content: "Customer initials ______  ______"; } }`;
  renderDraftSelect();
}

// --- actions -----------------------------------------------------------------

function fileName(c) {
  const last = c.cust1.trim().split(/\s+/).pop() || '';
  const parts = ['Northern-Pines-Agreement', c.no.trim(), last].filter(Boolean).join('-');
  return parts.replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-') + '.docx';
}

function download() {
  const c = draft();
  const blob = new Blob([contractDocx(c)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName(c);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  const n = problems(c).length;
  say(n ? `Downloaded. ${n} required ${n === 1 ? 'item is' : 'items are'} still blank and highlighted in yellow; fill ${n === 1 ? 'it' : 'them'} in before the customer signs.` : 'Downloaded.');
}

function openDraft(id) {
  store.current = id;
  save();
  fillForm();
  refresh();
}

form.addEventListener('input', onEdit);
form.addEventListener('change', onEdit);
form.addEventListener('submit', (e) => e.preventDefault());

form.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const c = draft();
  if (btn.id === 'add-line') {
    c.lines.push(newLine());
    save(); renderLines(); refresh();
    const inputs = $('lines').querySelectorAll('[data-lf="item"]');
    inputs[inputs.length - 1].focus();
  } else if (btn.dataset.act === 'del-line') {
    c.lines = c.lines.filter((l) => l.id !== btn.dataset.line);
    save(); renderLines(); refresh();
    $('add-line').focus();
  } else if (btn.id === 'draft-new') {
    const d = newContract(store.rep);
    store.drafts.unshift(d);
    openDraft(d.id);
    form.querySelector('[data-f="no"]').focus();
    say('New contract started.');
  } else if (btn.id === 'draft-delete') {
    if (!window.confirm(`Delete the draft "${label(c)}"? This can't be undone.`)) return;
    store.drafts = store.drafts.filter((d) => d.id !== c.id);
    if (!store.drafts.length) store.drafts.push(newContract(store.rep));
    openDraft(store.drafts[0].id);
    say('Draft deleted.');
  } else if (btn.id === 'download') {
    download();
  } else if (btn.id === 'print') {
    window.print();
  }
});

$('draft-select').addEventListener('change', (e) => openDraft(e.target.value));

const gaps = companyGaps();
$('company-gaps').hidden = !gaps.length;
$('company-gaps').textContent = `Office setup isn't finished, so these print highlighted in yellow on every contract: ${gaps.join(', ')}. Ask the office to fill them in.`;

fillForm();
refresh();
