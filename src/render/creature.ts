import type Phaser from 'phaser';
import { CFG, PALETTE } from '../config';
import type { Creature } from '../sim/creature';
import type { Vec } from '../sim/routes';

interface Pose {
  len: number;
  wid: number;
  legAmp: number;
  spread: number;
  back: number;
  flare: number;
  jaw: number;
  jitter: number;
}

function poseOf(c: Creature, t: number): Pose {
  switch (c.state) {
    case 'windup': {
      const k = 1 - Math.max(0, c.timer) / Math.max(0.01, c.windupTotal);
      return { len: 0.9 - 0.12 * k, wid: 1.1 + 0.25 * k, legAmp: 0, spread: 1.2 + 0.7 * k, back: 0, flare: 1.1 + 0.9 * k, jaw: 0.35 + 0.65 * k, jitter: 1 + 3 * k };
    }
    case 'lunge':
      return { len: 1.5, wid: 0.75, legAmp: 0, spread: 0.5, back: 1, flare: 0.1, jaw: 0.9, jitter: 0 };
    case 'recoil':
      return { len: 0.75, wid: 0.8, legAmp: 0, spread: 0.4, back: 0, flare: 1.3, jaw: 0.5, jitter: 2.5 };
    default:
      return { len: 1 + 0.04 * Math.sin(t * 3), wid: 1 + 0.04 * Math.sin(t * 3), legAmp: c.asleep ? 0 : 9, spread: 1, back: 0, flare: 0.5 + 0.1 * Math.sin(t * 3), jaw: 0.15, jitter: 0 };
  }
}

export interface CreatureStyle {
  fill: number;
  edge: number;
  alpha: number;
}

export const BODY_STYLE: CreatureStyle = { fill: 0x1d2d21, edge: 0x4e7142, alpha: 1 };
export const GHOST_STYLE: CreatureStyle = { fill: 0xcfe0c8, edge: 0xeaf5e4, alpha: 0.5 };
export const FLASH_STYLE: CreatureStyle = { fill: PALETTE.surge, edge: PALETTE.surge, alpha: 1 };

// Local frame: u forward, v to the creature's right. Legs, spikes and jaw all hang off it so the
// windup (crouch, splayed legs, flared spikes, open jaw) is a different silhouette, not just a color.
export function eyePositions(c: Creature, t: number): Vec[] {
  const p = poseOf(c, t);
  const tx = frame(c, p, t);
  return [tx(22 * p.len, -6 * p.wid), tx(22 * p.len, 6 * p.wid)].map(([x, y]) => ({ x, y }));
}

function frame(c: Creature, p: Pose, t: number): (u: number, v: number) => [number, number] {
  const cos = Math.cos(c.facing);
  const sin = Math.sin(c.facing);
  const jx = p.jitter ? (Math.sin(t * 91) + Math.sin(t * 57)) * 0.5 * p.jitter : 0;
  const jy = p.jitter ? (Math.cos(t * 83) + Math.sin(t * 61)) * 0.5 * p.jitter : 0;
  return (u, v) => [c.x + jx + u * cos - v * sin, c.y + jy + u * sin + v * cos];
}

function poly(g: Phaser.GameObjects.Graphics, pts: [number, number][], fill: number, a: number): void {
  g.fillStyle(fill, a);
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  g.fillPath();
}

export function drawCreature(g: Phaser.GameObjects.Graphics, c: Creature, t: number, style: CreatureStyle): void {
  const p = poseOf(c, t);
  const at = frame(c, p, t);
  const { fill, edge, alpha } = style;

  const phase = t * 7;
  for (let i = 0; i < 3; i++) {
    const hu = (-9 + i * 10) * p.len;
    for (const side of [-1, 1]) {
      const sw = Math.sin(phase + i * 2.1 + (side > 0 ? Math.PI : 0)) * p.legAmp;
      const kneeU = hu + sw * 0.6 - p.back * 8;
      const footU = hu + sw * 1.3 - p.back * 18;
      const [hx, hy] = at(hu, side * 9 * p.wid);
      const [kx, ky] = at(kneeU, side * (17 + 7 * p.spread) * p.wid);
      const [fx, fy] = at(footU, side * (24 + 10 * p.spread) * p.wid);
      g.lineStyle(4, edge, alpha).beginPath().moveTo(hx, hy).lineTo(kx, ky).lineTo(fx, fy).strokePath();
      g.lineStyle(2, fill, alpha).beginPath().moveTo(hx, hy).lineTo(kx, ky).lineTo(fx, fy).strokePath();
    }
  }

  const tail: [number, number][] = [at(-24 * p.len, -3), at(-40 * p.len, Math.sin(t * 3) * 5), at(-24 * p.len, 3)];
  poly(g, tail, edge, alpha);

  for (const u of [-16, -7, 2, 11]) {
    for (const side of [-1, 1]) {
      const base1 = at(u * p.len, side * 10 * p.wid);
      const base2 = at((u + 6) * p.len, side * 10 * p.wid);
      const tip = at((u - 3) * p.len, side * (10 + 9 * p.flare) * p.wid);
      poly(g, [base1, tip, base2], edge, alpha);
    }
  }

  const body: [number, number][] = [
    at(-26 * p.len, 0),
    at(-15 * p.len, -13 * p.wid),
    at(6 * p.len, -15 * p.wid),
    at(16 * p.len, -9 * p.wid),
    at(18 * p.len, 0),
    at(16 * p.len, 9 * p.wid),
    at(6 * p.len, 15 * p.wid),
    at(-15 * p.len, 13 * p.wid),
  ];
  poly(g, body, edge, alpha);
  const inner = body.map(([x, y]) => [c.x + (x - c.x) * 0.82, c.y + (y - c.y) * 0.82] as [number, number]);
  poly(g, inner, fill, alpha);

  const head: [number, number][] = [at(14 * p.len, -8 * p.wid), at(30 * p.len, -3), at(30 * p.len, 3), at(14 * p.len, 8 * p.wid)];
  poly(g, head, edge, alpha);
  const j = 3 + p.jaw * 8;
  for (const side of [-1, 1]) {
    poly(g, [at(26 * p.len, side * 3), at(38 * p.len, side * j), at(30 * p.len, side * (j - 3))], edge, alpha);
  }
}

export function drawEyes(g: Phaser.GameObjects.Graphics, c: Creature, t: number): void {
  const hot = c.state === 'windup' ? 1 : c.state === 'lunge' ? 0.85 : c.asleep ? 0.25 : 0.4;
  const r = c.state === 'windup' ? 4.5 + 2 * (1 - c.timer / Math.max(0.01, c.windupTotal)) : 3.2;
  for (const e of eyePositions(c, t)) {
    g.fillStyle(PALETTE.creature, 0.14 + hot * 0.2).fillCircle(e.x, e.y, r * 3.2);
    g.fillStyle(PALETTE.creature, 0.3 + hot * 0.4).fillCircle(e.x, e.y, r * 1.6);
    g.fillStyle(c.state === 'windup' ? 0xeaffb0 : PALETTE.creature, 0.5 + hot * 0.5).fillCircle(e.x, e.y, r);
  }
}

// Short chevron ahead of the head that grows through the windup, so the telegraph reads with sound off.
export function drawTelegraph(g: Phaser.GameObjects.Graphics, c: Creature): void {
  if (c.state !== 'windup') return;
  const k = 1 - Math.max(0, c.timer) / Math.max(0.01, c.windupTotal);
  const cos = Math.cos(c.facing);
  const sin = Math.sin(c.facing);
  const nx = -sin;
  const ny = cos;
  const r = CFG.creatureRadius;
  for (let i = 0; i < 3; i++) {
    const d = r + 26 + i * 16 + k * 10;
    const w = 12 - i * 2;
    g.lineStyle(3, PALETTE.creature, (0.25 + 0.6 * k) * (1 - i * 0.28));
    g.beginPath();
    g.moveTo(c.x + cos * d + nx * w - cos * 8, c.y + sin * d + ny * w - sin * 8);
    g.lineTo(c.x + cos * (d + 8), c.y + sin * (d + 8));
    g.lineTo(c.x + cos * d - nx * w - cos * 8, c.y + sin * d - ny * w - sin * 8);
    g.strokePath();
  }
}

// Faint sickly rim above the darkness: enough to read the pose without lighting the creature up.
export function rimStyle(c: Creature): CreatureStyle {
  const k = 1 - Math.max(0, c.timer) / Math.max(0.01, c.windupTotal);
  const a = c.state === 'windup' ? 0.22 + 0.5 * k : c.state === 'lunge' ? 0.4 : c.state === 'recoil' ? 0.45 : c.asleep ? 0.07 : 0.13;
  return { fill: 0x0c140e, edge: PALETTE.creature, alpha: a };
}
