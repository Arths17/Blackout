import Phaser from 'phaser';
import { ROOMS, DARK, PALETTE, VIEW } from '../config';
import { progress } from '../progress';
import { titleSeen } from './Title';
import { TREE_EYES, dither, rgb, type Atlas } from '../render/pixel';
import { drawWardenSheet } from '../render/wardens';

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.bitmapFont('stencil', 'assets/stencil.png', 'assets/stencil.xml');
    this.load.json('atlas', 'assets/atlas.json');
    this.load.spritesheet('tree-monster', 'tree-root-monster.png', { frameWidth: 256, frameHeight: 256 });
    this.load.once('filecomplete-json-atlas', () => {
      const a = this.cache.json.get('atlas') as Atlas;
      for (const [name, s] of Object.entries(a.sheets)) {
        const [w, h] = s.frame as [number, number];
        this.load.spritesheet(name, `assets/${name}.png`, { frameWidth: w, frameHeight: h });
      }
    });
  }

  create(): void {
    this.scanTreeEyes();
    this.makeWardens();
    this.makeVignette();
    this.makeGrain();
    // Without this Space and the arrows also scroll the page the game is embedded in.
    this.input.keyboard!.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
    const q = new URLSearchParams(window.location.search);
    const lv = Number(q.get('level'));
    if (lv >= 1) progress.level = Math.min(ROOMS.length - 1, Math.floor(lv) - 1);
    // The dev flags (?level, ?lure, ?notitle) go straight to the game.
    const dev = ['level', 'lure', 'notitle'].some((k) => q.has(k));
    this.scene.start(dev || titleSeen() ? 'Game' : 'Title');
  }

  // The four hand-drawn wardens are painted in code, one 6 x 4 sheet of 64 px frames each.
  private makeWardens(): void {
    for (let i = 0; i < 4; i++) {
      const sheet = drawWardenSheet(i);
      const tex = this.textures.addCanvas(`warden${i}`, sheet.canvas)!;
      for (let f = 0; f < 24; f++) {
        tex.add(f, 0, (f % 6) * 64, Math.floor(f / 6) * 64, 64, 64);
        TREE_EYES.set(`warden${i}:${f}`, sheet.eyes.get(f) ?? []);
      }
    }
  }

  // The monster sheet draws its own orange eyes. Find them per frame so the glow lands on them exactly.
  private scanTreeEyes(): void {
    const img = this.textures.get('tree-monster').getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const cols = Math.floor(c.width / 256);
    const rows = Math.floor(c.height / 256);
    const k = 256 / 64;
    for (let f = 0; f < cols * rows; f++) {
      const x0 = (f % cols) * 256;
      const y0 = Math.floor(f / cols) * 256;
      const count = new Map<number, number>();
      for (let y = 0; y < 256; y++) {
        for (let x = 0; x < 256; x++) {
          const i = ((y0 + y) * c.width + x0 + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (data[i + 3] > 200 && r > 200 && g > 110 && b < 150 && r - b > 100) {
            const key = Math.floor(y / k) * 64 + Math.floor(x / k);
            count.set(key, (count.get(key) ?? 0) + 1);
          }
        }
      }
      const cells: [number, number][] = [];
      for (const [key, n] of count) if (n >= 3) cells.push([key % 64, Math.floor(key / 64)]);
      TREE_EYES.set(`tree-monster:${f}`, cells);
    }
  }

  // Stepped, dithered corners: four flat tiers, no smooth falloff.
  private makeVignette(): void {
    const t = this.textures.createCanvas('vignette', VIEW.w, VIEW.h)!;
    const ctx = t.getContext();
    const ink = rgb(PALETTE.ink);
    for (let y = 0; y < VIEW.h; y++) {
      for (let x = 0; x < VIEW.w; x++) {
        const nx = (x - VIEW.w / 2) / (VIEW.w / 2);
        const ny = (y - VIEW.h / 2) / (VIEW.h / 2);
        const d = Math.hypot(nx * 0.92, ny * 1.05) + dither(x, y) * 0.07;
        const a = DARK.vignette[d > 1 ? 3 : d > 0.85 ? 2 : d > 0.72 ? 1 : 0];
        if (a) {
          ctx.fillStyle = `rgba(${ink},${a})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    t.refresh();
  }

  private makeGrain(): void {
    const t = this.textures.createCanvas('grain', VIEW.w + 8, VIEW.h + 8)!;
    const ctx = t.getContext();
    ctx.fillStyle = `rgb(${rgb(PALETTE.n6)})`;
    let s = 12345;
    for (let y = 0; y < VIEW.h + 8; y++) {
      for (let x = 0; x < VIEW.w + 8; x++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        if (s / 4294967296 < 0.05) ctx.fillRect(x, y, 1, 1);
      }
    }
    t.refresh();
  }
}
