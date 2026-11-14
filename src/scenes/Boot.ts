import Phaser from 'phaser';
import { DARK, PALETTE, VIEW } from '../config';
import { EYES, dither, rgb, type Atlas } from '../render/pixel';

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.bitmapFont('stencil', 'assets/stencil.png', 'assets/stencil.xml');
    this.load.json('atlas', 'assets/atlas.json');
    this.load.once('filecomplete-json-atlas', () => {
      const a = this.cache.json.get('atlas') as Atlas;
      for (const [name, s] of Object.entries(a.sheets)) {
        const [w, h] = s.frame as [number, number];
        this.load.spritesheet(name, `assets/${name}.png`, { frameWidth: w, frameHeight: h });
      }
    });
  }

  create(): void {
    this.scanEyes();
    this.makeVignette();
    this.makeGrain();
    this.scene.start('Game');
  }

  private scanEyes(): void {
    const img = this.textures.get('creature').getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const g5 = PALETTE.g5;
    const cols = c.width / 32;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (data[i + 3] && data[i] === ((g5 >> 16) & 255) && data[i + 1] === ((g5 >> 8) & 255) && data[i + 2] === (g5 & 255)) {
          const f = Math.floor(y / 32) * cols + Math.floor(x / 32);
          if (!EYES.has(f)) EYES.set(f, []);
          EYES.get(f)!.push([x % 32, y % 32]);
        }
      }
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
