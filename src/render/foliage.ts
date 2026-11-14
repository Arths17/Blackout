import Phaser from 'phaser';
import { PALETTE, VIEW } from '../config';
import { DEPTH } from './layers';
import { FLOOR, mx, my } from './layout';

const rng = (seed: number) => {
  let n = seed >>> 0;
  return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
};

// A filled pixel ellipse, so the canopy stays crisp.
function blob(g: Phaser.GameObjects.Graphics, cx: number, cy: number, rx: number, ry: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry + 0.01)));
    g.fillRect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1);
  }
}

function tree(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, seed: number): void {
  const r = rng(seed);
  g.fillStyle(PALETTE.ink, 0.35).fillRect(Math.round(x - 9 * s), Math.round(y - 1), Math.round(18 * s), 3);
  const tw = Math.max(3, Math.round(3 * s));
  const th = Math.round(15 * s);
  g.fillStyle(PALETTE.ink, 1).fillRect(Math.round(x - tw / 2) - 1, y - th, tw + 2, th + 1);
  g.fillStyle(PALETTE.r2, 1).fillRect(Math.round(x - tw / 2), y - th, tw, th);
  g.fillStyle(PALETTE.r3, 1).fillRect(Math.round(x - tw / 2), y - th, 1, th);
  for (const side of [-1, 1]) {
    g.fillStyle(PALETTE.ink, 1).fillRect(Math.round(x + side * (tw / 2 + 1)) - 1, y - 1, 3, 2);
    g.fillStyle(PALETTE.r2, 1).fillRect(Math.round(x + side * (tw / 2 + 1)), y - 1, 2, 1);
  }
  // branches
  g.lineStyle(1, PALETTE.r2, 1);
  g.lineBetween(x, y - th * 0.7, x - 6 * s, y - th * 1.05);
  g.lineBetween(x, y - th * 0.6, x + 7 * s, y - th * 1.0);
  const cy = y - th - 6 * s;
  const blobs: [number, number, number, number][] = [
    [0, 0, 11 * s, 8 * s], [-7 * s, 3 * s, 8 * s, 6 * s], [7 * s, 2 * s, 8 * s, 6 * s], [-2 * s, -6 * s, 8 * s, 5 * s],
  ];
  for (const [dx, dy, rx, ry] of blobs) blob(g, x + dx, cy + dy, rx + 1, ry + 1, PALETTE.ink);
  for (const [dx, dy, rx, ry] of blobs) blob(g, x + dx, cy + dy, rx, ry, PALETTE.g2);
  for (const [dx, dy, rx, ry] of blobs) blob(g, x + dx - 1, cy + dy - 1, rx * 0.7, ry * 0.65, PALETTE.g3);
  blob(g, x - 3 * s, cy - 4 * s, 4 * s, 2.5 * s, PALETTE.g4, 0.9);
  for (let i = 0; i < 9 * s; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 9 * s;
    g.fillStyle(r() < 0.25 ? PALETTE.r4 : PALETTE.g5, 0.85).fillRect(Math.round(x + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.7), 2, 1);
  }
}

function bush(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number): void {
  g.fillStyle(PALETTE.ink, 0.35).fillRect(Math.round(x - 7 * s), y - 1, Math.round(14 * s), 2);
  blob(g, x, y - 4 * s, 7 * s + 1, 4 * s + 1, PALETTE.ink);
  blob(g, x, y - 4 * s, 7 * s, 4 * s, PALETTE.g2);
  blob(g, x - 1, y - 5 * s, 5 * s, 2.5 * s, PALETTE.g3);
  g.fillStyle(PALETTE.g4, 0.9).fillRect(Math.round(x - 3 * s), Math.round(y - 6 * s), 3, 1);
}

interface Fall {
  x: number;
  y: number;
  vy: number;
  sway: number;
  phase: number;
  warm: boolean;
}

// Trees and bushes around and inside the arena, leaves scattered over the floor, and leaves drifting down.
export class Foliage {
  private falling: Fall[] = [];
  private g: Phaser.GameObjects.Graphics;
  private t = 0;

  constructor(scene: Phaser.Scene) {
    // Authored positions (320 x 180 floor coordinates). Kept off the breaker panels, the exit and the props.
    const trees: [number, number, number][] = [
      [30, 92, 1.1], [150, 38, 1.2], [290, 58, 1.1], [208, 126, 0.9],
    ];
    const bushes: [number, number][] = [[60, 62], [262, 116]];
    trees.forEach(([x, y, s], i) => {
      const g = scene.add.graphics().setDepth(DEPTH.y + my(y));
      tree(g, mx(x), my(y), s, 31 + i * 7);
    });
    bushes.forEach(([x, y]) => {
      const g = scene.add.graphics().setDepth(DEPTH.y + my(y));
      bush(g, mx(x), my(y), 1);
    });

    // leaves lying on the floor
    const floor = scene.add.graphics().setDepth(DEPTH.shadow - 2);
    const r = rng(77);
    for (let i = 0; i < 45; i++) {
      const x = FLOOR.x0 + 6 + r() * (FLOOR.x1 - FLOOR.x0 - 12);
      const y = FLOOR.y0 + 6 + r() * (FLOOR.y1 - FLOOR.y0 - 12);
      const warm = r() < 0.3;
      floor.fillStyle(warm ? PALETTE.r3 : r() < 0.5 ? PALETTE.g3 : PALETTE.g4, 0.9);
      const horiz = r() < 0.5;
      floor.fillRect(Math.round(x), Math.round(y), horiz ? 3 : 2, horiz ? 2 : 3);
      floor.fillStyle(warm ? PALETTE.r4 : PALETTE.g5, 0.7).fillRect(Math.round(x), Math.round(y), 1, 1);
    }

    this.g = scene.add.graphics().setDepth(DEPTH.dust);
    for (let i = 0; i < 8; i++) {
      this.falling.push({ x: r() * VIEW.w, y: r() * VIEW.h, vy: 5 + r() * 7, sway: 3 + r() * 5, phase: r() * 6, warm: r() < 0.35 });
    }
  }

  update(dt: number): void {
    this.t += dt;
    const g = this.g;
    g.clear();
    for (const l of this.falling) {
      l.y += l.vy * dt;
      if (l.y > FLOOR.y1 + 4) {
        l.y = FLOOR.y0 - 4;
        l.x = FLOOR.x0 + Math.random() * (FLOOR.x1 - FLOOR.x0);
      }
      const x = l.x + Math.sin(this.t * 1.4 + l.phase) * l.sway;
      g.fillStyle(l.warm ? PALETTE.r4 : PALETTE.g4, 0.95).fillRect(Math.round(x), Math.round(l.y), 2, 1);
      g.fillStyle(l.warm ? PALETTE.r3 : PALETTE.g3, 0.95).fillRect(Math.round(x) + 1, Math.round(l.y) + 1, 1, 1);
    }
  }
}
