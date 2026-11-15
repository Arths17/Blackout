import Phaser from 'phaser';
import { PALETTE } from '../config';
import type { Light } from './darkness';
import { DEPTH } from './layers';
import { FLOOR, my } from './layout';

// The door the player came in through, in the left wall. Vines grow over it once the fight starts.
const DOOR = { x: FLOOR.x0 - 18, y: my(121), w: 16, h: 32 };
const START = 0.4; // sim seconds before the vines start
const GROW = 2.4; // seconds for the last vine to finish

interface Vine {
  points: [number, number][];
  delay: number;
  width: number;
}

function makeVines(): Vine[] {
  const vines: Vine[] = [];
  let n = 11;
  const rnd = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
  const cx = DOOR.x + DOOR.w / 2;
  const cy = DOOR.y + DOOR.h / 2;
  const starts: [number, number][] = [
    [DOOR.x + 2, DOOR.y - 2], [DOOR.x + 8, DOOR.y - 3], [DOOR.x + 14, DOOR.y - 2],
    [DOOR.x - 2, DOOR.y + 8], [DOOR.x - 2, DOOR.y + 22], [DOOR.x + DOOR.w + 1, DOOR.y + 12],
    [DOOR.x + DOOR.w + 1, DOOR.y + 26], [DOOR.x + 3, DOOR.y + DOOR.h + 2], [DOOR.x + 12, DOOR.y + DOOR.h + 2],
    [DOOR.x + 6, DOOR.y - 2], [DOOR.x + DOOR.w + 1, DOOR.y + 2],
  ];
  starts.forEach(([sx, sy], i) => {
    const tx = cx + (rnd() - 0.5) * 10;
    const ty = cy + (rnd() - 0.5) * 20;
    const pts: [number, number][] = [];
    const steps = 12;
    for (let k = 0; k <= steps; k++) {
      const f = k / steps;
      const wig = Math.sin(f * 7 + i) * 2.2 * (1 - f * 0.4);
      pts.push([sx + (tx - sx) * f + wig, sy + (ty - sy) * f + Math.cos(f * 5 + i * 1.3) * 1.6]);
    }
    vines.push({ points: pts, delay: i * 0.06, width: i % 3 === 0 ? 2 : 1 });
  });
  return vines;
}

export class Entrance {
  private g: Phaser.GameObjects.Graphics;
  private vines = makeVines();

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.y + 5);
  }

  update(t: number, lights: Light[]): void {
    const g = this.g;
    g.clear();
    const p = Math.max(0, Math.min(1, (t - START) / GROW));
    // frame, door panel and slats
    g.fillStyle(PALETTE.n5, 1).fillRect(DOOR.x - 2, DOOR.y - 3, DOOR.w + 4, DOOR.h + 4);
    g.fillStyle(PALETTE.n2, 1).fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
    for (let y = DOOR.y + 3; y < DOOR.y + DOOR.h; y += 4) g.fillStyle(PALETTE.n3, 1).fillRect(DOOR.x + 1, y, DOOR.w - 2, 1);
    // light from the way in, fading as it's sealed
    if (p < 1) g.fillStyle(PALETTE.warm, 0.35 * (1 - p)).fillRect(DOOR.x + 2, DOOR.y + 2, DOOR.w - 4, DOOR.h - 4);
    // lamp over the door goes out once the vines take it
    const lampOn = p < 0.5;
    g.fillStyle(PALETTE.n4, 1).fillRect(DOOR.x + 6, DOOR.y - 8, 4, 4);
    g.fillStyle(lampOn ? PALETTE.r5 : PALETTE.n3, 1).fillRect(DOOR.x + 7, DOOR.y - 7, 2, 2);

    for (const v of this.vines) {
      const f = Math.max(0, Math.min(1, (p - v.delay) / (1 - v.delay * 1.1)));
      if (f <= 0) continue;
      const upTo = f * (v.points.length - 1);
      const sway = p >= 1 ? Math.sin(t * 1.3 + v.delay * 9) * 0.6 : 0;
      const pts = v.points.slice(0, Math.floor(upTo) + 1).map(([x, y]) => [x + sway, y] as [number, number]);
      const frac = upTo - Math.floor(upTo);
      if (frac > 0 && Math.floor(upTo) + 1 < v.points.length) {
        const [ax, ay] = v.points[Math.floor(upTo)];
        const [bx, by] = v.points[Math.floor(upTo) + 1];
        pts.push([ax + (bx - ax) * frac + sway, ay + (by - ay) * frac]);
      }
      for (let i = 1; i < pts.length; i++) {
        g.lineStyle(v.width + 2, PALETTE.ink, 0.9).lineBetween(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
        g.lineStyle(v.width, i % 2 ? PALETTE.g2 : PALETTE.g3, 1).lineBetween(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      }
      pts.forEach(([x, y], i) => {
        if (i % 3 !== 2) return;
        const dx = i % 2 ? -3 : 1;
        g.fillStyle(PALETTE.g3, 1).fillRect(Math.round(x) + dx, Math.round(y), 3, 2);
        g.fillStyle(PALETTE.g4, 1).fillRect(Math.round(x) + dx, Math.round(y), 2, 1);
      });
    }

    if (p >= 1) lights.push({ x: DOOR.x + DOOR.w / 2 + 4, y: DOOR.y + DOOR.h / 2, r: 12, tint: PALETTE.g3 });
    else lights.push({ x: DOOR.x + DOOR.w / 2 + 6, y: DOOR.y + DOOR.h / 2, r: 24 * (1 - p), tint: PALETTE.warm });
  }
}
