/**
 * Screenshot an AUTHENTICATED page using the Chrome DevTools Protocol.
 *
 * Headless Chrome screenshots cannot hold a session, so protected routes would
 * only ever show the login screen. This script drives a real CDP session, seeds
 * the local auth token the same way signIn() does, reloads, and captures the
 * result - which is how the member details page and the export buttons get
 * verified.
 *
 * Usage:
 *   node scripts/shot-auth.mjs <url> <outfile> [--width 1440] [--height 1000]
 *
 * Requires: a Chrome already listening on --remote-debugging-port=9222
 */

const [, , url, outfile, ...rest] = process.argv;

const arg = (name, fallback) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};

const _width = arg('width', 1440);
const _height = arg('height', 1000);

const DEBUG_PORT = 9222;

/** Minimal CDP client over the WebSocket built into Node 18+. */
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        (this.listeners.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  once(method) {
    return new Promise((resolve) => {
      const handler = (params) => {
        const list = this.listeners.get(method);
        list.splice(list.indexOf(handler), 1);
        resolve(params);
      };
      this.on(method, handler);
    });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!url || !outfile) {
    console.error('usage: node scripts/shot-auth.mjs <url> <outfile> [--width N] [--height N]');
    process.exit(1);
  }

  // Open a fresh tab and grab its WS endpoint.
  const created = await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent('about:blank')}`,
    { method: 'PUT' },
  ).then((r) => r.json());

  const ws = new WebSocket(created.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const cdp = new CDP(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const logs = [];
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error' || p.type === 'warning') {
      logs.push(`[${p.type}] ${p.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    }
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    logs.push(`[exception] ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`);
  });

  // Load the origin once so localStorage/sessionStorage is writable, then seed
  // exactly the session shape services/auth.js writes.
  await cdp.send('Page.navigate', { url: new URL('/login', url).href });
  await sleep(1200);

  const seed = await cdp.send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const hash = async (t) => {
        const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
        return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2,'0')).join('');
      };
      const users = [{ id:'demo-admin', name:'Administrator', email:'admin@example.com',
                       role:'administrator', isDemo:true, passwordHash: await hash('demo1234') }];
      localStorage.setItem('idcms.admins', JSON.stringify(users));
      sessionStorage.setItem('idcms.session', JSON.stringify({
        user: { id:'demo-admin', name:'Administrator', email:'admin@example.com',
                role:'administrator' },
        startedAt: new Date().toISOString(),
      }));
      return 'seeded';
    })()`,
  });
  console.log('session:', seed.result?.value);

  // Now open the real target.
  await cdp.send('Page.navigate', { url });
  await sleep(2600);

  // Report what actually rendered.
  const probe = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `JSON.stringify({
      path: location.pathname,
      title: document.querySelector('.h1')?.textContent?.trim() ?? null,
      buttons: [...document.querySelectorAll('button.btn')].map(b => b.textContent.trim()),
      cardPresent: Boolean(document.querySelector('.idcard')),
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
    })`,
  });
  console.log('probe:', probe.result?.value);

  if (logs.length) console.log('console:\n  ' + logs.join('\n  '));

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(outfile, Buffer.from(shot.data, 'base64'));
  console.log('wrote', outfile);

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${created.id}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
