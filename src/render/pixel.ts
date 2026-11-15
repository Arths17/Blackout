import Phaser from 'phaser';
import { VIEW } from '../config';

export const px = (world: number): number => world / VIEW.s;

const B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
// -0.5..0.5 ordered-dither offset for a screen pixel
export const dither = (x: number, y: number): number => B4[y & 3][x & 3] / 16 - 0.5;

export const rgb = (c: number): string => `${(c >> 16) & 255},${(c >> 8) & 255},${c & 255}`;

export type Facing = { dir: 'down' | 'up' | 'right'; flip: boolean };

export function facingOf(angle: number): Facing {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (Math.abs(c) >= Math.abs(s)) return { dir: 'right', flip: c < 0 };
  return { dir: s > 0 ? 'down' : 'up', flip: false };
}

// One-pixel line, so nothing gets antialiased. Works on a Graphics or a 2D canvas context.
export function pixLine(g: { fillRect(x: number, y: number, w: number, h: number): unknown }, x0: number, y0: number, x1: number, y1: number): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

export interface Atlas {
  sheets: Record<string, Record<string, any>>;
}
export const atlasOf = (scene: Phaser.Scene): Atlas => scene.cache.json.get('atlas') as Atlas;

// Cells (in the 64 px display) where each boss frame has its glowing eye pixels, keyed 'sheet:frame'.
export const TREE_EYES = new Map<string, [number, number][]>();
// Boss sprite sheet for each room: four hand-drawn wardens, then the final boss's own art.
export const BOSS_SHEETS = ['warden0', 'warden1', 'warden2', 'warden3', 'tree-monster'];
