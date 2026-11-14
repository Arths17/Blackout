import Phaser from 'phaser';
import { DARK, PALETTE, VIEW } from '../config';
import { DEPTH } from './layers';
import { dither, rgb } from './pixel';

export interface Light {
  x: number;
  y: number;
  r: number;
  tint?: number;
  floor?: number; // darkest this light can make a cell; strips only haze the dark instead of lighting it
  cone?: { angle: number; half: number }; // flashlight: only lights a wedge
  shadows?: boolean; // props block it and walls are only lit near the lit floor edge
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Env {
  floor: Rect;
  blockers: Rect[];
}

const KEY = 'darkness';
const INK = rgb(PALETTE.ink);
const TAU = Math.PI * 2;

// Flat darkness in four tiers on 2 px cells; lights punch it back with a dithered edge. Never gradients, never pure black.
export class Darkness {
  private ctx: CanvasRenderingContext2D;
  private tex: Phaser.Textures.CanvasTexture;
  private cols = Math.ceil(VIEW.w / DARK.cell);
  private rows = Math.ceil(VIEW.h / DARK.cell);
  private grid = new Uint8Array(this.cols * this.rows);

  constructor(scene: Phaser.Scene, private env: Env) {
    this.tex = scene.textures.createCanvas(KEY, VIEW.w, VIEW.h)!;
    this.ctx = this.tex.getContext();
    scene.add.image(0, 0, KEY).setOrigin(0, 0).setDepth(DEPTH.dark);
  }

  // Tier 0..2 for a cell, or -1 when the light doesn't reach it.
  private tierOf(l: Light, cx: number, cy: number): number {
    const cell = DARK.cell;
    let x = cx * cell + 1;
    let y = cy * cell + 1;
    let extra = 0;
    if (l.shadows) {
      const f = this.env.floor;
      const ex = Math.min(f.x1, Math.max(f.x0, x));
      const ey = Math.min(f.y1, Math.max(f.y0, y));
      if (ex !== x || ey !== y) {
        // wall: only the face next to lit floor catches the light
        const reach = y < f.y0 ? 11 : 5;
        if (Math.hypot(x - ex, y - ey) > reach) return -1;
        x = ex;
        y = ey;
        extra = 0.14;
      }
      if (this.blocked(l.x, l.y, x, y)) return -1;
    }
    const dx = x - l.x;
    const dy = y - l.y;
    let e = Math.hypot(dx, dy) / l.r + extra;
    if (l.cone) {
      const diff = Math.abs(((Math.atan2(dy, dx) - l.cone.angle + 3 * Math.PI) % TAU) - Math.PI);
      if (diff > l.cone.half) return -1;
      e += (diff / l.cone.half) ** 2 * 0.38;
    }
    e += dither(cx, cy) * 0.1;
    if (e >= 1) return -1;
    return Math.max(l.floor ?? 0, e < 0.36 ? 0 : e < 0.66 ? 1 : 2);
  }

  // A prop's floor footprint hides everything behind it from the light, but not its own top.
  private blocked(lx: number, ly: number, x: number, y: number): boolean {
    for (const b of this.env.blockers) {
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) continue;
      if (lx >= b.x0 && lx <= b.x1 && ly >= b.y0 && ly <= b.y1) continue;
      const dx = x - lx;
      const dy = y - ly;
      let t0 = 0;
      let t1 = 1;
      let hit = true;
      for (const [p, d, lo, hi] of [[lx, dx, b.x0, b.x1], [ly, dy, b.y0, b.y1]] as const) {
        if (Math.abs(d) < 1e-6) {
          if (p < lo || p > hi) { hit = false; break; }
        } else {
          let ta = (lo - p) / d;
          let tb = (hi - p) / d;
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) { hit = false; break; }
        }
      }
      if (hit) return true;
    }
    return false;
  }

  render(lights: Light[], ambient: number): void {
    const { cols, rows, grid } = this;
    const cell = DARK.cell;
    grid.fill(ambient);
    const box = (l: Light): [number, number, number, number] => [
      Math.max(0, Math.floor((l.x - l.r) / cell)),
      Math.min(cols - 1, Math.ceil((l.x + l.r) / cell)),
      Math.max(0, Math.floor((l.y - l.r) / cell)),
      Math.min(rows - 1, Math.ceil((l.y + l.r) / cell)),
    ];
    for (const l of lights) {
      const [c0, c1, r0, r1] = box(l);
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const t = this.tierOf(l, cx, cy);
          if (t >= 0) {
            const i = cy * cols + cx;
            if (t < grid[i]) grid[i] = t;
          }
        }
      }
    }
    const c = this.ctx;
    c.clearRect(0, 0, VIEW.w, VIEW.h);
    for (let cy = 0; cy < rows; cy++) {
      let x0 = 0;
      let cur = grid[cy * cols];
      for (let cx = 1; cx <= cols; cx++) {
        const t = cx < cols ? grid[cy * cols + cx] : -1;
        if (t === cur) continue;
        const a = DARK.alpha[cur];
        if (a > 0) {
          c.fillStyle = `rgba(${INK},${a})`;
          c.fillRect(x0 * cell, cy * cell, (cx - x0) * cell, cell);
        }
        x0 = cx;
        cur = t;
      }
    }
    // colored pools (surge, win lights) tint the lit cells instead of adding a glow sprite
    for (const l of lights) {
      if (l.tint === undefined) continue;
      const col = rgb(l.tint);
      const [c0, c1, r0, r1] = box(l);
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const t = this.tierOf(l, cx, cy);
          if (t < 0) continue;
          c.fillStyle = `rgba(${col},${t === 0 ? 0.15 : t === 1 ? 0.08 : 0.04})`;
          c.fillRect(cx * cell, cy * cell, cell, cell);
        }
      }
    }
    this.tex.refresh();
  }
}
