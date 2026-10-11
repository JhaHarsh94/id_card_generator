/**
 * Report which data backend the running app is actually using.
 *
 * The card renders from a synchronous cache seeded at module load, so "is
 * Supabase live?" cannot be answered by reading the DOM - the same values are
 * present either way. This reads the module's own view of the world by checking
 * whether the app has made a Supabase request, and dumps whatever the
 * organisation cache holds so a stale isDemo flag can be traced.
 *
 * Run: node scripts/probe-backend.mjs <baseUrl>
 */

const [, , baseUrl = 'http://localhost:5239'] = process.argv;
const DEBUG_PORT = 9222;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.requests = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve } = this.pending.get(m.id);
        this.pending.delete(m.id);
        resolve(m.result);
      }
      if (m.method === 'Network.requestWillBeSent') {
        this.requests.push(m.params.request.url);
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
  await cdp.send('Network.enable');
  await cdp.send('Page.navigate', { url: `${baseUrl}/` });
  await sleep(4500);

  const supabaseCalls = cdp.requests.filter((u) => u.includes('supabase.co'));

  const probe = await cdp.send('Runtime.evaluate', {
    returnByValue: true,
    expression: `JSON.stringify({
      demoFlagPresent: Boolean(document.querySelector('.idcard__demo-flag')),
      storedOrg: localStorage.getItem('idcms.organization.v5')
    })`,
  });
  const d = JSON.parse(probe.result?.value ?? '{}');

  console.log(`\n  Supabase requests made: ${supabaseCalls.length}`);
  supabaseCalls.slice(0, 4).forEach((u) => console.log(`    ${u.slice(0, 110)}`));
  console.log(`\n  DEMO DATA badge rendered: ${d.demoFlagPresent ? 'YES' : 'no'}`);
  console.log(`  localStorage org: ${d.storedOrg ? d.storedOrg.slice(0, 200) : '(nothing stored)'}\n`);

  ws.close();
  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${t.id}`);
  process.exit(0);
};

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });