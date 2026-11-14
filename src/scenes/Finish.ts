import Phaser from 'phaser';
import { initAudio, play, startAmbience } from '../audio';
import { BOSS_LEVELS, PALETTE, VIEW } from '../config';
import { progress, resetRun } from '../progress';

const fmt = (s: number): string => {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
};

// 5x7 question mark: the pixel font has no punctuation beyond . : - [ ].
const Q = ['01110', '11011', '00011', '00110', '00100', '00000', '00100'];

export class Finish extends Phaser.Scene {
  constructor() {
    super('Finish');
  }

  create(): void {
    initAudio();
    startAmbience();
    play('power_return');
    this.cameras.main.setBackgroundColor(PALETTE.ink);
    this.cameras.main.fadeIn(600, 8, 13, 18);
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(20);
    this.add.image(0, 0, 'grain').setOrigin(0, 0).setDepth(21).setAlpha(0.035);

    const text = (y: number, v: string, size: number, tint: number) =>
      this.add.bitmapText(VIEW.w / 2, y, 'stencil', v, size).setTint(tint).setOrigin(0.5);
    text(40, 'GOOD JOB', 14, PALETTE.warm2);
    const ask = text(66, 'WHAT DO YOU THINK OF BLACKOUT', 7, PALETTE.w);
    const g = this.add.graphics();
    const qx = Math.round(ask.x + ask.width / 2 - 1);
    const qy = Math.round(ask.y - 4);
    g.fillStyle(PALETTE.w, 1);
    Q.forEach((row, j) => [...row].forEach((c, i) => c === '1' && g.fillRect(qx + i, qy + j, 1, 1)));
    g.fillStyle(PALETTE.warm, 1).fillRect(VIEW.w / 2 - 70, 80, 140, 1);

    text(100, 'YOUR TIME', 7, PALETTE.n7);
    text(118, fmt(progress.total), 14, PALETTE.warm);
    BOSS_LEVELS.forEach((b, i) => {
      text(142 + i * 9, `${i + 1}  ${b.name}  ${progress.levelTimes[i].toFixed(1)}S`, 7, PALETTE.n6);
    });
    const hint = text(VIEW.h - 14, '[ENTER] PLAY AGAIN', 7, PALETTE.warm2);
    this.tweens.add({ targets: hint, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    this.input.keyboard!.on('keydown-ENTER', () => {
      resetRun();
      this.scene.start('Game');
    });
  }
}
