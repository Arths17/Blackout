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
}

const KEY = 'darkness';
const INK = rgb(PALETTE.ink);

// Flat darkness in four tiers on 2 px cells; lights punch it back with a dithered edge. Never gradients, never pure black.
export class Darkness {
  private ctx: CanvasRenderingContext2D;
  private tex: Phaser.Textures.CanvasTexture;
  private cols = Math.ceil(VIEW.w / DARK.cell);
  private rows = Math.ceil(VIEW.h / DARK.cell);
  private grid = new Uint8Array(this.cols * this.rows);

  constructor(scene: Phaser.Scene) {
    this.tex = scene.textures.createCanvas(KEY, VIEW.w, VIEW.h)!;
    this.ctx = this.tex.getContext();
    scene.add.image(0, 0, KEY).setOrigin(0, 0).setDepth(DEPTH.dark);
  }

  render(lights: Light[], ambient: number): void {
    const { cols, rows, grid } = this;
    const cell = DARK.cell;
    grid.fill(ambient);
    for (const l of lights) {
      const c0 = Math.max(0, Math.floor((l.x - l.r) / cell));
      const c1 = Math.min(cols - 1, Math.ceil((l.x + l.r) / cell));
      const r0 = Math.max(0, Math.floor((l.y - l.r) / cell));
      const r1 = Math.min(rows - 1, Math.ceil((l.y + l.r) / cell));
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const d = Math.hypot(cx * cell + 1 - l.x, cy * cell + 1 - l.y) / l.r + dither(cx, cy) * 0.1;
          const tier = Math.max(l.floor ?? 0, d < 0.36 ? 0 : d < 0.66 ? 1 : d < 1 ? 2 : 3);
          const i = cy * cols + cx;
          if (tier < grid[i]) grid[i] = tier;
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
    // colored pools (emergency strips, surge) tint the lit cells instead of adding a glow sprite
    for (const l of lights) {
      if (l.tint === undefined) continue;
      const col = rgb(l.tint);
      const c0 = Math.max(0, Math.floor((l.x - l.r) / cell));
      const c1 = Math.min(cols - 1, Math.ceil((l.x + l.r) / cell));
      const r0 = Math.max(0, Math.floor((l.y - l.r) / cell));
      const r1 = Math.min(rows - 1, Math.ceil((l.y + l.r) / cell));
      for (let cy = r0; cy <= r1; cy++) {
        for (let cx = c0; cx <= c1; cx++) {
          const d = Math.hypot(cx * cell + 1 - l.x, cy * cell + 1 - l.y) / l.r + dither(cx, cy) * 0.1;
          if (d >= 1) continue;
          c.fillStyle = `rgba(${col},${d < 0.36 ? 0.15 : d < 0.66 ? 0.08 : 0.04})`;
          c.fillRect(cx * cell, cy * cell, cell, cell);
        }
      }
    }
    this.tex.refresh();
  }
}
