// Writes every sprite sheet in public/assets/ as pixel art. Run: node tools/make_art.mjs [--preview]
import fs from 'node:fs';
import zlib from 'node:zlib';

const OUT = 'public/assets';
const PREVIEW = process.argv.includes('--preview');

const hex = (h, a = 255) => [(h >> 16) & 255, (h >> 8) & 255, h & 255, a];
const palette = JSON.parse(fs.readFileSync('tools/palette.json', 'utf8'));
const P = Object.fromEntries(Object.entries(palette).filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, hex(parseInt(v.slice(1), 16))]));

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8Array(w * h * 4);
  }
  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = c[3];
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    return this.d[i + 3] ? [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]] : null;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, c);
      }
  }
  blit(src, dx, dy, flip = false) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const c = src.get(flip ? src.w - 1 - x : x, y);
        if (c) this.set(dx + x, dy + y, c);
      }
  }
  outline(c) {
    const out = [];
    for (let y = -1; y <= this.h; y++)
      for (let x = -1; x <= this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) out.push([x, y]);
      }
    for (const [x, y] of out) this.set(x, y, c);
  }
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(img) {
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 4 + 1)] = 0;
    Buffer.from(img.d.buffer, y * img.w * 4, img.w * 4).copy(raw, y * (img.w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
function save(name, img) {
  fs.writeFileSync(`${OUT}/${name}.png`, png(img));
  if (PREVIEW) {
    const s = 4;
    const big = new Img(img.w * s, img.h * s);
    big.rect(0, 0, big.w, big.h, hex(0x2a2f38));
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const c = img.get(x, y); if (c) big.rect(x * s, y * s, s, s, c); }
    fs.mkdirSync('/tmp/art', { recursive: true });
    fs.writeFileSync(`/tmp/art/${name}.png`, png(big));
  }
}

// Sheet helper: cells of cw x ch, `cols` per row.
function sheet(cw, ch, cols, frames) {
  const rows = Math.ceil(frames.length / cols);
  const s = new Img(cw * cols, ch * rows);
  frames.forEach((f, i) => s.blit(f, (i % cols) * cw, Math.floor(i / cols) * ch));
  return s;
}

const bayer = (x, y) => (((x & 1) + (y & 1) * 2) / 4 - 0.375);

// ---------------------------------------------------------------- tiles
function concrete(seed, kind) {
  const r = mulberry(seed);
  const t = new Img(16, 16);
  t.rect(0, 0, 16, 16, P.n3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = r();
    if (v < 0.1) t.set(x, y, P.n2);
    else if (v > 0.93) t.set(x, y, P.n4);
  }
  for (let i = 0; i < 16; i++) { t.set(i, 0, P.n2); t.set(0, i, P.n2); }
  for (let i = 1; i < 15; i++) if (r() < 0.4) { t.set(i, 1, P.n4); t.set(1, i, P.n4); }
  if (kind === 'crack' || kind === 'crack2') {
    let x = 2 + Math.floor(r() * 10), y = 0;
    while (y < 16) {
      t.set(x, y, P.ink);
      if (r() < 0.5) t.set(x + 1, y, P.n1);
      y++;
      x += r() < 0.5 ? 0 : r() < 0.5 ? -1 : 1;
      x = Math.max(1, Math.min(14, x));
      if (kind === 'crack2' && y === 8) for (let b = 0; b < 5; b++) { t.set(x + b, y + (b >> 1), P.ink); }
    }
  }
  if (kind === 'wet') {
    for (let y = 3; y < 13; y++) for (let x = 2; x < 14; x++) {
      const d = Math.hypot(x - 8, y - 8);
      if (d < 5 + bayer(x, y) * 3) t.set(x, y, P.n1);
    }
    t.set(6, 6, P.n4); t.set(10, 9, P.n4);
  }
  if (kind === 'blood') {
    for (let y = 2; y < 14; y++) for (let x = 1; x < 14; x++) {
      const d = Math.hypot(x - 7, y - 8);
      if (d < 4.5 + bayer(x, y) * 3) t.set(x, y, d < 2.5 ? P.r2 : P.r1);
    }
    t.set(11, 12, P.r2); t.set(12, 13, P.r1);
  }
  return t;
}

function grate(seed, rusty) {
  const r = mulberry(seed);
  const t = new Img(16, 16);
  t.rect(0, 0, 16, 16, P.ink);
  for (let y = 0; y < 16; y += 4) { t.rect(0, y, 16, 2, P.n4); t.rect(0, y, 16, 1, P.n5); }
  for (let x = 0; x < 16; x += 8) t.rect(x, 0, 2, 16, P.n3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (t.get(x, y) && r() < 0.06) t.set(x, y, rusty ? P.rust3 : P.n2);
  if (rusty) for (let i = 0; i < 12; i++) t.set(Math.floor(r() * 16), Math.floor(r() * 16), P.rust2);
  return t;
}

function hazardFloor(flip) {
  const r = mulberry(31);
  const t = new Img(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = (flip ? x - y : x + y) & 7;
    t.set(x, y, d < 4 ? P.r3 : P.n1);
    if (r() < 0.14) t.set(x, y, P.n3);
  }
  return t;
}

function wallCap(seed, variant) {
  const r = mulberry(seed);
  const t = new Img(16, 16);
  t.rect(0, 0, 16, 16, P.n4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = r();
    if (v < 0.08) t.set(x, y, P.n3);
    else if (v > 0.94) t.set(x, y, P.n5);
  }
  for (let i = 0; i < 16; i++) { t.set(i, 0, P.n5); t.set(0, i, P.n3); t.set(15, i, P.n3); t.set(i, 15, P.n3); }
  for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { t.set(x, y, P.n6); t.set(x + 1, y + 1, P.n2); }
  if (variant === 1) for (let i = 0; i < 3; i++) t.rect(4 + i * 3, 5, 2, 7, P.n3);
  if (variant === 2) { t.rect(0, 7, 16, 2, P.r3); for (let x = 0; x < 16; x += 4) t.rect(x, 7, 2, 2, P.n1); }
  if (variant === 3) for (let i = 0; i < 9; i++) t.set(3 + Math.floor(r() * 10), 4 + Math.floor(r() * 8), P.rust3);
  return t;
}

function wallFace(seed, variant) {
  const r = mulberry(seed);
  const t = new Img(16, 16);
  t.rect(0, 0, 16, 14, P.n3);
  t.rect(0, 0, 16, 3, P.n5);
  t.rect(0, 0, 16, 1, P.n6);
  t.rect(0, 3, 16, 1, P.n2);
  for (let y = 4; y < 14; y++) for (let x = 0; x < 16; x++) if (r() < 0.07) t.set(x, y, P.n2);
  for (let y = 4; y < 14; y++) { t.set(0, y, P.n2); t.set(8, y, P.n2); }
  t.rect(0, 13, 16, 1, P.ink);
  for (const [x, y] of [[2, 5], [6, 5], [10, 5], [14, 5]]) { t.set(x, y, P.n5); t.set(x, y + 1, P.n2); }
  if (variant === 1) for (let i = 0; i < 3; i++) { const x = 2 + Math.floor(r() * 12); const h = 3 + Math.floor(r() * 6); for (let y = 5; y < 5 + h; y++) t.set(x, y, y > 5 + h - 3 ? P.rust3 : P.rust2); }
  if (variant === 2) {
    t.rect(0, 6, 16, 5, P.n2);
    t.rect(0, 6, 16, 1, P.n6); t.rect(0, 7, 16, 1, P.n5); t.rect(0, 8, 16, 2, P.n4); t.rect(0, 10, 16, 1, P.n1);
    t.rect(6, 5, 3, 7, P.n4); t.rect(6, 5, 1, 7, P.n6); t.rect(8, 5, 1, 7, P.n1);
    for (let x = 1; x < 16; x += 5) t.set(x, 8, P.rust3);
  }
  if (variant === 3) {
    t.rect(3, 5, 10, 7, P.n1);
    t.rect(3, 5, 10, 1, P.n5);
    for (let y = 6; y < 12; y += 2) t.rect(4, y, 8, 1, P.n4);
    t.rect(3, 5, 1, 7, P.n5); t.rect(12, 5, 1, 7, P.n2);
  }
  if (variant === 4) {
    t.rect(2, 5, 12, 8, P.ink);
    t.line(2, 5, 6, 8, P.n4); t.line(14, 5, 10, 9, P.n4);
    t.line(4, 12, 8, 9, P.r3); t.line(8, 9, 12, 12, P.rust4);
    t.set(8, 9, P.r5);
  }
  if (variant === 5) {
    for (let y = 5; y < 12; y++) for (let x = 0; x < 16; x++) t.set(x, y, ((x + y) & 7) < 4 ? P.r3 : P.n1);
    t.rect(0, 5, 16, 1, P.ink); t.rect(0, 11, 16, 1, P.ink);
  }
  return t;
}

const tileFrames = [
  concrete(1, 'plain'), concrete(2, 'plain'), concrete(3, 'plain'), concrete(4, 'plain'),
  grate(5, false), grate(6, true), concrete(7, 'crack'), concrete(8, 'crack2'),
  concrete(9, 'wet'), concrete(10, 'blood'), hazardFloor(false), hazardFloor(true),
  wallCap(11, 0), wallCap(12, 1), wallCap(13, 2), wallCap(14, 3),
  wallFace(15, 0), wallFace(16, 1), wallFace(17, 2), wallFace(18, 3), wallFace(19, 4), wallFace(20, 5),
];

// ---------------------------------------------------------------- shaded rig (characters)
// parts: {a:[x,y], b:[x,y], r0, r1, ramp:[dark,mid,light], z}. Painted in array order.
function rig(w, h, parts, edge = P.ink) {
  const img = new Img(w, h);
  const ids = new Int16Array(w * h).fill(-1);
  parts.forEach((p, idx) => {
    const x0 = Math.floor(Math.min(p.a[0], p.b[0]) - Math.max(p.r0, p.r1) - 1);
    const x1 = Math.ceil(Math.max(p.a[0], p.b[0]) + Math.max(p.r0, p.r1) + 1);
    const y0 = Math.floor(Math.min(p.a[1], p.b[1]) - Math.max(p.r0, p.r1) - 1);
    const y1 = Math.ceil(Math.max(p.a[1], p.b[1]) + Math.max(p.r0, p.r1) + 1);
    const abx = p.b[0] - p.a[0], aby = p.b[1] - p.a[1];
    const l2 = abx * abx + aby * aby;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const t = l2 ? Math.max(0, Math.min(1, ((x - p.a[0]) * abx + (y - p.a[1]) * aby) / l2)) : 0;
      const cx = p.a[0] + abx * t, cy = p.a[1] + aby * t;
      const r = p.r0 + (p.r1 - p.r0) * t;
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      const nx = (x - cx) / Math.max(r, 0.5), ny = (y - cy) / Math.max(r, 0.5);
      const lit = nx * -0.6 + ny * -0.8 + bayer(x, y) * 0.5;
      const c = lit > 0.42 ? p.ramp[2] : lit < -0.12 ? p.ramp[0] : p.ramp[1];
      img.set(x, y, c);
      ids[y * w + x] = idx;
    }
  });
  const inner = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = ids[y * w + x];
    if (a < 0) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const b = ids[ny * w + nx];
      if (b > a && parts[b].sep !== false) { inner.push([x, y, parts[a].ramp[0]]); break; }
    }
  }
  for (const [x, y, c] of inner) img.set(x, y, c);
  img.outline(edge);
  return img;
}

// ---------------------------------------------------------------- player
const SKIN = [P.bone2, P.bone, P.bone];
const JACKET = [P.n3, P.n5, P.n7];
const PANTS = [P.n1, P.n2, P.n2];
const BOOT = [P.n1, P.n1, P.n2];
const HAIR = [P.rust1, P.rust1, P.rust2];
const STRIPE = [P.n7, P.n7, P.n7];

function player(dir, frame) {
  const W = 16, H = 16, cx = 8, gy = 15.5;
  const phase = [0, 1, 0, -1][frame % 4];
  const walking = frame > 0;
  const bob = walking && phase === 0 ? -1 : 0;
  const proj = (u, v, h) => {
    if (dir === 'down') return [cx + v, gy + u * 0.5 - h + bob, u];
    if (dir === 'up') return [cx - v, gy - u * 0.5 - h + bob, -u];
    return [cx + u, gy + v * 0.5 - h + bob, v];
  };
  const J = proj;
  const parts = [];
  const sw = phase * 2.6;
  for (const s of [-1, 1]) {
    const lift = walking && (s > 0 ? phase > 0 : phase < 0) ? 1.3 : 0;
    const hip = J(0, s * 1.5, 4.2), foot = J(s > 0 ? sw : -sw, s * 1.7, 0.3 + lift);
    parts.push({ a: hip.slice(0, 2), b: foot.slice(0, 2), r0: 1.4, r1: 1.2, ramp: PANTS, z: hip[2] + (s > 0 ? 0.01 : 0) - 1 });
    parts.push({ a: foot.slice(0, 2), b: foot.slice(0, 2), r0: 1.5, r1: 1.5, ramp: BOOT, z: hip[2] - 0.5 });
  }
  const torsoA = J(0, 0, 4.6), torsoB = J(0, 0, 8);
  parts.push({ a: torsoA.slice(0, 2), b: torsoB.slice(0, 2), r0: 3.3, r1: 3.4, ramp: JACKET, z: 0 });
  const stripeA = J(-3.1, -2.4, 6.8), stripeB = J(-3.1, 2.4, 6.8);
  parts.push({ a: stripeA.slice(0, 2), b: stripeB.slice(0, 2), r0: 0.8, r1: 0.8, ramp: STRIPE, z: -3.1, sep: false });
  const head = J(0.5, 0, 10.4);
  parts.push({ a: head.slice(0, 2), b: head.slice(0, 2), r0: 3, r1: 3, ramp: SKIN, z: 1 });
  const hairc = J(-0.5, 0, 11.2);
  parts.push({ a: hairc.slice(0, 2), b: hairc.slice(0, 2), r0: 2.8, r1: 2.8, ramp: HAIR, z: dir === 'up' ? 3 : -1, sep: false });
  const armSw = -sw * 0.8;
  for (const s of [-1, 1]) {
    const sh = J(0, s * 3.9, 7.6), hand = J(s > 0 ? armSw : -armSw, s * 4.3, 4.6);
    parts.push({ a: sh.slice(0, 2), b: hand.slice(0, 2), r0: 1.2, r1: 1.1, ramp: JACKET, z: sh[2] + (s > 0 ? 0.2 : -0.2) });
  }
  parts.sort((p, q) => p.z - q.z);
  const img = rig(W, H, parts, P.n1);
  if (dir === 'down') { img.set(Math.round(head[0] - 1.2), Math.round(head[1] + 0.6), P.n1); img.set(Math.round(head[0] + 1.2), Math.round(head[1] + 0.6), P.n1); }
  if (dir === 'right') img.set(Math.round(head[0] + 1.8), Math.round(head[1] + 0.4), P.n1);
  return img;
}

// ---------------------------------------------------------------- creature
const FLESH = [P.g2, P.g3, P.g4];
const FLESH_D = [P.g1, P.g2, P.g3];
const BONE = [P.bone2, P.bone, P.bone];
const SPIKE = [P.g1, P.g3, P.bone2];
const MAW = [P.r2, P.r2, P.r2];

// pose: lean, crouch, reach, spread, jaw, swing, lunge, curl, flare
function creature(dir, pose) {
  const W = 32, H = 32, cx = 16, gy = 24;
  const o = { lean: 0, crouch: 0, reach: 5, spread: 0, jaw: 0.2, swing: 0, lunge: 0, curl: 0, flare: 0, eyes: 1, ...pose };
  const proj = (u, v, h) => {
    if (dir === 'down') return [cx + v, gy + u * 0.55 - h * 0.95, u];
    if (dir === 'up') return [cx - v, gy - u * 0.55 - h * 0.95, -u];
    return [cx - 2 + u, gy + v * 0.5 - h * 0.95, v];
  };
  const J = (u, v, h) => proj(u, v, h);
  const parts = [];
  const add = (a, b, r0, r1, ramp, z, sep) => parts.push({ a: a.slice(0, 2), b: b.slice(0, 2), r0, r1, ramp, z, sep });
  const c = o.crouch;
  const pelvis = J(-6 + o.lean * 0.5, 0, 6.5 - 3 * c);
  const chest = J(2 + o.lean + o.lunge * 2, 0, 9 - 4.5 * c - o.curl * 2);
  const neck = J(6 + o.lean + o.lunge * 3, 0, 9.5 - 3.5 * c - o.curl);
  const head = J(10.5 + o.lean + o.lunge * 4, 0, 9.2 - 3.5 * c - o.curl * 1.5);
  // legs: thin and wrong, knees bent backwards
  for (const s of [-1, 1]) {
    const hip = J(-6, s * 3.5, 5.5 - 3 * c);
    const sw = (s > 0 ? o.swing : -o.swing) * 2.6;
    const knee = J(-9 + sw * 0.4 - o.lunge * 2, s * (6.5 + o.spread * 0.6), 4 - c);
    const foot = J(-6.5 + sw - o.lunge * 4, s * (7 + o.spread * 0.8), 0.3);
    add(hip, knee, 1.7, 1.2, FLESH_D, hip[2] - 3 + (s > 0 ? 0.1 : 0));
    add(knee, foot, 1.2, 0.9, FLESH_D, hip[2] - 3 + (s > 0 ? 0.2 : 0.1));
  }
  // spine spikes along the back
  const spikes = [];
  for (let i = 0; i < 5; i++) {
    const u = -7 + i * 2.8 + o.lean * (i / 4);
    const top = 9.5 - 4.5 * c - o.curl * 2 + 2.8 - Math.abs(i - 2) * 0.6;
    const base = J(u, 0, top - 1.3), tip = J(u - 0.6, 0, top + 3 + o.flare * 3 - Math.abs(i - 2) * 0.3);
    spikes.push({ a: base.slice(0, 2), b: tip.slice(0, 2), r0: 1.3, r1: 0.1, ramp: SPIKE, z: -1 - base[2] * 0 + (dir === 'up' ? 6 : -6) });
  }
  add(pelvis, chest, 4.1, 3.3, FLESH, 0);
  parts[parts.length - 1].z = 0;
  // ribs
  const rib = (k) => {
    const a = J(-3 + k * 2.6, -2.8, 9 - 4.5 * c), b = J(-3 + k * 2.6, 2.8, 9 - 4.5 * c);
    return { a: a.slice(0, 2), b: b.slice(0, 2), r0: 0.5, r1: 0.5, ramp: [P.ink, FLESH[0], FLESH[0]], z: 0.5, sep: false };
  };
  const ribs = dir === 'right' ? [] : [rib(0), rib(1), rib(2)];
  // arms, long, knuckles down
  const armParts = [];
  const clawPix = [];
  for (const s of [-1, 1]) {
    const sh = J(2 + o.lean, s * 4.2, 9 - 4.5 * c - o.curl * 2);
    const el = J(4 + o.lean + o.reach * 0.35, s * (7 + o.spread), 5.2 - 2 * c);
    const hand = J(5 + o.lean + o.reach + o.lunge * 4, s * (7.5 + o.spread * 1.3), 0.6 + o.curl);
    armParts.push({ a: sh.slice(0, 2), b: el.slice(0, 2), r0: 1.9, r1: 1.3, ramp: FLESH, z: sh[2] + (s > 0 ? 0.3 : -0.3) });
    armParts.push({ a: el.slice(0, 2), b: hand.slice(0, 2), r0: 1.3, r1: 1, ramp: FLESH, z: sh[2] + (s > 0 ? 0.4 : -0.2) });
    for (const k of [-1, 0, 1]) clawPix.push({ from: hand, to: J(5 + o.lean + o.reach + o.lunge * 4 + 3.4, s * (7.5 + o.spread * 1.3) + k * 1.6, 0.4), z: sh[2] + 0.5 });
  }
  const neckPart = { a: chest.slice(0, 2), b: neck.slice(0, 2), r0: 2.4, r1: 2, ramp: FLESH, z: 1 };
  const skull = { a: head.slice(0, 2), b: head.slice(0, 2), r0: 4.6, r1: 4.6, ramp: FLESH, z: 2 };
  const jawEnd = J(10.5 + o.lean + o.lunge * 4 + 2.5, 0, 9.2 - 3.5 * c - o.curl * 1.5 - 1 - o.jaw * 4.5);
  const jaw = { a: head.slice(0, 2), b: jawEnd.slice(0, 2), r0: 2.6, r1: 2.2, ramp: MAW, z: 1.5 };
  const horns = [];
  for (const s of [-1, 1]) {
    const hb = J(9 + o.lean + o.lunge * 4, s * 3, 12 - 3.5 * c - o.curl * 1.5);
    const ht = J(7 + o.lean + o.lunge * 4, s * 5.2, 15.5 - 3.5 * c - o.curl * 1.5 + o.flare * 2);
    horns.push({ a: hb.slice(0, 2), b: ht.slice(0, 2), r0: 1.2, r1: 0.1, ramp: BONE, z: 2.5 });
  }
  const bodyAll = [...parts, ...spikes, ...ribs, ...armParts, neckPart, jaw, skull, ...horns];
  bodyAll.sort((p, q) => p.z - q.z);
  const img = rig(W, H, bodyAll, P.g1);
  for (const cl of clawPix) img.line(cl.from[0], cl.from[1], cl.to[0], cl.to[1], P.bone);
  // eyes and teeth are painted last, on top of the silhouette
  if (dir !== 'up') {
    const e = (s) => J(10.5 + o.lean + o.lunge * 4 + (dir === 'right' ? 3.3 : 3.8), s * (dir === 'right' ? 1.5 : 2.2), 9.2 - 3.5 * c - o.curl * 1.5 + 1.4);
    const eyeC = o.eyes > 1 ? P.g5 : P.g5;
    for (const s of dir === 'right' ? [1] : [-1, 1]) {
      const ee = e(s);
      img.set(ee[0], ee[1], eyeC);
      if (o.eyes > 1) { img.set(ee[0] + 1, ee[1], P.g5); img.set(ee[0], ee[1] + 1, P.g4); }
    }
    const t0 = J(10.5 + o.lean + o.lunge * 4 + 3.8, -2.4, 9.2 - 3.5 * c - o.curl * 1.5 - 0.5 - o.jaw * 1.6);
    if (o.jaw > 0.4) for (let k = 0; k < 5; k++) img.set(t0[0] + (dir === 'right' ? 0 : k), t0[1] + (dir === 'right' ? k - 2 : 0), P.bone);
  }
  return img;
}

const POSES = {
  stalk: [
    { swing: 0, reach: 5, jaw: 0.2 },
    { swing: 1, reach: 6, jaw: 0.25, lean: 0.5 },
    { swing: 0, reach: 5, jaw: 0.2 },
    { swing: -1, reach: 6, jaw: 0.25, lean: 0.5 },
  ],
  windup: [
    { crouch: 0.55, spread: 2, reach: 3, jaw: 0.6, flare: 0.5, eyes: 2 },
    { crouch: 0.8, spread: 3, reach: 2, jaw: 0.9, flare: 1, eyes: 2, lean: -1 },
    { crouch: 1, spread: 3.5, reach: 1, jaw: 1, flare: 1.4, eyes: 2, lean: -1.5 },
  ],
  lunge: [
    { lunge: 1, reach: 8, jaw: 1, swing: 1, flare: -0.5, eyes: 2, lean: 1 },
    { lunge: 1.2, reach: 9, jaw: 1, swing: -1, flare: -0.5, eyes: 2, lean: 1.5 },
  ],
  recoil: [
    { curl: 1, crouch: 0.5, jaw: 0.8, reach: 2, spread: 1, flare: 1.5, lean: -1.5 },
    { curl: 1.4, crouch: 0.7, jaw: 1, reach: 1, spread: 2, flare: 1.2, lean: -2 },
  ],
};

const creatureFrames = [];
for (const dir of ['down', 'up', 'right']) {
  for (const k of ['stalk', 'windup', 'lunge', 'recoil']) for (const p of POSES[k]) creatureFrames.push(creature(dir, p));
}
// death: collapses to the floor, eyes out
const deathPoses = [
  { crouch: 0.9, curl: 1.2, jaw: 1, reach: 1, spread: 2, eyes: 1, lean: -2 },
  { crouch: 1.3, curl: 1.8, jaw: 0.8, reach: 0, spread: 3, eyes: 0, lean: -2.5, flare: 0 },
  { crouch: 1.6, curl: 2.4, jaw: 0.4, reach: -1, spread: 4, eyes: 0, lean: -3, flare: -1 },
  { crouch: 1.8, curl: 2.8, jaw: 0.2, reach: -1, spread: 4.5, eyes: 0, lean: -3, flare: -1 },
];
for (const p of deathPoses) {
  const f = creature('down', p);
  // dead eyes: clear the glow pixels
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const c = f.get(x, y); if (c && (c[0] === P.g5[0] && c[1] === P.g5[1] && c[2] === P.g5[2])) f.set(x, y, P.g1); }
  creatureFrames.push(f);
}
// sleeping: curled up
creatureFrames.push(creature('down', { crouch: 1, curl: 1.5, jaw: 0.1, reach: 1, spread: 2, eyes: 1, lean: -2 }));

// ---------------------------------------------------------------- props
function crate(w, h, top, seed) {
  const r = mulberry(seed);
  const t = new Img(32, 32);
  const x0 = Math.floor((32 - w) / 2), y0 = 32 - h - 3;
  t.rect(x0, y0 + top, w, h - top, P.rust2);
  t.rect(x0, y0, w, top, P.rust3);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (r() < 0.12) t.set(x, y, y < y0 + top ? P.rust2 : P.rust1);
  for (let x = x0; x < x0 + w; x += 5) t.rect(x, y0 + top, 1, h - top, P.rust1);
  t.rect(x0, y0 + top, w, 1, P.rust1);
  t.rect(x0, y0 + h - 2, w, 2, P.rust1);
  t.rect(x0, y0, w, 1, P.rust4);
  t.line(x0 + 1, y0 + 1, x0 + w - 2, y0 + top - 1, P.rust2);
  t.line(x0 + w - 2, y0 + 1, x0 + 1, y0 + top - 1, P.rust2);
  t.outline(P.ink);
  return t;
}

function barrel(toxic) {
  const t = new Img(32, 32);
  const body = [P.rust2, P.rust3, P.rust4];
  const base = toxic ? [P.g1, P.g2, P.g3] : [P.n2, P.n4, P.n6];
  t.ellipse(16, 25, 6, 2.5, base[0]);
  t.rect(10, 13, 13, 12, base[1]);
  t.rect(10, 13, 3, 12, base[2]);
  t.rect(20, 13, 3, 12, base[0]);
  t.ellipse(16, 13, 6.5, 3, base[2]);
  t.ellipse(16, 13, 4.5, 2, base[1]);
  t.rect(10, 17, 13, 1, base[0]);
  t.rect(10, 22, 13, 1, base[0]);
  if (toxic) { t.rect(14, 15, 5, 3, P.g4); t.set(16, 16, P.g5); for (let y = 18; y < 25; y++) if (y % 3) t.set(12, y, P.g4); }
  else for (const [x, y] of [[12, 19], [19, 15], [15, 21], [21, 23]]) t.set(x, y, body[1]);
  t.outline(P.ink);
  return t;
}

function locker() {
  const t = new Img(32, 32);
  t.rect(9, 4, 14, 24, P.n4);
  t.rect(9, 4, 14, 3, P.n6);
  t.rect(9, 4, 1, 24, P.n5);
  t.rect(22, 4, 1, 24, P.n2);
  t.rect(11, 9, 10, 8, P.n3); t.rect(11, 19, 10, 7, P.n3);
  for (let i = 0; i < 4; i++) t.rect(13, 10 + i * 2, 6, 1, P.n1);
  t.rect(19, 21, 2, 1, P.n7);
  t.line(12, 20, 17, 25, P.rust3); t.set(14, 22, P.rust4);
  t.rect(9, 26, 14, 2, P.n1);
  t.outline(P.ink);
  return t;
}

function generator() {
  const t = new Img(32, 32);
  t.rect(2, 8, 28, 20, P.n3);
  t.rect(2, 8, 28, 4, P.n5);
  t.rect(2, 8, 28, 1, P.n6);
  t.rect(2, 26, 28, 2, P.n1);
  for (const x of [6, 18]) { t.ellipse(x + 4, 20, 5, 5, P.n1); t.ellipse(x + 4, 20, 3.5, 3.5, P.n2); t.line(x + 1, 20, x + 7, 20, P.n4); t.line(x + 4, 17, x + 4, 23, P.n4); }
  t.rect(25, 14, 3, 2, P.r4); t.set(26, 14, P.r5);
  t.rect(4, 14, 1, 10, P.n2);
  t.rect(2, 12, 28, 1, P.n2);
  t.outline(P.ink);
  return t;
}

function bench() {
  const t = new Img(32, 32);
  t.rect(2, 14, 28, 6, P.n4);
  t.rect(2, 14, 28, 1, P.n6);
  t.rect(2, 20, 28, 2, P.n2);
  t.rect(4, 22, 2, 5, P.n2); t.rect(26, 22, 2, 5, P.n2);
  t.rect(7, 10, 5, 4, P.rust3); t.rect(7, 10, 5, 1, P.rust4);
  t.rect(16, 11, 3, 3, P.n6); t.line(20, 12, 25, 10, P.n7);
  t.set(23, 13, P.r4);
  t.outline(P.ink);
  return t;
}

function drainProp() {
  const t = new Img(32, 32);
  t.ellipse(16, 16, 7, 5, P.ink);
  t.ellipse(16, 16, 6, 4, P.n1);
  for (let x = -4; x <= 4; x += 2) t.line(16 + x, 13, 16 + x, 19, P.n4);
  t.line(10, 16, 22, 16, P.n3);
  return t;
}

function deadLamp(frame) {
  const t = new Img(32, 32);
  t.rect(10, 12, 12, 6, P.n3);
  t.rect(10, 12, 12, 1, P.n6);
  t.rect(11, 14, 10, 3, frame === 1 ? P.r3 : P.ink);
  if (frame === 1) { t.rect(12, 15, 8, 1, P.r4); t.set(16, 15, P.r5); }
  else { t.line(12, 14, 15, 16, P.n2); t.line(19, 14, 17, 16, P.n2); }
  t.outline(P.ink);
  return t;
}

function skull() {
  const t = new Img(32, 32);
  t.ellipse(16, 15, 4.5, 4, P.bone);
  t.rect(13, 18, 6, 3, P.bone2);
  t.rect(13, 14, 2, 2, P.ink); t.rect(17, 14, 2, 2, P.ink);
  t.set(16, 17, P.ink);
  for (let x = 13; x < 19; x += 2) t.set(x, 20, P.ink);
  t.ellipse(23, 22, 3, 1.5, P.bone2);
  t.line(6, 22, 11, 24, P.bone); t.line(8, 25, 13, 23, P.bone2);
  t.outline(P.ink);
  return t;
}

function toolchest() {
  const t = new Img(32, 32);
  t.rect(7, 17, 18, 9, P.rust3);
  t.rect(7, 17, 18, 3, P.rust4);
  t.rect(7, 24, 18, 2, P.rust2);
  t.rect(7, 20, 18, 1, P.rust1);
  t.rect(14, 15, 5, 2, P.n6); t.rect(14, 15, 1, 3, P.n7);
  t.rect(10, 21, 2, 2, P.n5); t.rect(21, 21, 2, 2, P.n5);
  t.outline(P.ink);
  return t;
}

const propFrames = [
  crate(24, 20, 9, 1), crate(16, 15, 7, 2), barrel(false), barrel(true), locker(), generator(), bench(), drainProp(), deadLamp(0), deadLamp(1), skull(), toolchest(),
];

// ---------------------------------------------------------------- decals
function decal(kind, seed) {
  const r = mulberry(seed);
  const t = new Img(16, 16);
  if (kind === 'blood') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 8);
      const n = (r() - 0.5) * 3;
      if (d + n < 5) t.set(x, y, d < 2.5 ? P.r2 : P.r1);
    }
    for (let i = 0; i < 4; i++) t.set(Math.floor(r() * 16), Math.floor(r() * 16), P.r1);
  }
  if (kind === 'drag') {
    let x = 0, y = 6 + Math.floor(r() * 4);
    while (x < 16) { t.set(x, y, P.r1); t.set(x, y + 1, P.r2); if (r() < 0.35) y += r() < 0.5 ? -1 : 1; y = Math.max(2, Math.min(13, y)); x++; }
  }
  if (kind === 'debris') {
    for (let i = 0; i < 9; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 14); t.rect(x, y, 1 + Math.floor(r() * 2), 1, r() < 0.5 ? P.n5 : P.n3); t.set(x, y + 1, P.ink); }
  }
  if (kind === 'paper') {
    t.rect(4, 5, 6, 7, P.n7); t.rect(4, 5, 6, 1, P.w);
    for (let y = 7; y < 11; y += 2) t.rect(5, y, 4, 1, P.n5);
    t.line(4, 12, 9, 12, P.n1);
  }
  if (kind === 'rustdrip') {
    for (let i = 0; i < 4; i++) { const x = 2 + i * 3 + Math.floor(r() * 2); const len = 4 + Math.floor(r() * 9); for (let y = 0; y < len; y++) t.set(x, y, y > len - 3 ? P.rust3 : P.rust2); }
  }
  if (kind === 'puddle') {
    t.ellipse(8, 9, 6, 3.5, P.n1);
    t.ellipse(8, 9, 4, 2, P.ink);
    t.set(5, 8, P.n5); t.set(6, 8, P.n4); t.set(11, 10, P.n5);
  }
  if (kind === 'slime') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 8, y - 8) + (r() - 0.5) * 3;
      if (d < 4.5) t.set(x, y, d < 2 ? P.g3 : P.g2);
    }
    t.set(7, 7, P.g4);
  }
  if (kind === 'cable') {
    for (let x = 0; x < 16; x++) { const y = 8 + Math.round(Math.sin(x / 2.2) * 2.5); t.set(x, y, P.ink); t.set(x, y - 1, P.n3); }
  }
  return t;
}

const decalFrames = [
  decal('blood', 1), decal('blood', 2), decal('blood', 3), decal('drag', 4), decal('drag', 5), decal('debris', 6), decal('debris', 7), decal('paper', 8),
  decal('rustdrip', 9), decal('puddle', 10), decal('slime', 11), decal('cable', 12),
];

// ---------------------------------------------------------------- lamps, breakers, ui, fx
function lamp(level) {
  const t = new Img(16, 16);
  // floor fixture: small caged ring, lit frames add a ring of sparks
  t.ellipse(8, 8, 4.5, 4.5, P.n3);
  t.ellipse(8, 8, 3.6, 3.6, P.n5);
  t.ellipse(8, 8, 2.6, 2.6, P.n2);
  t.set(4, 8, P.n6); t.set(12, 8, P.n6); t.set(8, 4, P.n6); t.set(8, 12, P.n6);
  const cols = [P.n2, P.c3, P.c2, P.w];
  t.ellipse(8, 8, 1.6, 1.6, cols[level]);
  if (level >= 2) { t.set(8, 3, P.c1); t.set(8, 13, P.c1); t.set(3, 8, P.c1); t.set(13, 8, P.c1); }
  if (level === 3) for (const [x, y] of [[5, 5], [11, 5], [5, 11], [11, 11]]) t.set(x, y, P.c1);
  return t;
}

function breaker(state, dent) {
  const t = new Img(36, 28);
  t.rect(0, 0, 36, 28, P.n3);
  t.rect(0, 0, 36, 1, P.n6); t.rect(0, 0, 1, 28, P.n5); t.rect(35, 0, 1, 28, P.n1); t.rect(0, 27, 36, 1, P.ink);
  t.rect(1, 1, 34, 7, state === 2 ? P.n2 : state === 1 ? P.r1 : state === 3 ? P.n6 : P.r2);
  t.rect(1, 1, 34, 1, state === 2 ? P.n3 : state === 3 ? P.w : P.r3);
  t.rect(3, 2, 14, 5, P.n1);
  t.rect(21, 2, 7, 5, P.ink);
  const up = state !== 2;
  t.rect(22 + (up ? 4 : 0), 3, 2, 3, up ? P.n7 : P.n5);
  t.rect(30, 2, 4, 5, P.ink);
  const lampC = state === 0 ? P.r4 : state === 1 ? P.r2 : state === 3 ? P.w : P.n1;
  t.rect(31, 3, 2, 3, lampC);
  if (state === 2) { t.set(31, 3, P.n3); t.set(32, 5, P.n3); }
  t.rect(2, 9, 32, 18, P.ink);
  t.rect(3, 10, 30, 16, P.n2);
  t.rect(2, 9, 32, 1, P.n3);
  for (const [x, y] of [[1, 2], [34, 2], [1, 26], [34, 26]]) t.set(x, y, P.n6);
  if (dent) { t.line(25, 0, 35, 9, P.n1); t.line(26, 0, 35, 8, P.n2); t.set(27, 1, P.n6); t.set(33, 8, P.n6); }
  if (state === 2) { t.line(4, 11, 31, 24, P.n2); t.line(10, 10, 6, 25, P.ink); }
  return t;
}

function door(open) {
  const t = new Img(32, 16);
  t.rect(0, 0, 32, 15, P.n4);
  t.rect(0, 0, 32, 2, P.n6);
  t.rect(0, 14, 32, 1, P.ink);
  for (let x = 0; x < 4; x++) for (let y = 3; y < 14; y++) { t.set(x, y, ((x + y) & 3) < 2 ? P.r3 : P.n1); t.set(31 - x, y, ((x + y) & 3) < 2 ? P.r3 : P.n1); }
  t.rect(5, 3, 22, 11, P.n2);
  t.rect(5, 3, 22, 1, P.n3);
  if (open) {
    t.rect(8, 4, 16, 10, P.warm);
    t.rect(10, 6, 12, 8, P.warm2);
    t.rect(8, 4, 16, 1, P.ink); t.rect(8, 4, 1, 10, P.ink); t.rect(23, 4, 1, 10, P.ink);
  } else {
    t.rect(15, 3, 2, 11, P.ink);
    for (const x of [7, 24]) for (const y of [5, 10]) { t.set(x, y, P.n6); t.set(x + 1, y + 1, P.n1); }
    t.rect(14, 6, 4, 3, P.ink); t.rect(15, 7, 2, 1, P.r4);
  }
  return t;
}

const breakerFrames = [];
for (const dent of [false, true]) for (let s = 0; s < 4; s++) breakerFrames.push(breaker(s, dent));

function pip(state) {
  const t = new Img(9, 9);
  t.rect(0, 0, 9, 9, P.ink);
  if (state === 0) { t.rect(1, 1, 7, 7, P.r3); t.rect(1, 1, 7, 2, P.r4); t.rect(1, 1, 7, 1, P.r5); t.rect(1, 7, 7, 1, P.r2); }
  if (state === 1) { t.rect(1, 1, 7, 7, P.n1); t.rect(1, 1, 7, 1, P.n2); t.rect(1, 7, 7, 1, P.r1); }
  if (state === 2) { t.rect(1, 1, 7, 7, P.w); }
  return t;
}

function bolt(full) {
  const t = new Img(9, 11);
  const c = full ? P.w : P.n3, e = full ? P.c2 : P.n1;
  const pts = [[5, 0], [3, 4], [5, 4], [3, 10], [7, 5], [5, 5], [7, 0]];
  const mask = new Img(9, 11);
  mask.line(5, 0, 2, 5, c); mask.line(6, 0, 3, 5, c); mask.line(2, 5, 6, 5, c); mask.line(3, 6, 7, 6, c); mask.line(6, 5, 3, 10, c); mask.line(7, 5, 4, 10, c);
  t.blit(mask, 0, 0);
  t.outline(e);
  void pts;
  return t;
}

const uiFrames = [pip(0), pip(1), pip(2), bolt(true), bolt(false)];

function shadow(w, h) {
  const t = new Img(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5 - w / 2) / (w / 2), ny = (y + 0.5 - h / 2) / (h / 2);
    const d = nx * nx + ny * ny;
    if (d <= 1 && (d < 0.4 || (x + y) % 2 === 0)) t.set(x, y, P.ink);
  }
  return t;
}

// ---------------------------------------------------------------- write
fs.mkdirSync(OUT, { recursive: true });
save('tiles', sheet(16, 16, 8, tileFrames));
save('decals', sheet(16, 16, 6, decalFrames));
save('props', sheet(32, 32, 6, propFrames));
save('lamp', sheet(16, 16, 4, [0, 1, 2, 3].map(lamp)));
save('breaker', sheet(36, 28, 4, breakerFrames));
save('door', sheet(32, 16, 2, [door(false), door(true)]));
save('ui', sheet(9, 11, 5, uiFrames.map((f) => { const c = new Img(9, 11); c.blit(f, 0, 0); return c; })));
save('shadow', sheet(24, 10, 2, [shadow(12, 5), shadow(24, 9)].map((f) => { const c = new Img(24, 10); c.blit(f, 0, 0); return c; })));
const playerFrames = [];
for (const dir of ['down', 'up', 'right']) for (let f = 0; f < 5; f++) playerFrames.push(player(dir, f));
save('player', sheet(16, 16, 5, playerFrames));
save('creature', sheet(32, 32, 11, creatureFrames));
console.log('frames: tiles', tileFrames.length, 'props', propFrames.length, 'creature', creatureFrames.length);

const atlas = {
  sheets: {
    tiles: { frame: [16, 16], cols: 8, floor: [0, 1, 2, 3], grate: [4, 5], crack: [6, 7], wet: 8, blood: 9, hazard: [10, 11], cap: [12, 13, 14, 15], face: [16, 17, 18, 19, 20, 21] },
    decals: { frame: [16, 16], cols: 6, blood: [0, 1, 2], drag: [3, 4], debris: [5, 6], paper: 7, rustdrip: 8, puddle: 9, slime: 10, cable: 11 },
    props: { frame: [32, 32], cols: 6, crate_a: 0, crate_b: 1, barrel: 2, barrel_toxic: 3, locker: 4, generator: 5, bench: 6, drain: 7, lamp_dead: 8, lamp_flicker: 9, skull: 10, toolchest: 11, relaxed: true },
    lamp: { frame: [16, 16], cols: 4, levels: [0, 1, 2, 3] },
    door: { frame: [32, 16], cols: 2, closed: 0, open: 1 },
    breaker: { frame: [36, 28], cols: 4, states: { ready: 0, cooling: 1, offline: 2, busy: 3 }, dentOffset: 4 },
    ui: { frame: [9, 11], cols: 5, pip: { full: 0, empty: 1, flash: 2 }, bolt: { full: 3, empty: 4 } },
    shadow: { frame: [24, 10], cols: 2, player: 0, creature: 1 },
    player: { frame: [16, 16], cols: 5, anchor: [8, 14], dirs: { down: 0, up: 5, right: 10 }, idle: 0, walk: [1, 2, 3, 4] },
    creature: {
      frame: [32, 32], cols: 11, anchor: [16, 24], dirs: { down: 0, up: 11, right: 22 },
      anims: { stalk: [0, 1, 2, 3], windup: [4, 5, 6], lunge: [7, 8], recoil: [9, 10] }, death: [33, 34, 35, 36], sleep: 37, relaxed: true,
    },
  },
};
fs.writeFileSync(`${OUT}/atlas.json`, JSON.stringify(atlas, null, 1));
