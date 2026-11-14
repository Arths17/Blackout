import Phaser from 'phaser';
import { CFG, PALETTE } from '../config';
import type { World } from '../sim/game';
import { DEPTH } from './layers';
import { atlasOf, facingOf, px } from './pixel';

export class PlayerView {
  private spr: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private ball: Phaser.GameObjects.Graphics;
  private hp = CFG.healthPips;
  private hurtAt = -Infinity;
  private interactAt = -Infinity;

  constructor(private scene: Phaser.Scene) {
    this.spr = scene.add.sprite(0, 0, 'player', 0).setOrigin(0.5, 23 / 24);
    this.shadow = scene.add.image(0, 0, 'shadow', 0).setOrigin(0.5, 0.5).setDepth(DEPTH.shadow);
    this.ball = scene.add.graphics().setDepth(DEPTH.over + 2);
  }

  interact(t: number): void {
    this.interactAt = t;
  }

  update(w: World, t: number): void {
    const p = w.player;
    const x = Math.round(px(p.x)), y = Math.round(px(p.y)) + 3;
    this.ball.clear();
    if (w.charged >= 0 && !w.bounce) {
      const pulse = Math.sin(t * 10);
      const cy = y - 7;
      this.ball.lineStyle(1, PALETTE.c1, 0.9).strokeCircle(x, cy, 11 + pulse);
      this.ball.lineStyle(1, PALETTE.w, 0.5).strokeCircle(x, cy, 14 - pulse);
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + (i * Math.PI * 2) / 3;
        this.ball.fillStyle(PALETTE.w, 1).fillRect(Math.round(x + Math.cos(a) * 12), Math.round(cy + Math.sin(a) * 12), 1, 1);
      }
    }
    if (w.bounce) {
      this.spr.setVisible(false);
      const pulse = 5 + Math.sin(t * 18) * 1.2;
      const b = w.bounce;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      for (let i = 4; i >= 1; i--) {
        this.ball.fillStyle(PALETTE.c2, 0.12 * (5 - i)).fillCircle(x - (b.vx / sp) * i * 5, y - (b.vy / sp) * i * 5, pulse - i * 0.6);
      }
      this.ball.fillStyle(PALETTE.c2, 0.35).fillCircle(x, y, pulse + 3);
      this.ball.fillStyle(PALETTE.c1, 1).fillCircle(x, y, pulse);
      this.ball.fillStyle(PALETTE.w, 1).fillCircle(x - 1, y - 1, 2);
      this.shadow.setPosition(x, y - 1);
      return;
    }
    this.spr.setVisible(true);
    const anims = atlasOf(this.scene).sheets.player.anims;
    const facing = facingOf(p.facing);
    const dir = facing.flip ? 'left' : facing.dir;
    if (w.hp < this.hp) this.hurtAt = t;
    this.hp = w.hp;
    let name = `${p.moving ? 'walk' : 'idle'}_${dir}`;
    let elapsed = t;
    let loop = true;
    if (w.phase === 'lost') { name = 'fall'; elapsed = t - w.endTime; loop = false; }
    else if (w.phase === 'won' || w.phase === 'escaped') {
      if (!p.moving) { name = 'victory'; elapsed = t - w.endTime; loop = false; }
    } else if (t - this.hurtAt < anims.hurt.frames.length / anims.hurt.fps) {
      name = 'hurt'; elapsed = t - this.hurtAt; loop = false;
    } else if (t - this.interactAt < anims.interact.frames.length / anims.interact.fps && !p.moving) {
      name = 'interact'; elapsed = t - this.interactAt; loop = false;
    }
    const animation = anims[name];
    const index = Math.max(0, Math.floor(elapsed * animation.fps));
    const frame = animation.frames[loop ? index % animation.frames.length : Math.min(animation.frames.length - 1, index)];
    this.spr.setFrame(frame).setPosition(x, y).setDepth(DEPTH.y + y);
    if (w.grace > 0 && Math.floor(t * 14) % 2 === 0) this.spr.setTintFill(PALETTE.n7);
    else this.spr.clearTint();
    this.shadow.setPosition(x, y - 1);
  }
}
