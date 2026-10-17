/**
 * Capture full-page screenshots at real device widths via CDP.
 *
 * Chrome's `--window-size` flag cannot be trusted below ~500px: the browser
 * clamps the window, lays the page out at the clamped width, and then crops to
 * the requested size, which makes a healthy layout look cut off on the right.
 * Driving Emulation.setDeviceMetricsOverride over the debugging protocol sets
 * the *layout* viewport instead, so a 390px shot is a genuine 390px render.
 *
 * Run: node scripts/shoot.mjs <baseUrl> <path> <outPrefix> [widthsCsv]
 */

import { writeFileSync } from 'node:fs';

const [, , baseUrl = 'http://localhost:5250', pagePath = '/', outPrefix = 'home', widthsArg] =
  process.argv;
const WIDTHS = (widthsArg ?? '390,1280').split(',').map(Number);
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
}

const main = async () => {
  const t = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' })
    .then((r) => r.json());
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  const cdp = new CDP(ws);
  await cdp.send('Page.enable');

  for (const width of WIDTHS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: width < 768,
    });
    await cdp.send('Page.navigate', { url: `${baseUrl}${pagePath}` });
    await sleep(2500);
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    });
    const file = `reference-analysis/${outPrefix}-${width}.png`;
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log(`wrote ${file}`);
  }

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${t.id}`);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
