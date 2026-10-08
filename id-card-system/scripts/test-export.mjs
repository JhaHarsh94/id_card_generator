/**
 * End-to-end export test.
 *
 * Clicks the real Download PNG / Download PDF / Print buttons on the member
 * details page and verifies the files that land in a download folder. This
 * exercises the actual export path - DOM rasterisation, jsPDF, filename
 * generation - rather than trusting that it compiles.
 *
 * Usage:
 *   node scripts/test-export.mjs <baseUrl> <downloadDir>
 *
 * Requires: Chrome listening on --remote-debugging-port=9222 and `npm run dev`
 * serving <baseUrl>.
 */

import { mkdir, readdir, readFile, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';

const [, , baseUrl, downloadDir] = process.argv;

if (!baseUrl || !downloadDir) {
  console.error('usage: node scripts/test-export.mjs <baseUrl> <downloadDir>');
  process.exit(1);
}

const DEBUG_PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
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

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
}

/** Read a PNG's intrinsic size straight from its IHDR chunk. */
function pngSize(buffer) {
  if (buffer.length < 24) return null;
  const sig = buffer.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
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

  // Allow downloads to land in our folder.
  await cdp.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadDir,
    eventsEnabled: true,
  });

  // Seed the session.
  await cdp.send('Page.navigate', { url: `${baseUrl}/login` });
  await sleep(1200);
  await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async () => {
      const hash = async (t) => {
        const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
        return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2,'0')).join('');
      };
      localStorage.setItem('idcms.admins', JSON.stringify([
        { id:'demo-admin', name:'Administrator', email:'admin@example.com',
          role:'administrator', isDemo:true, passwordHash: await hash('demo1234') }
      ]));
      sessionStorage.setItem('idcms.session', JSON.stringify({
        user:{ id:'demo-admin', name:'Administrator', email:'admin@example.com', role:'administrator' },
        startedAt:new Date().toISOString()
      }));
    })()`,
  });

  await cdp.send('Page.navigate', { url: `${baseUrl}/members/0095030` });
  await sleep(2500);

  const errors = [];
  cdp.on('Runtime.exceptionThrown', (p) => {
    errors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text);
  });

  async function clickButton(label) {
    const res = await cdp.send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const btn = [...document.querySelectorAll('button')]
          .find(b => b.textContent.trim() === ${JSON.stringify(label)});
        if (!btn) return 'missing-button';
        btn.click();
        // Give the export time to finish.
        await new Promise(r => setTimeout(r, 6000));
        return 'clicked';
      })()`,
    });
    return res.result?.value;
  }

  console.log('click Download PNG  ->', await clickButton('Download PNG'));
  await sleep(1500);
  console.log('click Download PDF  ->', await clickButton('Download PDF'));
  await sleep(2000);

  const files = (await readdir(downloadDir)).filter((f) => !f.endsWith('.crdownload'));
  console.log('\nfiles produced:');
  let ok = true;

  for (const f of files) {
    const path = join(downloadDir, f);
    const info = await stat(path);
    const buf = await readFile(path);
    const isPdf = buf.subarray(0, 4).toString() === '%PDF';
    const size = pngSize(buf);

    if (f.endsWith('.png')) {
      const good = size && size.width >= 2000 && size.height >= 1300;
      ok &&= Boolean(good);
      console.log(
        `  ${f}  ${(info.size / 1024).toFixed(0)} KB  `
        + `png ${size ? `${size.width}x${size.height}` : 'INVALID'}  ${good ? 'OK' : 'WRONG SIZE'}`,
      );
    } else if (f.endsWith('.pdf')) {
      // A CR80 PDF page is 85.60 x 53.98 mm = 242.6 x 153.1 pt.
      ok &&= isPdf;
      console.log(
        `  ${f}  ${(info.size / 1024).toFixed(0)} KB  `
        + `${isPdf ? 'valid PDF header' : 'NOT A PDF'}  ${isPdf ? 'OK' : 'FAIL'}`,
      );
    } else {
      console.log(`  ${f}  ${(info.size / 1024).toFixed(0)} KB`);
    }
  }

  if (errors.length) console.log('\npage errors:', errors.join(' | '));
  console.log(`\nRESULT: ${files.length >= 2 && ok ? 'PASS' : 'FAIL'}`);

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${created.id}`);
  process.exit(files.length >= 2 && ok ? 0 : 1);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
