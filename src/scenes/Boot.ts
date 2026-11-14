import Phaser from 'phaser';
import { H, VIS, W } from '../config';

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const size = 256;
    const glow = this.textures.createCanvas('glow', size, size)!;
    const ctx = glow.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    glow.refresh();

    const vig = this.textures.createCanvas('vignette', W, H)!;
    const vctx = vig.getContext();
    const v = vctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${VIS.vignetteA})`);
    vctx.fillStyle = v;
    vctx.fillRect(0, 0, W, H);
    vig.refresh();

    this.scene.start('Game');
  }
}
