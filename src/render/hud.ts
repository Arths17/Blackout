import Phaser from 'phaser';
import { CFG, EXIT, PALETTE, VIEW } from '../config';
import { inExit, isOffline, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { StencilText } from './font';
import { DEPTH } from './layers';
import { atlasOf, px } from './pixel';

export class Hud {
  private pips: Phaser.GameObjects.Image[] = [];
  private bolts: Phaser.GameObjects.Image[] = [];
  private status: StencilText;
  private prompt: StencilText;
  private banner: StencilText;
  private sub: StencilText;
  private bar: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene) {
    for (let i = 0; i < CFG.healthPips; i++) this.pips.push(scene.add.image(5 + i * 11, 1, 'ui', 0).setOrigin(0, 0).setDepth(DEPTH.hud));
    const right = Math.floor(px(EXIT.x)) - 6;
    for (let i = 0; i < CFG.shocksToWin; i++) this.bolts.push(scene.add.image(right - (CFG.shocksToWin - i) * 11, 0, 'ui', 3).setOrigin(0, 0).setDepth(DEPTH.hud));
    this.status = new StencilText(scene, 104, 6, { color: PALETTE.n7, origin: [0.5, 0.5], depth: DEPTH.text });
    this.prompt = new StencilText(scene, 0, 0, { color: PALETTE.w, origin: [0.5, 0.5], depth: DEPTH.text });
    this.bar = scene.add.rectangle(0, VIEW.h / 2, VIEW.w, 40, PALETTE.ink, 0.78).setOrigin(0, 0.5).setDepth(DEPTH.banner - 1).setVisible(false);
    this.banner = new StencilText(scene, VIEW.w / 2, VIEW.h / 2 - 9, { color: PALETTE.warm, scale: 2, origin: [0.5, 0.5], depth: DEPTH.banner });
    this.sub = new StencilText(scene, VIEW.w / 2, VIEW.h / 2 + 11, { color: PALETTE.n7, origin: [0.5, 0.5], depth: DEPTH.banner });
    new StencilText(scene, VIEW.w / 2, VIEW.h - 6, { color: PALETTE.n4, origin: [0.5, 0.5], depth: DEPTH.text }).set('WASD  E FIRE  R RESTART');
  }

  update(w: World, t: number): void {
    const U = atlasOf(this.scene).sheets.ui;
    this.pips.forEach((p, i) => p.setFrame(i < w.hp ? (w.grace > 0.8 && i === w.hp ? U.pip.flash : U.pip.full) : U.pip.empty));
    this.bolts.forEach((b, i) => b.setFrame(i < w.shocks ? U.bolt.full : U.bolt.empty));

    let status = '';
    if (w.phase === 'play') status = w.cooldown > 0 ? `GENERATOR ${w.cooldown.toFixed(1)}` : w.surge ? '' : 'POWER READY';
    this.status.set(status, w.cooldown > 0 ? PALETTE.r4 : PALETTE.n7);

    this.prompt.set('');
    if (w.phase === 'play' && !w.surge && w.cooldown <= 0) {
      for (const r of ROUTES) {
        const d = Math.hypot(w.player.x - r.switchPos.x, w.player.y - r.switchPos.y);
        if (d <= CFG.interactRange && !isOffline(w, r.id)) {
          this.prompt.set('E').setPosition(Math.round(px(w.player.x)), Math.round(px(w.player.y)) - 17 + (Math.floor(t * 3) % 2));
        }
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
    this.banner.set(banner, w.phase === 'lost' ? PALETTE.r4 : PALETTE.warm);
    this.sub.set(sub);
  }
}
