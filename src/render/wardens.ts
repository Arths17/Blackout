// The first four bosses: the Thornwood wardens, drawn from scratch in code. Each is a 6 x 4 sheet of
// 64 px frames using the same frame numbers as the final boss's sheet:
//   0-5 walk / idle   6-7 recoil   12-14 windup   18-19 lunge   18-21 falling apart when it dies.
// They are meant to look gentle and a little sad, and share one design: a tree, a dark hollow face and
// yellow eyes. A few glowing yellow spores on the bark show how far the Rot has got, from one on Oren
// up to the four on Kesh. The fifth boss, Ysolde, keeps the hand-made sprite.

const F = 64;
const FEET = 52;
const INK = '#0e1218';
const EYE = '#ffe45c';
const EYE_HI = '#fff8c4';
const SPORE = '#f4e04d';

interface Spec {
  trunkW: number;
  trunkH: number;
  flare: number;
  bark: [string, string, string]; // shade, body, light
  leaf: [string, string, string, string]; // dark, body, light, glint
  canopy: [number, number, number, number][]; // blobs: dx, dy, rx, ry, around the top of the trunk
  droop?: number[]; // hanging strands: x offsets from the trunk centre
  armStyle: 'stubs' | 'thin' | 'bare' | 'roots';
  armLeaves: boolean;
  bigRoots?: boolean;
  marks: 'none' | 'birch' | 'scorch' | 'moss';
  spores: number;
  hollow: { w: number; h: number; y: number };
}

const SPECS: Spec[] = [
  // Oren: a broad old oak with a big friendly hollow
  { trunkW: 20, trunkH: 22, flare: 6, bark: ['#3d2a1a', '#5f4229', '#86613a'],
    leaf: ['#244a26', '#3f7a35', '#6aa94a', '#9bd568'],
    canopy: [[0, -3, 17, 11], [-12, 3, 9, 7], [12, 3, 9, 7], [0, -10, 10, 6]],
    armStyle: 'stubs', armLeaves: true, marks: 'none', spores: 1, hollow: { w: 12, h: 11, y: 5 } },
  // Mab: a slim white birch that droops like a willow, because she sang to the saplings
  { trunkW: 11, trunkH: 30, flare: 3, bark: ['#aaa391', '#d6d0bf', '#f1ecdd'],
    leaf: ['#456c45', '#6f9d58', '#a2c978', '#d0e898'],
    canopy: [[0, -2, 12, 8], [-9, 4, 7, 6], [9, 4, 7, 6]], droop: [-14, -9, 9, 14, -4, 4],
    armStyle: 'thin', armLeaves: true, marks: 'birch', spores: 2, hollow: { w: 8, h: 8, y: 8 } },
  // Vael: scorched by his own fire, but the leaves turned autumn gold instead of dying
  { trunkW: 16, trunkH: 26, flare: 5, bark: ['#241d19', '#3f3229', '#65503f'],
    leaf: ['#7a3216', '#bf5a26', '#e58d2e', '#f7c85c'],
    canopy: [[0, -2, 14, 9], [-10, 4, 8, 6], [10, 3, 8, 6], [2, -9, 8, 5]],
    armStyle: 'bare', armLeaves: false, marks: 'scorch', spores: 3, hollow: { w: 10, h: 10, y: 6 } },
  // Kesh: holds the roots together, so his roots are his legs and arms
  { trunkW: 18, trunkH: 17, flare: 9, bark: ['#2f2c1f', '#4e4630', '#74683f'],
    leaf: ['#244a35', '#3a7650', '#5da46a', '#90d08c'],
    canopy: [[0, -1, 16, 9], [-11, 3, 8, 7], [11, 3, 8, 7]],
    armStyle: 'roots', armLeaves: false, bigRoots: true, marks: 'moss', spores: 4, hollow: { w: 11, h: 9, y: 4 } },
];

interface Pose {
  bob: number; // body lifted this many px
  lean: number; // canopy shifted forward, trunk bends to follow
  squash: number; // 1 is full height
  arms: number; // 0 down .. 1 raised
  swing: number; // arm / root step, -1..1
  eyes: 0 | 1 | 2; // closed, squinting, open
  dead: number; // 0 alive, 1 slumped, 2 collapsed
}

const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

// A filled pixel ellipse with a lit upper-left and a shaded lower-right, outlined in ink.
function blob(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, cols: [string, string, string, string], outline = true): void {
  const rows = (ox: number, oy: number, rrx: number, rry: number, col: string): void => {
    for (let y = -rry; y <= rry; y++) {
      const half = Math.round(rrx * Math.sqrt(Math.max(0, 1 - (y * y) / (rry * rry + 0.01))));
      rect(c, cx + ox - half, cy + oy + y, half * 2 + 1, 1, col);
    }
  };
  if (outline) rows(0, 0, rx + 1, ry + 1, INK);
  rows(0, 0, rx, ry, cols[0]);
  rows(-1, -1, rx - 1.5, ry - 1.5, cols[1]);
  rows(-2, -2, rx * 0.55, ry * 0.5, cols[2]);
  rect(c, cx - rx * 0.4, cy - ry * 0.55, 2, 1, cols[3]);
}

export function drawWarden(index: number, f: number): { canvas: HTMLCanvasElement; eyes: [number, number][] } {
  const canvas = document.createElement('canvas');
  canvas.width = F;
  canvas.height = F;
  const c = canvas.getContext('2d')!;
  const eyes: [number, number][] = [];
  const s = SPECS[index];
  const p = poseFor(f);
  paint(c, s, p, eyes);
  return { canvas, eyes };
}

function poseFor(f: number): Pose {
  const base: Pose = { bob: 0, lean: 0, squash: 1, arms: 0.1, swing: 0, eyes: 2, dead: 0 };
  if (f <= 5) {
    const ph = (f / 6) * Math.PI * 2;
    return { ...base, bob: Math.sin(ph * 2) > 0.2 ? 1 : 0, lean: Math.round(Math.sin(ph)), swing: Math.sin(ph), arms: 0.1 + 0.1 * Math.sin(ph + 1) };
  }
  if (f === 6) return { ...base, lean: -5, squash: 0.9, arms: 0.8, eyes: 1 };
  if (f === 7) return { ...base, lean: -3, squash: 0.94, arms: 0.6, eyes: 1 };
  if (f >= 12 && f <= 14) {
    const k = f - 12;
    return { ...base, lean: -1 - k, squash: 0.94 - k * 0.04, arms: 0.45 + k * 0.25, eyes: 2 };
  }
  if (f === 18) return { ...base, lean: 8, squash: 1.04, arms: -0.2, swing: -1, bob: 1 };
  if (f === 19) return { ...base, lean: 10, squash: 1.02, arms: -0.3, swing: 1, bob: 0 };
  if (f === 20) return { ...base, lean: 8, squash: 0.78, arms: 0.2, eyes: 0, dead: 1 };
  if (f === 21) return { ...base, lean: 9, squash: 0.45, arms: 0.2, eyes: 0, dead: 2 };
  return base;
}

function paint(c: CanvasRenderingContext2D, s: Spec, p: Pose, eyes: [number, number][]): void {
  const H = Math.round(s.trunkH * p.squash);
  const top = FEET - H - p.bob;
  const cx = 32;
  const bendAt = (h: number): number => Math.round(p.lean * Math.pow(h / Math.max(1, H), 1.6));

  // soft shadow on the ground
  rect(c, cx - s.trunkW / 2 - s.flare, FEET + 1, s.trunkW + s.flare * 2, 2, 'rgba(0,0,0,0.25)');

  // roots at the base: two little feet that take turns, or big splayed roots for Kesh
  const foot = (dx: number, lift: number, w: number): void => {
    rect(c, cx + dx - 1, FEET - 2 - lift, w + 2, 4 + lift, INK);
    rect(c, cx + dx, FEET - 1 - lift, w, 3 + lift, s.bark[1]);
    rect(c, cx + dx, FEET - 1 - lift, w, 1, s.bark[2]);
  };
  const reach = s.trunkW / 2 + s.flare - 3;
  if (s.bigRoots) {
    for (const side of [-1, 1]) {
      for (const k of [0, 1]) {
        const lift = side * p.swing > 0 ? 1 + k : 0;
        const x = cx + side * (reach - 6 + k * 7) - 3;
        foot(x - cx + 0, lift, 7);
        rect(c, x + 2 + (side > 0 ? 3 : -3) * k, FEET - 5, 3, 3, s.bark[1]);
      }
    }
  } else {
    foot(-reach, p.swing > 0.3 ? 1 : 0, 6);
    foot(reach - 6, p.swing < -0.3 ? 1 : 0, 6);
  }

  // trunk: each row a little wider near the ground and bent by the lean
  for (let y = 0; y < H; y++) {
    const h = H - y;
    const flareW = h < 7 ? Math.round(s.flare * (1 - h / 7)) : 0;
    const w = s.trunkW - Math.round((1 - Math.min(1, h / H)) * 0) + flareW * 2;
    const x0 = cx - Math.round(w / 2) + bendAt(h);
    const yy = FEET - h - p.bob;
    rect(c, x0 - 1, yy, w + 2, 1, INK);
    rect(c, x0, yy, w, 1, s.bark[1]);
    rect(c, x0, yy, 2, 1, s.bark[2]);
    rect(c, x0 + w - 3, yy, 3, 1, s.bark[0]);
    if ((y * 7 + h) % 5 === 0) rect(c, x0 + 3 + ((y * 3) % Math.max(1, w - 8)), yy, 1, 1, s.bark[0]);
  }
  rect(c, cx - Math.round(s.trunkW / 2) - 1 + bendAt(H), top - 1, s.trunkW + 2, 1, INK);

  const tx = cx + bendAt(H); // x of the top of the trunk
  const mid = (h: number): number => cx + bendAt(h);

  // bark markings
  if (s.marks === 'birch') {
    for (let k = 0; k < 6; k++) {
      const h = 4 + k * 4;
      rect(c, mid(h) - 3 + (k % 2) * 4, FEET - h - p.bob, 3, 1, '#3a352c');
    }
  } else if (s.marks === 'scorch') {
    for (const h of [5, 11, 17]) rect(c, mid(h) - Math.round(s.trunkW / 2) + 1, FEET - h - p.bob, s.trunkW - 2, 2, 'rgba(10,8,6,0.55)');
    rect(c, mid(8) + 2, FEET - 9 - p.bob, 1, 1, '#f0a23a');
    rect(c, mid(15) - 3, FEET - 16 - p.bob, 1, 1, '#f0a23a');
  } else if (s.marks === 'moss') {
    for (const [dx, h, w] of [[-7, 6, 5], [3, 9, 6], [-4, 13, 4]] as const) rect(c, mid(h) + dx, FEET - h - p.bob, w, 2, '#4f8a48');
  }

  // arms: branches off the sides of the trunk
  const armY = Math.round(H * 0.62);
  for (const side of [-1, 1]) {
    const sw = side * p.swing * (p.arms < 0 ? -1 : 1);
    const raise = p.arms + sw * 0.12;
    const bx = mid(armY) + side * Math.round(s.trunkW / 2);
    const by = FEET - armY - p.bob;
    const len = s.armStyle === 'thin' ? 13 : s.armStyle === 'stubs' ? 8 : s.armStyle === 'roots' ? 11 : 11;
    const ex = bx + side * (len - Math.round(raise * 3));
    const ey = by + 6 - Math.round(raise * 14) + (s.armStyle === 'thin' ? 3 : 0);
    c.strokeStyle = INK;
    c.lineWidth = s.armStyle === 'roots' || s.armStyle === 'stubs' ? 4 : 3;
    c.lineCap = 'butt';
    c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = s.bark[1];
    c.lineWidth = s.armStyle === 'roots' || s.armStyle === 'stubs' ? 2 : 1;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
    if (s.armLeaves) blob(c, ex, ey - 1, 3, 2, s.leaf);
    if (s.armStyle === 'bare') {
      rect(c, ex - side * 3, ey - 3, 1, 3, s.bark[1]);
      rect(c, ex, ey - 4, 1, 4, s.bark[1]);
    }
    if (s.armStyle === 'roots') rect(c, ex - 1, ey - 1, 3, 3, s.bark[2]);
  }

  // canopy
  const squashY = p.dead === 2 ? 0.4 : 1;
  const cy0 = top - 2;
  const leafCols = p.dead ? (['#51493a', '#6c624a', '#8a7d5a', '#a89a70'] as [string, string, string, string]) : s.leaf;
  if (s.droop && !p.dead) {
    for (const dx of s.droop) {
      const len = 9 + ((Math.abs(dx) * 5) % 9);
      const sway = Math.round(Math.sin(dx + p.lean) * 1);
      const x = tx + dx;
      for (let i = 0; i < len; i++) {
        rect(c, x + (i > 4 ? sway : 0) - 1, cy0 + 4 + i, 3, 1, i % 3 === 0 ? INK : INK);
        rect(c, x + (i > 4 ? sway : 0), cy0 + 4 + i, 1, 1, i % 4 === 3 ? s.leaf[2] : s.leaf[1]);
      }
    }
  }
  for (const [dx, dy, rx, ry] of s.canopy) blob(c, tx + dx, cy0 + Math.round(dy * squashY) + (p.dead === 2 ? 4 : 0), rx * (p.dead === 2 ? 1.05 : 1), Math.max(2, ry * squashY), leafCols);
  if (s.armStyle === 'bare') {
    // a couple of leafless twigs poking out of the autumn crown
    for (const side of [-1, 1]) {
      rect(c, tx + side * 14, cy0 - 3, 1, 5, INK);
      rect(c, tx + side * 14 + side, cy0 - 4, 1, 3, s.bark[1]);
    }
  }

  // face: a dark hollow with two yellow eyes, soft and round
  if (p.dead < 2) {
    const hy = top + s.hollow.y;
    const hx = mid(H - s.hollow.y - Math.round(s.hollow.h / 2)) - Math.round(s.hollow.w / 2);
    for (let y = 0; y < s.hollow.h; y++) {
      const half = Math.round((s.hollow.w / 2) * Math.sqrt(1 - Math.pow((y - s.hollow.h / 2 + 0.5) / (s.hollow.h / 2), 2)));
      rect(c, hx + s.hollow.w / 2 - half, hy + y, half * 2, 1, '#0a0d12');
    }
    if (p.eyes > 0) {
      const ey = hy + Math.round(s.hollow.h * 0.38);
      for (const dx of [-0.24, 0.24]) {
        const ex = Math.round(hx + s.hollow.w / 2 + dx * s.hollow.w) - 1;
        const h = p.eyes === 2 ? 3 : 1;
        rect(c, ex, ey, 2, h, EYE);
        if (p.eyes === 2) rect(c, ex, ey, 1, 1, EYE_HI);
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < 2; xx++) eyes.push([ex + xx, ey + yy]);
      }
    } else {
      const ey = hy + Math.round(s.hollow.h * 0.45);
      for (const dx of [-0.24, 0.24]) rect(c, Math.round(hx + s.hollow.w / 2 + dx * s.hollow.w) - 1, ey, 2, 1, '#6b5a2c');
    }
  }

  // the Rot: a few small glowing spores on the bark
  const sp: [number, number][] = [[-6, 5], [6, 8], [-5, 13], [5, 16]];
  for (let i = 0; i < s.spores; i++) {
    const [dx, h] = sp[i];
    if (h < H - 3) {
      rect(c, mid(h) + dx, FEET - h - p.bob, 2, 2, SPORE);
      rect(c, mid(h) + dx, FEET - h - p.bob, 1, 1, EYE_HI);
    }
  }
}

// The whole sheet for one warden, plus the eye pixels of every frame for the glow overlay.
export function drawWardenSheet(index: number): { canvas: HTMLCanvasElement; eyes: Map<number, [number, number][]> } {
  const canvas = document.createElement('canvas');
  canvas.width = F * 6;
  canvas.height = F * 4;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const eyes = new Map<number, [number, number][]>();
  for (let f = 0; f < 24; f++) {
    const idle = f > 5 && f < 12 && f !== 6 && f !== 7 ? 0 : f >= 15 && f <= 17 ? 0 : f >= 22 ? 21 : f;
    const frame = drawWarden(index, idle);
    ctx.drawImage(frame.canvas, (f % 6) * F, Math.floor(f / 6) * F);
    eyes.set(f, frame.eyes);
  }
  return { canvas, eyes };
}
