import Phaser from 'phaser';
import { CFG, EXIT, PALETTE, VIEW } from '../config';
import { inExit, isOffline, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { DEPTH } from './layers';
import { atlasOf, px } from './pixel';

export class Hud {
  private pips: Phaser.GameObjects.Image[] = [];
  private bolts: Phaser.GameObjects.Image[] = [];
  private prompt: Phaser.GameObjects.BitmapText;
  private banner: Phaser.GameObjects.BitmapText;
  private sub: Phaser.GameObjects.BitmapText;
  private bar: Phaser.GameObjects.Rectangle;
  private frame: Phaser.GameObjects.Graphics;
  private bossBar: Phaser.GameObjects.Graphics;
  private healthCaption: Phaser.GameObjects.BitmapText;
  private bossCaption: Phaser.GameObjects.BitmapText;
  private shieldFx: Phaser.GameObjects.Graphics;
  private controlsPanel: Phaser.GameObjects.Graphics;
  private controlsTitle: Phaser.GameObjects.BitmapText;
  private controlsText: Phaser.GameObjects.BitmapText;
  private controlsHint: Phaser.GameObjects.BitmapText;
  private controlsClose: Phaser.GameObjects.Rectangle;
  private controlsCloseLabel: Phaser.GameObjects.BitmapText;
  private controlsOpen = true;

  constructor(private scene: Phaser.Scene, onControlsClose: () => void) {
    const text = (x: number, y: number, value: string, tint: number, size = 7) =>
      scene.add.bitmapText(x, y, 'stencil', value, size).setTint(tint).setOrigin(0.5).setDepth(DEPTH.text);
    this.frame = scene.add.graphics().setDepth(DEPTH.hud - 1);
    this.frame.fillStyle(PALETTE.ink, 0.9).fillRect(2, 1, 96, 15);
    this.frame.lineStyle(1, PALETTE.n3, 1).strokeRect(2, 1, 96, 15);
    this.frame.fillStyle(PALETTE.ink, 0.9).fillRect(196, 1, 122, 15);
    this.frame.lineStyle(1, PALETTE.n3, 1).strokeRect(196, 1, 122, 15);
    this.frame.fillStyle(PALETTE.ink, 0.88).fillRect(2, VIEW.h - 17, VIEW.w - 4, 15);
    this.frame.lineStyle(1, PALETTE.n3, 1).strokeRect(2, VIEW.h - 17, VIEW.w - 4, 15);
    this.healthCaption = text(49, 5, 'VITAL', PALETTE.n6, 5);
    this.bossCaption = text(224, 5, 'BOSS HP', PALETTE.r4, 5);
    for (let i = 0; i < CFG.healthPips; i++) this.pips.push(scene.add.image(5 + i * 10, 2, 'ui', 0).setOrigin(0, 0).setDepth(DEPTH.hud));
    const right = Math.floor(px(EXIT.x)) - 6;
    for (let i = 0; i < CFG.shocksToWin; i++) this.bolts.push(scene.add.image(right - (CFG.shocksToWin - i) * 10, 1, 'ui', 3).setOrigin(0, 0).setDepth(DEPTH.hud));
    this.bossBar = scene.add.graphics().setDepth(DEPTH.hud);
    this.shieldFx = scene.add.graphics().setDepth(DEPTH.hud);
    this.prompt = text(0, 0, 'E', PALETTE.w).setVisible(false);
    this.bar = scene.add.rectangle(0, VIEW.h / 2, VIEW.w, 38, PALETTE.ink, 0.92).setOrigin(0, 0.5).setDepth(DEPTH.banner - 1).setVisible(false);
    this.banner = text(VIEW.w / 2, VIEW.h / 2 - 7, '', PALETTE.n7, 14).setDepth(DEPTH.banner);
    this.sub = text(VIEW.w / 2, VIEW.h / 2 + 10, '', PALETTE.n7).setDepth(DEPTH.banner);
    this.controlsPanel = scene.add.graphics().setDepth(DEPTH.banner - 2);
    this.controlsPanel.fillStyle(PALETTE.ink, 0.96).fillRect(68, 43, 184, 91);
    this.controlsPanel.lineStyle(1, PALETTE.c2, 1).strokeRect(68, 43, 184, 91);
    this.controlsPanel.lineStyle(1, PALETTE.n3, 1).strokeRect(72, 47, 176, 83);
    this.controlsTitle = text(VIEW.w / 2, 55, 'CONTROLS', PALETTE.warm2, 8);
    this.controlsText = text(VIEW.w / 2, 82, 'MOVE   WASD / ARROWS\nE       CHARGE / FIRE\nZ       SHIELD THE SHOCKWAVE\nR       RESTART', PALETTE.w, 7);
    this.controlsHint = text(VIEW.w / 2, 122, 'CLOSE THIS WINDOW TO BEGIN', PALETTE.warm2, 5);
    this.controlsClose = scene.add.rectangle(239, 53, 14, 12, PALETTE.r1, 1)
      .setStrokeStyle(1, PALETTE.c2, 1)
      .setDepth(DEPTH.banner);
    this.controlsCloseLabel = text(239, 53, 'X', PALETTE.w, 7).setDepth(DEPTH.banner + 1);
    this.controlsClose.setInteractive({ useHandCursor: true });
    this.controlsClose.on('pointerdown', () => {
      if (!this.controlsOpen) return;
      this.controlsOpen = false;
      onControlsClose();
    });
  }

  isControlsOpen(): boolean {
    return this.controlsOpen;
  }

  update(w: World, t: number): void {
    const U = atlasOf(this.scene).sheets.ui;
    this.pips.forEach((p, i) => p.setFrame(i < w.hp ? U.pip.full : w.grace > 0.8 && i === w.hp ? U.pip.flash : U.pip.empty));
    this.bolts.forEach((b, i) => b.setFrame(i < w.shocks ? U.bolt.full : U.bolt.empty));
    this.bossBar.clear();
    this.bossBar.fillStyle(PALETTE.r1, 1).fillRect(244, 10, 68, 4);
    this.bossBar.lineStyle(1, PALETTE.r3, 1).strokeRect(244, 10, 68, 4);
    this.bossBar.fillStyle(PALETTE.r4, 1).fillRect(245, 11, 66 * Math.max(0, 1 - w.shocks / CFG.shocksToWin), 2);
    this.healthCaption.setTint(w.hp <= 1 ? PALETTE.r4 : PALETTE.n6);
    this.bossCaption.setTint(w.shocks >= CFG.shocksToWin - 1 ? PALETTE.r5 : PALETTE.r4);
    const shieldX = 300;
    const shieldY = 10;
    const pulse = 1 + Math.sin(t * 8) * 0.12;
    const shieldColor = w.shielding ? PALETTE.c1 : PALETTE.c3;
    const shieldAlpha = w.shielding ? 0.95 : 0.45;
    this.shieldFx.clear();
    this.drawShield(shieldX, shieldY, shieldColor, shieldAlpha, pulse);
    if (w.shielding) {
      this.shieldFx.lineStyle(1, PALETTE.w, 0.9);
      this.shieldFx.strokeCircle(shieldX, shieldY, 11 * pulse);
      for (let i = 0; i < 8; i++) {
        const a = t * 5 + i * Math.PI / 4;
        this.shieldFx.lineBetween(
          shieldX + Math.cos(a) * 10,
          shieldY + Math.sin(a) * 10,
          shieldX + Math.cos(a) * 14,
          shieldY + Math.sin(a) * 14,
        );
      }
    }
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
    const showControls = this.controlsOpen;
    this.controlsPanel.setVisible(showControls);
    this.controlsTitle.setVisible(showControls);
    this.controlsText.setVisible(showControls);
    this.controlsHint.setVisible(showControls);
    this.controlsClose.setVisible(showControls);
    this.controlsCloseLabel.setVisible(showControls);
  }

  private drawShield(x: number, y: number, color: number, alpha: number, scale: number): void {
    const points = [
      { x: x, y: y - 7 * scale },
      { x: x + 7 * scale, y: y - 4 * scale },
      { x: x + 6 * scale, y: y + 3 * scale },
      { x: x, y: y + 8 * scale },
      { x: x - 6 * scale, y: y + 3 * scale },
      { x: x - 7 * scale, y: y - 4 * scale },
    ];
    this.shieldFx.fillStyle(color, alpha * 0.28);
    this.shieldFx.fillPoints(points, true);
    this.shieldFx.lineStyle(1, color, alpha);
    this.shieldFx.strokePoints(points, true);
    this.shieldFx.lineBetween(x - 3 * scale, y, x - scale, y + 2 * scale);
    this.shieldFx.lineBetween(x - scale, y + 2 * scale, x + 4 * scale, y - 3 * scale);
  }
}
