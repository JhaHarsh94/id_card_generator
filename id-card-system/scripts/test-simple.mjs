/**
 * End-to-end test of the simple client flow on "/":
 *   fill the form -> create the card -> download the PNG
 *
 * React-controlled inputs must be set through the native value setter and then
 * dispatched an 'input' event, otherwise React never sees the change.
 *
 * Usage: node scripts/test-simple.mjs <baseUrl> <downloadDir>
 */

import { mkdir, readdir, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';

const [, , baseUrl, downloadDir] = process.argv;
const DEBUG_PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) { reject(new Error(JSON.stringify(m.error))); } else { resolve(m.result); }
      } else if (m.method) {
        (this.listeners.get(m.method) ?? []).forEach((f) => f(m.params));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }
  on(m, f) { if (!this.listeners.has(m)) this.listeners.set(m, []); this.listeners.get(m).push(f); }
}

function pngSize(b) {
  if (b.length < 24 || b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

async function main() {
  await rm(downloadDir, { recursive: true, force: true });
  await mkdir(downloadDir, { recursive: true });

  const created = await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent('about:blank')}`,
    { method: 'PUT' },
  ).then((r) => r.json());

  const ws = new WebSocket(created.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Browser.setDownloadBehavior', {
    behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true,
  });

  await cdp.send('Page.navigate', { url: `${baseUrl}/` });
  await sleep(2500);

  // --- fill the form ---
  const fill = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const set = (sel, val) => {
        const el = document.querySelector(sel);
        if (!el) return 'missing ' + sel;
        const setter = Object.getOwnPropertyDescriptor(
          el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return 'ok';
      };
      const r1 = set('#s-fullName', 'सुनीता देवी');
      const r2 = set('#s-designation', 'प्रधान जिला अध्यक्ष');
      const r3 = set('#s-state', 'उत्तर प्रदेश');
      const r4 = set('#s-district', 'बागपत');
      await new Promise(res => setTimeout(res, 400));
      const card = document.querySelector('.idcard');
      return JSON.stringify({
        fields: [r1, r2, r3, r4],
        cardName: card?.querySelector('.idcard__name')?.textContent?.trim(),
        cardDesignation: card?.querySelector('.idcard__designation')?.textContent?.trim(),
      });
    })()`,
  });
  console.log('fill:', fill.result?.value);

  await sleep(600);

  // --- create the card ---
  const created2 = await cdp.send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.textContent.includes('ID कार्ड बनाएं'));
      if (!btn) return 'missing-button';
      btn.click();
      await new Promise(r => setTimeout(r, 1500));
      return document.body.textContent.includes('QR scan') ? 'created' : 'no-verify-block';
    })()`,
  });
  console.log('create:', created2.result?.value);

  // --- download the PNG ---
  await cdp.send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      const btn = [...document.querySelectorAll('button')]
        .find(b => b.textContent.includes('Download PNG'));
      if (!btn) return 'missing-button';
      btn.click();
      await new Promise(r => setTimeout(r, 6000));
      return 'clicked';
    })()`,
  });
  await sleep(1500);

  const files = (await readdir(downloadDir)).filter((f) => !f.endsWith('.crdownload'));
  console.log('\nfiles:');
  for (const f of files) {
    const p = join(downloadDir, f);
    const buf = await readFile(p);
    const info = await stat(p);
    const size = pngSize(buf);
    console.log(`  ${f}  ${(info.size / 1024).toFixed(0)} KB  `
      + `png ${size ? `${size.width}x${size.height}` : 'INVALID'}  `
      + `${size && size.width >= 2000 ? 'OK' : 'WRONG SIZE'}`);
  }

  await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    .then((s) => writeFile(join(downloadDir, '..', 'simple-flow.png'), Buffer.from(s.data, 'base64')));

  console.log(`\nRESULT: ${files.some((f) => f.endsWith('.png')) ? 'PASS' : 'FAIL'}`);

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${created.id}`);
  process.exit(files.some((f) => f.endsWith('.png')) ? 0 : 1);
}

const { writeFile } = await import('node:fs/promises');
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });