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

// A short forked bolt that hangs in the air for a few frames where something was struck.
interface Arc {
  pts: number[];
  life: number;
}

const SPARK_COLORS = [PALETTE.w, PALETTE.c1, PALETTE.c2, PALETTE.warm2];
const ARC_LIFE = 0.16;

export class Fx {
  private g: Phaser.GameObjects.Graphics;
  // Fixed pools: the oldest spark or arc is overwritten, nothing is allocated mid-fight.
  private sparks: Spark[] = Array.from({ length: VIS.sparkMax }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, color: 0 }));
  private nextSpark = 0;
  private arcs: Arc[] = Array.from({ length: 12 }, () => ({ pts: [], life: 0 }));
  private nextArc = 0;
  private trail: number[] = [];
  private lampSprites: Phaser.GameObjects.Sprite[][] = [];
  private lampSpots = ROUTES.map((r) => r.lampDists.map((_, i) => lampPos(r.id, i)));

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.over + 5);
    for (const spots of this.lampSpots) {
      this.lampSprites.push(spots.map((p) => scene.add.sprite(Math.round(px(p.x)), Math.round(px(p.y)), 'lamp', 0).setDepth(DEPTH.y + 1)));
    }
  }

  private spark(x: number, y: number, vx: number, vy: number, life: number, color: number): void {
    const s = this.sparks[this.nextSpark];
    this.nextSpark = (this.nextSpark + 1) % this.sparks.length;
    s.x = x; s.y = y; s.vx = vx; s.vy = vy; s.life = life; s.color = color;
  }

  // Sparks thrown off a strike, plus a few jagged arcs that crackle out of it.
  burst(wx: number, wy: number, n: number): void {
    const x = px(wx);
    const y = px(wy);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 90;
      this.spark(x, y, Math.cos(a) * v, Math.sin(a) * v - 20, 0.15 + Math.random() * 0.3, SPARK_COLORS[i % SPARK_COLORS.length]);
    }
    for (let k = 0; k < Math.min(5, Math.ceil(n / 6)); k++) {
      const arc = this.arcs[this.nextArc];
      this.nextArc = (this.nextArc + 1) % this.arcs.length;
      arc.life = ARC_LIFE * (0.6 + Math.random() * 0.6);
      arc.pts.length = 0;
      let a = Math.random() * Math.PI * 2;
      let ax = x;
      let ay = y;
      arc.pts.push(ax, ay);
      for (let j = 0; j < 4; j++) {
        a += (Math.random() - 0.5) * 1.6;
        const len = 3 + Math.random() * (n > 20 ? 7 : 4);
        ax += Math.cos(a) * len;
        ay += Math.sin(a) * len;
        arc.pts.push(ax, ay);
      }
    }
  }

  update(w: World, dt: number, lights: Light[]): void {
    const g = this.g;
    g.clear();
    const t = w.time;

    for (const s of w.seeds) {
      const x = Math.round(px(s.x));
      const y = Math.round(px(s.y));
      const sp = Math.hypot(s.vx, s.vy) || 1;
      // a hard little husk with an ember in it, trailing two cinders
      g.fillStyle(PALETTE.r3, 1).fillRect(Math.round(x - (s.vx / sp) * 5), Math.round(y - (s.vy / sp) * 5), 2, 2);
      g.fillStyle(PALETTE.r3, 0.6).fillRect(Math.round(x - (s.vx / sp) * 9), Math.round(y - (s.vy / sp) * 9), 1, 1);
      g.fillStyle(PALETTE.ink, 1).fillRect(x - 3, y - 3, 7, 7);
      g.fillStyle(PALETTE.r4, 1).fillRect(x - 2, y - 2, 5, 5);
      g.fillStyle(Math.floor(t * 12) % 2 ? PALETTE.r5 : PALETTE.warm2, 1).fillRect(x - 1, y - 1, 3, 3);
      lights.push({ x, y, r: 16, tint: PALETTE.r4 });
    }

    this.lampSprites.forEach((row, id) =>
      row.forEach((spr, i) => {
        const f = Math.max(0, 1 - (t - w.lampLitAt[id][i]) / CFG.lampFade);
        spr.setFrame(f > 0.75 ? 3 : f > 0.45 ? 2 : f > 0.12 ? 1 : 0);
        if (f > 0) {
          const p = this.lampSpots[id][i];
          lights.push({ x: px(p.x), y: px(p.y), r: DARK.lampR * (0.55 + 0.45 * f), tint: PALETTE.r4 });
        }
      }),
    );

    const s = w.surge;
    if (s) {
      const head = surgeHead(s);
      const hx = Math.round(px(head.x));
      const hy = Math.round(px(head.y));
      const from = Math.max(0, s.dist - VIS.trailLen * VIEW.s);
      const step = 9; // world px per sample, 3 screen px
      const pts = this.trail;
      pts.length = 0;
      const n = Math.max(2, Math.ceil((s.dist - from) / step));
      for (let i = 0; i <= n; i++) {
        const d = from + ((s.dist - from) * i) / n;
        const p = pointAt(s.route, d);
        // Sid's coherent wave motion, snapped to pixels along the shared surge route.
        const wave = Math.sin(i * 1.8 + t * 24) * (1 + i / n);
        const next = pointAt(s.route, d + 1);
        const angle = Math.atan2(next.y - p.y, next.x - p.x);
        pts.push(Math.round(px(p.x) - Math.sin(angle) * wave), Math.round(px(p.y) + Math.cos(angle) * wave));
      }
      const count = pts.length / 2;
      g.fillStyle(PALETTE.c3, 1);
      for (let i = 1; i < count; i++) {
        pixLine(g, pts[i * 2 - 2] + 1, pts[i * 2 - 1], pts[i * 2] + 1, pts[i * 2 + 1]);
        pixLine(g, pts[i * 2 - 2], pts[i * 2 - 1] + 1, pts[i * 2], pts[i * 2 + 1] + 1);
      }
      g.fillStyle(PALETTE.c2, 1);
      for (let i = 1; i < count; i++) pixLine(g, pts[i * 2 - 2], pts[i * 2 - 1], pts[i * 2], pts[i * 2 + 1]);
      g.fillStyle(PALETTE.c1, 1);
      for (let i = Math.max(1, Math.floor(count * 0.4)); i < count; i++) pixLine(g, pts[i * 2 - 2], pts[i * 2 - 1], pts[i * 2], pts[i * 2 + 1]);
      // a short forked branch off the trail now and then
      if (Math.random() < 0.7) {
        const j = Math.floor(count * (0.5 + Math.random() * 0.4));
        const a = Math.random() * Math.PI * 2;
        pixLine(g, pts[j * 2], pts[j * 2 + 1], pts[j * 2] + Math.cos(a) * 6, pts[j * 2 + 1] + Math.sin(a) * 6);
      }
      g.fillStyle(PALETTE.c2, 1).fillRect(hx - 3, hy - 3, 7, 7);
      g.fillStyle(PALETTE.c1, 1).fillRect(hx - 2, hy - 2, 5, 5);
      g.fillStyle(PALETTE.w, 1).fillRect(hx - 1, hy - 1, 3, 3);
      g.fillRect(hx - 5, hy, 11, 1).fillRect(hx, hy - 5, 1, 11);
      if (Math.random() < 0.8) this.spark(hx, hy, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.15, PALETTE.c1);
      lights.push({ x: hx, y: hy, r: DARK.surgeR, tint: PALETTE.c1 });
    }

    for (const arc of this.arcs) {
      if (arc.life <= 0) continue;
      arc.life -= dt;
      g.fillStyle(arc.life > ARC_LIFE * 0.5 ? PALETTE.w : PALETTE.c2, 1);
      for (let i = 2; i < arc.pts.length; i += 2) pixLine(g, arc.pts[i - 2], arc.pts[i - 1], arc.pts[i], arc.pts[i + 1]);
    }

    let lit = 0;
    for (const p of this.sparks) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 160 * dt;
      // drawn as a short streak along its path, so it reads as a flying spark and not a dot
      g.fillStyle(p.color, 1).fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      if (p.life > 0.12) g.fillStyle(p.color, 0.5).fillRect(Math.round(p.x - p.vx * 0.02), Math.round(p.y - p.vy * 0.02), 1, 1);
      if (p.life > 0.2 && lit < VIS.sparkLights) {
        lit++;
        lights.push({ x: p.x, y: p.y, r: 14, tint: PALETTE.c2 });
      }
    }
  }
}

// Slow motes drifting through the room, drawn under the darkness so only the lit parts show them.
export class Dust {
  private g: Phaser.GameObjects.Graphics;
  private p: { x: number; y: number; vx: number; vy: number }[] = [];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.dust);
    for (let i = 0; i < 14; i++) this.p.push({ x: Math.random() * VIEW.w, y: Math.random() * VIEW.h, vx: 2 + Math.random() * 4, vy: 1 + Math.random() * 3 });
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
