import Phaser from 'phaser';
import { EXIT, H, PALETTE, ROOM, VIS, W } from '../config';
import { DEPTH } from './layers';

type Pt = [number, number];

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rotRect(cx: number, cy: number, w: number, h: number, rot: number): Pt[] {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Pt[]).map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

function fillPoly(g: Phaser.GameObjects.Graphics, pts: Pt[], color: number, a = 1): void {
  g.fillStyle(color, a);
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  g.fillPath();
}

function strokePath(g: Phaser.GameObjects.Graphics, pts: Pt[], w: number, color: number, a = 1): void {
  g.lineStyle(w, color, a);
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.strokePath();
}

function crate(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, rot: number): void {
  const box = rotRect(x, y, w, h, rot);
  fillPoly(g, box, 0x343c4e);
  strokePath(g, [...box, box[0]], 2, 0x5b6a8d);
  const inner = rotRect(x, y, w - 10, h - 10, rot);
  strokePath(g, [...inner, inner[0]], 1, 0x454f69, 0.9);
  strokePath(g, [inner[0], inner[2]], 1, 0x454f69, 0.8);
  strokePath(g, [inner[1], inner[3]], 1, 0x454f69, 0.8);
}

function barrel(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
  g.fillStyle(0x2e394e, 1).fillCircle(x, y, r);
  g.lineStyle(2, 0x5d6d90, 1).strokeCircle(x, y, r);
  g.lineStyle(1, 0x46577e, 1).strokeCircle(x, y, r * 0.68);
  g.fillStyle(PALETTE.strip, 0.55).fillCircle(x + r * 0.3, y - r * 0.2, 2);
}

function pipe(g: Phaser.GameObjects.Graphics, pts: Pt[], w: number): void {
  strokePath(g, pts, w + 3, 0x0b0e15);
  strokePath(g, pts, w, 0x404f72);
  strokePath(g, pts.map(([x, y]) => [x, y - w * 0.22] as Pt), 1.5, 0x61759f, 0.9);
  for (let i = 1; i < pts.length - 1; i++) {
    g.fillStyle(0x54668a, 1).fillCircle(pts[i][0], pts[i][1], w * 0.75);
    g.lineStyle(1, 0x0b0e15, 1).strokeCircle(pts[i][0], pts[i][1], w * 0.75);
  }
}

function cable(g: Phaser.GameObjects.Graphics, p0: Pt, p1: Pt, p2: Pt): void {
  const pts: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push([(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]]);
  }
  strokePath(g, pts, 4, 0x07090e);
  strokePath(g, pts, 1.5, 0x3c4861, 0.9);
}

function vent(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0x0a0d14, 1).fillRect(x, y, w, h);
  g.lineStyle(2, 0x5b6a8d, 1).strokeRect(x, y, w, h);
  g.lineStyle(1, 0x46577e, 1);
  for (let i = 4; i < h - 2; i += 4) g.lineBetween(x + 3, y + i, x + w - 3, y + i);
}

function tape(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(PALETTE.ink, 0.85).fillRect(x, y, w, h);
  g.fillStyle(PALETTE.strip, 0.75);
  for (let i = -h; i < w; i += h * 2) {
    const x0 = Math.max(x, x + i);
    const x1 = Math.min(x + w, x + i + h);
    if (x1 > x0) g.fillTriangle(x0, y + h, x0 + (x1 - x0), y + h, x1, y);
  }
}

// Props go where someone would put them: crates by the first switch, a pipe run along the top wall,
// barrels piled in one corner. Nothing is mirrored and the spacing is uneven on purpose.
export function buildRoom(scene: Phaser.Scene): void {
  const rnd = seeded(7);
  const g = scene.add.graphics().setDepth(DEPTH.room);
  g.fillStyle(PALETTE.wall, 1).fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 96) g.lineStyle(1, 0x1b2436, 1).lineBetween(x + rnd() * 6, 0, x + rnd() * 6, H);
  g.fillStyle(PALETTE.floor, 1).fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);

  for (let y = ROOM.y; y < ROOM.y + ROOM.h; y += 80) {
    for (let x = ROOM.x; x < ROOM.x + ROOM.w; x += 80) {
      g.fillStyle(rnd() > 0.5 ? 0x1c273c : 0x283654, 0.5 + rnd() * 0.3).fillRect(x + 1, y + 1, 78, 78);
    }
  }
  g.lineStyle(1, 0x151b28, 1);
  for (let x = ROOM.x; x <= ROOM.x + ROOM.w; x += 80) g.lineBetween(x, ROOM.y, x, ROOM.y + ROOM.h);
  for (let y = ROOM.y; y <= ROOM.y + ROOM.h; y += 80) g.lineBetween(ROOM.x, y, ROOM.x + ROOM.w, y);

  for (let i = 0; i < 70; i++) {
    const x = ROOM.x + rnd() * ROOM.w;
    const y = ROOM.y + rnd() * ROOM.h;
    const a = rnd() * Math.PI;
    g.lineStyle(1, 0x45557e, 0.25).lineBetween(x, y, x + Math.cos(a) * (6 + rnd() * 18), y + Math.sin(a) * (6 + rnd() * 18));
  }
  for (const [x, y, w, h] of [[330, 410, 90, 38], [840, 250, 70, 30], [610, 140, 110, 44]]) g.fillStyle(PALETTE.grime, 0.55).fillEllipse(x, y, w, h);

  const g2 = scene.add.graphics().setDepth(DEPTH.props);
  pipe(g2, [[110, 56], [330, 57], [341, 62], [560, 61], [572, 55], [770, 56]], 8);
  pipe(g2, [[88, 90], [87, 230], [93, 241], [92, 410]], 7);
  crate(g2, 108, 538, 46, 50, 0.12);
  crate(g2, 118, 588, 34, 26, -0.18);
  crate(g2, 102, 505, 28, 26, 0.3);
  barrel(g2, 1040, 92, 14);
  barrel(g2, 1015, 108, 14);
  barrel(g2, 1046, 130, 13);
  vent(g2, 470, 584, 62, 16);
  vent(g2, 650, 585, 56, 15);
  cable(g2, [262, 600], [340, 570], [430, 602]);
  cable(g2, [1072, 372], [1050, 430], [1066, 520]);
  cable(g2, [330, 604], [380, 560], [470, 604]);

  g2.fillStyle(0x0a0d14, 1).fillCircle(760, 432, 17);
  g2.lineStyle(2, 0x5b6a8d, 1).strokeCircle(760, 432, 17);
  g2.lineStyle(1, 0x46577e, 1);
  for (let i = -12; i <= 12; i += 6) g2.lineBetween(760 + i, 424, 760 + i, 440);

  g2.fillStyle(0x273043, 1).fillRect(990, 520, 78, 56);
  g2.lineStyle(2, 0x5b6a8d, 1).strokeRect(990, 520, 78, 56);
  g2.lineStyle(1, 0x0a0d14, 1).strokeCircle(1010, 548, 13).strokeCircle(1048, 548, 13);
  g2.fillStyle(PALETTE.strip, 0.5).fillRect(996, 526, 6, 4);

  const stencil = { fontFamily: VIS.font, fontSize: '15px', color: '#4a5870' };
  scene.add.text(515, 550, 'GEN. ROOM B', stencil).setOrigin(0.5).setAlpha(0.55).setDepth(DEPTH.props);
  scene.add.text(1010, 92, 'NO ENTRY', { ...stencil, fontSize: '12px' }).setOrigin(0.5).setAlpha(0.5).setDepth(DEPTH.props);
  scene.add.text(300, 604 - 70, 'KEEP CLEAR', { ...stencil, fontSize: '11px' }).setOrigin(0.5).setAlpha(0.4).setDepth(DEPTH.props);
  scene.add.text(1000, 590, '3-C', { ...stencil, fontSize: '11px' }).setOrigin(0.5).setAlpha(0.4).setDepth(DEPTH.props);

  tape(g2, 140, 566, 120, 6);
  tape(g2, 840, 566, 120, 6);
  tape(g2, 1030, 372, 46, 6);
}

// Emergency strips and one flickering dead lamp, drawn above the darkness so the walls stay readable.
export class RoomFx {
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.over);
  }

  draw(t: number, lit: boolean): void {
    const g = this.g;
    g.clear();
    const segs = 14;
    const perim: [number, number, number, number][] = [];
    const { x, y, w, h } = ROOM;
    for (let i = 0; i < segs / 2; i++) {
      const a = x + (w * i) / (segs / 2);
      const b = x + (w * (i + 1)) / (segs / 2);
      perim.push([a, y, b, y], [a, y + h, b, y + h]);
    }
    perim.forEach(([x0, y0, x1, y1], i) => {
      const flick = 0.55 + 0.25 * Math.sin(t * (1.7 + i * 0.37) + i) + (Math.sin(t * 31 + i * 5) > 0.93 ? -0.3 : 0);
      g.lineStyle(3, lit ? PALETTE.warm : PALETTE.strip, Math.max(0.12, flick) * 0.9).lineBetween(x0, y0, x1, y1);
    });
    for (let i = 0; i < 3; i++) {
      g.lineStyle(3, lit ? PALETTE.warm : PALETTE.strip, 0.7).lineBetween(x, y + (h * i) / 3, x, y + (h * (i + 1)) / 3);
      g.lineStyle(3, lit ? PALETTE.warm : PALETTE.strip, 0.5).lineBetween(x + w, y + (h * i) / 3, x + w, y + (h * (i + 1)) / 3);
    }
    const buzz = Math.sin(t * 47) > 0.2 && Math.sin(t * 3.1) > 0.55;
    g.fillStyle(0x10141d, 1).fillRect(470, 46, 22, 7);
    if (buzz) g.fillStyle(PALETTE.strip, 0.9).fillRect(474, 48, 14, 3);
    g.fillStyle(0x10141d, 1).fillRect(790, 46, 22, 7);
  }
}

export function drawExit(g: Phaser.GameObjects.Graphics, open: boolean, t: number): void {
  const x = EXIT.x;
  const y = ROOM.y - 26;
  g.fillStyle(0x0b0f18, 1).fillRect(x - 6, y, EXIT.w + 12, 30);
  g.lineStyle(2, 0x39435a, 1).strokeRect(x - 6, y, EXIT.w + 12, 30);
  if (open) {
    g.fillStyle(PALETTE.warm, 0.9).fillRect(x, y + 4, EXIT.w, 22);
    g.fillStyle(PALETTE.warm, 0.25 + 0.1 * Math.sin(t * 4)).fillRect(x - 10, ROOM.y, EXIT.w + 20, 18);
  } else {
    g.fillStyle(0x182030, 1).fillRect(x, y + 4, EXIT.w, 22);
    g.lineStyle(1, 0x39435a, 1).lineBetween(x + EXIT.w / 2, y + 4, x + EXIT.w / 2, y + 26);
    g.fillStyle(PALETTE.strip, Math.sin(t * 6) > 0 ? 0.95 : 0.35).fillCircle(x + EXIT.w - 10, y + 15, 3);
  }
  tape(g, x - 6, ROOM.y, EXIT.w + 12, 8);
}
