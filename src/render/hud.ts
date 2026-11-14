import Phaser from 'phaser';
import { CFG, EXIT, PALETTE, VIEW } from '../config';
import { inExit, isOffline, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { DEPTH } from './layers';
import { atlasOf, px } from './pixel';

export class Hud {
  private pips: Phaser.GameObjects.Image[] = [];
  private bolts: Phaser.GameObjects.Image[] = [];
  private status: Phaser.GameObjects.BitmapText;
  private prompt: Phaser.GameObjects.BitmapText;
  private banner: Phaser.GameObjects.BitmapText;
  private sub: Phaser.GameObjects.BitmapText;
  private bar: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene) {
    const text = (x: number, y: number, value: string, tint: number, size = 7) =>
      scene.add.bitmapText(x, y, 'stencil', value, size).setTint(tint).setOrigin(0.5).setDepth(DEPTH.text);
    for (let i = 0; i < CFG.healthPips; i++) this.pips.push(scene.add.image(5 + i * 10, 2, 'ui', 0).setOrigin(0, 0).setDepth(DEPTH.hud));
    const right = Math.floor(px(EXIT.x)) - 6;
    for (let i = 0; i < CFG.shocksToWin; i++) this.bolts.push(scene.add.image(right - (CFG.shocksToWin - i) * 10, 1, 'ui', 3).setOrigin(0, 0).setDepth(DEPTH.hud));
    this.status = text(130, 5, '', PALETTE.n7);
    this.prompt = text(0, 0, 'E', PALETTE.w).setVisible(false);
    this.bar = scene.add.rectangle(0, VIEW.h / 2, VIEW.w, 38, PALETTE.ink, 0.92).setOrigin(0, 0.5).setDepth(DEPTH.banner - 1).setVisible(false);
    this.banner = text(VIEW.w / 2, VIEW.h / 2 - 7, '', PALETTE.n7, 14).setDepth(DEPTH.banner);
    this.sub = text(VIEW.w / 2, VIEW.h / 2 + 10, '', PALETTE.n7).setDepth(DEPTH.banner);
    text(VIEW.w / 2, VIEW.h - 5, 'WASD MOVE  E CHARGE/FIRE  Z SHIELD  R RESTART', PALETTE.n6);
  }

  update(w: World, t: number): void {
    const U = atlasOf(this.scene).sheets.ui;
    this.pips.forEach((p, i) => p.setFrame(i < w.hp ? U.pip.full : w.grace > 0.8 && i === w.hp ? U.pip.flash : U.pip.empty));
    this.bolts.forEach((b, i) => b.setFrame(i < w.shocks ? U.bolt.full : U.bolt.empty));
    const status = w.phase !== 'play' || w.surge ? '' : w.energy > 0 ? 'ENERGY READY' : w.cooldown > 0 ? `GEN ${w.cooldown.toFixed(1)}` : 'POWER READY';
    this.status.setText(status).setTint(PALETTE.n7);
    this.prompt.setVisible(false);
    if (w.phase === 'play' && !w.surge && w.cooldown <= 0 && w.energy === 0) {
      for (const r of ROUTES) {
        if (Math.hypot(w.player.x - r.switchPos.x, w.player.y - r.switchPos.y) <= CFG.interactRange && !isOffline(w, r.id)) {
          this.prompt.setVisible(true).setPosition(Math.round(px(w.player.x)), Math.round(px(w.player.y)) - 17 + Math.floor(t * 3) % 2);
        }
      }
    }
    let banner = '', sub = '';
    if (w.phase === 'won' && !inExit(w.player)) { banner = 'POWER RESTORED'; sub = 'EXIT OPEN'; }
    else if (w.phase === 'escaped') { banner = 'OUT'; sub = `${w.endTime.toFixed(1)}S  RESTART [R]`; }
    else if (w.phase === 'lost') { banner = 'BLACKED OUT'; sub = 'RESTART [R]'; }
    this.bar.setVisible(banner !== '');
    this.banner.setText(banner).setTint(w.phase === 'lost' ? PALETTE.n7 : PALETTE.warm);
    this.sub.setText(sub);
  }
}
