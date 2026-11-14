import Phaser from 'phaser';
import { CFG, PALETTE, VIEW } from '../config';
import { inExit, isOffline, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { DEPTH } from './layers';
import { atlasOf, px } from './pixel';

// The controls window opens once per page load; restarting with R skips it.
let controlsSeen = false;

function bestTime(t: number): number {
  try {
    const old = Number(localStorage.getItem('blackout-best')) || Infinity;
    const best = Math.min(old, t);
    localStorage.setItem('blackout-best', String(best));
    return best;
  } catch {
    return t;
  }
}

export class Hud {
  private pips: Phaser.GameObjects.Image[] = [];
  private bolts: Phaser.GameObjects.Image[] = [];
  private prompt: Phaser.GameObjects.BitmapText;
  private banner: Phaser.GameObjects.BitmapText;
  private sub: Phaser.GameObjects.BitmapText;
  private bar: Phaser.GameObjects.Rectangle;
  private frame: Phaser.GameObjects.Graphics;
  private healthCaption: Phaser.GameObjects.BitmapText;
  private shockCaption: Phaser.GameObjects.BitmapText;
  private status: Phaser.GameObjects.BitmapText;
  private controlsPanel: Phaser.GameObjects.Graphics;
  private controlsTitle: Phaser.GameObjects.BitmapText;
  private controlsText: Phaser.GameObjects.BitmapText;
  private controlsHint: Phaser.GameObjects.BitmapText;
  private controlsClose: Phaser.GameObjects.Rectangle;
  private controlsCloseLabel: Phaser.GameObjects.BitmapText;
  private controlsOpen = !controlsSeen;
  private onClose: () => void;
  private best = 0;

  constructor(private scene: Phaser.Scene, onControlsClose: () => void) {
    this.onClose = onControlsClose;
    const text = (x: number, y: number, value: string, tint: number, size = 7) =>
      scene.add.bitmapText(x, y, 'stencil', value, size).setTint(tint).setOrigin(0.5).setDepth(DEPTH.text);
    this.frame = scene.add.graphics().setDepth(DEPTH.hud - 1);
    this.frame.fillStyle(PALETTE.ink, 0.9).fillRect(2, 1, 84, 15);
    this.frame.lineStyle(1, PALETTE.n3, 1).strokeRect(2, 1, 84, 15);
    this.frame.fillStyle(PALETTE.ink, 0.9).fillRect(186, 1, 132, 15);
    this.frame.lineStyle(1, PALETTE.n3, 1).strokeRect(186, 1, 132, 15);
    this.frame.fillStyle(PALETTE.ink, 0.88).fillRect(2, VIEW.h - 17, VIEW.w - 4, 15);
    this.frame.lineStyle(1, PALETTE.n3, 1).strokeRect(2, VIEW.h - 17, VIEW.w - 4, 15);
    this.healthCaption = text(66, 8, 'VITAL', PALETTE.n6, 7);
    this.shockCaption = text(213, 8, 'SHOCKS', PALETTE.n6, 7);
    this.status = text(VIEW.w / 2, VIEW.h - 10, '', PALETTE.warm2, 7);
    for (let i = 0; i < CFG.healthPips; i++) this.pips.push(scene.add.image(5 + i * 10, 2, 'ui', 0).setOrigin(0, 0).setDepth(DEPTH.hud));
    for (let i = 0; i < CFG.shocksToWin; i++) this.bolts.push(scene.add.image(236 + i * 16, 2, 'ui', 3).setOrigin(0, 0).setDepth(DEPTH.hud));
    this.prompt = text(0, 0, 'E', PALETTE.w).setVisible(false);
    this.bar = scene.add.rectangle(0, VIEW.h / 2, VIEW.w, 38, PALETTE.ink, 0.92).setOrigin(0, 0.5).setDepth(DEPTH.banner - 1).setVisible(false);
    this.banner = text(VIEW.w / 2, VIEW.h / 2 - 7, '', PALETTE.n7, 14).setDepth(DEPTH.banner);
    this.sub = text(VIEW.w / 2, VIEW.h / 2 + 10, '', PALETTE.n7).setDepth(DEPTH.banner);
    this.controlsPanel = scene.add.graphics().setDepth(DEPTH.banner - 2);
    this.controlsPanel.fillStyle(PALETTE.ink, 0.96).fillRect(68, 43, 184, 91);
    this.controlsPanel.lineStyle(1, PALETTE.c2, 1).strokeRect(68, 43, 184, 91);
    this.controlsPanel.lineStyle(1, PALETTE.n3, 1).strokeRect(72, 47, 176, 83);
    this.controlsTitle = text(VIEW.w / 2, 55, 'CONTROLS', PALETTE.warm2, 7).setDepth(DEPTH.banner + 1);
    this.controlsText = text(VIEW.w / 2, 82, 'MOVE   WASD / ARROWS\nE      THROW NEAREST BREAKER\nR      RESTART\n\nLURE IT. THROW. GET CLEAR.', PALETTE.w, 7).setDepth(DEPTH.banner + 1);
    this.controlsHint = text(VIEW.w / 2, 122, 'PRESS ANY KEY TO BEGIN', PALETTE.warm2, 7).setDepth(DEPTH.banner + 1);
    this.controlsClose = scene.add.rectangle(239, 53, 14, 12, PALETTE.r1, 1)
      .setStrokeStyle(1, PALETTE.c2, 1)
      .setDepth(DEPTH.banner);
    this.controlsCloseLabel = text(239, 53, 'X', PALETTE.w, 7).setDepth(DEPTH.banner + 1);
    this.controlsClose.setInteractive({ useHandCursor: true });
    this.controlsClose.on('pointerdown', () => this.closeControls());
  }

  closeControls(): void {
    if (!this.controlsOpen) return;
    this.controlsOpen = false;
    controlsSeen = true;
    this.onClose();
  }

  isControlsOpen(): boolean {
    return this.controlsOpen;
  }

  update(w: World, t: number): void {
    const U = atlasOf(this.scene).sheets.ui;
    this.pips.forEach((p, i) => p.setFrame(i < w.hp ? U.pip.full : w.grace > 0.8 && i === w.hp ? U.pip.flash : U.pip.empty));
    this.bolts.forEach((b, i) => b.setFrame(i < w.shocks ? U.bolt.full : U.bolt.empty));
    this.healthCaption.setTint(w.hp <= 1 ? PALETTE.r4 : PALETTE.n6);
    this.shockCaption.setTint(w.shocks >= CFG.shocksToWin - 1 ? PALETTE.warm2 : PALETTE.n6);
    this.prompt.setVisible(false);
    if (w.phase === 'play' && !w.surge && w.cooldown <= 0) {
      for (const r of ROUTES) {
        if (Math.hypot(w.player.x - r.switchPos.x, w.player.y - r.switchPos.y) <= CFG.interactRange && !isOffline(w, r.id)) {
          this.prompt.setVisible(true).setPosition(Math.round(px(w.player.x)), Math.round(px(w.player.y)) - 17 + Math.floor(t * 3) % 2);
        }
      }
    }
    let status = 'THROW BREAKER 1  [E]';
    if (w.phase !== 'play') status = '';
    else if (w.surge) status = 'SURGE LIVE';
    else if (w.cooldown > 0) status = 'GENERATOR RECOVERING';
    else if (w.shocks === 0 && w.missStreak > 0) status = 'MISSED  LURE IT FIRST';
    else if (w.lastHitBreaker >= 0) status = `BREAKER ${w.lastHitBreaker + 1} OFFLINE`;
    this.status.setText(status);
    let banner = '', sub = '';
    if (w.phase === 'won' && !inExit(w.player)) { banner = 'POWER RESTORED'; sub = 'EXIT OPEN'; }
    else if (w.phase === 'escaped') {
      if (this.best === 0) this.best = bestTime(w.endTime);
      banner = 'OUT';
      sub = `${w.endTime.toFixed(1)}S  BEST ${this.best.toFixed(1)}S  [R]`;
    }
    else if (w.phase === 'lost') { banner = 'BLACKED OUT'; sub = 'RESTART [R]'; }
    this.bar.setVisible(banner !== '');
    this.banner.setText(banner).setTint(w.phase === 'lost' ? PALETTE.n7 : PALETTE.warm);
    this.sub.setText(sub);
    const showControls = this.controlsOpen;
    this.controlsPanel.setVisible(showControls);
    this.controlsTitle.setVisible(showControls);
    this.controlsText.setVisible(showControls);
    this.controlsHint.setVisible(showControls);
    this.controlsClose.setVisible(showControls);
    this.controlsCloseLabel.setVisible(showControls);
  }
}
