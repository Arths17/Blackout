import Phaser from 'phaser';
import { ROOMS, CFG, PALETTE, VIEW } from '../config';
import { progress } from '../progress';
import { inExit, type World } from '../sim/game';
import { DEPTH } from './layers';
import { atlasOf } from './pixel';

// The controls window opens once per page load; restarting with R skips it.
let controlsSeen = false;

export class Hud {
  private pips: Phaser.GameObjects.Image[] = [];
  private banner: Phaser.GameObjects.BitmapText;
  private sub: Phaser.GameObjects.BitmapText;
  private bar: Phaser.GameObjects.Rectangle;
  private frame: Phaser.GameObjects.Graphics;
  private healthCaption: Phaser.GameObjects.BitmapText;
  private status: Phaser.GameObjects.BitmapText;
  private controlsPanel: Phaser.GameObjects.Graphics;
  private controlsTitle: Phaser.GameObjects.BitmapText;
  private controlsText: Phaser.GameObjects.BitmapText;
  private controlsHint: Phaser.GameObjects.BitmapText;
  private controlsClose: Phaser.GameObjects.Rectangle;
  private controlsCloseLabel: Phaser.GameObjects.BitmapText;
  private controlsOpen = !controlsSeen;
  private onClose: () => void;
  private onTitle: () => void;
  private backBtn: Phaser.GameObjects.Rectangle;
  private backLabel: Phaser.GameObjects.BitmapText;

  constructor(private scene: Phaser.Scene, onControlsClose: () => void, onTitle: () => void) {
    this.onClose = onControlsClose;
    this.onTitle = onTitle;
    const text = (x: number, y: number, value: string, tint: number, size = 7) =>
      scene.add.bitmapText(x, y, 'stencil', value, size).setTint(tint).setOrigin(0.5).setDepth(DEPTH.text);
    this.frame = scene.add.graphics().setDepth(DEPTH.hud - 1);
    // Wide enough for five life pips and the caption.
    this.frame.fillStyle(PALETTE.ink, 0.9).fillRect(2, 1, 110, 15);
    this.frame.lineStyle(1, PALETTE.n3, 1).strokeRect(2, 1, 110, 15);
    this.frame.fillStyle(PALETTE.ink, 0.88).fillRect(2, VIEW.h - 17, VIEW.w - 4, 15);
    this.frame.lineStyle(1, PALETTE.n3, 1).strokeRect(2, VIEW.h - 17, VIEW.w - 4, 15);
    // Which fight this is, top right, for the whole fight.
    const TAGW = 80;
    this.frame.fillStyle(PALETTE.ink, 0.9).fillRect(VIEW.w - 2 - TAGW, 1, TAGW, 15);
    this.frame.lineStyle(1, PALETTE.n3, 1).strokeRect(VIEW.w - 2 - TAGW, 1, TAGW, 15);
    text(VIEW.w - 2 - TAGW / 2, 8, `ROOM ${progress.level + 1} OF ${ROOMS.length}`, PALETTE.warm, 7);
    this.healthCaption = text(84, 8, 'HEALTH', PALETTE.n6, 7);
    this.status = text(VIEW.w / 2, VIEW.h - 10, '', PALETTE.warm2, 7);
    for (let i = 0; i < CFG.healthPips; i++) this.pips.push(scene.add.image(5 + i * 10, 2, 'ui', 0).setOrigin(0, 0).setDepth(DEPTH.hud));
    this.bar = scene.add.rectangle(0, VIEW.h / 2, VIEW.w, 38, PALETTE.ink, 0.92).setOrigin(0, 0.5).setDepth(DEPTH.banner - 1).setVisible(false);
    this.banner = text(VIEW.w / 2, VIEW.h / 2 - 7, '', PALETTE.n7, 14).setDepth(DEPTH.banner);
    this.sub = text(VIEW.w / 2, VIEW.h / 2 + 10, '', PALETTE.n7).setDepth(DEPTH.banner);
    // Sized to the text: the widest line is 34 characters at 6 px.
    const PW = 236;
    const PH = 146;
    const px0 = Math.round((VIEW.w - PW) / 2);
    const py0 = Math.round((VIEW.h - PH) / 2);
    this.controlsPanel = scene.add.graphics().setDepth(DEPTH.banner - 2);
    this.controlsPanel.fillStyle(PALETTE.ink, 0.96).fillRect(px0, py0, PW, PH);
    this.controlsPanel.lineStyle(1, PALETTE.c2, 1).strokeRect(px0, py0, PW, PH);
    this.controlsPanel.lineStyle(1, PALETTE.n3, 1).strokeRect(px0 + 4, py0 + 4, PW - 8, PH - 8);
    this.controlsTitle = text(VIEW.w / 2, py0 + 13, 'CONTROLS', PALETTE.warm2, 7).setDepth(DEPTH.banner + 1);
    this.controlsText = text(VIEW.w / 2, py0 + 59, 'MOVE   WASD  ARROWS\n1 2 3  FIRE THAT GENERATOR\n4 F    PARRY THE BOSS\nSHIFT  SMALL DASH\nR      RESTART\n\nFIRE WHEN THE BOSS CROSSES A PATH.\nTWO PARRIES MAKE A SUPER BOUNCE.', PALETTE.w, 7).setDepth(DEPTH.banner + 1);
    this.backBtn = scene.add.rectangle(VIEW.w / 2, py0 + PH - 36, 150, 14, PALETTE.r1, 1)
      .setStrokeStyle(1, PALETTE.c2, 1)
      .setDepth(DEPTH.banner)
      .setInteractive({ useHandCursor: true });
    this.backLabel = text(VIEW.w / 2, py0 + PH - 36, 'BACK TO TITLE SCREEN [T]', PALETTE.w, 7).setDepth(DEPTH.banner + 1);
    this.backBtn.on('pointerover', () => this.backBtn.setFillStyle(PALETTE.n3, 1));
    this.backBtn.on('pointerout', () => this.backBtn.setFillStyle(PALETTE.r1, 1));
    this.backBtn.on('pointerdown', () => this.toTitle());
    this.controlsHint = text(VIEW.w / 2, py0 + PH - 12, 'PRESS ANY KEY TO BEGIN', PALETTE.warm2, 7).setDepth(DEPTH.banner + 1);
    this.controlsClose = scene.add.rectangle(px0 + PW - 12, py0 + 12, 14, 12, PALETTE.r1, 1)
      .setStrokeStyle(1, PALETTE.c2, 1)
      .setDepth(DEPTH.banner);
    this.controlsCloseLabel = text(px0 + PW - 12, py0 + 12, 'X', PALETTE.w, 7).setDepth(DEPTH.banner + 1);
    this.controlsClose.setInteractive({ useHandCursor: true });
    this.controlsClose.on('pointerdown', () => this.closeControls());
  }

  // Esc: pause the fight and show the controls again, or resume.
  toggleControls(): void {
    if (this.controlsOpen) this.closeControls();
    else {
      this.controlsOpen = true;
      this.controlsHint.setText('PRESS ANY KEY TO RESUME');
    }
  }

  toTitle(): void {
    if (this.controlsOpen) this.onTitle();
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

  update(w: World): void {
    const U = atlasOf(this.scene).sheets.ui;
    this.pips.forEach((p, i) => p.setFrame(i < w.hp ? U.pip.full : w.grace > 0.8 && i === w.hp ? U.pip.flash : U.pip.empty));
    this.healthCaption.setTint(w.hp <= 1 ? PALETTE.r4 : PALETTE.n6);
    let status = 'PRESS 1  2  OR 3 TO FIRE A GENERATOR';
    if (w.phase !== 'play') status = '';
    else if (w.bounce) status = w.bounce.super ? 'SUPER BOUNCE  HIT IT BACK' : 'BOUNCING  HIT IT BACK';
    else if (w.parryStreak > 0) status = `PARRY ${w.parryStreak} OF ${CFG.parriesForSuper}  ONE MORE FOR A SUPER BOUNCE`;
    else if (w.surge) status = 'SURGE LIVE';
    else if (w.cooldown > 0) status = 'GENERATOR RECOVERING';
    else if (w.shocks === 0 && w.missStreak > 0) status = 'MISSED  WAIT FOR IT TO CROSS A PATH';
    else if (w.lastHitBreaker >= 0) status = `GENERATOR ${w.lastHitBreaker + 1} OFFLINE  PICK ANOTHER`;
    this.status.setText(status);
    let banner = '', sub = '';
    if (w.phase === 'won' && !inExit(w.player)) { banner = 'POWER RESTORED'; sub = 'EXIT OPEN  GO UP, TOP RIGHT'; }
    else if (w.phase === 'escaped') {
      const last = progress.level >= ROOMS.length - 1;
      banner = last ? 'THE ROT ENDS' : `BOSS ${progress.level + 1} DEFEATED`;
      sub = `${w.endTime.toFixed(1)}S  [ENTER] OPEN THE CHEST`;
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
    this.backBtn.setVisible(showControls);
    this.backLabel.setVisible(showControls);
    if (showControls) this.backBtn.setInteractive();
    else this.backBtn.disableInteractive();
  }
}
