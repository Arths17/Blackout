import Phaser from 'phaser';
import { CFG, PALETTE } from '../config';
import type { World } from '../sim/game';
import { DEPTH } from './layers';
import { facingOf, pixLine, px } from './pixel';

export class CreatureView {
  private spr: Phaser.GameObjects.Sprite;
  private ghost: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.spr = scene.add.sprite(0, 0, 'tree-monster', 0).setOrigin(0.5, 0.82).setDisplaySize(64, 64);
    this.ghost = scene.add.sprite(0, 0, 'tree-monster', 0).setOrigin(0.5, 0.82).setDisplaySize(64, 64).setDepth(DEPTH.ghost).setVisible(false);
    this.shadow = scene.add.image(0, 0, 'shadow', 1).setOrigin(0.5, 0.5).setDepth(DEPTH.shadow);
    this.eyes = scene.add.graphics().setDepth(DEPTH.over);
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
    else if (c.asleep) frame = 0;
    else frame = Math.floor(t * 6) % 6;

    const x = Math.round(px(c.x)) + dx;
    const y = Math.round(px(c.y)) + 6;
    const flip = f.flip;
    this.spr.setFrame(frame).setFlipX(flip).setPosition(x, y).setDepth(DEPTH.y + y);
    if (c.alive && c.state === 'recoil' && Math.floor(t * 24) % 2 === 0) this.spr.setTintFill(PALETTE.w);
    else this.spr.clearTint();
    this.shadow.setPosition(x, y - 1).setVisible(true);

    // a lamp or the surge showing the creature for a moment, drawn above the darkness
    const reveal = c.alive ? Math.max(0, Math.min(1, (w.revealUntil - t) / CFG.revealSeconds)) : 0;
    this.ghost.setVisible(reveal > 0).setFrame(frame).setFlipX(flip).setPosition(x, y).setAlpha(Math.min(1, reveal * 1.6));

    const g = this.eyes;
    g.clear();
    if (c.alive) {
      this.drawEyes(g, w, t, x, y);
      this.telegraph(g, w);
    }
  }

  private drawEyes(g: Phaser.GameObjects.Graphics, w: World, t: number, x: number, y: number): void {
    const reveal = w.creature.asleep ? Math.max(0, Math.min(1, (t - Math.max(0, CFG.introSeconds - 1)) / 1)) : 1;
    if (reveal <= 0) return;
    const pulse = 0.72 + Math.sin(t * 7) * 0.18;
    const eyeY = y - 29;
    for (const eyeX of [x - 6, x + 6]) {
      g.fillStyle(0xff1d32, 0.18 * reveal);
      g.fillRect(eyeX - 3, eyeY - 2, 7, 5);
      g.fillStyle(0xff3548, pulse * reveal);
      g.fillRect(eyeX - 2, eyeY - 1, 5, 3);
      g.fillStyle(PALETTE.w, reveal);
      g.fillRect(eyeX - 1, eyeY, 2, 1);
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
