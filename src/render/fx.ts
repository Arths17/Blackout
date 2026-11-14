import Phaser from 'phaser';
import { CFG, DARK, PALETTE, VIEW, VIS } from '../config';
import { lampPos, type World } from '../sim/game';
import { ROUTES, pointAt } from '../sim/routes';
import { surgeHead } from '../sim/surge';
import type { Light } from './darkness';
import { DEPTH } from './layers';
import { pixLine, px } from './pixel';

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: number;
}

export class Fx {
  private g: Phaser.GameObjects.Graphics;
  private sparks: Spark[] = [];
  private lampSprites: Phaser.GameObjects.Sprite[][] = [];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.over + 5);
    for (const r of ROUTES) {
      this.lampSprites.push(
        r.lampDists.map((_, i) => {
          const p = lampPos(r.id, i);
          return scene.add.sprite(Math.round(px(p.x)), Math.round(px(p.y)), 'lamp', 0).setDepth(DEPTH.y + 1);
        }),
      );
    }
  }

  burst(wx: number, wy: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 70;
      this.sparks.push({ x: px(wx), y: px(wy), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.15 + Math.random() * 0.25, color: [PALETTE.w, PALETTE.c1, PALETTE.c2][i % 3] });
    }
  }

  update(w: World, dt: number): Light[] {
    const g = this.g;
    g.clear();
    const lights: Light[] = [];
    const t = w.time;

    if (w.shockwave) {
      g.lineStyle(2, PALETTE.c1, 0.9).strokeCircle(px(w.creature.x), px(w.creature.y), px(w.shockwave.radius));
      lights.push({ x: px(w.creature.x), y: px(w.creature.y), r: Math.min(DARK.surgeR, px(w.shockwave.radius)), tint: PALETTE.c1 });
    }

    this.lampSprites.forEach((row, id) =>
      row.forEach((spr, i) => {
        const f = Math.max(0, 1 - (t - w.lampLitAt[id][i]) / CFG.lampFade);
        spr.setFrame(f > 0.75 ? 3 : f > 0.45 ? 2 : f > 0.12 ? 1 : 0);
        if (f > 0) {
          const p = lampPos(id, i);
          lights.push({ x: px(p.x), y: px(p.y), r: DARK.lampR * (0.55 + 0.45 * f), tint: PALETTE.r4 });
        }
      }),
    );

    const s = w.surge;
    if (s) {
      const head = surgeHead(s);
      const hx = px(head.x);
      const hy = px(head.y);
      const from = Math.max(0, s.dist - VIS.trailLen * VIEW.s);
      const step = 9; // world px per sample, 3 screen px
      const pts: [number, number][] = [];
      const n = Math.max(2, Math.ceil((s.dist - from) / step));
      for (let i = 0; i <= n; i++) {
        const p = pointAt(s.route, from + ((s.dist - from) * i) / n);
        const k = i / n;
        // Sid's coherent wave motion, snapped to pixels along the shared surge route.
        const wave = Math.sin(i * 1.8 + t * 24) * (1 + k);
        const next = pointAt(s.route, from + ((s.dist - from) * i) / n + 1);
        const angle = Math.atan2(next.y - p.y, next.x - p.x);
        pts.push([Math.round(px(p.x) - Math.sin(angle) * wave), Math.round(px(p.y) + Math.cos(angle) * wave)]);
      }
      const pass = (color: number, off: number, every: number) => {
        g.fillStyle(color, 1);
        for (let i = 1; i < pts.length; i++) {
          if (i % every) continue;
          pixLine(g, pts[i - 1][0] + off, pts[i - 1][1], pts[i][0] + off, pts[i][1]);
          if (off) pixLine(g, pts[i - 1][0], pts[i - 1][1] + off, pts[i][0], pts[i][1] + off);
        }
      };
      pass(PALETTE.c3, 1, 1);
      pass(PALETTE.c2, 0, 1);
      for (let i = Math.floor(pts.length * 0.4); i < pts.length; i++) {
        g.fillStyle(PALETTE.c1, 1);
        pixLine(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      }
      // a short forked branch off the trail now and then
      if (Math.random() < 0.7) {
        const [bx, by] = pts[Math.floor(pts.length * (0.5 + Math.random() * 0.4))];
        const a = Math.random() * Math.PI * 2;
        g.fillStyle(PALETTE.c1, 1);
        pixLine(g, bx, by, bx + Math.cos(a) * 6, by + Math.sin(a) * 6);
      }
      g.fillStyle(PALETTE.c2, 1).fillRect(Math.round(hx) - 3, Math.round(hy) - 3, 7, 7);
      g.fillStyle(PALETTE.c1, 1).fillRect(Math.round(hx) - 2, Math.round(hy) - 2, 5, 5);
      g.fillStyle(PALETTE.w, 1).fillRect(Math.round(hx) - 1, Math.round(hy) - 1, 3, 3);
      g.fillStyle(PALETTE.w, 1).fillRect(Math.round(hx) - 5, Math.round(hy), 11, 1).fillRect(Math.round(hx), Math.round(hy) - 5, 1, 11);
      if (Math.random() < 0.8) this.sparks.push({ x: hx, y: hy, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.15, color: PALETTE.c1 });
      lights.push({ x: hx, y: hy, r: DARK.surgeR, tint: PALETTE.c1 });
    }

    this.sparks = this.sparks.filter((p) => (p.life -= dt) > 0);
    for (const p of this.sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
      g.fillStyle(p.color, 1).fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      if (p.life > 0.2) lights.push({ x: p.x, y: p.y, r: 14, tint: PALETTE.c2 });
    }
    return lights;
  }
}

// Slow motes drifting through the room, drawn under the darkness so only the lit parts show them.
export class Dust {
  private g: Phaser.GameObjects.Graphics;
  private p: { x: number; y: number; vx: number; vy: number }[] = [];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.dust);
    for (let i = 0; i < 46; i++) this.p.push({ x: Math.random() * VIEW.w, y: Math.random() * VIEW.h, vx: 2 + Math.random() * 4, vy: 1 + Math.random() * 3 });
  }

  update(dt: number): void {
    const g = this.g;
    g.clear();
    for (const m of this.p) {
      m.x = (m.x + m.vx * dt + VIEW.w) % VIEW.w;
      m.y = (m.y + m.vy * dt + VIEW.h) % VIEW.h;
      g.fillStyle(m.vx > 4.5 ? PALETTE.n7 : PALETTE.n6, 1).fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
  }
}
