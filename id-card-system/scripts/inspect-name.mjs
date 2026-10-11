/**
 * Dump the trust name's measured geometry.
 *
 * check-name-fit.mjs reports "does it fit"; this reports WHY, when it does not.
 * It prints every input the auto-fit calculation uses - the host width, the
 * subtracted padding and the element's own frame - so a wrong number can be
 * identified rather than guessed at. Without it, a silent failure inside
 * useFittedFontSize() looks identical to a styling problem.
 *
 * Run: node scripts/inspect-name.mjs <baseUrl> [path]
 */

const [, , baseUrl = 'http://localhost:5244', pagePath = '/dev/card'] = process.argv;
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
  await cdp.send('Runtime.enable');
  await cdp.send('Page.navigate', { url: `${baseUrl}${pagePath}` });
  await sleep(5000);

  const r = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const el = document.querySelector('.idcard__trust-name');
      if (!el) return JSON.stringify({ missing: true });
      const host = el.parentElement;
      const hs = getComputedStyle(host);
      const es = getComputedStyle(el);
      const n = (v) => parseFloat(v) || 0;
      const frame = n(es.paddingLeft) + n(es.paddingRight) + n(es.borderLeftWidth) + n(es.borderRightWidth);
      const avail = host.clientWidth - n(hs.paddingLeft) - n(hs.paddingRight) - frame;
      return JSON.stringify({
        inlineStyleFontSize: el.style.fontSize || '(none)',
        computedFontSize: es.fontSize,
        whiteSpace: es.whiteSpace,
        text: el.textContent.trim().slice(0, 60),
        hostClientWidth: host.clientWidth,
        hostPad: n(hs.paddingLeft) + n(hs.paddingRight),
        frame,
        avail: Math.round(avail),
        scrollWidth: el.scrollWidth,
        offsetWidth: el.offsetWidth,
        rectWidth: +el.getBoundingClientRect().width.toFixed(1),
        fontsStatus: document.fonts.status,
        notoLoaded: document.fonts.check('900 46px "Noto Sans Devanagari"'),
      });
    })()`,
  });

  console.log('\n' + JSON.stringify(JSON.parse(r.result?.value ?? '{}'), null, 2) + '\n');

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${t.id}`);
  process.exit(0);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });