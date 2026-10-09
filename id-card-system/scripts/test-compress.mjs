/**
 * Verify that photo compression actually shrinks a realistic photo.
 *
 * Generates a synthetic but realistic portrait-sized JPEG (noise + gradient,
 * which compresses like a photograph), then runs it through the same
 * compressImage() the app uses and reports the before/after sizes.
 *
 * Run: node scripts/test-compress.mjs
 * Requires the dev server on the port passed as argv[2] (default 5195).
 */

const [, , baseUrl = 'http://localhost:5195'] = process.argv;
const DEBUG_PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) { reject(new Error(JSON.stringify(m.error))); } else { resolve(m.result); }
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }
}

async function main() {
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
  await cdp.send('Page.navigate', { url: `${baseUrl}/` });
  await sleep(2200);

  const res = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      // Build a realistic photo: 2400x3200 gradient + noise, as from a phone camera.
      const W = 2400, H = 3200;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#c8a888'); g.addColorStop(0.5, '#8a6a52'); g.addColorStop(1, '#d8c4b0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const img = ctx.getImageData(0, 0, W, H);
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 46;
        img.data[i] += n; img.data[i+1] += n; img.data[i+2] += n;
      }
      ctx.putImageData(img, 0, 0);
      const original = c.toDataURL('image/jpeg', 0.92);

      // Same algorithm the app uses.
      const { compressImage, dataUrlBytes } = await import('/src/utils/imageProcessing.js');
      const out = await compressImage(original);

      return JSON.stringify({
        originalKB: Math.round(dataUrlBytes(original) / 1024),
        compressedKB: Math.round(dataUrlBytes(out.dataUrl) / 1024),
        outWidth: out.width,
        outHeight: out.height,
        totalBytes: dataUrlBytes(original),
      });
    })()`,
  });

  const out = JSON.parse(res.result?.value ?? '{}');
  if (!out.originalKB) {
    console.error('no result:', res.result?.value);
    process.exit(1);
  }

  const ratio = (out.compressedKB / out.originalKB);
  // localStorage is ~5 MB; a photo must be well under ~300 KB to hold ~15+.
  const headroom = Math.floor(5 * 1024 / Math.max(out.compressedKB, 1));

  console.log(`\n  source photo   2400x3200  ${out.originalKB} KB`);
  console.log(`  after resize   ${out.outWidth}x${out.outHeight}  ${out.compressedKB} KB`);
  console.log(`  reduction      ${Math.round((1 - ratio) * 100)}%  (${ratio.toFixed(3)}x)`);
  console.log(`  ~5MB quota     fits about ${headroom} member photos\n`);

  console.log(headroom >= 10 ? 'RESULT: PASS' : 'RESULT: FAIL - still too large');

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${created.id}`);
  process.exit(headroom >= 10 ? 0 : 1);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });