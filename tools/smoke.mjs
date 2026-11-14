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
  assert.ok(canvas.width > 0 && canvas.height > 0, 'canvas has a drawing surface');
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
  const screenshot = resolve(shots, 'smoke.png');
  await page.screenshot({ path: screenshot });
  assert.deepEqual(errors, [], 'no page, console, request or HTTP errors');
  console.log(JSON.stringify({ result: 'pass', servedAt: prefix, canvas, beforeKey, afterKey,
    audio, errors, warnings, screenshot }, null, 2));
} catch (error) {
  console.error(error.message);
  if (errors.length) console.error(JSON.stringify(errors, null, 2));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
