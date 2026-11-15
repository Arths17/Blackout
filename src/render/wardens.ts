// The first four bosses: the Thornwood wardens, drawn from scratch in code. Each is a 6 x 4 sheet of
// 64 px frames using the same frame numbers as the final boss's sheet:
//   0-5 walk / idle   6-7 recoil   12-14 windup   18-19 lunge   18-21 falling apart when it dies.
// They are kin to the final boss, Ysolde: dark gnarled bark, a crown of bare clawing branches, a hooded
// hollow with angry yellow eyes and root claws. Glowing yellow cracks run up the trunk toward the face,
// and the Rot is worse in each one, from Oren (the first to turn) up to Kesh. Ysolde keeps the team's own
// hand-made sprite.

const F = 64;
const FEET = 53;
const INK = '#07090d';
const EYE = '#ffe24a';
const EYE_HI = '#fffbd0';

interface Spec {
  trunkW: number;
  trunkH: number;
  flare: number;
  bark: [string, string, string]; // shade, body, light
  leaf: [string, string, string]; // dark, body, light: a few withered tufts
  vein: string; // the glowing infection
  veins: number;
  crown: [number, number][]; // branches: angle in degrees (-90 is straight up), length
  tufts: number; // leaf tufts along the crown
  hair?: number; // dead hanging strands (Mab)
  hairCol?: string;
  armLen: number;
  rootClaws: number; // per side
  maw: boolean; // jagged teeth in the hollow
  moss: boolean;
  scorch: boolean;
  hollow: { w: number; h: number; y: number };
}

const SPECS: Spec[] = [
  // Oren: a stout dead oak, the first to turn. A huge hollow with a toothy maw.
  { trunkW: 22, trunkH: 24, flare: 6, bark: ['#150e0a', '#2f2016', '#52382a'], leaf: ['#16241a', '#27401f', '#47693a'],
    vein: '#e6d440', veins: 2, crown: [[-165, 14], [-140, 18], [-112, 19], [-88, 20], [-64, 19], [-40, 17], [-15, 13]],
    tufts: 3, armLen: 15, rootClaws: 2, maw: true, moss: false, scorch: false, hollow: { w: 13, h: 15, y: 3 } },
  // Mab: a tall dead birch gone grey, with long dead strands hanging like hair
  { trunkW: 12, trunkH: 33, flare: 4, bark: ['#3d3a34', '#77716a', '#aaa496'], leaf: ['#2a3326', '#44543a', '#6b7c55'],
    vein: '#eadd55', veins: 3, crown: [[-170, 15], [-145, 19], [-118, 21], [-90, 22], [-62, 21], [-35, 19], [-10, 15]],
    tufts: 2, hair: 7, hairCol: '#59644c', armLen: 19, rootClaws: 2, maw: false, moss: false, scorch: false, hollow: { w: 9, h: 12, y: 5 } },
  // Vael: burnt black, with glowing cracks, tried to burn the Rot out of himself
  { trunkW: 17, trunkH: 28, flare: 5, bark: ['#0a0807', '#1d1612', '#3a2a20'], leaf: ['#6e280f', '#b4531f', '#f08a2c'],
    vein: '#ffb326', veins: 4, crown: [[-168, 13], [-142, 20], [-115, 22], [-90, 23], [-65, 22], [-38, 20], [-12, 14]],
    tufts: 2, armLen: 17, rootClaws: 2, maw: true, moss: false, scorch: true, hollow: { w: 11, h: 14, y: 4 } },
  // Kesh: the root warden, a hulking mossy horror with thick clawing roots for legs
  { trunkW: 20, trunkH: 20, flare: 10, bark: ['#10130b', '#242817', '#434a27'], leaf: ['#1a3322', '#2a5636', '#437c4a'],
    vein: '#d4ea3a', veins: 5, crown: [[-160, 12], [-132, 16], [-100, 17], [-70, 17], [-42, 15], [-16, 11]],
    tufts: 4, armLen: 16, rootClaws: 3, maw: true, moss: true, scorch: false, hollow: { w: 12, h: 12, y: 3 } },
];

interface Pose {
  bob: number;
  lean: number;
  squash: number;
  arms: number; // -0.3 swept back .. 1 raised
  swing: number;
  eyes: 0 | 1 | 2; // closed, squinting, glaring
  dead: number;
}

const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void => {
  c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

// A gnarled limb: ink outline underneath, bark on top, with an elbow so it never looks like a pole.
function limb(c: CanvasRenderingContext2D, pts: [number, number][], thick: number, col: string, hi: string): void {
  const stroke = (w: number, color: string): void => {
    c.strokeStyle = color;
    c.lineWidth = w;
    c.lineCap = 'butt';
    c.lineJoin = 'miter';
    c.beginPath();
    c.moveTo(Math.round(pts[0][0]) + 0.5, Math.round(pts[0][1]) + 0.5);
    for (let i = 1; i < pts.length; i++) c.lineTo(Math.round(pts[i][0]) + 0.5, Math.round(pts[i][1]) + 0.5);
    c.stroke();
  };
  stroke(thick + 2, INK);
  stroke(thick, col);
  if (thick >= 3) stroke(1, hi);
}

function claw(c: CanvasRenderingContext2D, x: number, y: number, dir: number, col: string): void {
  for (const a of [-0.55, 0, 0.55]) {
    const ang = dir + a;
    limb(c, [[x, y], [x + Math.cos(ang) * 5, y + Math.sin(ang) * 5]], 1, col, col);
  }
}

function tuft(c: CanvasRenderingContext2D, x: number, y: number, cols: [string, string, string]): void {
  rect(c, x - 3, y - 1, 7, 4, INK);
  rect(c, x - 2, y, 5, 2, cols[0]);
  rect(c, x - 2, y - 1, 3, 2, cols[1]);
  rect(c, x - 1, y - 1, 1, 1, cols[2]);
  rect(c, x + 3, y + 1, 1, 2, cols[0]);
}

export function drawWarden(index: number, f: number): { canvas: HTMLCanvasElement; eyes: [number, number][] } {
  const canvas = document.createElement('canvas');
  canvas.width = F;
  canvas.height = F;
  const c = canvas.getContext('2d')!;
  const eyes: [number, number][] = [];
  paint(c, SPECS[index], poseFor(f), eyes);
  return { canvas, eyes };
}

function poseFor(f: number): Pose {
  const base: Pose = { bob: 0, lean: 0, squash: 1, arms: 0.05, swing: 0, eyes: 2, dead: 0 };
  if (f <= 5) {
    const ph = (f / 6) * Math.PI * 2;
    return { ...base, bob: Math.sin(ph * 2) > 0.2 ? 1 : 0, lean: Math.round(Math.sin(ph) * 1.5), swing: Math.sin(ph), arms: 0.05 + 0.12 * Math.sin(ph + 1) };
  }
  if (f === 6) return { ...base, lean: -5, squash: 0.92, arms: 0.8, eyes: 1 };
  if (f === 7) return { ...base, lean: -3, squash: 0.95, arms: 0.6, eyes: 1 };
  if (f >= 12 && f <= 14) {
    const k = f - 12;
    return { ...base, lean: -1 - k, squash: 0.95 - k * 0.04, arms: 0.55 + k * 0.25 };
  }
  if (f === 18) return { ...base, lean: 7, squash: 1.03, arms: -0.3, swing: -1, bob: 1 };
  if (f === 19) return { ...base, lean: 9, squash: 1.01, arms: -0.35, swing: 1 };
  if (f === 20) return { ...base, lean: 7, squash: 0.74, arms: 0.2, eyes: 0, dead: 1 };
  if (f === 21) return { ...base, lean: 8, squash: 0.42, arms: 0.2, eyes: 0, dead: 2 };
  return base;
}

function paint(c: CanvasRenderingContext2D, s: Spec, p: Pose, eyes: [number, number][]): void {
  const H = Math.round(s.trunkH * p.squash);
  const top = FEET - H - p.bob;
  const cx = 32;
  const bendAt = (h: number): number => Math.round(p.lean * Math.pow(h / Math.max(1, H), 1.6));
  const mid = (h: number): number => cx + bendAt(h);
  const tx = mid(H);
  const alive = p.dead === 0;

  rect(c, cx - s.trunkW / 2 - s.flare - 2, FEET, s.trunkW + s.flare * 2 + 4, 2, 'rgba(0,0,0,0.35)');

  // root claws gripping the ground, taking turns as it walks
  const reach = s.trunkW / 2 + s.flare - 2;
  for (const side of [-1, 1]) {
    for (let k = 0; k < s.rootClaws; k++) {
      const lift = (side * p.swing > 0.2 && k === 0) ? 2 : 0;
      const bx = cx + side * (reach - k * 5);
      const tipx = bx + side * (6 + k * 2);
      const tipy = FEET + 1 - lift;
      limb(c, [[bx - side * 3, FEET - 5], [bx, FEET - 2 - lift], [tipx, tipy]], 3, s.bark[1], s.bark[2]);
      rect(c, tipx + (side > 0 ? 1 : -2), tipy - 1, 1, 1, s.bark[2]);
    }
  }

  // trunk: gnarled, ridged, flaring into the roots
  for (let y = 0; y < H; y++) {
    const h = H - y;
    const flareW = h < 8 ? Math.round(s.flare * (1 - h / 8)) : 0;
    const wob = Math.round(Math.sin(h * 0.9) * 1.2);
    const w = s.trunkW + flareW * 2 + (wob > 0 ? 1 : 0);
    const x0 = cx - Math.round(w / 2) + bendAt(h);
    const yy = FEET - h - p.bob;
    rect(c, x0 - 1, yy, w + 2, 1, INK);
    rect(c, x0, yy, w, 1, s.bark[1]);
    rect(c, x0, yy, 2, 1, s.bark[2]);
    rect(c, x0 + w - 4, yy, 4, 1, s.bark[0]);
    if ((y * 5 + h * 3) % 7 === 0) rect(c, x0 + 3 + ((y * 5) % Math.max(1, w - 8)), yy, 1, 1, s.bark[0]);
    if ((y * 3 + h) % 9 === 0) rect(c, x0 + 2 + ((y * 7) % Math.max(1, w - 6)), yy, 2, 1, s.bark[2]);
  }
  // knots and ridges
  for (const [dx, h] of [[-5, 7], [4, 12], [-3, 18]] as const) if (h < H - 4) rect(c, mid(h) + dx, FEET - h - p.bob, 3, 2, s.bark[0]);
  if (s.moss) for (const [dx, h, w] of [[-9, 5, 6], [2, 8, 7], [-5, 12, 5], [5, 15, 5]] as const) {
    if (h < H - 2) { rect(c, mid(h) + dx, FEET - h - p.bob, w, 2, '#2f5a38'); rect(c, mid(h) + dx, FEET - h - p.bob, w - 2, 1, '#4b8450'); }
  }

  // glowing infection: cracks climbing the trunk toward the face
  if (alive) {
    for (let i = 0; i < s.veins; i++) {
      let vx = mid(1) + (i - (s.veins - 1) / 2) * Math.max(2, Math.floor((s.trunkW - 4) / s.veins));
      const reachH = Math.min(H - 6, 8 + i * 4);
      for (let h = 1; h < reachH; h++) {
        vx += ((h * 7 + i * 3) % 5 === 0 ? 1 : (h * 5 + i) % 7 === 0 ? -1 : 0);
        const x = mid(h) + (vx - mid(1));
        rect(c, x, FEET - h - p.bob, 1, 1, s.vein);
        if (h % 5 === 0) rect(c, x + 1, FEET - h - p.bob, 1, 1, 'rgba(255,235,120,0.55)');
      }
    }
  }
  if (s.scorch && alive) for (const h of [6, 13, 20]) if (h < H - 3) rect(c, mid(h) - Math.round(s.trunkW / 2) + 2, FEET - h - p.bob, s.trunkW - 4, 1, 'rgba(0,0,0,0.5)');

  // arms: long gnarled limbs ending in claws, hanging low or raised to strike
  const armY = Math.round(H * 0.66);
  for (const side of [-1, 1]) {
    const raise = p.arms + side * p.swing * 0.15;
    const sx = mid(armY) + side * Math.round(s.trunkW / 2 - 1);
    const sy = FEET - armY - p.bob;
    const ex = sx + side * (s.armLen * 0.45);
    const ey = sy + 5 - raise * 7;
    const hx = ex + side * (s.armLen * 0.35 - raise * 2);
    const hy = ey + 9 - raise * 22;
    limb(c, [[sx, sy], [ex, ey], [hx, hy]], 3, s.bark[1], s.bark[2]);
    claw(c, hx, hy, raise > 0.4 ? -Math.PI / 2 + side * 0.4 : Math.PI / 2 - side * 0.35, s.bark[2]);
  }

  // crown: a tangle of bare branches with thorns and a few withered tufts
  const crownBase: [number, number] = [tx, top + 3];
  const dead = p.dead;
  const spread = dead === 2 ? 0.4 : dead === 1 ? 0.75 : 1;
  const tips: [number, number][] = [];
  s.crown.forEach(([deg, len], i) => {
    const a = (deg * Math.PI) / 180;
    const sway = Math.sin(i * 1.7 + p.lean * 0.3) * 1.2;
    const L = len * spread;
    const ex = crownBase[0] + Math.cos(a) * L + sway;
    const ey = crownBase[1] + Math.sin(a) * L * (dead === 2 ? 0.3 : 1) + (dead === 2 ? 8 : 0);
    const mx = crownBase[0] + Math.cos(a + 0.18) * L * 0.55;
    const my = crownBase[1] + Math.sin(a + 0.18) * L * 0.55;
    limb(c, [crownBase, [mx, my], [ex, ey]], i % 2 === 0 ? 3 : 2, s.bark[1], s.bark[2]);
    // fork near the tip, and a thorn
    const fa = a + (i % 2 ? 0.7 : -0.7);
    limb(c, [[mx, my], [mx + Math.cos(fa) * L * 0.42, my + Math.sin(fa) * L * 0.42]], 2, s.bark[1], s.bark[1]);
    rect(c, ex + Math.cos(a) * 1.5, ey + Math.sin(a) * 1.5, 1, 1, s.bark[2]);
    tips.push([ex, ey]);
  });
  tips.forEach(([x, y], i) => {
    if (i < s.tufts * 2 && i % 2 === 1 && alive) tuft(c, x, y + 1, s.leaf);
  });
  if (s.hair && alive) {
    for (let i = 0; i < s.hair; i++) {
      const [x, y] = tips[(i * 2 + 1) % tips.length];
      const len = 10 + ((i * 5) % 9);
      const sw = Math.round(Math.sin(i + p.lean) * 1);
      for (let k = 0; k < len; k++) {
        rect(c, x + sw * (k > 4 ? 1 : 0) - 1, y + k, 3, 1, INK);
        rect(c, x + sw * (k > 4 ? 1 : 0), y + k, 1, 1, k % 4 === 3 ? '#7f8a68' : (s.hairCol ?? '#59644c'));
      }
    }
  }

  // the hooded hollow: a tall dark opening with a pointed top, like the final boss's hood
  if (dead < 2) {
    const hy = top + s.hollow.y;
    const hx = mid(H - s.hollow.y - Math.round(s.hollow.h / 2)) - Math.round(s.hollow.w / 2);
    const hw = s.hollow.w;
    const hh = s.hollow.h;
    for (let y = 0; y < hh; y++) {
      const t = (y + 0.5) / hh;
      const half = Math.max(1, Math.round((hw / 2) * (t < 0.35 ? 0.45 + t * 1.6 : t > 0.8 ? 1 - (t - 0.8) * 1.2 : 1)));
      rect(c, hx + hw / 2 - half - 1, hy + y, half * 2 + 2, 1, INK);
    }
    for (let y = 0; y < hh; y++) {
      const t = (y + 0.5) / hh;
      const half = Math.max(1, Math.round((hw / 2) * (t < 0.35 ? 0.45 + t * 1.6 : t > 0.8 ? 1 - (t - 0.8) * 1.2 : 1)));
      rect(c, hx + hw / 2 - half, hy + y, half * 2, 1, '#05070a');
    }
    // angry slanted eyes, set high in the hood
    if (p.eyes > 0) {
      const ey = hy + Math.round(hh * 0.3);
      const glare = p.eyes === 2;
      for (const side of [-1, 1]) {
        const ex = hx + hw / 2 + side * (hw * 0.2) + (side < 0 ? -2 : 0);
        const px: [number, number][] = glare
          ? (side < 0 ? [[0, 0], [1, 1], [2, 1], [3, 1]] : [[3, 0], [2, 1], [1, 1], [0, 1]])
          : [[0, 1], [1, 1], [2, 1]];
        for (const [dx, dy] of px) {
          rect(c, ex + dx, ey + dy, 1, 1, EYE);
          eyes.push([Math.round(ex + dx), Math.round(ey + dy)]);
        }
        if (glare) rect(c, ex + (side < 0 ? 2 : 1), ey + 1, 1, 1, EYE_HI);
      }
    } else {
      const ey = hy + Math.round(hh * 0.34);
      for (const side of [-1, 1]) rect(c, hx + hw / 2 + side * (hw * 0.2) - 1, ey, 3, 1, '#5a4a22');
    }
    // jagged teeth along the bottom of the hollow
    if (s.maw && alive) {
      const my = hy + hh - 4;
      for (let i = 0; i < 4; i++) {
        const x = hx + 2 + i * Math.floor((hw - 3) / 3);
        rect(c, x, my, 1, 2, s.bark[2]);
        rect(c, x + 1, my + 1, 1, 1, s.bark[2]);
      }
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
