import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const shots = fileURLToPath(new URL('../docs/shots/', import.meta.url));
const prefix = '/jam/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.wav': 'audio/wav', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' };
await stat(resolve(root, 'index.html')).catch(() => {
  throw new Error('dist/index.html is missing. Run npm run build before npm run smoke.');
});
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) { response.writeHead(404).end(); return; }
    const relative = pathname.slice(prefix.length) || 'index.html';
    const path = resolve(root, relative);
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403).end(); return;
    }
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
let browser;
const errors = [];
const warnings = [];
const audioRequests = new Map();
try {
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}${prefix}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (new URL(response.url()).pathname.includes('/audio/')) audioRequests.set(new URL(response.url()).pathname, response.status());
    if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.addInitScript(() => {
    Math.random = (() => { let n = 7; return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296); })();
    window.__smokeAudio = [];
    const Audio = window.AudioContext;
    if (Audio) window.AudioContext = new Proxy(Audio, {
      construct(target, args) {
        const context = Reflect.construct(target, args);
        window.__smokeAudio.push(context);
        return context;
      },
    });
  });
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, 'page returns 200');
  await page.waitForSelector('canvas', { state: 'visible', timeout: 15000 });
  const canvas = await page.locator('canvas').first().evaluate(element => ({ width: element.width, height: element.height }));
  assert.deepEqual(canvas, { width: 320, height: 180 }, 'native canvas is 320x180');
  await page.waitForFunction(() => window.__smokeAudio.length > 0, null, { timeout: 10000 });
  const beforeKey = await page.evaluate(() => window.__smokeAudio.map(context => context.state));
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__smokeAudio.every(context => context.state === 'running'), null, { timeout: 10000 });
  // Let the first input's sim, render and audio callbacks finish before checking errors.
  await page.waitForTimeout(750);
  const afterKey = await page.evaluate(() => window.__smokeAudio.map(context => context.state));
  const audioFiles = (await readdir(resolve(root, 'audio'))).filter(name => name.endsWith('.wav')).sort();
  assert.ok(audioFiles.length > 0, 'build contains WAV files');
  const audio = [];
  for (const name of audioFiles) {
    const path = `${prefix}audio/${encodeURIComponent(name)}`;
    const gameRequestStatus = audioRequests.get(path) ?? null;
    const fetched = await page.request.get(new URL(path, url).href);
    assert.equal(fetched.status(), 200, `${name} returns 200`);
    const body = await fetched.body();
    assert.equal(body.toString('ascii', 0, 4), 'RIFF', `${name} is a WAV, not an HTML fallback`);
    assert.equal(body.toString('ascii', 8, 12), 'WAVE', `${name} has a WAVE header`);
    audio.push({ name, status: fetched.status(), bytes: body.length, gameRequestStatus });
  }
  if (audio.some(file => file.gameRequestStatus === null)) {
    warnings.push('Some built WAVs were not requested by the game during this smoke window. HTTP availability does not prove scene audio wiring.');
  }
  await mkdir(shots, { recursive: true });
  await page.screenshot({ path: resolve(shots, 'smoke.png') });
  const restart = async () => {
    await page.evaluate(() => { window.__smokePreviousWorld = window.__blackout; });
    await page.keyboard.press('r');
    await page.waitForFunction(() => window.__blackout !== window.__smokePreviousWorld && window.__blackout.time < 0.5 && window.__blackout.phase === 'play' && window.__blackout.shocks === 0);
  };
  await restart();
  const x0 = await page.evaluate(() => window.__blackout.player.x);
  await page.keyboard.down('d');
  await page.waitForTimeout(200);
  await page.keyboard.up('d');
  assert.ok(await page.evaluate(x => window.__blackout.player.x > x, x0), 'movement reaches the sim');
  await restart();
  await page.evaluate(() => {
    const w = window.__blackout;
    w.hp = 1; w.grace = 0;
    w.creature.asleep = true; w.creature.state = 'stalk';
    w.creature.x = w.player.x; w.creature.y = w.player.y;
  });
  await page.waitForFunction(() => window.__blackout.phase === 'lost');
  await restart();
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__blackout.surge !== null);
  await page.evaluate(() => {
    const w = window.__blackout, s = w.surge, point = s.route.points[1];
    w.shocks = 4; w.lastHitBreaker = -1;
    w.player.x = 950; w.player.y = 560;
    w.creature.x = point.x; w.creature.y = point.y;
    w.creature.state = 'windup'; w.creature.timer = 99;
    s.dist = s.route.cum[1] - 5;
  });
  await page.waitForFunction(() => window.__blackout.phase === 'won');
  await page.waitForTimeout(1000);
  assert.deepEqual(await page.evaluate(() => ({ cooldown: window.__blackout.cooldown, surge: window.__blackout.surge })),
    { cooldown: 0, surge: null }, 'win clears countdown and shot');
  await page.evaluate(() => { window.__blackout.player.x = 1000; window.__blackout.player.y = 50; });
  await page.waitForFunction(() => window.__blackout.phase === 'escaped');
  await restart();
  const screenshots = [];
  for (const scale of [1, 4]) {
    await page.setViewportSize({ width: 320 * scale, height: 180 * scale });
    await page.goto(url + '?lure=hit&freeze=1.2', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__blackout?.time >= 1.2);
    const box = await page.locator('canvas').boundingBox();
    assert.equal(box.width, 320 * scale, 'integer canvas width');
    assert.equal(box.height, 180 * scale, 'integer canvas height');
    const path = resolve(shots, `slice-${scale}x.png`);
    await page.locator('canvas').screenshot({ path });
    screenshots.push(path);
  }
  assert.deepEqual(errors, [], 'no page, console, request or HTTP errors');
  console.log(JSON.stringify({ result: 'pass', servedAt: prefix, canvas, beforeKey, afterKey,
    audio, errors, warnings, screenshots, flows: ['movement', 'restart', 'death', 'win', 'escape'] }, null, 2));
} catch (error) {
  console.error(error.message);
  if (errors.length) console.error(JSON.stringify(errors, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
