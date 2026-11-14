import Phaser from 'phaser';
import { DARK, PALETTE } from '../config';
import type { World } from '../sim/game';
import type { Light } from './darkness';
import { DEPTH } from './layers';
import { px } from './pixel';

interface Root {
  points: [number, number][];
  phase: number;
  width: number;
  leaf?: boolean;
}

export class Atmosphere {
  private g: Phaser.GameObjects.Graphics;
  private roots: Root[] = [
    { points: [[22, 166], [35, 151], [45, 154], [57, 138]], phase: 0.4, width: 2 },
    { points: [[299, 158], [282, 145], [274, 128], [257, 117]], phase: 2.1, width: 1 },
    { points: [[84, 47], [96, 59], [111, 58], [126, 72]], phase: 3.4, width: 1 },
    // Perimeter roots pushing in through the walls, kept clear of the breaker panels and the exit.
    { points: [[21, 58], [31, 64], [40, 62], [51, 73]], phase: 1.2, width: 2, leaf: true },
    { points: [[21, 99], [30, 95], [38, 101], [46, 97]], phase: 2.7, width: 1 },
    { points: [[299, 34], [289, 40], [286, 50], [275, 56]], phase: 0.9, width: 2, leaf: true },
    { points: [[299, 126], [290, 132], [285, 126], [274, 134]], phase: 3.9, width: 1 },
    { points: [[299, 147], [291, 150], [283, 158]], phase: 1.7, width: 1 },
    { points: [[104, 163], [110, 156], [106, 149], [115, 143]], phase: 2.4, width: 2, leaf: true },
    { points: [[203, 163], [199, 156], [207, 150]], phase: 0.3, width: 1 },
    { points: [[146, 14], [149, 24], [143, 33], [150, 43]], phase: 4.4, width: 2, leaf: true },
    { points: [[196, 14], [192, 22], [198, 31], [193, 39]], phase: 5.1, width: 1 },
  ];
  // Vines hanging from the top wall, with leaves down their length.
  private hanging = [
    { x: 118, len: 26, phase: 0.5 },
    { x: 171, len: 18, phase: 2.2 },
    { x: 222, len: 30, phase: 4.0 },
    { x: 244, len: 14, phase: 1.1 },
  ];
  // Moss patches on the floor edges: [x, y, w, h].
  private moss: [number, number, number, number][] = [
    [22, 15, 10, 5], [286, 15, 12, 5], [22, 156, 12, 6], [286, 118, 12, 6], [150, 160, 14, 5], [22, 72, 5, 8],
  ];
  private nextTremor = 7;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.y + 4);
  }

  update(w: World, t: number): { lights: Light[]; tremor: boolean } {
    const lights: Light[] = [];
    this.g.clear();
    this.drawMoss();
    this.drawRoots(w, t);
    this.drawHanging(t);
    this.drawMonitors(t, lights);
    const tremor = t >= this.nextTremor;
    if (tremor) this.nextTremor = t + 11 + (Math.sin(t * 0.17) + 1) * 3;
    return { lights, tremor };
  }

  private drawRoots(w: World, t: number): void {
    const g = this.g;
    for (const root of this.roots) {
      const points: [number, number][] = root.points.map(([x, y], i) => [
        x + Math.sin(t * 1.4 + root.phase + i * 0.8) * (i === 0 ? 0.5 : 1.5),
        y + Math.cos(t * 1.1 + root.phase + i) * 0.8,
      ]);
      // Thick where it enters the wall, thinner toward the tip.
      for (let i = 1; i < points.length; i++) {
        const wd = Math.max(2, root.width + 2 - Math.floor(i / 2));
        g.lineStyle(wd + 2, PALETTE.ink, 0.9);
        this.stroke(g, [points[i - 1], points[i]]);
        g.lineStyle(wd, i % 2 ? PALETTE.g3 : PALETTE.g4, 1);
        this.stroke(g, [points[i - 1], points[i]]);
      }
      for (let i = 1; i < points.length; i++) {
        const [x, y] = points[i];
        g.fillStyle(PALETTE.g5, 0.5);
        g.fillRect(Math.round(x), Math.round(y), 2, 1);
      }
      if (root.leaf) this.leaves(points[points.length - 1][0], points[points.length - 1][1], root.phase);
    }

    if (w.creature.alive) {
      const cx = px(w.creature.x);
      const cy = px(w.creature.y) + 5;
      for (let i = 0; i < 4; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const endX = cx + side * (28 + i * 13);
        const endY = cy + 18 + Math.sin(t * 1.7 + i) * 3;
        const pts: [number, number][] = [
          [cx + side * 4, cy + 8],
          [cx + side * (12 + i * 3), cy + 12 + Math.sin(t * 1.6 + i) * 2],
          [endX, endY],
        ];
        g.lineStyle(3, PALETTE.ink, 0.85);
        this.stroke(g, pts);
        g.lineStyle(1, PALETTE.g3, 0.85);
        this.stroke(g, pts);
      }
    }
  }

  private leaves(x: number, y: number, phase: number): void {
    const g = this.g;
    for (let i = 0; i < 3; i++) {
      const a = phase + i * 2.1;
      const lx = Math.round(x + Math.cos(a) * 3);
      const ly = Math.round(y + Math.sin(a) * 3);
      g.fillStyle(PALETTE.g3, 1).fillRect(lx, ly, 3, 2);
      g.fillStyle(PALETTE.g4, 1).fillRect(lx, ly, 2, 1);
      g.fillStyle(PALETTE.g5, 0.7).fillRect(lx, ly, 1, 1);
    }
  }

  private drawHanging(t: number): void {
    const g = this.g;
    for (const v of this.hanging) {
      for (let i = 0; i < v.len; i++) {
        const x = Math.round(v.x + Math.sin(t * 1.1 + v.phase + i * 0.22) * (i * 0.07));
        const y = 14 + i;
        g.fillStyle(PALETTE.ink, 0.9).fillRect(x - 1, y, 3, 1);
        g.fillStyle(PALETTE.g2, 1).fillRect(x, y, 1, 1);
        if (i % 5 === 3) {
          const side = (i / 5) % 2 < 1 ? -1 : 1;
          g.fillStyle(PALETTE.g3, 1).fillRect(x + (side < 0 ? -3 : 1), y, 3, 2);
          g.fillStyle(PALETTE.g4, 1).fillRect(x + (side < 0 ? -3 : 1), y, 2, 1);
        }
      }
    }
  }

  private drawMoss(): void {
    const g = this.g;
    for (const [x, y, w, h] of this.moss) {
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          const k = (i * 7 + j * 13 + x + y) % 5;
          if (k === 0) continue;
          g.fillStyle(k === 1 ? PALETTE.g5 : k === 2 ? PALETTE.g4 : PALETTE.g3, k === 1 ? 0.7 : 0.9).fillRect(x + i, y + j, 1, 1);
        }
      }
    }
  }

  private drawMonitors(t: number, lights: Light[]): void {
    const g = this.g;
    const flickerA = 0.45 + 0.35 * Math.sin(t * 2.7);
    const flickerB = 0.35 + 0.3 * Math.sin(t * 3.3 + 1.7);
    g.fillStyle(PALETTE.n2, 0.95).fillRect(28, 27, 21, 12);
    g.fillStyle(PALETTE.g3, flickerA).fillRect(30, 29, 17, 7);
    g.fillStyle(PALETTE.g5, flickerA * 0.45).fillRect(32, 31, 11, 1);
    g.fillStyle(PALETTE.n2, 0.95).fillRect(264, 29, 25, 13);
    g.fillStyle(PALETTE.r3, flickerB).fillRect(267, 31, 19, 8);
    g.fillStyle(PALETTE.r4, flickerB * 0.4).fillRect(269, 33, 12, 1);
    lights.push({ x: 38, y: 33, r: DARK.panelR * 0.8, tint: PALETTE.g3 });
    lights.push({ x: 276, y: 35, r: DARK.panelR * 0.85, tint: PALETTE.r3 });
    // Faint green glow at some root tips so the roots read in the dark.
    for (const i of [3, 4, 5, 8, 10, 11]) {
      const r = this.roots[i];
      const [x, y] = r.points[r.points.length - 1];
      lights.push({ x, y, r: 11, tint: PALETTE.g3 });
    }
  }

  private stroke(g: Phaser.GameObjects.Graphics, points: [number, number][]): void {
    g.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    g.strokePath();
  }
}
