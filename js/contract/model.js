// The contract record, money and date helpers, and the checks Indiana requires
// before a customer signs. Nothing here touches the DOM.
import { COMPANY } from './company.js';

export const SERVICES = ['Roofing', 'Windows', 'Gutters', 'Siding', 'Doors', 'Concrete'];

export const uid = () => Math.random().toString(36).slice(2, 10);

export const newLine = () => ({ id: uid(), item: '', spec: '', qty: '', price: '' });

export function newContract(rep = {}) {
  const today = isoToday();
  return {
    id: uid(),
    no: '', submitted: today, expires: addDays(today, 30),
    repName: rep.repName || '', repPhone: rep.repPhone || '',
    cust1: '', cust2: '', mailing: '', projectSame: true, project: '', phone: '', email: '',
    services: [],
    lines: [newLine()],
    attached: '', inclusions: '', exclusions: '',
    sub: false, subWork: '',
    tax: '',
    pct: { ...COMPANY.payment },
    method: 'cash', lender: COMPANY.lender, plan: '', financed: '',
    start: '', finish: '',
    hoa: false, hoaBy: '',
    dumpster: '',
    claim: false, insurer: '', claimNo: '',
    photos: '',
    signed: today, cancelBy: ''
  };
}

/** Every field empty: the printable blank the office keeps in contracts/. */
export function blankContract() {
  const c = newContract();
  Object.assign(c, { submitted: '', expires: '', signed: '', method: '', lender: '', lines: [] });
  c.pct = { deposit: '', materials: '', final: '' };
  return c;
}

/** Brings a stored record up to the current shape, or null if it is unusable. */
export function cleanContract(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return null;
  const c = { ...newContract(), ...raw };
  c.pct = { ...COMPANY.payment, ...(raw.pct || {}) };
  c.services = Array.isArray(raw.services) ? raw.services.filter((s) => SERVICES.includes(s)) : [];
  c.lines = Array.isArray(raw.lines) ? raw.lines.filter((l) => l && typeof l.id === 'string').map((l) => ({ ...newLine(), ...l })) : [];
  if (!c.lines.length) c.lines.push(newLine());
  return c;
}

// --- money ---------------------------------------------------------------

export function parseMoney(s) {
  const t = String(s ?? '').replace(/[$,\s]/g, '');
  if (!t || !/^\d*\.?\d+$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100) / 100;
}

export const fmtMoney = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A typed amount shown as money when it parses, as typed when it doesn't. */
export const showMoney = (s) => { const n = parseMoney(s); return n === null ? String(s ?? '').trim() : fmtMoney(n); };

export function totals(c) {
  const prices = c.lines.map((l) => parseMoney(l.price)).filter((n) => n !== null);
  if (!prices.length) return null;
  const subtotal = Math.round(prices.reduce((a, b) => a + b, 0) * 100) / 100;
  const tax = parseMoney(c.tax) || 0;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

const pctNum = (s) => { const n = parseFloat(String(s ?? '').replace('%', '')); return Number.isFinite(n) ? n : null; };

/** The three payment amounts. The last absorbs rounding so they add up exactly. */
export function payments(c) {
  const t = totals(c);
  const p = [c.pct.deposit, c.pct.materials, c.pct.final].map(pctNum);
  if (!t || p.some((n) => n === null)) return null;
  const a = Math.round(t.total * p[0]) / 100;
  const b = Math.round(t.total * p[1]) / 100;
  return [a, b, Math.round((t.total - a - b) * 100) / 100];
}

export function pctSum(c) {
  const p = [c.pct.deposit, c.pct.materials, c.pct.final].map(pctNum);
  return p.some((n) => n === null) ? null : Math.round(p.reduce((x, y) => x + y, 0) * 100) / 100;
}

// --- dates ---------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
export const isoToday = () => iso(new Date());
export const addDays = (s, n) => { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); };

export function fmtDate(s, weekday = false) {
  if (!isDate(s)) return '';
  return fromIso(s).toLocaleDateString('en-US', { ...(weekday ? { weekday: 'long' } : {}), year: 'numeric', month: 'long', day: 'numeric' });
}

/** Federal holidays for a year, each on its actual date and on its observed date. */
function holidays(y) {
  const nth = (m, wd, n) => { const d = new Date(y, m, 1); d.setDate(1 + ((wd - d.getDay() + 7) % 7) + (n - 1) * 7); return d; };
  const last = (m, wd) => { const d = new Date(y, m + 1, 0); d.setDate(d.getDate() - ((d.getDay() - wd + 7) % 7)); return d; };
  const fixed = [[0, 1], [5, 19], [6, 4], [10, 11], [11, 25]].map(([m, d]) => new Date(y, m, d));
  const out = [...fixed, nth(0, 1, 3), nth(1, 1, 3), last(4, 1), nth(8, 1, 1), nth(9, 1, 2), nth(10, 4, 4)];
  fixed.forEach((d) => {
    if (d.getDay() === 6) out.push(new Date(y, d.getMonth(), d.getDate() - 1));
    if (d.getDay() === 0) out.push(new Date(y, d.getMonth(), d.getDate() + 1));
  });
  return out.map(iso);
}

/**
 * Midnight of the third business day after signing. Under the FTC rule a
 * business day is any day but Sunday and federal holidays, so Saturday counts.
 * Observed and actual holiday dates are both skipped: an extra day only ever
 * gives the customer longer.
 */
export function cancelDeadline(signed) {
  if (!isDate(signed)) return '';
  const y = fromIso(signed).getFullYear();
  const off = new Set([...holidays(y), ...holidays(y + 1)]);
  let d = signed;
  for (let n = 0; n < 3;) {
    d = addDays(d, 1);
    if (fromIso(d).getDay() !== 0 && !off.has(d)) n++;
  }
  return d;
}

export const cancelBy = (c) => (isDate(c.cancelBy) ? c.cancelBy : cancelDeadline(c.signed));

// --- checks --------------------------------------------------------------

/** Company details still empty in company.js. Reps can't fill these; the office can. */
export function companyGaps() {
  const names = {
    street: 'office street address', zip: 'office ZIP', registration: 'contractor registration number',
    contactName: 'customer contact name', holdback: 'punch-list holdback', lateDays: 'late-payment days',
    lateRate: 'late-payment rate', financingDays: 'financing approval days', workmanshipWarranty: 'workmanship warranty term',
    county: 'county for disputes'
  };
  const out = Object.keys(names).filter((k) => !String(COMPANY[k] || '').trim()).map((k) => names[k]);
  if (COMPANY.unitPrices.some((u) => !String(u.price).trim())) out.push('hidden-damage unit prices');
  return out;
}

/** What is still missing. Indiana requires all of it before the customer signs. */
export function problems(c) {
  const out = [];
  if (!c.no.trim()) out.push('Agreement number');
  if (!c.cust1.trim()) out.push('Customer name');
  if (!(c.projectSame ? c.mailing : c.project).trim()) out.push('Project address');
  if (!isDate(c.submitted)) out.push('Date given to the customer');
  if (!isDate(c.expires)) out.push('Date the offer expires');
  const described = c.lines.filter((l) => l.item.trim() || l.spec.trim());
  if (!described.length) out.push('A description of the work (at least one line item)');
  if (described.some((l) => parseMoney(l.price) === null)) out.push('A price on every line item');
  if (!isDate(c.start)) out.push('Approximate start date');
  if (!isDate(c.finish)) out.push('Approximate completion date');
  if (isDate(c.start) && isDate(c.finish) && c.finish < c.start) out.push('Completion date is before the start date');
  const sum = pctSum(c);
  if (sum === null) out.push('All three payment percentages');
  else if (sum !== 100) out.push(`Payment percentages add up to ${sum}%, not 100%`);
  if (!c.method) out.push('How the customer is paying');
  if (c.method === 'finance' && !c.lender.trim()) out.push('Lender name');
  if (c.sub && !c.subWork.trim()) out.push('Which work the subcontractor does');
  if (c.hoa && !c.hoaBy) out.push('Who gets HOA approval');
  if (c.claim && !(c.insurer.trim() && c.claimNo.trim())) out.push('Insurer and claim number');
  if (!c.photos) out.push('Customer’s choice on project photos');
  if (!isDate(c.signed)) out.push('Signing date (for the Notice of Cancellation)');
  return out;
}
