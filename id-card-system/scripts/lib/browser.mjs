import { writeFile } from 'node:fs/promises';

export async function connectBrowser() {
  const page = await fetch('http://127.0.0.1:9222/json/new?about:blank', { method: 'PUT' }).then((res) => res.json());
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let serial = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(new Error(JSON.stringify(message.error)));
      else task.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
  });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => reject(new Error(`Browser timeout: ${method}`)), 30000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 150; attempt += 1) {
      try { if (await evaluate(expression)) return; } catch { /* Navigation can replace the JS context. */ }
      await pause(100);
    }
    throw new Error(`Browser condition not met: ${expression}`);
  }
  async function navigate(url) {
    await send('Page.navigate', { url });
    await waitFor('document.readyState === "complete" && !!document.querySelector("#root > *")');
  }
  async function input(selector, value) {
    await evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
  }
  async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); }
  async function viewport(width) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 800 });
  }
  async function screenshot(path) {
    const result = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(path, Buffer.from(result.data, 'base64'));
  }
  async function close() { ws.close(); await fetch(`http://127.0.0.1:9222/json/close/${page.id}`); }
  await send('Page.enable');
  await send('Runtime.enable');
  return { send, evaluate, waitFor, navigate, input, click, viewport, screenshot, pause, close, errors };
}
