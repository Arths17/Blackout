import Phaser from 'phaser';
import { PALETTE } from '../config';
import type { World } from '../sim/game';
import { DEPTH } from './layers';
import { atlasOf, facingOf, px } from './pixel';

export class PlayerView {
  private spr: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene) {
    this.spr = scene.add.sprite(0, 0, 'player', 0).setOrigin(0.5, 15 / 16);
    this.shadow = scene.add.image(0, 0, 'shadow', 0).setOrigin(0.5, 0.5).setDepth(DEPTH.shadow);
  }

  update(w: World, t: number): void {
    const p = w.player;
    const A = atlasOf(this.scene).sheets.player;
    const f = facingOf(p.facing);
    const frame = A.dirs[f.dir] + (p.moving ? A.walk[Math.floor(t * 9) % 4] : A.idle);
    const x = Math.round(px(p.x));
    const y = Math.round(px(p.y)) + 4;
    const hurt = w.grace > 0 && Math.floor(t * 14) % 2 === 0;
    this.spr.setFrame(frame).setFlipX(f.flip).setPosition(x, y).setDepth(DEPTH.y + y).setAlpha(w.phase === 'lost' ? 0.6 : 1);
    if (hurt) this.spr.setTintFill(PALETTE.n7);
    else this.spr.clearTint();
    this.shadow.setPosition(x, y - 1);
  }
}
