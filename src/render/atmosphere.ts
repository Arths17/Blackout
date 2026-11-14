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
}

export class Atmosphere {
  private g: Phaser.GameObjects.Graphics;
  private roots: Root[] = [
    { points: [[22, 166], [35, 151], [45, 154], [57, 138]], phase: 0.4, width: 2 },
    { points: [[299, 158], [282, 145], [274, 128], [257, 117]], phase: 2.1, width: 1 },
    { points: [[84, 47], [96, 59], [111, 58], [126, 72]], phase: 3.4, width: 1 },
  ];
  private nextTremor = 7;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.y + 4);
  }

  update(w: World, t: number): { lights: Light[]; tremor: boolean } {
    const lights: Light[] = [];
    this.g.clear();
    this.drawRoots(w, t);
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
      g.lineStyle(root.width + 2, PALETTE.ink, 0.9);
      this.stroke(g, points);
      g.lineStyle(root.width, PALETTE.g2, 0.95);
      this.stroke(g, points);
      for (let i = 1; i < points.length; i++) {
        const [x, y] = points[i];
        g.fillStyle(PALETTE.g4, 0.45);
        g.fillRect(Math.round(x), Math.round(y), 2, 1);
      }
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
  }

  private stroke(g: Phaser.GameObjects.Graphics, points: [number, number][]): void {
    g.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    g.strokePath();
  }
}
