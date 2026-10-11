/**
 * Report horizontal overflow on a page.
 *
 * The client form was unusable on a phone: every field and the card preview
 * extended past the right edge of the viewport, so the far side of each input
 * - where the text is actually typed - was unreachable without sideways
 * scrolling. Nothing errored; the page was simply wider than the screen.
 *
 * This walks the DOM for elements whose right edge exceeds the viewport and
 * attributes the width to the nearest offending ancestor, because the fix
 * belongs on the container rather than on each of its children.
 *
 * Run: node scripts/check-overflow.mjs <baseUrl> [path]
 */

const [, , baseUrl = 'http://localhost:5247', pagePath = '/'] = process.argv;
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

const WIDTHS = [360, 390, 430, 768, 1280];

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

  let failures = 0;
  console.log('');

  for (const width of WIDTHS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: width < 768,
    });
    await cdp.send('Page.navigate', { url: `${baseUrl}${pagePath}` });
    await sleep(2500);

    const r = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const vw = document.documentElement.clientWidth;
        const doc = document.documentElement;
        const offenders = [];
        for (const el of document.querySelectorAll('body *')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          if (b.right <= vw + 1) continue;
          // Report the deepest offender and its nearest sized ancestor.
          let owner = el;
          let p = el.parentElement;
          while (p && p !== document.body) {
            if (p.getBoundingClientRect().width > vw + 1) { owner = p; break; }
            p = p.parentElement;
          }
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className && String(el.className).slice(0, 40)) || '',
            over: Math.round(b.right - vw),
            owner: owner.tagName.toLowerCase() + '.' + String(owner.className || '').split(' ')[0],
            ownerWidth: Math.round(owner.getBoundingClientRect().width),
          });
        }
        return JSON.stringify({
          vw,
          scrollWidth: doc.scrollWidth,
          horizontalScroll: doc.scrollWidth > vw + 1,
          count: offenders.length,
          worst: offenders.sort((a, b) => b.over - a.over).slice(0, 3),
        });
      })()`,
    });

    const d = JSON.parse(r.result?.value ?? '{}');
    const bad = d.horizontalScroll;
    if (bad) failures += 1;

    console.log(`  ${String(width).padStart(4)}px  viewport ${String(d.vw).padStart(4)}`
      + `  scrollWidth ${String(d.scrollWidth).padStart(4)}`
      + `  ${bad ? `OVERFLOW by ${d.scrollWidth - d.vw}px` : 'ok'}`);
    d.worst?.forEach((w) => console.log(
      `          ${w.tag}.${w.cls} +${w.over}px  →  ${w.owner} (${w.ownerWidth}px)`,
    ));
  }

  console.log(`\nRESULT: ${failures === 0 ? 'PASS - no horizontal overflow' : `FAIL - ${failures} width(s) overflow`}\n`);
  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${t.id}`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });