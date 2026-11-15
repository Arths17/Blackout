import Phaser from 'phaser';
import { initAudio, play, setMusic, startAmbience } from '../audio';
import { BOSS_LEVELS, PALETTE, VIEW } from '../config';
import { LORE } from '../lore';
import { progress, totalCoins } from '../progress';
import { coinsFor } from '../sim/coins';

interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rest: boolean;
}

const CX = VIEW.w / 2;
const BASE = 118; // y of the chest's bottom edge
const FLOOR_Y = 128;
const clean = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9 .:\-[\]]/g, '');

// Opened between fights. It pays out coins for how fast the boss fell and tells a piece of the story.
export class Chest extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private coinsG!: Phaser.GameObjects.Graphics;
  private state: 'closed' | 'opening' | 'open' = 'closed';
  private p = 0;
  private coins: Coin[] = [];
  private spawn = 0;
  private awarded = 0;
  private shown = 0;
  private typed = 0;
  private message = '';
  private body!: Phaser.GameObjects.BitmapText;
  private hint!: Phaser.GameObjects.BitmapText;
  private gain!: Phaser.GameObjects.BitmapText;
  private total!: Phaser.GameObjects.BitmapText;
  private box!: Phaser.GameObjects.Graphics;
  private pingAt = 0;
  private leaving = false;

  constructor() {
    super('Chest');
  }

  create(): void {
    this.state = 'closed';
    this.p = 0;
    this.coins = [];
    this.spawn = 0;
    this.shown = 0;
    this.typed = 0;
    this.pingAt = 0;
    this.leaving = false;
    initAudio();
    startAmbience();
    setMusic('music_menu');
    const lvl = progress.level;
    const lore = LORE[lvl];
    this.message = clean(lore.text);
    this.awarded = coinsFor(lvl, progress.levelTimes[lvl]);

    this.cameras.main.setBackgroundColor(PALETTE.ink);
    this.cameras.main.fadeIn(500, 8, 13, 18);
    // warm pool of light behind the chest, in flat steps
    const glow = this.add.graphics();
    for (let i = 7; i >= 0; i--) glow.fillStyle(PALETTE.warm, 0.025 + (7 - i) * 0.006).fillEllipse(CX, 112, 90 + i * 26, 34 + i * 12);
    glow.fillStyle(PALETTE.n1, 1).fillRect(0, FLOOR_Y + 8, VIEW.w, VIEW.h);
    glow.fillStyle(PALETTE.n3, 1).fillRect(0, FLOOR_Y + 8, VIEW.w, 1);
    this.g = this.add.graphics().setDepth(5);
    this.coinsG = this.add.graphics().setDepth(6);
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(20);
    this.add.image(0, 0, 'grain').setOrigin(0, 0).setDepth(21).setAlpha(0.035);

    const text = (x: number, y: number, v: string, size: number, tint: number, origin = 0.5) =>
      this.add.bitmapText(x, y, 'stencil', v, size).setTint(tint).setOrigin(origin, 0.5).setDepth(30);
    text(CX, 14, lore.chest, 7, PALETTE.warm2);
    text(CX, 25, `BOSS ${lvl + 1} OF ${BOSS_LEVELS.length} DEFEATED`, 7, PALETTE.n6);
    this.total = text(VIEW.w - 8, 8, `COINS ${totalCoins()}`, 7, PALETTE.warm, 1);
    this.gain = text(CX, 44, '', 14, PALETTE.warm).setAlpha(0);
    this.hint = text(CX, 150, '[ENTER] OPEN THE CHEST', 7, PALETTE.warm2);
    this.tweens.add({ targets: this.hint, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });

    this.box = this.add.graphics().setDepth(29).setVisible(false);
    this.box.fillStyle(PALETTE.ink, 0.9).fillRect(14, 136, VIEW.w - 28, 62);
    this.box.lineStyle(1, PALETTE.n4, 1).strokeRect(14, 136, VIEW.w - 28, 62);
    this.box.lineStyle(1, PALETTE.n3, 1).strokeRect(17, 139, VIEW.w - 34, 56);
    this.body = this.add.bitmapText(22, 143, 'stencil', '', 7).setTint(PALETTE.w).setDepth(30).setMaxWidth(VIEW.w - 46).setVisible(false);

    const kb = this.input.keyboard!;
    for (const k of ['ENTER', 'SPACE', 'E']) kb.on(`keydown-${k}`, () => this.press());
  }

  private press(): void {
    if (this.leaving) return;
    if (this.state === 'closed') {
      this.state = 'opening';
      progress.levelCoins[progress.level] = this.awarded;
      play('chest_open');
      this.hint.setVisible(false);
      return;
    }
    if (this.state !== 'open') return;
    if (this.typed < this.message.length) {
      this.typed = this.message.length;
      return;
    }
    this.leaving = true;
    this.cameras.main.fadeOut(400, 8, 13, 18);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (progress.level >= BOSS_LEVELS.length - 1) this.scene.start('Finish');
      else {
        progress.level++;
        this.scene.start('Game');
      }
    });
  }

  private drawChest(): void {
    const g = this.g;
    g.clear();
    const p = this.p;
    const L = CX - 28;
    const R = CX + 28;
    g.fillStyle(PALETTE.ink, 0.45).fillEllipse(CX, BASE + 3, 74, 9);
    // light spilling out of an opened chest
    if (p > 0.3) {
      const k = Math.min(1, (p - 0.3) / 0.7);
      g.fillStyle(PALETTE.warm2, 0.1 * k).fillTriangle(L + 4, BASE - 26, R - 4, BASE - 26, CX, 12);
      g.fillStyle(PALETTE.warm2, 0.08 * k).fillTriangle(L + 12, BASE - 26, R - 12, BASE - 26, CX, 4);
    }
    // body
    g.fillStyle(PALETTE.ink, 1).fillRect(L - 1, BASE - 25, 58, 26);
    g.fillStyle(PALETTE.r3, 1).fillRect(L, BASE - 24, 56, 24);
    g.fillStyle(PALETTE.r2, 1).fillRect(L, BASE - 16, 56, 1).fillRect(L, BASE - 8, 56, 1);
    g.fillStyle(PALETTE.r4, 1).fillRect(L, BASE - 24, 56, 1);
    g.fillStyle(PALETTE.n5, 1).fillRect(L + 4, BASE - 24, 4, 24).fillRect(R - 8, BASE - 24, 4, 24);
    g.fillStyle(PALETTE.n7, 1).fillRect(L + 4, BASE - 24, 1, 24).fillRect(R - 8, BASE - 24, 1, 24);
    // the lid swings up and back, leaving a gap that shows the inside
    const top = BASE - 24;
    const rise = p * 17;
    const inset = p * 6;
    const lidH = 12 - p * 5;
    const lidBottom = top - rise;
    if (rise > 1) {
      g.fillStyle(PALETTE.r1, 1).fillRect(L + 2, top - rise, 52, rise + 1);
      const k = Math.min(1, p);
      // coins heaped inside
      g.fillStyle(PALETTE.warm, k).fillRect(L + 3, top - 5, 50, 5);
      g.fillStyle(PALETTE.warm2, k).fillRect(L + 6, top - 8, 44, 3).fillRect(L + 14, top - 11, 28, 3);
      g.fillStyle(PALETTE.w, k * 0.8).fillRect(L + 18, top - 11, 3, 1).fillRect(L + 34, top - 8, 3, 1);
    }
    g.fillStyle(PALETTE.ink, 1).fillRect(L + inset - 1, lidBottom - lidH - 1, 58 - inset * 2, lidH + 2);
    g.fillStyle(p > 0.15 ? PALETTE.r2 : PALETTE.r3, 1).fillRect(L + inset, lidBottom - lidH, 56 - inset * 2, lidH);
    g.fillStyle(PALETTE.r4, 1).fillRect(L + inset, lidBottom - lidH, 56 - inset * 2, 1);
    g.fillStyle(PALETTE.n5, 1).fillRect(L + 4 + inset * 0.5, lidBottom - lidH, 4, lidH).fillRect(R - 8 - inset * 0.5, lidBottom - lidH, 4, lidH);
    // lock
    if (p < 0.2) {
      g.fillStyle(PALETTE.ink, 1).fillRect(CX - 5, top - 4, 10, 9);
      g.fillStyle(PALETTE.warm, 1).fillRect(CX - 4, top - 3, 8, 7);
      g.fillStyle(PALETTE.ink, 1).fillRect(CX - 1, top - 1, 2, 3);
    }
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);
    if (this.state === 'opening') {
      this.p = Math.min(1, this.p + dt / 0.8);
      if (this.p >= 0.4 && this.spawn === 0) this.spawn = 1;
      if (this.p >= 1) {
        this.state = 'open';
        this.box.setVisible(true);
        this.body.setVisible(true);
        this.gain.setText(`${this.awarded} COINS`).setAlpha(1);
        this.cameras.main.flash(180, 255, 235, 190);
      }
    }
    // burst of coins out of the chest: one per ~3 coins awarded, up to 40
    if (this.spawn === 1 && this.coins.length < Math.min(40, Math.ceil(this.awarded / 3))) {
      for (let i = 0; i < 2 && this.coins.length < Math.min(40, Math.ceil(this.awarded / 3)); i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const v = 70 + Math.random() * 90;
        this.coins.push({ x: CX + (Math.random() - 0.5) * 30, y: BASE - 26, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rest: false });
      }
      this.shown = Math.min(this.awarded, Math.round((this.coins.length / Math.min(40, Math.ceil(this.awarded / 3))) * this.awarded));
      this.gain.setText(`${this.shown} COINS`).setAlpha(1);
      this.pingAt -= dt;
      if (this.pingAt <= 0) {
        play('coin');
        this.pingAt = 0.07;
      }
      this.total.setText(`COINS ${totalCoins() - this.awarded + this.shown}`);
    }
    if (this.state === 'open') {
      this.gain.setText(`${this.awarded} COINS`);
      this.total.setText(`COINS ${totalCoins()}`);
      if (this.typed < this.message.length) {
        this.typed = Math.min(this.message.length, this.typed + dt * 55);
        this.body.setText(this.message.slice(0, Math.floor(this.typed)));
      } else {
        this.body.setText(this.message);
        this.hint.setText(progress.level >= BOSS_LEVELS.length - 1 ? '[ENTER] FINISH' : '[ENTER] NEXT FIGHT').setPosition(CX, 206).setVisible(true).setAlpha(1);
      }
    }
    this.drawCoins(dt);
    this.drawChest();
  }

  private drawCoins(dt: number): void {
    const g = this.coinsG;
    g.clear();
    for (const c of this.coins) {
      if (!c.rest) {
        c.vy += 260 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        const floor = FLOOR_Y + (c.x * 7 % 9);
        if (c.y >= floor) {
          if (Math.abs(c.vy) > 40) {
            c.y = floor;
            c.vy *= -0.4;
            c.vx *= 0.6;
          } else {
            c.y = floor;
            c.rest = true;
          }
        }
      }
      g.fillStyle(PALETTE.ink, 1).fillRect(Math.round(c.x) - 2, Math.round(c.y) - 2, 5, 5);
      g.fillStyle(PALETTE.warm, 1).fillRect(Math.round(c.x) - 1, Math.round(c.y) - 1, 3, 3);
      g.fillStyle(PALETTE.warm2, 1).fillRect(Math.round(c.x) - 1, Math.round(c.y) - 1, 1, 1);
    }
  }
}
