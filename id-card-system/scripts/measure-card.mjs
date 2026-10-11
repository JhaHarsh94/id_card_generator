/**
 * Measure the card's identity block in a real browser and report the numbers
 * that decide whether the member text stacks cleanly or collides.
 *
 * Run: node scripts/measure-card.mjs <baseUrl>
 */

const [, , baseUrl = 'http://localhost:5213'] = process.argv;
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
  await cdp.send('Page.navigate', { url: `${baseUrl}/dev/card` });
  await sleep(2500);

  // Fill realistic Hindi data so wrapping behaviour is representative.
  // Devanagari is much wider than Latin, so measuring the English placeholder
  // would report "no wrapping" and hide a real collision.
  await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    expression: `(async () => {
      // The card preview page has no ids/placeholders on its inputs, so they
      // are addressed by position: name, designation, state, id.
      const inputs = [...document.querySelectorAll('input[type="text"], input:not([type])')];
      const set = (i, v) => {
        const el = inputs[i];
        if (!el) return;
        const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        d.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set(0, 'सुनीता देवी');
      set(1, 'प्रधान जिला अध्यक्ष');
      set(2, 'उत्तर प्रदेश');
      await new Promise(r => setTimeout(r, 700));
      return inputs.length;
    })()`,
  });
  await sleep(700);

  const res = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const q = (s) => document.querySelector(s);
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          text: el.textContent.trim().slice(0, 26),
          w: Math.round(r.width), h: Math.round(r.height),
          top: Math.round(r.top), bottom: Math.round(r.bottom),
          fontSize: cs.fontSize, lineHeight: cs.lineHeight,
          scrollW: el.scrollWidth, clientW: el.clientWidth,
        };
      };
      const id = q('.idcard__identity');
      const body = q('.idcard__body');
      return JSON.stringify({
        identity: box(id),
        body: box(body),
        children: [...(id?.children ?? [])].map(box),
      });
    })()`,
  });

  const d = JSON.parse(res.result?.value ?? '{}');
  const I = d.identity ?? {};
  console.log(`\nidentity box   w=${I.w}  top=${I.top}  bottom=${I.bottom}`);
  console.log(`body box       top=${d.body?.top}  bottom=${d.body?.bottom}\n`);

  console.log('child'.padEnd(28), 'w'.padStart(4), 'h'.padStart(4), 'top'.padStart(5), 'bot'.padStart(5), ' font/line');
  let prev = null;
  for (const c of d.children ?? []) {
    const gap = prev === null ? '' : ` gap=${c.top - prev}`;
    console.log(
      String(c.text).padEnd(28),
      String(c.w).padStart(4),
      String(c.h).padStart(4),
      String(c.top).padStart(5),
      String(c.bottom).padStart(5),
      ` ${c.fontSize}/${c.lineHeight}${gap}`,
    );
    if (c.scrollW > c.clientW + 1) {
      console.log(`   !! overflows its own box: scrollW=${c.scrollW} clientW=${c.clientW}`);
    }
    prev = c.bottom;
  }

  // Wrap detection: an element taller than a single line has wrapped.
  const wrapped = (d.children ?? []).filter((c) => {
    const lh = parseFloat(c.lineHeight);
    return c.h > lh * 1.6;
  });
  console.log(wrapped.length
    ? `\nWRAPPED (overlapping risk): ${wrapped.map((w) => w.text).join(', ')}`
    : '\nNo wrapping - all lines fit.');

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${created.id}`);
  process.exit(0);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });