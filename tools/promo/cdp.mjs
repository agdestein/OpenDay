// Minimal CDP driver: node cdp.mjs <script.mjs>  (script exports default async ({send, eval_, shot, mouse, sleep}) => {})
import { spawn } from 'node:child_process';
const SP = import.meta.dirname + '/build';
const port = 9333;
const chrome = spawn('chromium', ['--headless=new', `--remote-debugging-port=${port}`, '--no-first-run',
  '--user-data-dir=' + SP + '/chrome-prof', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.consoleAPICalled') { console.log('[page]', m.params.args.map(a => a.value ?? a.description).join(' ')); } else if (m.method === 'Runtime.exceptionThrown') console.log('[exc]', m.params.exceptionDetails.exception?.description); });
const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, (m) => m.error ? j(new Error(method + ': ' + m.error.message)) : r(m.result)); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
const eval_ = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result.value; };
const fs = await import('node:fs'); fs.mkdirSync(`${SP}/shots`, { recursive: true }); fs.mkdirSync(`${SP}/out`, { recursive: true });
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${SP}/shots/${name}.png`, Buffer.from(r.data, 'base64')); console.log('saved', name); };
const mouse = (type, x, y, buttons = 1) => send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: 1 });
const click = async (x, y) => { await mouse('mouseMoved', x, y, 0); await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y, 0); };
const drag = async (pts, dt = 16) => { await mouse('mouseMoved', pts[0][0], pts[0][1], 0); await mouse('mousePressed', ...pts[0]); for (const p of pts.slice(1)) { await mouse('mouseMoved', p[0], p[1], 1); await sleep(dt); } const l = pts.at(-1); await mouse('mouseReleased', l[0], l[1], 0); };
const setup = async (w, h, scale) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false });
const nav = async (url) => { await send('Page.enable'); await send('Page.navigate', { url }); await sleep(1500); };
const key = async (k) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k }); };
try { const mod = await import(process.argv[2]); await mod.default({ send, eval_, shot, mouse, click, drag, sleep, setup, nav, key }); }
catch (e) { console.error(e); }
finally { ws.close(); chrome.kill(); process.exit(0); }
