#!/usr/bin/env node
// One-command stand launcher: serve app/dist on this machine (no network
// needed) and keep a Chromium-family browser (Chrome, Chromium or Edge) open
// on it in kiosk mode. If a visitor manages to close the browser, it comes
// back after two seconds; close it twice within ten seconds (Alt+F4, Alt+F4)
// to really quit.
//
//   cd app && npm run build                       # once, after every change
//   node tools/kiosk/kiosk.mjs                     # all games, Dutch, idle reset 180 s
//   node tools/kiosk/kiosk.mjs --home=windfarm     # rests on Swirl Lab, not the menu
//   node tools/kiosk/kiosk.mjs --games=windfarm,bounce --quality=low
//   node tools/kiosk/kiosk.mjs --windowed          # a normal window, for testing
//   node tools/kiosk/kiosk.mjs --serve-only        # just the server; open the URL yourself
//   node tools/kiosk/kiosk.mjs --dry-run           # print what it would do
//
// Launcher options: --port=8080, --browser=<path>, --windowed, --serve-only,
// --dry-run. Every other --name[=value] becomes a URL parameter of the arcade
// (see the README: games, lang, idle, quality, sound, dpr, reset-scores, ...).
// Defaults: lang=nl, idle=180. Windows: double-click kiosk.bat instead.

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const DIST = resolve(import.meta.dirname, '../../app/dist');
const LAUNCHER_OPTIONS = new Set(['port', 'browser', 'windowed', 'serve-only', 'dry-run']);

const options = {};
const params = new URLSearchParams({ lang: 'nl', idle: '180' });
for (const arg of process.argv.slice(2)) {
  const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
  if (!match) {
    console.error(`Unknown argument ${arg} (expected --name or --name=value)`);
    process.exit(1);
  }
  const [, name, value = ''] = match;
  if (LAUNCHER_OPTIONS.has(name)) options[name] = value || true;
  else params.set(name, value);
}
const port = Number(options.port) || 8080;
const urlWith = (p) => `http://127.0.0.1:${port}/?${p}`.replace(/=(?=&|$)/g, '');
const url = urlWith(params);
// --reset-scores clears the boards on the first launch only, not on every
// relaunch after a visitor closed the browser.
const laterParams = new URLSearchParams(params);
laterParams.delete('reset-scores');
const laterUrl = urlWith(laterParams);

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`No build in ${DIST}. Run first:\n  cd app && npm install && npm run build`);
  process.exit(1);
}

// ---- the local web server (module scripts do not load from file://) ----

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.bin': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function serve() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(readFileSync(file));
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => ok(server));
  });
}

// ---- finding and running the browser ----

function onPath(name) {
  const which = platform() === 'win32' ? 'where' : 'which';
  const result = spawnSync(which, [name], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split(/\r?\n/)[0].trim() : null;
}

function findBrowser() {
  if (options.browser) return options.browser;
  if (process.env.ARCADE_BROWSER) return process.env.ARCADE_BROWSER;
  if (platform() === 'win32') {
    const roots = [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], process.env['LocalAppData']];
    const candidates = roots.filter(Boolean).flatMap((root) => [
      join(root, 'Google/Chrome/Application/chrome.exe'),
      join(root, 'Microsoft/Edge/Application/msedge.exe'),
    ]);
    return candidates.find((p) => existsSync(p)) ?? null;
  }
  if (platform() === 'darwin') {
    return (
      [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ].find((p) => existsSync(p)) ?? null
    );
  }
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable', 'microsoft-edge']) {
    const found = onPath(name);
    if (found) return found;
  }
  return null;
}

function browserArgs(target = url) {
  const args = [
    // Its own profile: scores and crowns live in localStorage and must survive
    // a relaunch (so not --incognito), without touching anyone's own browser.
    `--user-data-dir=${join(homedir(), '.cwi-arcade-kiosk')}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--noerrdialogs',
    '--hide-crash-restore-bubble',
    '--disable-session-crashed-bubble',
    '--disable-pinch',
    '--overscroll-history-navigation=0',
    '--disable-features=Translate,TouchpadOverscrollHistoryNavigation',
    '--autoplay-policy=no-user-gesture-required',
    '--ignore-gpu-blocklist',
    '--check-for-update-interval=31536000',
  ];
  if (platform() === 'linux') args.push('--password-store=basic');
  args.push(...(options.windowed ? [`--app=${target}`] : ['--kiosk', target]));
  return args;
}

async function runBrowser(browser) {
  let target = url;
  let lastExit = 0;
  for (;;) {
    const args = browserArgs(target);
    console.log(`Opening ${target}`);
    target = laterUrl;
    const started = Date.now();
    await new Promise((done) => spawn(browser, args, { stdio: 'ignore' }).once('exit', done).once('error', done));
    const now = Date.now();
    if (now - lastExit < 10_000 && now - started < 10_000) {
      console.log('Closed twice in a row: stopping.');
      process.exit(0);
    }
    lastExit = now;
    console.log('The browser closed; reopening in 2 s (close it again within 10 s to quit).');
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const browser = options['serve-only'] ? null : findBrowser();
if (options['dry-run']) {
  console.log(`Would serve ${DIST} on http://127.0.0.1:${port}/`);
  console.log(browser ? `Would run: ${browser} ${browserArgs().join(' ')}` : 'No browser (serve only, or none found).');
  process.exit(0);
}
if (!options['serve-only'] && !browser) {
  console.error('No Chrome, Chromium or Edge found. Pass --browser=<path>, or use --serve-only and open the URL yourself.');
  process.exit(1);
}
try {
  await serve();
} catch (error) {
  console.error(`Could not serve on port ${port} (${error.code ?? error}). Is the arcade already running? Try --port=8081.`);
  process.exit(1);
}
console.log(`Serving ${DIST} on http://127.0.0.1:${port}/`);
if (browser) await runBrowser(browser);
else console.log(`Open ${url} in a browser (F for fullscreen). Ctrl+C stops the server.`);
