import Phaser from 'phaser';
import { CFG, PALETTE } from '../config';
import type { World } from '../sim/game';
import { DEPTH } from './layers';
import { EYES, atlasOf, facingOf, pixLine, px } from './pixel';

export class CreatureView {
  private spr: Phaser.GameObjects.Sprite;
  private ghost: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.spr = scene.add.sprite(0, 0, 'creature', 0).setOrigin(0.5, 24 / 32);
    this.ghost = scene.add.sprite(0, 0, 'creature', 0).setOrigin(0.5, 24 / 32).setDepth(DEPTH.ghost).setVisible(false);
    this.shadow = scene.add.image(0, 0, 'shadow', 1).setOrigin(0.5, 0.5).setDepth(DEPTH.shadow);
    this.eyes = scene.add.graphics().setDepth(DEPTH.over);
  }

  update(w: World, t: number): void {
    const c = w.creature;
    const A = atlasOf(this.scene).sheets.creature;
    const f = facingOf(c.facing);
    const base = A.dirs[f.dir] as number;
    let frame: number;
    let dx = 0;
    if (!c.alive) {
      frame = A.death[Math.min(3, Math.floor((w.time - w.endTime) * 5))];
    } else if (c.state === 'windup') {
      const k = 1 - Math.max(0, c.timer) / Math.max(0.01, c.windupTotal);
      frame = base + A.anims.windup[k < 0.3 ? 0 : k < 0.7 ? 1 : 2];
      if (k > 0.45) dx = Math.round(Math.sin(t * 70) * (k > 0.8 ? 1.5 : 1));
    } else if (c.state === 'lunge') frame = base + A.anims.lunge[Math.floor(t * 14) % 2];
    else if (c.state === 'recoil') frame = base + A.anims.recoil[c.timer > 0.25 ? 0 : 1];
    else if (c.asleep) frame = A.sleep;
    else frame = base + A.anims.stalk[Math.floor(t * 6) % 4];

    const x = Math.round(px(c.x)) + dx;
    const y = Math.round(px(c.y)) + 6;
    const flip = f.flip && frame < A.death[0];
    this.spr.setFrame(frame).setFlipX(flip).setPosition(x, y).setDepth(DEPTH.y + y);
    if (c.alive && c.state === 'recoil' && Math.floor(t * 24) % 2 === 0) this.spr.setTintFill(PALETTE.w);
    else this.spr.clearTint();
    this.shadow.setPosition(x, y - 1).setVisible(true);

    // a lamp or the surge showing the creature for a moment, drawn above the darkness
    const reveal = c.alive ? Math.max(0, Math.min(1, (w.revealUntil - t) / CFG.revealSeconds)) : 0;
    this.ghost.setVisible(reveal > 0).setFrame(frame).setFlipX(flip).setPosition(x, y).setAlpha(Math.min(1, reveal * 1.6));

    // glowing eyes stay visible in the dark
    const g = this.eyes;
    g.clear();
    if (c.alive) {
      const px0 = x - 16;
      const py0 = y - 24;
      for (const [ex, ey] of EYES.get(frame) ?? []) {
        const X = px0 + (flip ? 31 - ex : ex);
        const Y = py0 + ey;
        g.fillStyle(PALETTE.g3, 1).fillRect(X - 1, Y, 3, 1).fillRect(X, Y - 1, 1, 3);
        g.fillStyle(PALETTE.g5, 1).fillRect(X, Y, 1, 1);
        if (c.state === 'windup' || c.state === 'lunge') g.fillRect(X + (flip ? -1 : 1), Y, 1, 1);
      }
      this.telegraph(g, w);
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
