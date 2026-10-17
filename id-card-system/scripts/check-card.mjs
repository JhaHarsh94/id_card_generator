/**
 * Geometry guard for the locked card layout.
 *
 * The card canvas is a fixed 856x540 and every block inside it is absolutely
 * positioned, so adding a line of text cannot reflow anything - it can only
 * collide. When the DISTRICT line was added under the state, the identity
 * column gained ~28px of height; if that column grows past the bottom of the
 * card body it silently overlaps the footer band, and the only symptom is text
 * printed on top of other text.
 *
 * This reads the real boxes out of the DOM and fails if anything escapes.
 *
 * Run: node scripts/check-card.mjs <baseUrl>
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
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false,
  });

  let failures = 0;
  const fail = (m) => { failures += 1; console.log(`  FAIL  ${m}`); };
  const pass = (m) => console.log(`  ok    ${m}`);

  // ---- /dev/card: the design preview, which has a District control ----------
  await cdp.send('Page.navigate', { url: `${baseUrl}/dev/card` });
  await sleep(3000);

  const r = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const g = (sel) => { const el = document.querySelector(sel); if (!el) return null;
        const b = el.getBoundingClientRect();
        return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), h: +b.height.toFixed(1) }; };
      const txt = (sel) => (document.querySelector(sel)?.textContent || '').trim();
      return JSON.stringify({
        canvas: g('.idcard'),
        header: g('.idcard__header'),
        body: g('.idcard__body'),
        identity: g('.idcard__identity'),
        footer: g('.idcard'),
        name: txt('.idcard__name'),
        nameSize: getComputedStyle(document.querySelector('.idcard__name')).fontSize,
        designation: txt('.idcard__designation'),
        state: txt('.idcard__state'),
        district: txt('.idcard__district'),
        districtSize: document.querySelector('.idcard__district')
          ? getComputedStyle(document.querySelector('.idcard__district')).fontSize : null,
        districtWeight: document.querySelector('.idcard__district')
          ? getComputedStyle(document.querySelector('.idcard__district')).fontWeight : null,
      });
    })()`,
  }).catch(() => ({ result: { value: '{}' } }));

  const d = JSON.parse(r.result?.value ?? '{}');
  console.log('\n--- card geometry (/dev/card) ---');
  console.log('  ' + JSON.stringify(d, null, 2).replace(/\n/g, '\n  '));
  console.log('');

  if (!d.identity) { fail('no .idcard__identity'); }
  if (!d.district) fail('district is not rendered on the card');
  else pass(`district rendered: "${d.district}" (${d.districtSize}/${d.districtWeight})`);
  if (!d.state) fail('state not rendered');
  if (d.identity && d.body && d.identity.bottom > d.body.bottom) {
    fail(`identity bottom ${d.identity.bottom} passes body bottom ${d.body.bottom}`);
  } else if (d.identity && d.body) {
    pass(`identity bottom ${d.identity.bottom} <= body bottom ${d.body.bottom}`);
  }

  // ---- worst case: text long enough to wrap onto several lines -------------
  // The identity column is absolutely positioned inside a fixed-height body, so
  // wrapped names are the one input that can push the last line over the footer.
  // React tracks input value on the DOM node, so the native setter has to be
  // used and an 'input' event dispatched - assigning .value alone is ignored.
  const CASES = [
    { name: 'सुनीता देवी', designation: 'सदस्य' },
    { name: 'श्रीमती सुनीता देवी कबीरा', designation: 'जिला अध्यक्ष' },
    { name: 'मनोज कुमार कबीरा सर्व धर्म सहायता', designation: 'संस्थापक/अध्यक्ष' },
    // Deliberately absurd: a four-line name AND a two-line designation. The
    // fitter is allowed to shrink this far, but if it cannot get the column
    // inside the body even at its floor then the floor is too high.
    {
      name: 'श्रीमती मनोज कुमार कबीरा सर्व धर्म सहायता समिति बागपत उत्तर प्रदेश',
      designation: 'राष्ट्रीय महासचिव एवं मुख्य संयोजक',
    },
  ];
  console.log('\n--- wrapped-text overflow (worst case) ---');
  for (const testCase of CASES) {
    const rr = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const inputs = [...document.querySelectorAll('input.input')];
        const labelOf = (inp) => inp.closest('label')?.querySelector('span')?.textContent || '';
        const setVar = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const set = (label, value) => {
          const inp = inputs.find((i) => labelOf(i) === label);
          if (!inp) return false;
          setVar.call(inp, value);
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        };
        const a = set('Name', ${JSON.stringify(testCase.name)});
        const b = set('Designation', ${JSON.stringify(testCase.designation)});
        return JSON.stringify({ ok: a && b });
      })()`,
    });
    if (!JSON.parse(rr.result?.value ?? '{}').ok) { fail('could not set name/designation'); break; }
    await sleep(800);
    const m = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const g = (sel) => { const el = document.querySelector(sel); if (!el) return null;
          const b = el.getBoundingClientRect();
          return { top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), h: +b.height.toFixed(1) }; };
        const idEl = document.querySelector('.idcard__identity');
        return JSON.stringify({
          nameClass: document.querySelector('.idcard__name').className,
          nameLines: Math.round(document.querySelector('.idcard__name').getBoundingClientRect().height
            / parseFloat(getComputedStyle(document.querySelector('.idcard__name')).lineHeight)),
          scale: idEl.style.transform || 'none',
          identity: g('.idcard__identity'),
          body: g('.idcard__body'),
        });
      })()`,
    });
    const v = JSON.parse(m.result?.value ?? '{}');
    const over = v.identity && v.body ? v.identity.bottom - v.body.bottom : 0;
    const label = `name x${v.nameLines} lines, ${v.scale}`;
    if (over > 0.5) {
      fail(`${label} -> identity bottom ${v.identity.bottom} passes body bottom ${v.body.bottom} by ${over.toFixed(1)}px`);
    } else {
      pass(`${label} -> bottom ${v.identity.bottom} <= ${v.body.bottom}`);
    }
  }

  console.log(`\nRESULT: ${failures === 0 ? 'PASS' : `FAIL - ${failures}`}\n`);
  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${t.id}`);
  process.exit(0);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
