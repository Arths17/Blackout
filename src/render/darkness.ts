import Phaser from 'phaser';
import { DARK, PALETTE, VIEW } from '../config';
import { DEPTH } from './layers';
import { dither } from './pixel';

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
const TAU = Math.PI * 2;
const TINT_ALPHA = [0.15, 0.08, 0.04];
const MAX_TINTED = 60000;

// Flat darkness in four tiers on 2 px cells; lights punch it back with a dithered edge. Never gradients, never pure black.
// One texel per cell, written straight into the pixel buffer and scaled up, so a frame costs one small upload.
export class Darkness {
  private ctx: CanvasRenderingContext2D;
  private tex: Phaser.Textures.CanvasTexture;
  private cols = Math.ceil(VIEW.w / DARK.cell);
  private rows = Math.ceil(VIEW.h / DARK.cell);
  private grid = new Uint8Array(this.cols * this.rows);
  private img: ImageData;
  private out: Uint32Array;
  private tierPixel: number[];
  // Cells a tinted light reached this frame: cell index, tier and color, in light order.
  private tintCell = new Int32Array(MAX_TINTED);
  private tintTier = new Uint8Array(MAX_TINTED);
  private tintColor = new Int32Array(MAX_TINTED);

  constructor(scene: Phaser.Scene, private env: Env) {
    this.tex = scene.textures.exists(KEY) ? scene.textures.get(KEY) as Phaser.Textures.CanvasTexture : scene.textures.createCanvas(KEY, this.cols, this.rows)!;
    this.ctx = this.tex.getContext();
    this.img = this.ctx.createImageData(this.cols, this.rows);
    this.out = new Uint32Array(this.img.data.buffer);
    // Canvas pixels are RGBA bytes, which read as ABGR in a little-endian Uint32.
    const ink = ((PALETTE.ink & 255) << 16) | (PALETTE.ink & 0xff00) | (PALETTE.ink >> 16);
    this.tierPixel = DARK.alpha.map((a) => ((Math.round(a * 255) << 24) | ink) >>> 0);
    scene.add.image(0, 0, KEY).setOrigin(0, 0).setScale(DARK.cell).setDepth(DEPTH.dark);
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
        if (Math.abs(x - ex) > reach || Math.abs(y - ey) > reach || Math.hypot(x - ex, y - ey) > reach) return -1;
        x = ex;
        y = ey;
        extra = 0.14;
      }
    }
    const dx = x - l.x;
    const dy = y - l.y;
    // The dither can only pull the edge in or out by 0.05, so anything past that is dark for sure.
    const far = l.r * (1.05 - extra);
    if (dx * dx + dy * dy >= far * far) return -1;
    let e = Math.sqrt(dx * dx + dy * dy) / l.r + extra;
    if (l.cone) {
      const diff = Math.abs(((Math.atan2(dy, dx) - l.cone.angle + 3 * Math.PI) % TAU) - Math.PI);
      if (diff > l.cone.half) return -1;
      e += (diff / l.cone.half) ** 2 * 0.38;
    }
    e += dither(cx, cy) * 0.1;
    if (e >= 1) return -1;
    if (l.shadows && this.blocked(l.x, l.y, x, y)) return -1;
    return Math.max(l.floor ?? 0, e < 0.36 ? 0 : e < 0.66 ? 1 : 2);
  }

  // A prop's floor footprint hides everything behind it from the light, but not its own top.
  private blocked(lx: number, ly: number, x: number, y: number): boolean {
    const dx = x - lx;
    const dy = y - ly;
    for (const b of this.env.blockers) {
      if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) continue;
      if (lx >= b.x0 && lx <= b.x1 && ly >= b.y0 && ly <= b.y1) continue;
      let t0 = 0;
      let t1 = 1;
      if (Math.abs(dx) < 1e-6) {
        if (lx < b.x0 || lx > b.x1) continue;
      } else {
        const ta = (b.x0 - lx) / dx;
        const tb = (b.x1 - lx) / dx;
        t0 = Math.max(t0, Math.min(ta, tb));
        t1 = Math.min(t1, Math.max(ta, tb));
        if (t0 > t1) continue;
      }
      if (Math.abs(dy) < 1e-6) {
        if (ly < b.y0 || ly > b.y1) continue;
      } else {
        const ta = (b.y0 - ly) / dy;
        const tb = (b.y1 - ly) / dy;
        t0 = Math.max(t0, Math.min(ta, tb));
        t1 = Math.min(t1, Math.max(ta, tb));
        if (t0 > t1) continue;
      }
      return true;
    }
    return false;
  }

  render(lights: Light[], ambient: number): void {
    const { cols, rows, grid, out, tierPixel } = this;
    const cell = DARK.cell;
    grid.fill(ambient);
    let tinted = 0;
    for (const l of lights) {
      const c0 = Math.max(0, Math.floor((l.x - l.r) / cell));
      const c1 = Math.min(cols - 1, Math.ceil((l.x + l.r) / cell));
      const r0 = Math.max(0, Math.floor((l.y - l.r) / cell));
      const r1 = Math.min(rows - 1, Math.ceil((l.y + l.r) / cell));
      const tint = l.tint;
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const t = this.tierOf(l, cx, cy);
          if (t < 0) continue;
          const i = cy * cols + cx;
          if (t < grid[i]) grid[i] = t;
          if (tint !== undefined && tinted < MAX_TINTED) {
            this.tintCell[tinted] = i;
            this.tintTier[tinted] = t;
            this.tintColor[tinted++] = tint;
          }
        }
      }
    }
    for (let i = 0; i < grid.length; i++) out[i] = tierPixel[grid[i]];
    // Colored pools (surge, lamps, win lights) are laid over the lit cells, the way a translucent fill would be.
    for (let k = 0; k < tinted; k++) {
      const i = this.tintCell[k];
      const sa = TINT_ALPHA[this.tintTier[k]];
      const col = this.tintColor[k];
      const dst = out[i];
      const da = (dst >>> 24) / 255 * (1 - sa);
      const oa = sa + da;
      const r = (((col >> 16) & 255) * sa + (dst & 255) * da) / oa;
      const g = (((col >> 8) & 255) * sa + ((dst >> 8) & 255) * da) / oa;
      const b = ((col & 255) * sa + ((dst >> 16) & 255) * da) / oa;
      out[i] = ((Math.round(oa * 255) << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.tex.refresh();
  }
}
