/**
 * Browser test of the deployed admin flow.
 *
 * The API tests prove the endpoints work; this proves the APPLICATION works -
 * that the built bundle is talking to the API, that a real login round-trips
 * through an httpOnly cookie, and that the dashboard actually renders the
 * numbers it fetched.
 *
 * To make the assertions meaningful rather than "something rendered", the script
 * seeds a few members through the API first and expects to see exactly those
 * members reflected in the UI - so a dashboard stuck on zero, or a table that
 * quietly failed to fetch, fails the run.
 *
 * Everything it creates is removed again.
 *
 * Needs headless Chrome on port 9222 (see scripts/run-browser-check.ps1).
 * Run: node scripts/check-admin.mjs <baseUrl>
 */

import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

for (const line of readFileSync(join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2];
}

const [, , baseUrl = 'https://id-card-generator-chi-one.vercel.app'] = process.argv;
const EMAIL = process.env.IDCMS_ADMIN_EMAIL ?? 'admin@punamkabira.org';
// Read from .env.local (loaded above). The password is deliberately absent from
// the source tree: this repository is public and this is a live admin account.
const PASSWORD = process.env.IDCMS_ADMIN_PASSWORD ?? '';
if (!PASSWORD) {
  console.error('IDCMS_ADMIN_PASSWORD is not set - add it to .env.local before running this check.');
  process.exit(1);
}
const DEBUG_PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve } = this.pending.get(m.id);
        this.pending.delete(m.id);
        resolve(m.result);
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res) => this.pending.set(id, { resolve: res }));
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { returnByValue: true, expression });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.text ?? 'page error');
    return r?.result?.value;
  }

  async json(expression) {
    return JSON.parse((await this.eval(expression)) ?? '{}');
  }
}

const sha256 = (t) => createHash('sha256').update(t).digest('hex');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const stamp = Date.now().toString().slice(-6);
const SEEDS = [
  { memberId: `BROWSER-A-${stamp}`, fullName: 'ब्राउज़र सदस्य एक', designation: 'अध्यक्ष', state: 'उत्तर प्रदेश', district: 'बागपत', validUntil: '2027-06-30', status: 'active' },
  { memberId: `BROWSER-B-${stamp}`, fullName: 'ब्राउज़र सदस्य दो', designation: 'सचिव', state: 'उत्तर प्रदेश', district: 'मेरठ', validUntil: '2027-01-15', status: 'active' },
  { memberId: `BROWSER-C-${stamp}`, fullName: 'ब्राउज़र सदस्य तीन', designation: 'कोषाध्यक्ष', state: 'दिल्ली', district: 'नई दिल्ली', validUntil: '2026-12-31', status: 'active' },
];

const token = randomBytes(32).toString('hex');
const seededIds = [];

async function seed() {
  const admin = await pool.query('select id from admin_users limit 1');
  await pool.query(
    "insert into sessions (token_hash, admin_id, expires_at) values ($1, $2, now() + interval '1 hour')",
    [sha256(token), admin.rows[0].id],
  );
  const cookie = `idcms_session=${token}`;
  for (const s of SEEDS) {
    const res = await fetch(`${baseUrl}/api/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ ...s, validFrom: '2026-01-01' }),
    });
    const body = await res.json();
    if (res.status !== 201) throw new Error(`seed failed: ${JSON.stringify(body)}`);
    seededIds.push(body.member.id);
  }
}

async function cleanup() {
  for (const id of seededIds) await pool.query('delete from members where id = $1', [id]);
  await pool.query('delete from sessions where token_hash = $1', [sha256(token)]);
  await pool.end();
}

let failures = 0;
const fail = (m) => { failures += 1; console.log(`  FAIL  ${m}`); };
const pass = (m) => console.log(`  ok    ${m}`);

const main = async () => {
  await seed();
  console.log(`\nSeeded ${SEEDS.length} members for the browser to find.`);

  const target = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  /*
   * Start from a genuinely signed-out browser. The profile on disk survives
   * between runs, so without this the second run would carry the first run's
   * session cookie - and the anonymous-gate assertion would either pass for the
   * wrong reason or fail outright on an expired one.
   */
  await cdp.send('Network.enable');
  await cdp.send('Network.clearBrowserCookies');

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  /**
   * Poll the page until `expression` evaluates truthy.
   *
   * A fixed sleep is only correct on a machine whose speed you already know.
   * The deployed site settles in well under three seconds, so a fixed wait
   * looked fine there - but a local dev server has to transform the entire
   * module graph on first load, and the same wait then sampled pages that were
   * still loading. It reported a blank dashboard, an empty table and a member
   * that "did not exist" against a perfectly healthy API. Waiting for the state
   * itself is faster when things are quick and still honest when they are slow.
   */
  async function waitFor(expression, timeout = 20000) {
    const deadline = Date.now() + timeout;
    for (;;) {
      let ready = false;
      try { ready = await cdp.eval(expression); } catch { ready = false; }
      if (ready) return true;
      if (Date.now() > deadline) return false;
      await sleep(250);
    }
  }

  // ---- 1. an anonymous visitor is stopped at the gate ----------------------
  console.log('\n--- gate ---');
  await cdp.send('Page.navigate', { url: `${baseUrl}/` });
  await waitFor("location.pathname === '/login' && !!document.querySelector('#email')");
  const gate = await cdp.json(`JSON.stringify({
    path: location.pathname,
    hasLoginForm: !!document.querySelector('#email') && !!document.querySelector('#password'),
    hasAdminShell: !!document.querySelector('.kpi-grid'),
  })`);
  console.log(`  landed on ${gate.path}`);
  if (gate.path !== '/login') fail(`anonymous / should land on /login, got ${gate.path}`);
  else pass('anonymous visitor is redirected to /login');
  if (!gate.hasLoginForm) fail('the login form is not rendered');
  else pass('login form is rendered');
  if (gate.hasAdminShell) fail('the admin shell rendered for an anonymous visitor');
  else pass('no admin shell leaks to an anonymous visitor');

  // ---- 2. a wrong password is refused --------------------------------------
  console.log('\n--- sign in ---');
  await cdp.eval(`(() => {
    const set = (sel, value) => {
      const el = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('#email', ${JSON.stringify(EMAIL)});
    set('#password', 'definitely-not-the-password');
    document.querySelector('form').requestSubmit();
  })()`);
  await waitFor("!!document.querySelector('.banner-error')");
  const rejected = await cdp.json(`JSON.stringify({
    path: location.pathname,
    banner: document.querySelector('.banner-error')?.textContent.trim() ?? '',
  })`);
  if (rejected.path === '/login' && rejected.banner) pass(`wrong password refused: "${rejected.banner}"`);
  else fail(`wrong password was not refused (path=${rejected.path}, banner="${rejected.banner}")`);

  // ---- 3. the real credential signs in -------------------------------------
  await cdp.eval(`(() => {
    const set = (sel, value) => {
      const el = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('#email', ${JSON.stringify(EMAIL)});
    set('#password', ${JSON.stringify(PASSWORD)});
    document.querySelector('form').requestSubmit();
  })()`);
  // Wait for the dashboard to reflect the seeded rows, not just to appear: the
  // hero total counts up from zero, so sampling as soon as the element exists
  // can read a perfectly correct "0".
  await waitFor(`Number(document.querySelector('.dash-hero__value')?.textContent.trim()) >= ${SEEDS.length}`);
  const afterLogin = await cdp.json(`JSON.stringify({
    path: location.pathname,
    hero: document.querySelector('.dash-hero__value')?.textContent.trim() ?? '',
    kpis: [...document.querySelectorAll('.kpi')].map((k) => ({
      label: k.querySelector('.kpi__label')?.textContent.trim(),
      value: k.querySelector('.kpi__value')?.textContent.trim(),
    })),
    stats: document.querySelectorAll('.dash-stat').length,
    donut: !!document.querySelector('.donut'),
    trend: !!document.querySelector('.trend, .trendbars'),
  })`);
  if (afterLogin.path !== '/admin') fail(`expected to land on /admin, got ${afterLogin.path}`);
  else pass('signed in and landed on /admin');
  console.log(`  hero total = ${afterLogin.hero}`);
  console.log(`  kpis = ${JSON.stringify(afterLogin.kpis)}`);
  if (Number(afterLogin.hero) >= SEEDS.length) pass(`dashboard shows ${afterLogin.hero} members (seeded ${SEEDS.length})`);
  else fail(`dashboard shows ${afterLogin.hero}, expected at least ${SEEDS.length} - the UI is not seeing the API data`);
  if (afterLogin.kpis.length === 5) pass('five KPI cards rendered');
  else fail(`expected 5 KPI cards, got ${afterLogin.kpis.length}`);
  if (afterLogin.stats >= 3) pass(`${afterLogin.stats} hero quick-stats rendered`);
  else fail(`expected hero quick-stats, got ${afterLogin.stats}`);
  if (afterLogin.donut) pass('status donut rendered');
  else fail('status donut missing');

  // ---- 4. the members table lists the seeded rows ---------------------------
  console.log('\n--- members table ---');
  await cdp.send('Page.navigate', { url: `${baseUrl}/admin/members` });
  await waitFor(`document.querySelectorAll('.table tbody tr').length >= ${SEEDS.length}`);
  const table = await cdp.json(`JSON.stringify({
    path: location.pathname,
    rows: [...document.querySelectorAll('.table tbody tr')].length,
    ids: [...document.querySelectorAll('.table tbody tr')].map((tr) => tr.textContent.trim()).slice(0, 5),
    search: !!document.querySelector('input[type=search], .toolbar input, #member-search'),
    exportBtn: [...document.querySelectorAll('button')].some((b) => /CSV|Export/i.test(b.textContent)),
    pagination: !!document.querySelector('.pagination, .pager'),
  })`);
  console.log(`  rows = ${table.rows}`);
  if (table.rows >= SEEDS.length) pass(`table lists ${table.rows} rows`);
  else fail(`table lists ${table.rows} rows, expected at least ${SEEDS.length}`);
  const missing = SEEDS.filter((s) => !table.ids.join(' ').includes(s.memberId));
  if (missing.length === 0) pass('every seeded member appears in the table');
  else fail(`members missing from the table: ${missing.map((m) => m.memberId).join(', ')}`);
  if (table.exportBtn) pass('CSV export control present');
  else fail('CSV export control missing');

  // ---- 5. the QR verification page is public -------------------------------
  console.log('\n--- public QR verification ---');
  await cdp.send('Page.navigate', { url: `${baseUrl}/verify/${SEEDS[0].memberId}` });
  // Wait for a verdict either way. A real "not found" should report immediately
  // rather than after the whole timeout, and a success should not have to race
  // the page either.
  await waitFor(`document.body.innerText.includes(${JSON.stringify(SEEDS[0].fullName)}) || /NOT FOUND/i.test(document.body.innerText)`);
  const verify = await cdp.json(`JSON.stringify({
    path: location.pathname,
    body: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 220),
    hasName: document.body.innerText.includes(${JSON.stringify(SEEDS[0].fullName)}),
    hasDistrict: document.body.innerText.includes('बागपत'),
  })`);
  if (verify.hasName) pass('the scanned card resolves to the right member, with no sign-in');
  else fail(`verification did not show ${SEEDS[0].fullName}: ${verify.body}`);
  if (verify.hasDistrict) pass('district shown on the verification page');
  else fail('district missing from the verification page');

  // ---- 6. the settings page, including the password card --------------------
  console.log('\n--- settings ---');
  await cdp.send('Page.navigate', { url: `${baseUrl}/admin/settings` });
  await waitFor("!!document.querySelector('#pw-current')");
  const settings = await cdp.json(`JSON.stringify({
    path: location.pathname,
    current: !!document.querySelector('#pw-current'),
    next: !!document.querySelector('#pw-new'),
    confirm: !!document.querySelector('#pw-confirm'),
    saveOrg: [...document.querySelectorAll('button')].some((b) => /Save/i.test(b.textContent)),
  })`);
  if (settings.current && settings.next && settings.confirm) pass('the change-password card renders with all three fields');
  else fail(`change-password fields missing: ${JSON.stringify(settings)}`);
  if (settings.saveOrg) pass('the organisation settings form renders alongside it');
  else fail('the organisation settings form is missing');

  // ---- 7. the admin shell renders on a phone width --------------------------
  console.log('\n--- responsive ---');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp.send('Page.navigate', { url: `${baseUrl}/admin` });
  await waitFor("!!document.querySelector('.kpi-grid')");
  const mobile = await cdp.json(`JSON.stringify({
    vw: document.documentElement.clientWidth,
    sw: document.documentElement.scrollWidth,
    path: location.pathname,
  })`);
  if (mobile.path === '/admin' && mobile.sw - mobile.vw <= 1) pass(`390px: no horizontal overflow (${mobile.sw} = ${mobile.vw})`);
  else fail(`390px overflow or redirected: sw=${mobile.sw} vw=${mobile.vw} path=${mobile.path}`);

  /*
   * Sign out through the page before finishing. The session this run created is
   * an httpOnly cookie that page script cannot read, so asking the API to end it
   * is the only way to leave the database exactly as it was found - otherwise
   * every run would strand a live session in the sessions table.
   */
  await cdp.eval(
    "fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })"
    + ".then((r) => r.status).catch(() => 'err')",
  );

  console.log(`\nRESULT: ${failures === 0 ? 'PASS' : `FAIL - ${failures} problem(s)`}\n`);
  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${target.id}`);
};

main()
  .catch((e) => { console.error('FAILED:', e.message); failures += 1; })
  .finally(async () => {
    await cleanup().catch(() => {});
    process.exit(failures === 0 ? 0 : 1);
  });
