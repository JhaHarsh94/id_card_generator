/**
 * Diagnostic: print the raw numbers the identity fitter sees.
 *
 * Run: node scripts/diag-identity.mjs <baseUrl>
 */

const [, , baseUrl = 'http://localhost:5250'] = process.argv;
const DEBUG_PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve } = this.pending.get(m.id);
        this.pending.delete(m.id); resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((res) => this.pending.set(id, { resolve: res }));
  }
}

const CASES = [
  ['M.K Kabira', 'State President'],
  ['सुनीता देवी', 'सदस्य'],
  ['मनोज कुमार कबीरा सर्व धर्म सहायता', 'संस्थापक/अध्यक्ष'],
  ['श्रीमती मनोज कुमार कबीरा सर्व धर्म सहायता समिति बागपत उत्तर प्रदेश', 'राष्ट्रीय महासचिव एवं मुख्य संयोजक'],
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
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false,
  });
  await cdp.send('Page.navigate', { url: `${baseUrl}/dev/card` });
  await sleep(3000);

  for (const [name, designation] of CASES) {
    await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const inputs = [...document.querySelectorAll('input.input')];
        const labelOf = (i) => i.closest('label')?.querySelector('span')?.textContent || '';
        const setVar = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        const set = (l, v) => { const i = inputs.find((x) => labelOf(x) === l); if (!i) return;
          setVar.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); };
        set('Name', ${JSON.stringify(name)});
        set('Designation', ${JSON.stringify(designation)});
      })()`,
    });
    await sleep(900);
    const r = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const id = document.querySelector('.idcard__identity');
        const body = document.querySelector('.idcard__body');
        const nm = document.querySelector('.idcard__name');
        const cs = getComputedStyle(nm);
        return JSON.stringify({
          transform: id.style.transform || 'none',
          scrollHeight: id.scrollHeight,
          clientHeight: id.clientHeight,
          offsetTop: id.offsetTop,
          bodyClientHeight: body.clientHeight,
          available: body.clientHeight - id.offsetTop - 6,
          ratio: +((body.clientHeight - id.offsetTop - 6) / id.scrollHeight).toFixed(3),
          nameFontSize: cs.fontSize,
          nameLineHeight: cs.lineHeight,
          nameH: +nm.getBoundingClientRect().height.toFixed(1),
          nameClass: nm.className,
          desired: (() => {
            const needW = 404 - 0;
            return null;
          })(),
        });
      })()`,
    });
    const v = JSON.parse(r.result?.value ?? '{}');
    console.log(`\nname="${name}"`);
    console.log('  ' + JSON.stringify(v));
  }

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${t.id}`);
  process.exit(0);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
