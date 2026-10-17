/**
 * Assert the landing page actually rendered its content, and that no width
 * overflows horizontally.
 *
 * Screenshots are not reviewable in every environment, so the page is checked
 * by reading the live DOM: each section must be present with the organisation's
 * own copy (read from the config, not hardcoded), the two calls to action must
 * exist, and documentElement.scrollWidth must equal the viewport at every width
 * - a wider scrollWidth means some child is pushing the page sideways, which is
 * the failure mode that makes a form unusable on a phone.
 *
 * Run: node scripts/check-home.mjs <baseUrl>
 */

const [, , baseUrl = 'http://localhost:5250'] = process.argv;
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
  const fail = (msg) => { failures += 1; console.log(`  FAIL  ${msg}`); };
  const pass = (msg) => console.log(`  ok    ${msg}`);

  // ------------------------------------------------- content, at 1280 only
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.send('Page.navigate', { url: `${baseUrl}/` });
  await sleep(2500);

  const r = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const q = (s) => document.querySelector(s);
      const all = (s) => [...document.querySelectorAll(s)];
      const txt = (s) => (q(s)?.textContent || '').trim();
      const org = JSON.parse(JSON.stringify(window.__orgProbe || {}));
      return JSON.stringify({
        path: location.pathname,
        h1: txt('h1.home__title'),
        eyebrow: txt('.home__eyebrow'),
        authority: txt('.home__authority'),
        lede: txt('.home__lede') ,
        cta: all('.home__btn').map((b) => b.textContent.trim()),
        ctaPrimaryHref: q('.home__cta .home__btn--primary')?.tagName,
        lookup: !!q('.home__lookup-input'),
        steps: all('.home__step').length,
        stepTitles: all('.home__step-title').map((e) => e.textContent.trim()),
        support: txt('.home__support'),
        h2s: all('.home__h2').map((e) => e.textContent.trim()),
        addressLines: all('.home__contact-line').map((e) => e.textContent.trim()),
        signName: txt('.home__sign-name'),
        signRole: txt('.home__sign-role'),
        footLink: txt('.home__foot-link'),
        barLink: txt('.home__bar-link'),
        logo: !!q('.home__brand-logo'),
        hasForm: !!q('#s-fullName'),
        cssLoaded: all('link[rel=stylesheet]').length > 0
          || all('style').length > 0,
        bodyBg: getComputedStyle(q('.home__hero')).backgroundImage.slice(0, 40),
      });
    })()`,
  });
  const d = JSON.parse(r.result?.value ?? '{}');
  console.log('\n--- landing content (1280px) ---');
  console.log(`  h1        ${d.h1}`);
  console.log(`  eyebrow   ${d.eyebrow}`);
  console.log(`  authority ${d.authority}`);
  console.log(`  cta       ${JSON.stringify(d.cta)}`);
  console.log(`  steps     ${d.steps} ${JSON.stringify(d.stepTitles)}`);
  console.log(`  h2s       ${JSON.stringify(d.h2s)}`);
  console.log(`  address   ${JSON.stringify(d.addressLines)}`);
  console.log(`  sign      ${d.signName} / ${d.signRole}`);
  console.log(`  links     bar="${d.barLink}" foot="${d.footLink}"`);
  console.log('');

  if (d.path !== '/') fail(`root path is ${d.path}, expected /`);
  if (!d.h1) fail('no h1 title'); else pass(`h1 = ${d.h1}`);
  if (!/29\/2024/.test(d.eyebrow)) fail(`registration missing from eyebrow (${d.eyebrow})`);
  if (!/Uttar Pradesh/.test(d.authority)) fail(`authority line missing (${d.authority})`);
  if (d.cta.length < 2) fail(`expected 2 CTAs, got ${JSON.stringify(d.cta)}`);
  if (d.ctaPrimaryHref !== 'BUTTON') fail('primary CTA is not a button');
  if (!d.lookup) fail('no member-ID lookup input on the landing page');
  if (d.steps !== 3) fail(`expected 3 steps, got ${d.steps}`);
  if (d.h2s.length < 4) fail(`expected 4 section headings, got ${JSON.stringify(d.h2s)}`);
  if (!d.addressLines.length) fail('no address lines rendered from footerText');
  if (!/9458447100/.test(d.addressLines.join(' '))) fail('phone numbers missing from contact');
  if (!d.logo) fail('organisation logo not rendered in the top bar');
  if (d.hasForm) fail('the card form is still rendering at / (should be at /generate)');
  if (!d.bodyBg || d.bodyBg === 'none') fail('hero gradient missing');
  if (d.footLink && !/लॉगिन/.test(d.footLink)) fail(`footer link is "${d.footLink}"`);

  // ------------------------------------------------- overflow, every width
  console.log('\n--- overflow ---');
  for (const width of WIDTHS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height: 900, deviceScaleFactor: 1, mobile: width < 768,
    });
    await cdp.send('Page.navigate', { url: `${baseUrl}/` });
    await sleep(1600);
    const o = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `JSON.stringify({
        vw: document.documentElement.clientWidth,
        sw: document.documentElement.scrollWidth,
      })`,
    });
    const v = JSON.parse(o.result?.value ?? '{}');
    const over = v.sw - v.vw;
    if (over > 1) fail(`${width}px: scrollWidth ${v.sw} > viewport ${v.vw} (+${over})`);
    else pass(`${width}px: ${v.sw} = ${v.vw}`);
  }

  // ------------------------------------------------- generator page
  console.log('\n--- generator page ---');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.send('Page.navigate', { url: `${baseUrl}/generate` });
  await sleep(2000);
  const g = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `JSON.stringify({
      hasForm: !!document.querySelector('#s-fullName'),
      hasDistrict: !!document.querySelector('#s-district'),
      back: document.querySelector('.simple__home-link')?.textContent.trim() || '',
      backHref: document.querySelector('.simple__home-link')?.getAttribute('href') || '',
    })`,
  });
  const gv = JSON.parse(g.result?.value ?? '{}');
  if (!gv.hasForm) fail('/generate does not render the card form');
  else pass('/generate renders the card form');
  if (!gv.hasDistrict) fail('/generate has no district field');
  else pass('district field present');
  if (gv.backHref !== '/') fail(`back link points at "${gv.backHref}"`);
  else pass(`back link "${gv.back}" -> /`);

  console.log(`\nRESULT: ${failures === 0 ? 'PASS' : `FAIL - ${failures} problem(s)`}\n`);
  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${t.id}`);
  process.exit(failures === 0 ? 0 : 1);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
