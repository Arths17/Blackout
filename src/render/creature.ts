import Phaser from 'phaser';
import { CFG, PALETTE } from '../config';
import type { World } from '../sim/game';
import { DEPTH } from './layers';
import { progress } from '../progress';
import { BOSS_SHEETS, TREE_EYES, facingOf, pixLine, px } from './pixel';

export class CreatureView {
  private spr: Phaser.GameObjects.Sprite;
  private ghost: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Graphics;
  private bar: Phaser.GameObjects.Graphics;
  private sheet = BOSS_SHEETS[progress.level];
  private shown = 0; // segments drawn, easing toward the real value so a hit visibly drains

  constructor(scene: Phaser.Scene) {
    this.spr = scene.add.sprite(0, 0, this.sheet, 0).setOrigin(0.5, 0.82).setDisplaySize(64, 64);
    this.ghost = scene.add.sprite(0, 0, this.sheet, 0).setOrigin(0.5, 0.82).setDisplaySize(64, 64).setDepth(DEPTH.ghost).setVisible(false);
    this.shadow = scene.add.image(0, 0, 'shadow', 1).setOrigin(0.5, 0.5).setDepth(DEPTH.shadow);
    this.eyes = scene.add.graphics().setDepth(DEPTH.over);
    this.bar = scene.add.graphics().setDepth(DEPTH.over + 1);
    this.shown = CFG.shocksToWin;
  }

  update(w: World, t: number): void {
    const c = w.creature;
    const f = facingOf(c.facing);
    let frame: number;
    let dx = 0;
    if (!c.alive) {
      frame = 18 + Math.min(3, Math.floor((w.time - w.endTime) * 5));
    } else if (c.state === 'windup') {
      const k = 1 - Math.max(0, c.timer) / Math.max(0.01, c.windupTotal);
      frame = 12 + (k < 0.3 ? 0 : k < 0.7 ? 1 : 2);
      if (k > 0.45) dx = Math.round(Math.sin(t * 70) * (k > 0.8 ? 1.5 : 1));
    } else if (c.state === 'lunge') frame = 18 + Math.floor(t * 14) % 2;
    else if (c.state === 'recoil') frame = 6 + (c.timer > 0.25 ? 0 : 1);
    else if (c.asleep || c.state === 'freeze') frame = 0;
    else frame = Math.floor(t * 6) % 6;

    const x = Math.round(px(c.x)) + dx;
    const y = Math.round(px(c.y)) + 6;
    const flip = f.flip;
    this.spr.setFrame(frame).setFlipX(flip).setPosition(x, y).setDepth(DEPTH.y + y);
    if (c.alive && c.state === 'recoil' && Math.floor(t * 24) % 2 === 0) this.spr.setTintFill(PALETTE.w);
    else if (c.alive && c.state === 'freeze') this.spr.setTint(PALETTE.c2);
    else this.spr.clearTint();
    this.shadow.setPosition(x, y - 1).setVisible(true);

    // a lamp or the surge showing the creature for a moment, drawn above the darkness
    const reveal = c.alive ? Math.max(0, Math.min(1, (w.revealUntil - t) / CFG.revealSeconds)) : 0;
    this.ghost.setVisible(reveal > 0).setFrame(frame).setFlipX(flip).setPosition(x, y).setAlpha(Math.min(1, reveal * 1.6));

    this.drawHealth(w, x, y);
    const g = this.eyes;
    g.clear();
    if (c.alive) {
      this.drawEyes(g, w, t, x, y, frame, flip);
      this.telegraph(g, w);
    }
  }

  // Segmented health bar over the boss's head, one segment per shock still needed.
  private drawHealth(w: World, x: number, y: number): void {
    const g = this.bar;
    g.clear();
    if (!w.creature.alive) return;
    const n = CFG.shocksToWin;
    const left = Math.max(0, n - w.shocks);
    this.shown += (left - this.shown) * 0.18;
    if (Math.abs(this.shown - left) < 0.01) this.shown = left;
    const seg = 8;
    const gap = 1;
    const width = n * seg + (n - 1) * gap;
    const bx = Math.round(x - width / 2);
    const by = Math.round(y - 64 * 0.82 + 3);
    g.fillStyle(PALETTE.ink, 0.92).fillRect(bx - 2, by - 2, width + 4, 7);
    g.lineStyle(1, PALETTE.r3, 1).strokeRect(bx - 2, by - 2, width + 4, 7);
    for (let i = 0; i < n; i++) {
      const sx = bx + i * (seg + gap);
      g.fillStyle(PALETTE.r1, 1).fillRect(sx, by, seg, 3);
      const now = Math.max(0, Math.min(1, left - i));
      const was = Math.max(0, Math.min(1, this.shown - i));
      if (now > 0) g.fillStyle(left === 1 ? PALETTE.r5 : PALETTE.r4, 1).fillRect(sx, by, Math.round(seg * now), 3);
      // the part that was just lost drains away in white
      if (was > now) g.fillStyle(PALETTE.w, 0.9).fillRect(sx + Math.round(seg * now), by, Math.max(1, Math.round(seg * (was - now))), 3);
    }
  }

  private drawEyes(g: Phaser.GameObjects.Graphics, w: World, t: number, x: number, y: number, frame: number, flip: boolean): void {
    const reveal = w.creature.asleep ? Math.max(0, Math.min(1, (t - Math.max(0, CFG.introSeconds - 1)) / 1)) : 1;
    const cells = TREE_EYES.get(`${this.sheet}:${frame}`);
    if (reveal <= 0 || !cells || cells.length === 0) return;
    const pulse = 0.72 + Math.sin(t * 7) * 0.18;
    // The sprite is drawn 64 px wide with its origin at (0.5, 0.82); the cells are in that 64 px space.
    const left = Math.round(x - 32);
    const top = Math.round(y - 64 * 0.82);
    for (const [cx, cy] of cells) {
      const ex = left + (flip ? 63 - cx : cx);
      const ey = top + cy;
      g.fillStyle(0xffc233, 0.22 * reveal).fillRect(ex - 1, ey - 1, 3, 3);
      g.fillStyle(0xffe45c, pulse * reveal).fillRect(ex, ey, 1, 1);
    }
  }

  // Chevrons ahead of the head that march outward through the windup, readable with the sound off.
  private telegraph(g: Phaser.GameObjects.Graphics, w: World): void {
    const c = w.creature;
    if (c.state !== 'windup') return;
    const k = 1 - Math.max(0, c.timer) / Math.max(0.01, c.windupTotal);
    const ux = Math.cos(c.facing);
    const uy = Math.sin(c.facing);
    const cx = px(c.x);
    const cy = px(c.y);
    for (let i = 0; i < 3; i++) {
      const lit = k * 3 > i;
      if (!lit) continue;
      const d = 13 + i * 5;
      const tipX = cx + ux * (d + 3);
      const tipY = cy + uy * (d + 3);
      g.fillStyle(i === 2 ? PALETTE.g5 : PALETTE.g4, 1);
      pixLine(g, tipX, tipY, cx + ux * d - uy * 4, cy + uy * d + ux * 4);
      pixLine(g, tipX, tipY, cx + ux * d + uy * 4, cy + uy * d - ux * 4);
    }
  }
}
