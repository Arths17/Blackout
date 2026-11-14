import Phaser from 'phaser';
import { CFG, EXIT, H, PALETTE, VIS, W } from '../config';
import { inExit, isOffline, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { DEPTH } from './layers';

// Kept clear of the exit door, which sits in the top wall to the right.
const SHOCK_RIGHT = EXIT.x - 24;

export class Hud {
  private g: Phaser.GameObjects.Graphics;
  private status: Phaser.GameObjects.Text;
  private prompt: Phaser.GameObjects.Text;
  private banner: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;
  private bar: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    const base = { fontFamily: VIS.font, color: '#8794ad' };
    this.g = scene.add.graphics().setDepth(DEPTH.hud);
    scene.add.text(14, 22, 'HP', { ...base, fontSize: '18px' }).setOrigin(0, 0.5).setDepth(DEPTH.text);
    scene.add.text(SHOCK_RIGHT - 5 * 30 - 6, 22, 'SHOCK', { ...base, fontSize: '18px' }).setOrigin(1, 0.5).setDepth(DEPTH.text);
    this.status = scene.add.text(W / 2, 22, '', { ...base, fontSize: '20px' }).setOrigin(0.5).setDepth(DEPTH.text);
    this.prompt = scene.add.text(0, 0, 'E', { ...base, fontSize: '16px', color: '#cfd8e6' }).setOrigin(0.5).setDepth(DEPTH.text).setVisible(false);
    this.bar = scene.add.rectangle(0, H / 2 - 4, W, 120, PALETTE.ink, 0.6).setOrigin(0, 0.5).setDepth(DEPTH.banner - 1).setVisible(false);
    this.banner = scene.add.text(W / 2, H / 2 - 22, '', { fontFamily: VIS.font, fontSize: '60px', color: '#ffb14a' }).setOrigin(0.5).setDepth(DEPTH.banner);
    this.sub = scene.add.text(W / 2, H / 2 + 26, '', { ...base, fontSize: '22px', color: '#cfd8e6' }).setOrigin(0.5).setDepth(DEPTH.banner);
    scene.add.text(W - 14, H - 8, 'WASD MOVE   E FIRE   R RESTART', { ...base, fontSize: '12px', color: '#3a4560' }).setOrigin(1, 1).setDepth(DEPTH.text);
  }

  draw(w: World): void {
    const g = this.g;
    g.clear();
    for (let i = 0; i < CFG.healthPips; i++) {
      const x = 46 + i * 34;
      const full = i < w.hp;
      g.fillStyle(0x0a0d14, 1).fillRect(x - 2, 6, 32, 32);
      g.fillStyle(full ? 0xc9372b : 0x2a1a1a, 1).fillRect(x, 8, 28, 28);
      if (full) g.fillStyle(0xe8604f, 1).fillRect(x, 8, 28, 5);
      g.lineStyle(2, full ? 0x5a1a14 : 0x3a2626, 1).strokeRect(x, 8, 28, 28);
    }
    for (let i = 0; i < CFG.shocksToWin; i++) {
      const cx = SHOCK_RIGHT - 15 - i * 30;
      const full = i < w.shocks;
      const pts: [number, number][] = [[cx + 4, 6], [cx - 8, 24], [cx - 1, 24], [cx - 5, 38], [cx + 9, 17], [cx + 2, 17]];
      g.fillStyle(full ? PALETTE.surge : 0x161d2c, 1);
      g.beginPath();
      pts.forEach(([x, y], k) => (k === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.closePath();
      g.fillPath();
      g.lineStyle(1.5, full ? 0xbcd8ff : 0x39435a, 1);
      g.beginPath();
      pts.forEach(([x, y], k) => (k === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.closePath();
      g.strokePath();
    }

    let status = '';
    if (w.phase === 'play') status = w.cooldown > 0 ? `GENERATOR ${w.cooldown.toFixed(1)}` : w.surge ? '' : 'POWER READY';
    this.status.setText(status).setColor(w.cooldown > 0 ? '#b0453a' : '#6f7c96');

    this.prompt.setVisible(false);
    if (w.phase === 'play' && !w.surge && w.cooldown <= 0) {
      for (const r of ROUTES) {
        const d = Math.hypot(w.player.x - r.switchPos.x, w.player.y - r.switchPos.y);
        if (d <= CFG.interactRange && !isOffline(w, r.id)) this.prompt.setVisible(true).setPosition(w.player.x, w.player.y - 28);
      }
    }

    let banner = '';
    let sub = '';
    if (w.phase === 'won' && !inExit(w.player)) {
      banner = 'POWER RESTORED';
      sub = 'EXIT OPEN';
    } else if (w.phase === 'escaped') {
      banner = 'OUT';
      sub = `${w.endTime.toFixed(1)}s     RESTART [R]`;
    } else if (w.phase === 'lost') {
      banner = 'BLACKED OUT';
      sub = 'RESTART [R]';
    }
    this.bar.setVisible(banner !== '');
    this.banner.setText(banner).setColor(w.phase === 'lost' ? '#c9372b' : '#ffb14a');
    this.sub.setText(sub);
  }
}
