import Phaser from 'phaser';
import { initAudio } from '../audio';
import { DARK, PALETTE, VIEW } from '../config';
import { TREE_EYES, pixLine } from '../render/pixel';

// Shown once per page load, before the controls panel. Five colours only: the blue-black of the room, the grey-green of its
// fog, cream for the title, amber for the eyes and the small print, rust for the underline.
let seen = false;
export const titleSeen = (): boolean => seen;

const WORD = 'BLACKOUT';
const SHAKY = [1, 0, 2, 0, 1, 2, 0, 1]; // the letters sit a pixel or two off each other, like they were placed by hand
const BROKEN = 3; // the K is the letter that keeps failing

const lerp = (a: number, b: number, t: number): number => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
};

export class Title extends Phaser.Scene {
  private letters: Phaser.GameObjects.BitmapText[] = [];
  private mon!: Phaser.GameObjects.Sprite;
  private eyes!: Phaser.GameObjects.Graphics;
  private fog!: Phaser.GameObjects.Graphics;
  private sparks!: Phaser.GameObjects.Graphics;
  private motes!: Phaser.GameObjects.Graphics;
  private prompt!: Phaser.GameObjects.BitmapText;
  private grain!: Phaser.GameObjects.Image;
  private bands = [
    { y: 112, x: 20, w: 150, v: 3.2, a: 0.1 },
    { y: 132, x: 190, w: 200, v: -2.1, a: 0.08 },
    { y: 146, x: 90, w: 120, v: 4.4, a: 0.12 },
    { y: 96, x: 250, w: 90, v: -1.6, a: 0.07 },
  ];
  private dust: { x: number; y: number; vx: number; vy: number }[] = [];
  private leaving = false;
  private born = 0;

  constructor() {
    super('Title');
  }

  create(): void {
    seen = true;
    initAudio(); // so the first key press also unlocks audio
    this.leaving = false;
    this.born = this.time.now;
    this.cameras.main.fadeIn(700, 8, 13, 18);

    this.drawSky();
    this.drawGround();

    this.mon = this.add.sprite(252, 150, 'tree-monster', 0).setOrigin(0.5, 0.82).setDisplaySize(112, 112).setTint(0x1a2630).setDepth(10);
    this.eyes = this.add.graphics().setDepth(12);
    this.fog = this.add.graphics().setDepth(20);
    this.motes = this.add.graphics().setDepth(21);
    for (let i = 0; i < 26; i++) this.dust.push({ x: Math.random() * VIEW.w, y: Math.random() * VIEW.h, vx: 1 + Math.random() * 3, vy: -0.6 + Math.random() * 1.6 });

    this.drawTitle();
    this.sparks = this.add.graphics().setDepth(31);

    this.prompt = this.add.bitmapText(22, 150, 'stencil', '> PRESS ANY KEY', 7).setTint(PALETTE.n7).setDepth(32);

    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(40);
    this.grain = this.add.image(0, 0, 'grain').setOrigin(0, 0).setDepth(41).setAlpha(DARK.grainAlpha * 1.4);

    const go = () => this.leave();
    this.input.keyboard!.on('keydown', go);
    this.input.on('pointerdown', go);
  }

  // Flat bands that step darker toward the top, with a dithered seam between them instead of a smooth blend.
  private drawSky(): void {
    const g = this.add.graphics().setDepth(0);
    const top = PALETTE.ink;
    const low = 0x16282c;
    const n = 18;
    const h = Math.ceil(VIEW.h / n);
    for (let i = 0; i < n; i++) {
      const c = lerp(top, low, (i / (n - 1)) ** 1.4);
      g.fillStyle(c, 1).fillRect(0, i * h, VIEW.w, h);
      if (i > 0) {
        const prev = lerp(top, low, ((i - 1) / (n - 1)) ** 1.4);
        g.fillStyle(prev, 1);
        for (let x = 0; x < VIEW.w; x += 2) g.fillRect(x + (i % 2), i * h, 1, 1);
      }
    }
    // a pale pool of air behind the head, in stepped rings so it reads as light and not as a shape
    for (let r = 0; r < 6; r++) g.fillStyle(PALETTE.g3, 0.05).fillCircle(252, 74, 70 - r * 10);
  }

  // The floor is ragged on purpose: uneven heights and a few blades or roots sticking up out of it.
  private drawGround(): void {
    const g = this.add.graphics().setDepth(14);
    let s = 90210;
    const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    let h = 154;
    for (let x = 0; x < VIEW.w; x += 2) {
      h = Math.max(150, Math.min(160, h + Math.round((r() - 0.5) * 3)));
      g.fillStyle(PALETTE.ink, 1).fillRect(x, h, 2, VIEW.h - h);
      if (r() < 0.09) g.fillStyle(PALETTE.ink, 1).fillRect(x, h - 3 - Math.floor(r() * 8), 1, 12);
    }
    g.fillStyle(PALETTE.n1, 1).fillRect(0, 168, VIEW.w, 12);
    for (let x = 0; x < VIEW.w; x += 3) if (r() < 0.5) g.fillStyle(PALETTE.ink, 1).fillRect(x, 168 + Math.floor(r() * 3), 2, 1);
  }

  private drawTitle(): void {
    const x0 = 20;
    const y0 = 38;
    const adv = 26;
    WORD.split('').forEach((ch, i) => {
      const x = x0 + i * adv;
      const y = y0 + SHAKY[i];
      this.add.bitmapText(x + 2, y + 2, 'stencil', ch, 28).setTint(PALETTE.r1).setDepth(29);
      this.letters.push(this.add.bitmapText(x, y, 'stencil', ch, 28).setTint(PALETTE.warm2).setDepth(30));
    });
    // a crack through the O
    const g = this.add.graphics().setDepth(31);
    const ox = x0 + 5 * adv;
    g.fillStyle(PALETTE.ink, 1);
    pixLine(g, ox + 8, y0 + 3 + SHAKY[5], ox + 13, y0 + 14 + SHAKY[5]);
    pixLine(g, ox + 13, y0 + 14 + SHAKY[5], ox + 11, y0 + 18 + SHAKY[5]);
    pixLine(g, ox + 11, y0 + 18 + SHAKY[5], ox + 16, y0 + 30 + SHAKY[5]);

    this.add.bitmapText(24, 80, 'stencil', 'BOUNCE BACK', 14).setTint(PALETTE.warm).setDepth(30);
    // the underline wobbles, the way a hand-drawn one would
    const u = this.add.graphics().setDepth(30);
    u.fillStyle(PALETTE.r4, 1);
    let y = 99;
    for (let x = 24; x < 24 + 11 * 12; x += 3) {
      if (Math.random() < 0.3) y += Math.random() < 0.5 ? -1 : 1;
      y = Math.max(98, Math.min(100, y));
      u.fillRect(x, y, 3, 1);
    }
  }

  private leave(): void {
    if (this.leaving || this.time.now - this.born < 400) return;
    this.leaving = true;
    this.cameras.main.fadeOut(280, 8, 13, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Game'));
  }

  update(_t: number, deltaMs: number): void {
    const t = (this.time.now - this.born) / 1000;
    const dt = Math.min(deltaMs / 1000, 0.1);

    // the K gives out in short bursts and comes back; the rest of the word stays steady
    const k = this.letters[BROKEN];
    const phase = t % 6.5;
    const dead = (phase > 4.1 && phase < 4.2) || (phase > 4.3 && phase < 4.36) || (phase > 5.7 && phase < 6.0);
    k.setAlpha(dead ? 0.12 : phase > 4.2 && phase < 4.3 ? 0.55 : 1);

    // the creature breathes by a pixel; its own eyes (found on the sheet at boot) glow, and it blinks now and then
    const bob = Math.round(Math.sin(t * 1.15));
    this.mon.setPosition(252, 140 + bob);
    const eyes = this.eyes;
    eyes.clear();
    const cells = TREE_EYES.get(0) ?? [];
    const open = t > 1.2 && !(t % 5.4 > 5.22);
    const s = 112 / 64;
    const left = 252 - 56;
    const top = 140 + bob - 112 * 0.82;
    const pulse = 0.75 + Math.sin(t * 2.2) * 0.2;
    if (open) {
      for (const [cx, cy] of cells) {
        const ex = Math.round(left + cx * s);
        const ey = Math.round(top + cy * s);
        eyes.fillStyle(0xff8a1f, 0.16 * pulse).fillRect(ex - 3, ey - 3, 8, 8);
        eyes.fillStyle(0xff8a1f, 0.28 * pulse).fillRect(ex - 1, ey - 1, 4, 4);
        eyes.fillStyle(0xffb347, pulse).fillRect(ex, ey, 2, 2);
      }
    }

    // fog drifts at different speeds; each band is a few stacked thin strips so the ends feather out
    this.fog.clear();
    for (const b of this.bands) {
      b.x += b.v * dt;
      if (b.v > 0 && b.x > VIEW.w) b.x = -b.w;
      if (b.v < 0 && b.x + b.w < 0) b.x = VIEW.w;
      for (let i = 0; i < 4; i++) {
        this.fog.fillStyle(PALETTE.g4, b.a * (1 - i * 0.2)).fillRect(Math.round(b.x + i * 6), b.y + i, b.w - i * 12, 1);
      }
    }
    this.motes.clear();
    for (const m of this.dust) {
      m.x = (m.x + m.vx * dt + VIEW.w) % VIEW.w;
      m.y = (m.y + m.vy * dt + VIEW.h) % VIEW.h;
      this.motes.fillStyle(PALETTE.n7, 0.35).fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }

    // sparks jump off the K while it is failing
    const sp = this.sparks;
    sp.clear();
    if (dead) {
      const kx = 20 + BROKEN * 26;
      const ky = 38 + SHAKY[BROKEN];
      for (let i = 0; i < 5; i++) {
        sp.fillStyle(i % 2 ? PALETTE.warm2 : PALETTE.warm, 1).fillRect(kx + 4 + Math.floor(Math.random() * 20), ky + 8 + Math.floor(Math.random() * 26), 1, 1);
      }
    }
    // the prompt blinks in steps, not fades
    this.prompt.setAlpha(Math.floor(t / 0.55) % 3 === 2 ? 0.25 : 1);
    this.grain.setPosition(-Math.floor(Math.random() * 8), -Math.floor(Math.random() * 8));
  }
}
