import Phaser from 'phaser';
import { EXIT, PALETTE } from '../config';
import type { World } from '../sim/game';
import type { Light } from './darkness';
import { DEPTH } from './layers';
import { px } from './pixel';

// After the boss falls, make the way out hard to miss: a lit doorway, marching arrows and a label.
export class ExitCue {
  private g: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.BitmapText;

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.over + 3);
    this.label = scene.add.bitmapText(0, 0, 'stencil', 'EXIT', 7).setTint(PALETTE.warm2).setOrigin(0.5).setDepth(DEPTH.text).setVisible(false);
  }

  update(w: World, t: number, lights: Light[]): void {
    const g = this.g;
    g.clear();
    const on = w.phase === 'won' || w.phase === 'escaped';
    this.label.setVisible(on && w.phase === 'won');
    if (!on) return;
    const x0 = Math.round(px(EXIT.x));
    const wd = Math.round(px(EXIT.w));
    const cx = x0 + wd / 2;
    const pulse = 0.55 + 0.35 * Math.sin(t * 5);
    g.lineStyle(1, PALETTE.warm2, pulse).strokeRect(x0 - 1, 3, wd + 2, 22);
    g.fillStyle(PALETTE.warm, 0.3 + 0.2 * pulse).fillRect(x0, 4, wd, 20);
    // chevrons marching up toward the door
    for (let i = 0; i < 3; i++) {
      const y = 38 - ((t * 14 + i * 7) % 21);
      const a = Math.max(0, Math.min(1, (y - 26) / 6)) * (y > 28 ? 1 : 0.4);
      g.fillStyle(PALETTE.warm2, 0.35 + 0.5 * a);
      for (let k = 0; k < 5; k++) {
        g.fillRect(Math.round(cx) - k, Math.round(y) + k, 1, 1);
        g.fillRect(Math.round(cx) + k, Math.round(y) + k, 1, 1);
      }
    }
    this.label.setPosition(Math.round(cx), 46);
    lights.push({ x: cx, y: 12, r: 66, tint: PALETTE.warm2 });
  }
}
