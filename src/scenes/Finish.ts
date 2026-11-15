import Phaser from 'phaser';
import { play, setMusic, startAmbience } from '../audio';
import { ROOMS, PALETTE, VIEW } from '../config';
import { progress, resetRun, totalCoins } from '../progress';

const fmt = (s: number): string => {
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
};

export class Finish extends Phaser.Scene {
  constructor() {
    super('Finish');
  }

  create(): void {
    startAmbience();
    setMusic('music_menu');
    play('power_return');
    this.cameras.main.setBackgroundColor(PALETTE.ink);
    this.cameras.main.fadeIn(600, 8, 13, 18);
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(20);
    this.add.image(0, 0, 'grain').setOrigin(0, 0).setDepth(21).setAlpha(0.035);

    const text = (y: number, v: string, size: number, tint: number) =>
      this.add.bitmapText(VIEW.w / 2, y, 'stencil', v, size).setTint(tint).setOrigin(0.5);
    text(26, 'YOU MADE IT OUT', 14, PALETTE.warm2);
    text(48, 'WHAT DO YOU THINK OF BLACKOUT?', 7, PALETTE.w);
    this.add.rectangle(VIEW.w / 2, 62, 140, 1, PALETTE.warm);

    const col = (x: number, label: string, value: string) => {
      this.add.bitmapText(x, 82, 'stencil', label, 7).setTint(PALETTE.n7).setOrigin(0.5);
      this.add.bitmapText(x, 100, 'stencil', value, 14).setTint(PALETTE.warm).setOrigin(0.5);
    };
    col(VIEW.w / 2 - 80, 'YOUR TIME', fmt(progress.total));
    col(VIEW.w / 2 + 80, 'COINS', String(totalCoins()));
    ROOMS.forEach((b, i) => {
      text(122 + i * 9, `${i + 1}  ${b.name}  ${progress.levelTimes[i].toFixed(1)}S  ${progress.levelCoins[i]} COINS`, 7, PALETTE.n6);
    });
    text(VIEW.h - 36, 'MUSIC BY ERIC SKIFF  RESISTOR ANTHEMS  ERICSKIFF.COM  CC BY 4.0', 7, PALETTE.n5);
    text(VIEW.h - 27, 'UNDERCLOCKED  JUMPSHOT  COME AND FIND ME  THERES A POWER HERE', 7, PALETTE.n5);
    const hint = text(VIEW.h - 14, '[ENTER] PLAY AGAIN', 7, PALETTE.warm2);
    this.tweens.add({ targets: hint, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    let leaving = false;
    const again = () => {
      if (leaving) return;
      leaving = true;
      this.cameras.main.fadeOut(350, 8, 13, 18);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        resetRun();
        this.scene.start('Game');
      });
    };
    for (const k of ['ENTER', 'SPACE']) this.input.keyboard!.on(`keydown-${k}`, again);
  }
}
