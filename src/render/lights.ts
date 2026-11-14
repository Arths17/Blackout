import Phaser from 'phaser';
import { H, PALETTE, VIS, W } from '../config';
import { DEPTH } from './layers';

// Phaser 4 render textures queue their draw commands, so every erase needs its own sprite
// and the texture has to be rendered by hand once the frame's pools are in.
export class Lights {
  private rt: Phaser.GameObjects.RenderTexture;
  private vignette: Phaser.GameObjects.Image;
  private erasers: Phaser.GameObjects.Image[] = [];
  private halos: Phaser.GameObjects.Image[] = [];
  private eUsed = 0;
  private hUsed = 0;

  constructor(private scene: Phaser.Scene) {
    this.rt = scene.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(DEPTH.dark);
    this.vignette = scene.add.image(W / 2, H / 2, 'vignette').setDepth(DEPTH.vignette);
  }

  begin(level: number, t: number): void {
    this.eUsed = 0;
    this.hUsed = 0;
    this.rt.clear();
    this.rt.fill(PALETTE.ink, level);
    this.vignette.setAlpha(VIS.vignetteA + 0.06 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 9.1));
  }

  pool(x: number, y: number, r: number, a = 1): void {
    let img = this.erasers[this.eUsed++];
    if (!img) {
      img = new Phaser.GameObjects.Image(this.scene, 0, 0, 'glow');
      this.erasers.push(img);
    }
    img.setScale((r * 2) / 256).setAlpha(a);
    this.rt.erase(img, x, y);
  }

  halo(x: number, y: number, r: number, a: number, tint = 0xbcd8ff): void {
    let img = this.halos[this.hUsed++];
    if (!img) {
      img = this.scene.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.halo);
      this.halos.push(img);
    }
    img.setVisible(true).setPosition(x, y).setScale((r * 2) / 256).setAlpha(a).setTint(tint);
  }

  end(): void {
    for (let i = this.hUsed; i < this.halos.length; i++) this.halos[i].setVisible(false);
    this.rt.render();
  }
}
