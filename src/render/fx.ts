import type Phaser from 'phaser';
import { CFG, PALETTE, VIS } from '../config';
import { lampPos, type World } from '../sim/game';
import { ROUTES, pointAt, type Vec } from '../sim/routes';
import { surgeHead } from '../sim/surge';
import type { Lights } from './lights';

interface Spark {
  x: number;
  y: number;
  at: number;
}

export class Sparks {
  private items: Spark[] = [];

  add(x: number, y: number, at: number): void {
    this.items.push({ x, y, at });
  }

  draw(g: Phaser.GameObjects.Graphics, lights: Lights, t: number): void {
    this.items = this.items.filter((s) => t - s.at < 0.3);
    for (const s of this.items) {
      const k = 1 - (t - s.at) / 0.3;
      g.lineStyle(2, PALETTE.surge, k);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + s.at * 7;
        const near = 4 + 4 * (1 - k);
        const far = 10 + 18 * (1 - k);
        g.lineBetween(s.x + Math.cos(a) * near, s.y + Math.sin(a) * near, s.x + Math.cos(a) * far, s.y + Math.sin(a) * far);
      }
      lights.halo(s.x, s.y, 55 * k + 20, 0.3 * k);
      lights.pool(s.x, s.y, 90 * k, 0.8);
    }
  }
}

export function drawLamps(g: Phaser.GameObjects.Graphics, w: World, lights: Lights): void {
  const t = w.time;
  for (const r of ROUTES) {
    r.lampDists.forEach((_, i) => {
      const p = lampPos(r.id, i);
      const f = Math.max(0, 1 - (t - w.lampLitAt[r.id][i]) / CFG.lampFade);
      g.fillStyle(0x0a0d14, 0.9).fillCircle(p.x, p.y, 8);
      g.lineStyle(2, 0x39435a, 0.9).strokeCircle(p.x, p.y, 8);
      g.lineStyle(1, 0x39435a, 0.7);
      g.lineBetween(p.x - 8, p.y, p.x + 8, p.y).lineBetween(p.x, p.y - 8, p.x, p.y + 8);
      g.fillStyle(0x28324a, 1).fillCircle(p.x, p.y, 3.5);
      if (f > 0) {
        g.fillStyle(PALETTE.surge, f).fillCircle(p.x, p.y, 5.5);
        lights.halo(p.x, p.y, VIS.lampHaloR * (0.6 + 0.4 * f), 0.45 * f);
        lights.pool(p.x, p.y, VIS.lampPoolR * (0.5 + 0.5 * f), 0.95 * f);
      }
    });
  }
}

export function drawSurge(g: Phaser.GameObjects.Graphics, w: World, lights: Lights): void {
  const s = w.surge;
  if (!s) return;
  const head = surgeHead(s);
  const from = Math.max(0, s.dist - VIS.trailLen);
  const n = Math.max(2, Math.ceil((s.dist - from) / 12));
  const pts: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const d = from + ((s.dist - from) * i) / n;
    const p = pointAt(s.route, d);
    const k = i / n;
    const amp = 5 * k * (i < n ? 1 : 0);
    pts.push({ x: p.x + (Math.random() - 0.5) * amp * 2, y: p.y + (Math.random() - 0.5) * amp * 2 });
  }
  const pass = (width: number, color: number, a: number) => {
    g.lineStyle(width, color, a);
    g.beginPath();
    pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    g.strokePath();
  };
  pass(13, 0x6f9fe0, 0.14);
  pass(6, 0xbcd8ff, 0.4);
  pass(2.5, PALETTE.surge, 0.95);
  g.fillStyle(PALETTE.surge, 1).fillCircle(head.x, head.y, 5);
  g.fillStyle(0xbcd8ff, 0.5).fillCircle(head.x, head.y, 9);
  lights.halo(head.x, head.y, VIS.surgeHaloR, VIS.surgeHaloA);
  lights.halo(head.x, head.y, VIS.surgeHaloR * 2.4, VIS.surgeHaloA * 0.3, 0x6f9fe0);
  lights.pool(head.x, head.y, VIS.surgePoolR, 1);
}
