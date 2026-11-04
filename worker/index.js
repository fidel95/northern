/* Giveaway entry API. Static pages are served by Workers Assets; only
   /api/* reaches this Worker (assets.run_worker_first in wrangler.jsonc).

   Files land in a PRIVATE R2 bucket (binding BUCKET). Nothing is public: the
   notification email carries signed links that expire after LINK_DAYS.

   Secrets (wrangler secret put ...):
     SESSION_SECRET     random string, signs upload sessions and download links
     RESEND_API_KEY     email provider key
     TURNSTILE_SECRET   optional; when set, /session requires a passed challenge
   Vars (wrangler.jsonc): NOTIFY_TO, MAIL_FROM, SITE_ORIGIN */

import { DurableObject } from 'cloudflare:workers';

const MB = 1024 * 1024;
// Hard ceilings so storage can never outgrow R2's free 10 GB. Enforced by the
// Ledger below, not by trust in the browser.
const CAP_BYTES = 7 * 1024 * MB;
const MAX_ENTRIES = 150;
const RESERVE_TTL_MS = 4 * 3600000;
const CAPS = { ownership: 10 * MB, income: 100 * MB, video: 500 * MB };
const DOC_EXT = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'];
const VID_EXT = ['mp4', 'mov', 'm4v', 'webm', '3gp'];
const MAX_PART = 9 * MB;
const MAX_PARTS = 70;
const SESSION_HOURS = 4;
const LINK_DAYS = 21;

/* One global Durable Object counts reserved/stored bytes and submitted entries.
   A reservation is taken when an upload starts and released if it is never
   finished (or finalized to the real size once it is). */
export class Ledger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS res (k TEXT PRIMARY KEY, bytes INTEGER, ts INTEGER, done INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS rl (k TEXT, ts INTEGER)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS rl_k ON rl (k, ts)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS ids (k TEXT PRIMARY KEY)');
  }
  /* Sliding-window limiter: allow at most `limit` hits per `windowMs` for key k. */
  hit(k, limit, windowMs) {
    const now = Date.now();
    this.sql.exec('DELETE FROM rl WHERE ts < ?', now - 24 * 3600000);
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM rl WHERE k = ? AND ts > ?', k, now - windowMs).one().n;
    if (n >= limit) return false;
    this.sql.exec('INSERT INTO rl (k, ts) VALUES (?, ?)', k, now);
    return true;
  }
  /* One entry per session, per email and per phone number. Atomic with the entry count. */
  commit(keys) {
    if (this.entries() >= MAX_ENTRIES) return 'full';
    for (const k of keys) {
      if (this.sql.exec('SELECT 1 FROM ids WHERE k = ?', k).toArray().length) return 'duplicate';
    }
    for (const k of keys) this.sql.exec('INSERT INTO ids (k) VALUES (?)', k);
    this.sql.exec("INSERT INTO meta (k, v) VALUES ('entries', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1");
    return 'ok';
  }
  uncommit(keys) {
    for (const k of keys) this.sql.exec('DELETE FROM ids WHERE k = ?', k);
    this.sql.exec("UPDATE meta SET v = MAX(v - 1, 0) WHERE k = 'entries'");
  }
  used() {
    this.sql.exec('DELETE FROM res WHERE done = 0 AND ts < ?', Date.now() - RESERVE_TTL_MS);
    return this.sql.exec('SELECT COALESCE(SUM(bytes),0) AS n FROM res').one().n;
  }
  entries() {
    const r = this.sql.exec("SELECT v FROM meta WHERE k = 'entries'").toArray();
    return r.length ? r[0].v : 0;
  }
  status() { return { used: this.used(), entries: this.entries(), full: this.used() >= CAP_BYTES || this.entries() >= MAX_ENTRIES }; }
  reserve(key, bytes) {
    this.sql.exec('DELETE FROM res WHERE k = ?', key);
    if (this.used() + bytes > CAP_BYTES) return false;
    this.sql.exec('INSERT INTO res (k, bytes, ts, done) VALUES (?, ?, ?, 0)', key, bytes, Date.now());
    return true;
  }
  finalize(key, actual) {
    const r = this.sql.exec('SELECT bytes FROM res WHERE k = ?', key).toArray();
    if (!r.length || actual > r[0].bytes) { this.sql.exec('DELETE FROM res WHERE k = ?', key); return false; }
    this.sql.exec('UPDATE res SET bytes = ?, done = 1 WHERE k = ?', actual, key);
    return true;
  }
  release(key) { this.sql.exec('DELETE FROM res WHERE k = ?', key); }
}
const ipKey = async (env, request) => (await hmac(env.SESSION_SECRET, `ip.${request.headers.get('CF-Connecting-IP') || 'unknown'}`)).slice(0, 24);
const ledger = (env) => env.LEDGER.get(env.LEDGER.idFromName('giveaway'));

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (status, error) => json({ error }, status);

const enc = new TextEncoder();
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
  return [...sig].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const extOf = (name) => (/\.([^.]+)$/.exec(name || '') || [])[1]?.toLowerCase() || '';
const safeName = (name) => (name || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function checkToken(env, url) {
  const id = url.searchParams.get('id') || '';
  const token = url.searchParams.get('token') || '';
  const [tid, exp, sig] = token.split('.');
  if (!id || tid !== id || !exp || Number(exp) < Date.now()) return null;
  if (!same(sig || '', await hmac(env.SESSION_SECRET, `s.${tid}.${exp}`))) return null;
  return id;
}

async function signedLink(env, key) {
  const exp = Date.now() + LINK_DAYS * 86400000;
  const sig = await hmac(env.SESSION_SECRET, `f.${key}.${exp}`);
  return `${env.SITE_ORIGIN}/api/giveaway/file?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/giveaway/, '');
  const m = request.method;

  if (path === '/file' && m === 'GET') {
    const key = url.searchParams.get('key') || '';
    const exp = url.searchParams.get('exp') || '';
    const sig = url.searchParams.get('sig') || '';
    if (!key.startsWith('giveaway/') || Number(exp) < Date.now() ||
        !same(sig, await hmac(env.SESSION_SECRET, `f.${key}.${exp}`))) return fail(403, 'link expired or invalid');
    const obj = await env.BUCKET.get(key);
    if (!obj) return fail(404, 'not found');
    const h = new Headers({
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
      'Content-Length': String(obj.size),
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    });
    return new Response(obj.body, { headers: h });
  }

  if (path === '/session' && m === 'POST') {
    if (env.GIVEAWAY_OPEN === 'false') return fail(503, 'closed');
    if ((await ledger(env).status()).full) return fail(503, 'full');
    if (!(await ledger(env).hit(`sess.${await ipKey(env, request)}`, 5, 3600000))) return fail(429, 'slow');
    if (env.TURNSTILE_SECRET) {
      const body = await request.json().catch(() => ({}));
      const fd = new FormData();
      fd.set('secret', env.TURNSTILE_SECRET);
      fd.set('response', body.turnstile || '');
      fd.set('remoteip', request.headers.get('CF-Connecting-IP') || '');
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: fd });
      const out = await r.json().catch(() => ({}));
      if (!out.success) return fail(403, 'challenge failed');
    }
    const id = crypto.randomUUID();
    const exp = Date.now() + SESSION_HOURS * 3600000;
    return json({ id, token: `${id}.${exp}.${await hmac(env.SESSION_SECRET, `s.${id}.${exp}`)}` });
  }

  const id = await checkToken(env, url);
  if (!id) return fail(401, 'session expired');
  const prefix = `giveaway/${id}/`;

  if (path === '/upload/start' && m === 'POST') {
    const kind = url.searchParams.get('kind');
    const name = url.searchParams.get('name') || '';
    const size = Number(url.searchParams.get('size'));
    if (!CAPS[kind]) return fail(400, 'bad kind');
    if (!(await ledger(env).hit(`start.${id}`, 8, SESSION_HOURS * 3600000))) return fail(429, 'slow');
    if (!(size > 0) || size > CAPS[kind]) return fail(413, 'too large');
    if (!(kind === 'video' ? VID_EXT : DOC_EXT).includes(extOf(name))) return fail(415, 'bad type');
    const key = `${prefix}${kind}.${extOf(name)}`;
    if (!(await ledger(env).reserve(key, size))) return fail(503, 'full');
    const mp = await env.BUCKET.createMultipartUpload(key, {
      httpMetadata: { contentType: url.searchParams.get('type') || 'application/octet-stream' },
    });
    return json({ key, uploadId: mp.uploadId });
  }

  if (path === '/upload/part' && m === 'PUT') {
    const key = url.searchParams.get('key') || '';
    const n = Number(url.searchParams.get('n'));
    if (!key.startsWith(prefix) || !(n >= 1 && n <= MAX_PARTS)) return fail(400, 'bad part');
    const len = Number(request.headers.get('Content-Length'));
    if (!(len > 0) || len > MAX_PART) return fail(413, 'part too large');
    const mp = env.BUCKET.resumeMultipartUpload(key, url.searchParams.get('uploadId') || '');
    const part = await mp.uploadPart(n, request.body);
    return json({ partNumber: part.partNumber, etag: part.etag });
  }

  if (path === '/upload/complete' && m === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { key, uploadId, parts, kind } = body;
    if (!String(key).startsWith(prefix) || !CAPS[kind] || !Array.isArray(parts) || parts.length > MAX_PARTS) return fail(400, 'bad request');
    const mp = env.BUCKET.resumeMultipartUpload(key, uploadId);
    const obj = await mp.complete(parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })));
    if (obj.size > CAPS[kind] || !(await ledger(env).finalize(key, obj.size))) {
      await env.BUCKET.delete(key);
      return fail(413, 'too large');
    }
    return json({ ok: true, size: obj.size });
  }

  if (path === '/submit' && m === 'POST') {
    const body = await request.json().catch(() => null);
    if (!body || !body.fields || !Array.isArray(body.files)) return fail(400, 'bad request');
    const f = body.fields;
    if (f.website) return json({ ok: true }); // honeypot: pretend success
    if (!(await ledger(env).hit(`sub.${await ipKey(env, request)}`, 3, 3600000))) return fail(429, 'slow');
    const clean = (v, n) => String(v ?? '').trim().slice(0, n);
    const data = {
      id, received: new Date().toISOString(), lang: f.lang === 'es' ? 'es' : 'en',
      first_name: clean(f.first_name, 60), last_name: clean(f.last_name, 80),
      phone: clean(f.phone, 30), email: clean(f.email, 120),
      elig_owner: !!f.elig_owner, elig_county: !!f.elig_county, elig_income: !!f.elig_income, elig_media: !!f.elig_media,
      outside: clean(f.outside, 600),
    };
    if (!data.first_name || !data.last_name || !data.phone || !/^\S+@\S+\.\S+$/.test(data.email)) return fail(400, 'missing fields');

    const stored = [];
    for (const file of body.files) {
      if (!String(file.key).startsWith(prefix) || !CAPS[file.kind]) return fail(400, 'bad file');
      const head = await env.BUCKET.head(file.key);
      if (!head) return fail(400, 'file missing');
      stored.push({ kind: file.kind, key: file.key, name: clean(file.name, 120), size: head.size });
    }
    if (!stored.some((s) => s.kind === 'ownership') || !stored.some((s) => s.kind === 'video')) return fail(400, 'missing files');
    const ids = [`s:${id}`, `e:${data.email.toLowerCase()}`, `p:${data.phone.replace(/\D/g, '').slice(-10)}`];
    const verdict = await ledger(env).commit(ids);
    if (verdict === 'full') return fail(503, 'full');
    if (verdict === 'duplicate') return fail(409, 'duplicate');
    data.files = stored;
    try {
      await env.BUCKET.put(`${prefix}submission.json`, JSON.stringify(data, null, 2), { httpMetadata: { contentType: 'application/json' } });
    } catch (err) {
      await ledger(env).uncommit(ids);
      throw err;
    }

    try {
      await sendEmail(env, data);
    } catch (err) {
      // Entry is safely stored; don't make the applicant redo a 300 MB upload.
      console.error('email failed', id, String(err));
    }
    return json({ ok: true });
  }

  return fail(404, 'not found');
}

async function sendEmail(env, d) {
  const label = { ownership: 'Proof of homeownership', income: 'Proof of income', video: 'Video entry' };
  const yes = (b) => (b ? 'Yes' : 'No');
  const rows = [];
  for (const f of d.files) {
    const link = await signedLink(env, f.key);
    rows.push(`<li><strong>${label[f.kind]}</strong>: <a href="${esc(link)}">${esc(f.name)}</a> (${(f.size / MB).toFixed(1)} MB)</li>`);
  }
  const html = `<h2>New giveaway entry: ${esc(d.first_name)} ${esc(d.last_name)}</h2>
<p>Phone: <a href="tel:${esc(d.phone)}">${esc(d.phone)}</a><br>Email: <a href="mailto:${esc(d.email)}">${esc(d.email)}</a><br>Language: ${d.lang === 'es' ? 'Español' : 'English'}</p>
<h3>Eligibility</h3><ul>
<li>Owns and lives in the home: ${yes(d.elig_owner)}</li>
<li>In Montgomery County: ${yes(d.elig_county)}</li>
<li>Meets low-income guidelines: ${yes(d.elig_income)}</li>
<li>Willing to sign media release: ${yes(d.elig_media)}</li></ul>
${d.outside ? `<h3>Outside Montgomery County</h3><p>${esc(d.outside).replace(/\n/g, '<br>')}</p>` : ''}
<h3>Files</h3><ul>${rows.join('')}</ul>
<p style="color:#666">Download links expire in ${LINK_DAYS} days. Entry id: ${esc(d.id)}</p>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM, to: [env.NOTIFY_TO], reply_to: d.email,
      subject: `Giveaway entry: ${d.first_name} ${d.last_name}`, html,
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`);
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      console.error(String(err));
      return fail(500, 'server error');
    }
  },
};
