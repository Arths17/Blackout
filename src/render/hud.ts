import Phaser from 'phaser';
import { CFG, EXIT, PALETTE, VIEW } from '../config';
import { inExit, isOffline, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { DEPTH } from './layers';
import { atlasOf, px } from './pixel';

const FONT = '"Silkscreen", monospace';

export class Hud {
  private pips: Phaser.GameObjects.Image[] = [];
  private bolts: Phaser.GameObjects.Image[] = [];
  private status: Phaser.GameObjects.Text;
  private prompt: Phaser.GameObjects.Text;
  private banner: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene) {
    const style = (c: number, size = 8) => ({ fontFamily: FONT, fontSize: `${size}px`, color: `#${c.toString(16).padStart(6, '0')}` });
    for (let i = 0; i < CFG.healthPips; i++) this.pips.push(scene.add.image(5 + i * 11, 2, 'ui', 0).setOrigin(0, 0).setDepth(DEPTH.hud));
    const right = Math.floor(px(EXIT.x)) - 6;
    for (let i = 0; i < CFG.shocksToWin; i++) this.bolts.push(scene.add.image(right - (CFG.shocksToWin - i) * 11, 1, 'ui', 3).setOrigin(0, 0).setDepth(DEPTH.hud));
    this.status = scene.add.text(VIEW.w / 2 - 20, 7, '', style(PALETTE.n7)).setOrigin(0.5).setDepth(DEPTH.text);
    this.prompt = scene.add.text(0, 0, 'E', style(PALETTE.w)).setOrigin(0.5).setDepth(DEPTH.text).setVisible(false);
    this.bar = scene.add.rectangle(0, VIEW.h / 2, VIEW.w, 44, PALETTE.ink, 0.78).setOrigin(0, 0.5).setDepth(DEPTH.banner - 1).setVisible(false);
    this.banner = scene.add.text(VIEW.w / 2, VIEW.h / 2 - 7, '', style(PALETTE.warm, 16)).setOrigin(0.5).setDepth(DEPTH.banner);
    this.sub = scene.add.text(VIEW.w / 2, VIEW.h / 2 + 11, '', style(PALETTE.n7)).setOrigin(0.5).setDepth(DEPTH.banner);
    scene.add.text(VIEW.w / 2, VIEW.h - 7, 'WASD MOVE   E FIRE   R RESTART', style(PALETTE.n4)).setOrigin(0.5).setDepth(DEPTH.text);
  }

  update(w: World, t: number): void {
    const U = atlasOf(this.scene).sheets.ui;
    this.pips.forEach((p, i) => p.setFrame(i < w.hp ? (w.grace > 0.8 && i === w.hp ? U.pip.flash : U.pip.full) : U.pip.empty));
    this.bolts.forEach((b, i) => b.setFrame(i < w.shocks ? U.bolt.full : U.bolt.empty));

    let status = '';
    if (w.phase === 'play') status = w.cooldown > 0 ? `GENERATOR ${w.cooldown.toFixed(1)}` : w.surge ? '' : 'POWER READY';
    this.status.setText(status).setColor(w.cooldown > 0 ? '#d0402e' : '#8394ad');

    this.prompt.setVisible(false);
    if (w.phase === 'play' && !w.surge && w.cooldown <= 0) {
      for (const r of ROUTES) {
        const d = Math.hypot(w.player.x - r.switchPos.x, w.player.y - r.switchPos.y);
        if (d <= CFG.interactRange && !isOffline(w, r.id)) this.prompt.setVisible(true).setPosition(Math.round(px(w.player.x)), Math.round(px(w.player.y)) - 16 + (Math.floor(t * 3) % 2));
      }
    }

    let banner = '';
    let sub = '';
    if (w.phase === 'won' && !inExit(w.player)) {
      banner = 'POWER RESTORED';
      sub = 'EXIT OPEN';
    } else if (w.phase === 'escaped') {
      banner = 'OUT';
      sub = `${w.endTime.toFixed(1)}S    RESTART [R]`;
    } else if (w.phase === 'lost') {
      banner = 'BLACKED OUT';
      sub = 'RESTART [R]';
    }
    this.bar.setVisible(banner !== '');
    this.banner.setText(banner).setColor(w.phase === 'lost' ? '#d0402e' : '#ffb14a');
    this.sub.setText(sub);
  }
}
