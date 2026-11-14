import Phaser from 'phaser';
import { PALETTE } from '../config';

// 5x7 capitals drawn as grids, with the bridge gaps a stencil has: closed shapes lose a pixel where the
// counter would fall out. Everything else is plain blocky industrial lettering.
const G: Record<string, string[]> = {
  A: ['.XXX.', 'X...X', 'X...X', '.XXXX', 'X...X', 'X...X', 'X...X'],
  B: ['XXXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', 'XXXX.'],
  C: ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
  D: ['XXXX.', 'X...X', 'X...X', '....X', 'X...X', 'X...X', 'XXXX.'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
  G: ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXX.'],
  H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  I: ['.XXX.', '..X..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
  J: ['..XXX', '...X.', '...X.', '...X.', '...X.', 'X..X.', '.XX..'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  N: ['X...X', 'XX..X', 'X.X.X', 'X.X.X', 'X..XX', 'X...X', 'X...X'],
  O: ['.XXX.', 'X...X', 'X...X', '.....', 'X...X', 'X...X', '.XXX.'],
  P: ['XXXX.', 'X...X', 'X...X', '.XXX.', 'X....', 'X....', 'X....'],
  Q: ['.XXX.', 'X...X', 'X...X', '.....', 'X.X.X', 'X..X.', '.XX.X'],
  R: ['XXXX.', 'X...X', 'X...X', '.XXX.', 'X.X..', 'X..X.', 'X...X'],
  S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  V: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
  W: ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'],
  X: ['X...X', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', 'X...X'],
  Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'],
  Z: ['XXXXX', '....X', '...X.', '..X..', '.X...', 'X....', 'XXXXX'],
  '0': ['.XXX.', 'X...X', 'X..XX', '.....', 'XX..X', 'X...X', '.XXX.'],
  '1': ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
  '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  '3': ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', 'XXXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['.XXX.', 'X....', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  '8': ['.XXX.', 'X...X', 'X...X', '.....', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '....X', '.XXX.'],
  '.': ['.....', '.....', '.....', '.....', '.....', '..X..', '..X..'],
  ':': ['.....', '..X..', '..X..', '.....', '..X..', '..X..', '.....'],
  '[': ['.XXX.', '.X...', '.X...', '.X...', '.X...', '.X...', '.XXX.'],
  ']': ['.XXX.', '...X.', '...X.', '...X.', '...X.', '...X.', '.XXX.'],
  '-': ['.....', '.....', '.....', 'XXXXX', '.....', '.....', '.....'],
  '/': ['....X', '....X', '...X.', '..X..', '.X...', 'X....', 'X....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

export const GLYPH_W = 5;
export const GLYPH_H = 7;
let counter = 0;

export interface StencilOpts {
  color: number;
  scale?: number;
  origin?: [number, number];
  depth: number;
}

// Text drawn straight from the glyph grids into a small canvas: always crisp, one pixel scale.
export class StencilText {
  private tex: Phaser.Textures.CanvasTexture;
  private img: Phaser.GameObjects.Image;
  private text = '';
  private color: number;
  private scale: number;
  private origin: [number, number];

  constructor(scene: Phaser.Scene, private x: number, private y: number, o: StencilOpts) {
    this.color = o.color;
    this.scale = o.scale ?? 1;
    this.origin = o.origin ?? [0, 0];
    const key = `stencil${counter++}`;
    this.tex = scene.textures.createCanvas(key, 200 * this.scale, (GLYPH_H + 1) * this.scale + 2)!;
    this.img = scene.add.image(x, y, key).setOrigin(0, 0).setDepth(o.depth).setVisible(false);
  }

  set(text: string, color = this.color): this {
    if (text === this.text && color === this.color) return this;
    this.text = text;
    this.color = color;
    const s = this.scale;
    const ctx = this.tex.getContext();
    ctx.clearRect(0, 0, this.tex.width, this.tex.height);
    const w = Math.max(0, text.length * (GLYPH_W + 1) - 1) * s;
    const h = GLYPH_H * s;
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    // one-pixel ink shadow first so the lettering holds up on any floor
    for (const [ox, oy, col] of [[1, 1, PALETTE.ink], [0, 0, color]] as const) {
      ctx.fillStyle = hex(col);
      [...text.toUpperCase()].forEach((ch, i) => {
        const g = G[ch] ?? G[' '];
        g.forEach((row, ry) => [...row].forEach((v, rx) => v === 'X' && ctx.fillRect((i * (GLYPH_W + 1) + rx) * s + ox, ry * s + oy, s, s)));
      });
    }
    this.tex.refresh();
    this.img.setCrop(0, 0, w + 1, h + 1).setVisible(text.length > 0);
    this.place(w, h);
    return this;
  }

  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    this.place(Math.max(0, this.text.length * (GLYPH_W + 1) - 1) * this.scale, GLYPH_H * this.scale);
    return this;
  }

  setVisible(v: boolean): this {
    this.img.setVisible(v && this.text.length > 0);
    return this;
  }

  private place(w: number, h: number): void {
    this.img.setPosition(Math.round(this.x - w * this.origin[0]), Math.round(this.y - h * this.origin[1]));
  }
}
