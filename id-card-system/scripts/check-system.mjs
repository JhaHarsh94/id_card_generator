/** End-to-end test of the real API-backed application against serve-test-api.mjs. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { connectBrowser } from './lib/browser.mjs';

const base = 'http://127.0.0.1:5174';
const browser = await connectBrowser();
const { evaluate, waitFor, navigate, input, click, viewport, send, pause } = browser;
await mkdir('.artifacts/system', { recursive: true });
const passed = [];
const pass = (label) => { passed.push(label); console.log(`PASS ${label}`); };
const route = (path) => navigate(base + path);
const api = (path, method = 'GET', body) => evaluate(`fetch('/api${path}', {
  method: ${JSON.stringify(method)}, headers: { 'Content-Type': 'application/json' },
  ${body ? `body: ${JSON.stringify(JSON.stringify(body))},` : ''}
}).then(async res => ({status:res.status, ...(await res.json())}))`);
let id;
let generatorId;
try {
  await send('Network.deleteCookies', { name: 'idcms_session', url: base });
  await viewport(390);
  await route('/login');
  await waitFor('!!document.querySelector("#email")');
  await input('#email', 'browser-test@example.org');
  await input('#password', 'Browser-Test-Password-1234');
  await click('form button[type=submit]');
  await waitFor('location.pathname === "/admin"');
  pass('Real cookie login works at a phone viewport');

  await click('[aria-label="Open navigation"]');
  await waitFor('document.querySelector(".sidebar").classList.contains("open")');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await waitFor('!document.querySelector(".sidebar").classList.contains("open")');
  pass('Mobile drawer opens and dismisses with Escape');

  await route('/admin/settings');
  await waitFor('!!document.querySelector("#s-name")');
  await input('#s-name', 'परीक्षण सहायता ट्रस्ट');
  await input('#s-prefix', 'QA');
  await input('#s-start', '120');
  await input('#s-pad', '4');
  await click('.settings-grid form button[type=submit]');
  await waitFor('document.body.textContent.includes("Settings saved.")');
  await waitFor('document.querySelector(".sidebar__brand").textContent.includes("परीक्षण सहायता ट्रस्ट")');
  pass('Organisation settings persist and refresh the navigation brand');

  await route('/admin/members/new');
  await waitFor('!!document.querySelector("#memberId")?.value');
  id = await evaluate('document.querySelector("#memberId").value');
  assert.ok(id.startsWith('QA'));
  assert.equal(await evaluate('document.querySelector("#memberId").disabled'), false);
  assert.equal(await evaluate('document.querySelector(".idcard__trust-name").textContent'), 'परीक्षण सहायता ट्रस्ट');
  await click('form button[type=submit]');
  await waitFor('!!document.querySelector("[aria-invalid=true]")');
  assert.equal(await evaluate('document.activeElement.id'), 'fullName');
  pass('New-member form uses saved settings and focuses validation errors');

  await input('#fullName', 'परीक्षण सदस्य');
  await input('#designation', 'सदस्य');
  await input('#state', 'उत्तर प्रदेश');
  await input('#district', 'मेरठ');
  await send('DOM.enable');
  const tree = await send('DOM.getDocument');
  const fileInput = await send('DOM.querySelector', { nodeId: tree.root.nodeId, selector: '.memberform input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [resolve('src/assets/samples/member-portrait-ai.png')] });
  await input('#fullName', 'फोटो के साथ नया नाम');
  await waitFor('!!document.querySelector(".photo-preview img")?.naturalWidth && !document.querySelector(".photo-preview-busy")');
  assert.equal(await evaluate('document.querySelector("#fullName").value'), 'फोटो के साथ नया नाम');
  await click('form button[type=submit]');
  await waitFor(`location.pathname === '/admin/members/${id}'`);
  await waitFor('!!document.querySelector(".idcard__photo img")?.naturalWidth');
  assert.equal((await api(`/member?memberId=${id}`)).member.fullName, 'फोटो के साथ नया नाम');
  pass('Photo processing preserves concurrent text edits and creation persists to PostgreSQL');

  await route(`/admin/members/${id}/edit`);
  await waitFor('!!document.querySelector("#fullName")');
  await input('#fullName', 'सहेजा हुआ नया नाम');
  await input('#validUntil', '2000-01-01');
  await click('form button[type=submit]');
  await waitFor('document.querySelector("#validUntil").getAttribute("aria-invalid") === "true"');
  await input('#validUntil', '2030-10-18');
  await click('form button[type=submit]');
  await waitFor(`location.pathname === '/admin/members/${id}'`);
  await waitFor('document.querySelector(".idcard__name")?.textContent === "सहेजा हुआ नया नाम"');
  pass('Editing rejects invalid date windows and saves valid changes');

  await evaluate('window.confirm = () => true');
  await evaluate('[...document.querySelectorAll("button")].find(el => el.textContent.trim() === "Renew").click()');
  await waitFor('document.body.textContent.includes("18/10/2031")');
  await evaluate('window.prompt = () => "Automated revocation test"');
  await evaluate('[...document.querySelectorAll("button")].find(el => el.textContent.trim() === "Revoke").click()');
  await waitFor('!!document.querySelector(".badge-revoked")');
  await route(`/verify/${id}`);
  await waitFor('document.querySelector(".verify__headline")?.textContent === "REVOKED"');
  assert.equal(await evaluate('document.querySelector(".verify__main").querySelector("img") === null'), true);
  pass('Renewal and revocation update public verification without exposing the portrait');

  await evaluate('fetch("/__test/outage?enabled=true")');
  await route(`/verify/${id}`);
  await waitFor('document.querySelector(".verify__headline")?.textContent === "VERIFICATION UNAVAILABLE"');
  await evaluate('fetch("/__test/outage?enabled=false")');
  await evaluate('[...document.querySelectorAll("button")].find(el => el.textContent === "Try again").click()');
  await waitFor('document.querySelector(".verify__headline")?.textContent === "REVOKED"');
  pass('A database outage shows unavailable status and retry recovers');

  await route('/verify/%25');
  await waitFor('document.querySelector(".verify__headline")?.textContent === "NOT FOUND"');
  pass('Malformed verification identifiers do not crash the application');

  await route('/generate');
  await waitFor('!!document.querySelector("#s-memberId")?.value');
  generatorId = await evaluate('document.querySelector("#s-memberId").value');
  assert.notEqual(generatorId, id);
  for (const [selector, value] of [['#s-fullName', 'जनरेटर सदस्य'], ['#s-designation', 'सदस्य'], ['#s-state', 'उत्तर प्रदेश']]) await input(selector, value);
  assert.equal(await evaluate('document.querySelector(".simple__buttons button").disabled'), true);
  await click('.simple__actions button[type=submit]');
  await waitFor('!document.querySelector(".simple__buttons button").disabled');
  const countBefore = (await api('/members')).members.length;
  await input('#s-fullName', 'जनरेटर में बदलाव');
  assert.equal(await evaluate('document.querySelector(".simple__buttons button").disabled'), true);
  await click('.simple__actions button[type=submit]');
  await waitFor('!document.querySelector(".simple__buttons button").disabled');
  assert.equal((await api('/members')).members.length, countBefore);
  assert.equal((await api(`/member?memberId=${generatorId}`)).member.fullName, 'जनरेटर में बदलाव');
  await click('.simple__actions button[type=button]');
  assert.notEqual(await evaluate('document.querySelector("#s-memberId").value'), generatorId);
  pass('Generator saves before export, updates without duplication and allocates the next free ID');

  const paths = ['/admin', '/admin/members', '/admin/members/new', `/admin/members/${id}`, `/admin/members/${id}/edit`, '/admin/settings', '/admin/reports', '/admin/verification', '/generate', `/verify/${id}`];
  const layouts = [];
  for (const width of [320, 390, 768, 1440]) {
    await viewport(width);
    for (const path of paths) {
      await route(path);
      await pause(150);
      const result = await evaluate(`({scroll:document.documentElement.scrollWidth,width:innerWidth,clipped:[...document.querySelectorAll('.pagehead,.pagehead__actions,.card,.member-page,.settings-grid,.simple__card,.verify__top,.admin__header-tools')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).map(el=>el.className)})`);
      assert.ok(result.scroll <= width, `${path} scrolls horizontally at ${width}px`);
      assert.deepEqual(result.clipped, [], `${path} clips content at ${width}px`);
      layouts.push({ width, path });
    }
    await route('/admin');
    await pause(200);
    await browser.screenshot(`.artifacts/system/dashboard-${width}.png`);
  }
  pass('40 page/viewport combinations fit without horizontal scrolling or clipped panels');

  await route('/admin/verification');
  await waitFor('!!document.querySelector("#lookup")');
  await input('#lookup', id);
  await evaluate('fetch("/__test/outage?enabled=true")');
  await click('form button[type=submit]');
  await waitFor('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('location.pathname'), '/admin/verification');
  await evaluate('fetch("/__test/outage?enabled=false")');
  pass('An authenticated API outage shows a retry message without falsely expiring the session');

  await route('/admin');
  await waitFor(`!!document.querySelector('[aria-label="Log out"]')`);
  await evaluate(`window.__originalFetch = window.fetch; window.fetch = (url, options) => String(url).includes('/api/auth/logout') ? Promise.reject(new Error('offline')) : window.__originalFetch(url, options)`);
  await click('[aria-label="Log out"]');
  await waitFor('!!document.querySelector("[role=alert]")');
  assert.equal(await evaluate('location.pathname'), '/admin');
  await evaluate('window.fetch = window.__originalFetch');
  pass('Failed network sign-out keeps the session visible and shows an error');

  await send('Network.setCookie', { name: 'idcms_session', value: 'expired-test-token', url: base });
  await evaluate(`(async () => { const {listMembers}=await import('/src/services/members.js'); try { await listMembers(); } catch {} })()`);
  await waitFor('location.pathname === "/login"');
  pass('An expired server session redirects protected pages to sign-in');
  assert.deepEqual(browser.errors, []);
  await writeFile('.artifacts/system/results.json', JSON.stringify({ passed, layouts, errors: browser.errors }, null, 2));
  console.log(`\n${passed.length} system checks passed.`);
} finally {
  await fetch(`${base}/__test/outage?enabled=false`).catch(() => {});
  await browser.close();
}
