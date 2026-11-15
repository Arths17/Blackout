// Serves a built copy of the game from a subfolder URL, the way itch.io does, and plays the
// first seconds in headless Chromium. Fails on any console error, failed request or 4xx/5xx.
// Usage: node tools/smoke.mjs [folder]   (default: dist)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(process.argv[2] ?? 'dist') + sep;
const prefix = '/jam/';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.xml': 'application/xml', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.png': 'image/png' };
await stat(resolve(root, 'index.html')).catch(() => {
  throw new Error(`${root}index.html is missing. Run npm run build first.`);
});
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const path = resolve(root, pathname.slice(prefix.length) || 'index.html');
    if (!pathname.startsWith(prefix) || !path.startsWith(root)) { response.writeHead(404).end(); return; }
    const bytes = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${server.address().port}${prefix}`;
const browser = await chromium.launch({ headless: true });
const problems = [];
let requests = 0;
let bytes = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1152, height: 648 } });
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('requestfailed', (request) => problems.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', async (response) => {
    requests++;
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
    // Phaser hands loaded images to the page as blob: URLs; those are still local.
    if (!response.url().startsWith(url) && !/^(blob|data):/.test(response.url())) problems.push(`request left the build folder: ${response.url()}`);
    bytes += (await response.body().catch(() => Buffer.alloc(0))).length;
  });
  await page.addInitScript(() => {
    window.__audio = [];
    const Real = window.AudioContext;
    window.AudioContext = function (...args) { const c = new Real(...args); window.__audio.push(c); return c; };
  });
  const started = Date.now();
  assert.equal((await page.goto(url, { waitUntil: 'networkidle' })).status(), 200);
  await page.waitForSelector('canvas');
  const loadMs = Date.now() - started;
  const before = { requests, bytes };
  assert.equal(await page.evaluate(() => window.__audio.length), 0, 'no audio context before the first key');
  const size = await page.locator('canvas').evaluate((c) => [c.width, c.height, c.getBoundingClientRect().width]);
  assert.deepEqual(size, [384, 216, 1152], 'canvas is 384x216 scaled 3x in a 1152x648 frame');

  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__audio.length === 1 && window.__audio[0].state === 'running', null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.scrollY), 0, 'Space does not scroll the page');
  await page.waitForFunction(() => window.__blackout, null, { timeout: 5000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__blackout.time > 0.3);
  await page.keyboard.press('1');
  await page.waitForFunction(() => window.__blackout.surge !== null, null, { timeout: 2000 });
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  assert.ok(await page.evaluate(() => window.__blackout.player.x > 250), 'the player moved');
  // mash restart and breakers
  for (let i = 0; i < 12; i++) await page.keyboard.press(i % 3 ? String(1 + (i % 3)) : 'r');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__blackout.phase), 'play');
  // tabbing away pauses the fight
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const t0 = await page.evaluate(() => window.__blackout.time);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__blackout.time), t0, 'blur pauses the sim');
  await page.keyboard.press('Enter');
  await page.waitForFunction((t) => window.__blackout.time > t, t0);
  await page.waitForTimeout(1500);
  assert.deepEqual(problems, []);
  console.log(`ok: loaded in ${loadMs} ms, ${before.requests} requests and ${(before.bytes / 1024).toFixed(0)} KB before the first key, ${requests} requests and ${(bytes / 1024).toFixed(0)} KB after ten seconds of play`);
} finally {
  await browser.close();
  server.close();
}
