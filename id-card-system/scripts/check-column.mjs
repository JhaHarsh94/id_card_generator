/**
 * Verify the right-hand column is centred.
 *
 * Photo, signatory and QR are meant to share one vertical axis. Eyeballing a
 * 2140px export is not reliable enough for that - a few card-px of drift is
 * invisible in a screenshot and obvious on a printed card. This reports each
 * block's horizontal centre relative to the photo's, and flags any that differ
 * by more than a pixel.
 *
 * Run: node scripts/check-column.mjs <baseUrl>
 */

const [, , baseUrl = 'http://localhost:5234'] = process.argv;
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
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        if (m.error) reject(new Error(JSON.stringify(m.error)));
        else resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res, rej) => this.pending.set(id, { resolve: res, reject: rej }));
  }
}

const main = async () => {
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
  await sleep(3000);

  const res = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height };
      };
      const body = box('.idcard__body');
      const out = {
        body,
        photo: box('.idcard__photo'),
        signatory: box('.idcard__signatory'),
        qr: box('.idcard__qr'),
        qrLabel: box('.idcard__qr-label'),
        logo: box('.idcard__logo'),
        seal: box('.idcard__seal'),
      };
      return JSON.stringify(out);
    })()`,
  });

  const d = JSON.parse(res.result?.value ?? '{}');
  const centre = (b) => (b ? b.l + b.w / 2 : NaN);

  // Work in card px regardless of how the page is scaled on screen.
  const photo = d.photo;
  if (!photo || !d.body) {
    console.log('RESULT: FAIL - card did not render');
    ws.close();
    process.exit(1);
  }
  const scale = photo.w / 168; // .idcard__photo is 168 card px wide
  const px = (v) => v / scale;

  const axis = px(centre(photo));
  console.log(`\n  photo axis (card px) ${axis.toFixed(1)}\n`);

  let worst = 0;
  for (const [label, key] of [
    ['signatory', 'signatory'],
    ['qr', 'qr'],
  ]) {
    const b = d[key];
    if (!b) {
      console.log(`  ${label.padEnd(11)} (not found)`);
      continue;
    }
    const off = px(centre(b)) - axis;
    worst = Math.max(worst, Math.abs(off));
    console.log(
      `  ${label.padEnd(11)} centre ${px(centre(b)).toFixed(1)}   `
      + `offset ${off >= 0 ? '+' : ''}${off.toFixed(1)}`,
    );
  }

  // The caption deliberately sits BESIDE the QR rather than under it, so it is
  // reported for information and not held to the shared axis.
  if (d.qrLabel) {
    const off = px(centre(d.qrLabel)) - axis;
    console.log(
      `  qr label    centre ${px(centre(d.qrLabel)).toFixed(1)}   `
      + `offset ${off >= 0 ? '+' : ''}${off.toFixed(1)} (beside the QR, not on axis)`,
    );
  }

  // Overlap check: nothing in the column may pass the body's bottom edge.
  const bodyBottom = px(d.body.b);
  console.log(`\n  body bottom  ${bodyBottom.toFixed(1)}`);
  let overflow = 0;
  for (const key of ['photo', 'signatory', 'qr', 'qrLabel', 'logo', 'seal']) {
    const b = d[key];
    if (!b) continue;
    const over = px(b.b) - bodyBottom;
    if (over > 0.5) {
      overflow = Math.max(overflow, over);
      console.log(`  OVERFLOW  ${key} bottom ${px(b.b).toFixed(1)} (+${over.toFixed(1)})`);
    }
  }
  if (!overflow) console.log('  nothing overflows the body');

  const pass = worst <= 1 && overflow === 0;
  console.log(`\nRESULT: ${pass ? 'PASS - column aligned and inside the body' : 'FAIL'}`);

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${created.id}`);
  process.exit(pass ? 0 : 1);
};

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});