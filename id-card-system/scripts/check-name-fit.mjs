/**
 * Check the trust name fits at several viewport widths.
 *
 * The card is a fixed 856px canvas scaled to fit, so the name's LAYOUT width
 * does not change with the viewport - but the RENDERED pixels do, and so does
 * the webfont's load timing. The reported failure was that the name overflowed
 * on a phone and not on a desktop, which means the bug is in when the size is
 * measured rather than in the layout itself.
 *
 * So this deliberately throttles the network before loading, reproducing a slow
 * phone: the font arrives late, exactly as it would on a mobile connection. A
 * fix that only measures on first paint will fail here; one that waits for the
 * face will pass.
 *
 * Run: node scripts/check-name-fit.mjs <baseUrl> [path]
 *
 * Defaults to /dev/card. The root "/" only renders the card after a member has
 * been typed into the form, so measuring there would report "card not rendered"
 * at every viewport and tell us nothing.
 */

const [, , baseUrl = 'http://localhost:5242', pagePath = '/dev/card'] = process.argv;
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

/**
 * Wait for the trust name to exist.
 *
 * A fixed sleep is wrong under throttling: the app bundle alone takes ~9s at
 * 400kbit/s, so the element is simply not in the DOM yet and every viewport
 * would be reported as "card not rendered".
 */
async function waitForCard(cdp, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    const r = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `Boolean(document.querySelector('.idcard__trust-name'))`,
    });
    if (r.result?.value) return true;
    await sleep(500);
  }
  return false;
}

/** Viewports chosen to bracket the reported failure: small phone up to desktop. */
const VIEWPORTS = [
  { label: 'iPhone SE', width: 375, height: 667, mobile: true },
  { label: 'iPhone 12 ', width: 390, height: 844, mobile: true },
  { label: 'Pixel 7  ', width: 412, height: 915, mobile: true },
  { label: 'tablet   ', width: 768, height: 1024, mobile: false },
  { label: 'desktop  ', width: 1440, height: 900, mobile: false },
];

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
  await cdp.send('Network.enable');
  // 400 kbit/s: a slow phone connection, so the woff2 lands well after first
  // paint - the condition under which the name used to overflow.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (200 * 1024) / 8,
  });

  let failures = 0;
  console.log('');

  for (const vp of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: vp.mobile,
    });
    await cdp.send('Page.navigate', { url: `${baseUrl}${pagePath}` });
    // The throttle applies to the app bundle too - at 400kbit/s the ~424 kB
    // entry chunk alone takes ~9s, before any font request is even made. Wait
    // for the element itself rather than guessing a duration.
    await waitForCard(cdp);

    const res = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const el = document.querySelector('.idcard__trust-name');
        if (!el) return JSON.stringify({ missing: true });
        const host = el.parentElement;
        const hs = getComputedStyle(host);
        const es = getComputedStyle(el);
        const frame =
          parseFloat(es.paddingLeft) + parseFloat(es.paddingRight) +
          parseFloat(es.borderLeftWidth) + parseFloat(es.borderRightWidth);
        const avail = host.clientWidth
          - parseFloat(hs.paddingLeft) - parseFloat(hs.paddingRight) - frame;
        return JSON.stringify({
          fontSize: parseFloat(es.fontSize),
          scale: es.getPropertyValue('--name-fit-scale').trim() || '1',
          textWidth: el.scrollWidth,
          avail: Math.round(avail),
          overflow: Math.max(0, el.scrollWidth - avail),
        });
      })()`,
    });
    const d = JSON.parse(res.result?.value ?? '{}');

    if (d.missing) {
      console.log(`  ${vp.label} ${String(vp.width).padStart(4)}px  (card not rendered)`);
      failures += 1;
      continue;
    }

    const bad = d.overflow > 0.5;
    if (bad) failures += 1;
    console.log(
      `  ${vp.label} ${String(vp.width).padStart(4)}px  `
      + `font ${String(d.fontSize).padStart(5)}px  `
      + `scaleX ${String(d.scale).padStart(5)}  `
      + `text ${String(Math.round(d.textWidth)).padStart(3)} / ${String(d.avail).padStart(3)} available  `
      + `${bad ? `  OVERFLOW +${d.overflow.toFixed(0)}px` : '  fits'}`,
    );
  }

  console.log(`\nRESULT: ${failures === 0 ? 'PASS - name fits at every width' : `FAIL - ${failures} viewport(s) overflow`}\n`);

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${t.id}`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });