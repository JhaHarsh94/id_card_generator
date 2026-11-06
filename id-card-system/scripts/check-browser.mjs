/** Local browser regression checks. Requires isolated headless Chrome on port 9222. */
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  throw new Error('Run this test against a local development server with an isolated browser profile.');
}
const output = resolve('.artifacts');
await mkdir(output, { recursive: true });
const downloads = resolve(output, 'downloads', String(Date.now()));
await mkdir(downloads, { recursive: true });
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const page = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' }).then((r) => r.json());
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((done, reject) => {
  ws.addEventListener('open', done, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let serial = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.done(message.result);
  } else if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  }
});
function send(method, params = {}) {
  return new Promise((done, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 45000);
    pending.set(id, { done, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Condition not met: ${expression}`);
}
async function navigate(path) {
  await send('Page.navigate', { url: `${base}${path}` });
  await waitFor('document.readyState === "complete" && !!document.querySelector("#root > *")');
}
async function screenshot(filename, cardOnly = false) {
  const clip = cardOnly ? await evaluate(`document.querySelector('.idcard').getBoundingClientRect().toJSON()`) : null;
  const shot = await send('Page.captureScreenshot', {
    format: 'png', ...(clip ? { clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 } } : {}),
  });
  await writeFile(resolve(output, filename), Buffer.from(shot.data, 'base64'));
}
async function setInput(selector, value) {
  await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}
async function waitForDownload(extension, prefix = 'PKSDST0001') {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const files = (await readdir(downloads)).filter((name) => name.startsWith(prefix) && name.endsWith(extension));
    if (files.length) return readFile(resolve(downloads, files[0]));
    await pause(100);
  }
  throw new Error(`Download missing: ${extension}`);
}
const report = [];
function pass(label) { report.push(label); console.log(`PASS ${label}`); }

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/dev/card');
  await waitFor('!!document.querySelector(".idcard") && document.fonts.status === "loaded"');
  await waitFor('!!document.querySelector(".idcard__photo img")?.naturalWidth');
  assert.equal(await evaluate('document.querySelector(".idcard").offsetWidth'), 1000);
  assert.equal(await evaluate('document.querySelector(".idcard").offsetHeight'), 600);
  assert.equal(await evaluate('document.querySelector(".idcard__qr") === null'), true);
  assert.equal(await evaluate('document.querySelector(".idcard__trust-name").textContent'), 'पूनम कबीरा सर्व धर्म सहायता ट्रस्ट');
  await screenshot('reference-card.png', true);
  await screenshot('desktop-preview.png');
  pass('Hindi reference card, correct aspect ratio and no QR by default');

  await evaluate('document.querySelector(".card-preview__actions button").click()');
  const png = await waitForDownload('.png');
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 2500);
  assert.equal(png.readUInt32BE(20), 1500);
  await writeFile(resolve(output, 'exported-card.png'), png);
  await waitFor('!document.querySelector(".card-preview__actions button").disabled');
  pass('Real PNG download: 2500 × 1500, self-hosted Hindi fonts');

  await evaluate('document.querySelectorAll(".card-preview__actions button")[1].click()');
  const pdf = await waitForDownload('.pdf');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const mediaBox = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  assert.ok(mediaBox, 'PDF page has a MediaBox');
  assert.ok(Math.abs(Number(mediaBox[1]) / Number(mediaBox[2]) - 5 / 3) < 0.001);
  await waitFor('!document.querySelector(".card-preview__actions button").disabled');
  pass('Real PDF download preserves the card aspect ratio');

  await evaluate(`(async () => {
    const {downloadCardsCombinedPdf} = await import('/src/utils/cardExport.js');
    const card = document.querySelector('.idcard');
    await downloadCardsCombinedPdf(Array(10).fill(card), [], {idStart: 1});
  })()`);
  const combined = await waitForDownload('.pdf', '1_10-cards_');
  assert.equal((combined.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length, 2);
  pass('Ten-card combined PDF produces two pages without extra blank pages');

  const printHtml = await evaluate(`(async () => {
    const original = window.open;
    let html = '';
    window.open = () => ({ closed: false, close() {}, document: { open() { html = ''; }, write(value) { html += value; }, close() {} } });
    try {
      const { printCard } = await import('/src/utils/cardExport.js');
      await printCard(document.querySelector('.idcard'), { name: '<test>' });
      return html;
    } finally { window.open = original; }
  })()`);
  assert.ok(printHtml.includes('size: A4 landscape'));
  assert.ok(printHtml.includes('width: 85.6mm'));
  assert.ok(printHtml.includes('&lt;test&gt;'));
  await writeFile(resolve(output, 'print-preview.html'), printHtml);
  pass('Print uses A4 landscape, undistorted card size and escaped text');

  await setInput('.card-preview__controls input', 'श्रीमती सुनीता देवी शर्मा सदस्य कल्याण समिति');
  await pause(200);
  assert.equal(await evaluate(`(() => { const el = document.querySelector('.idcard__name'); return el.scrollWidth <= el.clientWidth + 1; })()`), true);
  await setInput('.card-preview__controls input', 'सदस्य का नाम');
  pass('Long Hindi member names fit without overlapping the photo');

  await send('DOM.enable');
  const root = await send('DOM.getDocument');
  const input = await send('DOM.querySelector', { nodeId: root.root.nodeId, selector: '.card-preview input[type=file]' });
  await send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [resolve('src/assets/org/logo.png')] });
  await waitFor('!!document.querySelector(".idcard__photo img")?.naturalWidth');
  pass('Uploaded image appears in the portrait slot');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(250);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  const ratio = await evaluate(`(() => { const r = document.querySelector('.idcard').getBoundingClientRect(); return r.width / r.height; })()`);
  assert.ok(Math.abs(ratio - 5 / 3) < 0.001);
  await screenshot('mobile-preview.png');
  pass('390px mobile preview preserves layout with no horizontal overflow');

  await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/login');
  await waitFor('!!document.querySelector("form button[type=submit]")');
  assert.equal(await evaluate('document.body.textContent.includes("Local development mode")'), true);
  await evaluate('document.querySelector("form button[type=submit]").click()');
  await waitFor('location.pathname === "/admin"');
  await navigate('/generate');
  await waitFor('!!document.querySelector("#s-fullName")');
  await setInput('#s-fullName', 'स्थानीय परीक्षण सदस्य');
  await setInput('#s-designation', 'सदस्य');
  await setInput('#s-state', 'उत्तर प्रदेश');
  await setInput('#s-district', 'मेरठ');
  await waitFor('document.querySelector(".idcard__name").textContent.includes("स्थानीय परीक्षण")');
  pass('Local sign-in and real generator update the shared card template');

  await navigate('/admin/settings');
  await waitFor('!!document.querySelector("#s-name")');
  await setInput('#s-name', 'परीक्षण ट्रस्ट');
  await evaluate('document.querySelector("form button[type=submit]").click()');
  await waitFor('document.body.textContent.includes("Settings saved.")');
  await navigate('/generate');
  await waitFor('document.querySelector(".idcard__trust-name")?.textContent === "परीक्षण ट्रस्ट"');
  await navigate('/admin/settings');
  await setInput('#s-name', 'पूनम कबीरा सर्व धर्म सहायता ट्रस्ट');
  await evaluate('document.querySelector("form button[type=submit]").click()');
  await waitFor('document.body.textContent.includes("Settings saved.")');
  pass('Settings save survives route changes and reloads');

  assert.deepEqual(errors, [], 'No uncaught browser exceptions');
  await writeFile(resolve(output, 'browser-checks.json'), JSON.stringify({ passed: report, errors }, null, 2));
  console.log(`\n${report.length} browser checks passed. Artifacts: ${output}`);
} finally {
  ws.close();
  await fetch(`http://127.0.0.1:9222/json/close/${page.id}`);
}
