// STORY-004 bench: drive headless Chrome over the DevTools protocol, run the
// spike's ?bench flight, then take screenshots at fixed distances.
//
// Usage: node scripts/bench.mjs <spike url> <output dir>
//   e.g. node scripts/bench.mjs http://localhost:4173/GlobeCiv3/spike.html docs/spikes
// Needs Node 22+ (global WebSocket and fetch). CHROME overrides the browser path.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, outDir] = process.argv.slice(2);
if (!base || !outDir) {
  console.error('usage: node scripts/bench.mjs <spike url> <output dir>');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'gc3-bench-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1280,800', 'about:blank',
], { stdio: 'ignore' });

async function getJson(path) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
      if (r.ok) return r.json();
    } catch { /* browser still starting */ }
    await sleep(200);
  }
  throw new Error('Chrome DevTools endpoint did not come up');
}

const page = (await getJson('/json/list')).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));

let nextId = 0;
const pending = new Map();
const consoleLines = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    consoleLines.push(`${msg.params.type}: ${msg.params.args.map(a => a.value ?? a.description).join(' ')}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    consoleLines.push(`exception: ${d.exception?.description ?? d.text}`);
  }
});
const send = (method, params = {}) => new Promise(resolve => {
  const id = ++nextId;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
async function waitFor(expr, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await evaluate(expr);
    if (v) return v;
    await sleep(250);
  }
  return null;
}

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

// 1. Bench flight
await send('Page.navigate', { url: `${base}?bench` });
const bench = await waitFor('window.__bench', 180000);
writeFileSync(join(outDir, 'STORY-004-bench-desktop.json'), JSON.stringify(bench, null, 2) + '\n');
console.log(bench ? `bench: ${bench.avgFps} fps avg, ${bench.p1LowFps} fps 1% low, level ${bench.reachedLevel}` : 'bench: TIMED OUT');

// 2. Screenshots at fixed distances (distance is a multiple of the globe radius)
const views = [
  ['etaalta', 'dist=5'],
  ['manner', 'dist=0.04'],
  ['ruutu', 'dist=0.0025'],
  ['syvin', 'dist=0.00002'],
  ['syvin-tasovarit', 'dist=0.00002&tint=1'],
];
const shots = [];
for (const [name, query] of views) {
  await send('Page.navigate', { url: `${base}?${query}` });
  const ready = await waitFor('window.__ready', 60000);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const file = `STORY-004-${name}.png`;
  writeFileSync(join(outDir, file), Buffer.from(shot.result.data, 'base64'));
  shots.push({ file, query, ready });
  console.log(`${file}: ${ready ? `level ${ready.level}, ${ready.drawn} tiles` : 'NOT READY'}`);
}
writeFileSync(join(outDir, 'STORY-004-screenshots.json'), JSON.stringify(shots, null, 2) + '\n');

const problems = consoleLines.filter(l => /^(error|warning|exception)/.test(l));
console.log(problems.length ? `console problems:\n${problems.join('\n')}` : 'console: no errors or warnings');

ws.close();
chrome.kill();
