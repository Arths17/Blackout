import Phaser from 'phaser';
import { initAudio, play, startAmbience } from '../audio';
import { CFG, PALETTE, VIEW } from '../config';
import { CHECKPOINTS, FINISH_X, PLATFORMS, createObby, stepObby, type Obby as ObbyState, type ObbyEvent } from '../sim/obby';
import { atlasOf } from '../render/pixel';

const STEP = 1 / CFG.stepHz;
const WORLD_W = FINISH_X + 80;
const Z = { far: 1, plat: 5, door: 6, ghost: 9, player: 10, vignette: 20, grain: 21, hud: 30 };

interface Ghost {
  spr: Phaser.GameObjects.Sprite;
  life: number;
}

export class Obby extends Phaser.Scene {
  private s!: ObbyState;
  private acc = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private jumpPressed = false;
  private dashPressed = false;
  private spr!: Phaser.GameObjects.Sprite;
  private ghosts: Ghost[] = [];
  private ghostAt = 0;
  private lamps!: Phaser.GameObjects.Graphics;
  private door!: Phaser.GameObjects.Graphics;
  private fallsText!: Phaser.GameObjects.BitmapText;
  private banner!: Phaser.GameObjects.BitmapText;
  private stepAt = 0;
  private leaving = false;

  constructor() {
    super('Obby');
  }

  create(): void {
    this.s = createObby();
    this.acc = 0;
    this.jumpPressed = false;
    this.dashPressed = false;
    this.ghosts = [];
    this.stepAt = 0;
    this.leaving = false;
    (window as unknown as { __obby: ObbyState }).__obby = this.s;

    initAudio();
    startAmbience();
    this.cameras.main.setBackgroundColor(PALETTE.ink);
    this.cameras.main.fadeIn(400, 8, 13, 18);
    this.drawFar();
    this.drawPlatforms();
    this.drawSigns();
    this.lamps = this.add.graphics().setDepth(Z.plat + 1);
    this.door = this.add.graphics().setDepth(Z.door);

    this.spr = this.add.sprite(0, 0, 'player', 0).setOrigin(0.5, 23 / 24).setDepth(Z.player);
    for (let i = 0; i < 6; i++) {
      this.ghosts.push({ spr: this.add.sprite(0, 0, 'player', 0).setOrigin(0.5, 23 / 24).setDepth(Z.ghost).setVisible(false).setTintFill(PALETTE.c1), life: 0 });
    }

    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setScrollFactor(0).setDepth(Z.vignette);
    this.add.image(0, 0, 'grain').setOrigin(0, 0).setScrollFactor(0).setDepth(Z.grain).setAlpha(0.035);
    const text = (x: number, y: number, v: string, tint: number) =>
      this.add.bitmapText(x, y, 'stencil', v, 7).setTint(tint).setOrigin(0, 0).setScrollFactor(0).setDepth(Z.hud);
    text(6, 5, 'THE WAY IN', PALETTE.n7);
    this.fallsText = text(VIEW.w - 50, 5, 'FALLS 0', PALETTE.n6);
    this.banner = this.add.bitmapText(VIEW.w / 2, VIEW.h / 2 - 6, 'stencil', '', 14).setTint(PALETTE.warm).setOrigin(0.5).setScrollFactor(0).setDepth(Z.hud).setVisible(false);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('A,D,W,LEFT,RIGHT,UP,SPACE,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-SPACE', () => (this.jumpPressed = true));
    kb.on('keydown-W', () => (this.jumpPressed = true));
    kb.on('keydown-UP', () => (this.jumpPressed = true));
    kb.on('keydown-SHIFT', () => (this.dashPressed = true));
    kb.on('keydown-ENTER', () => this.leave());
  }

  private drawFar(): void {
    const g = this.add.graphics().setScrollFactor(0.3).setDepth(Z.far);
    let n = 7;
    const rnd = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let x = -20; x < WORLD_W * 0.3 + VIEW.w; x += 26 + rnd() * 30) {
      const w = 4 + Math.floor(rnd() * 8);
      const top = 10 + Math.floor(rnd() * 70);
      g.fillStyle(PALETTE.n1, 1).fillRect(Math.round(x), top, w, VIEW.h);
      g.fillStyle(PALETTE.n2, 1).fillRect(Math.round(x), top, 1, VIEW.h);
      if (rnd() < 0.5) g.fillStyle(PALETTE.rust2, 1).fillRect(Math.round(x) - 1, top + 20, w + 2, 2);
    }
    const pit = this.add.rectangle(0, 176, VIEW.w, 4, PALETTE.r1, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(Z.far + 1);
    pit.setAlpha(0.7);
  }

  private drawPlatforms(): void {
    const g = this.add.graphics().setDepth(Z.plat);
    for (const p of PLATFORMS) {
      const x = Math.round(p.x);
      g.fillStyle(PALETTE.n2, 1).fillRect(x + 4, p.y + 8, 3, 40);
      g.fillStyle(PALETTE.n2, 1).fillRect(x + p.w - 7, p.y + 8, 3, 40);
      g.fillStyle(PALETTE.n3, 1).fillRect(x, p.y, p.w, 8);
      g.fillStyle(PALETTE.n5, 1).fillRect(x, p.y, p.w, 2);
      g.fillStyle(PALETTE.n2, 1);
      for (let gx = x + 2; gx < x + p.w - 2; gx += 4) g.fillRect(gx, p.y + 4, 2, 3);
      g.fillStyle(PALETTE.r4, 1);
      for (let gx = x + 3; gx < x + p.w - 2; gx += 14) g.fillRect(gx, p.y, 2, 1);
    }
  }

  private drawSigns(): void {
    const sign = (x: number, y: number, v: string) =>
      this.add.bitmapText(x, y, 'stencil', v, 7).setTint(PALETTE.n6).setOrigin(0.5).setDepth(Z.plat + 1);
    sign(54, 112, 'A D  MOVE');
    sign(150, 100, 'SPACE  JUMP');
    sign(505, 76, 'SHIFT  DASH');
    sign(590, 88, '>>  >>');
    sign(FINISH_X - 70, 84, 'THE BOSS');
    sign(1840, 108, 'DASH AGAIN');
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(600, 8, 13, 18);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
  }

  private onEvent(e: ObbyEvent): void {
    switch (e) {
      case 'jump': play('jump'); break;
      case 'dash': play('dash'); break;
      case 'land': play('land'); break;
      case 'checkpoint': play('power_back'); break;
      case 'respawn':
        play('fizzle');
        this.cameras.main.flash(180, 225, 232, 227);
        break;
      case 'finish':
        play('power_return');
        this.banner.setText('THE BOSS').setVisible(true);
        this.cameras.main.flash(200, 234, 243, 255);
        this.time.delayedCall(900, () => this.leave());
        break;
    }
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.acc += dt;
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const jumpHeld = k.SPACE.isDown || k.W.isDown || k.UP.isDown;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      const events = this.leaving && !this.s.finished ? [] : stepObby(this.s, { dx: this.s.finished ? 0 : dx, jumpHeld, jumpPressed: this.jumpPressed, dashPressed: this.dashPressed }, STEP);
      this.jumpPressed = false;
      this.dashPressed = false;
      for (const e of events) this.onEvent(e);
    }
    this.render(dt, dx);
  }

  private render(dt: number, dx: number): void {
    const s = this.s;
    const t = s.time;
    const anims = atlasOf(this).sheets.player.anims;
    const dir = s.face > 0 ? 'right' : 'left';
    const moving = dx !== 0 && !s.finished;
    const a = anims[`${moving && s.grounded ? 'walk' : 'idle'}_${dir}`];
    const frame = a.frames[Math.floor(t * a.fps) % a.frames.length];
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    this.spr.setFrame(frame).setPosition(x, y);
    if (s.grounded && moving && s.time >= this.stepAt) {
      play('step_player');
      this.stepAt = s.time + 0.3;
    }

    if (s.dashLeft > 0 && t >= this.ghostAt) {
      this.ghostAt = t + 0.03;
      const g = this.ghosts.find((q) => q.life <= 0);
      if (g) {
        g.life = 0.22;
        g.spr.setFrame(frame).setPosition(x, y).setVisible(true);
      }
    }
    for (const g of this.ghosts) {
      if (g.life > 0) {
        g.life -= dt;
        g.spr.setAlpha(Math.max(0, g.life / 0.22) * 0.6);
        if (g.life <= 0) g.spr.setVisible(false);
      }
    }

    this.lamps.clear();
    CHECKPOINTS.forEach((c, i) => {
      const lit = s.reached > i;
      this.lamps.fillStyle(PALETTE.n4, 1).fillRect(c.x + 14, c.y - 16, 2, 16);
      this.lamps.fillStyle(lit ? PALETTE.r5 : PALETTE.n3, 1).fillRect(c.x + 12, c.y - 20, 6, 5);
      if (lit) this.lamps.fillStyle(PALETTE.r4, 0.25).fillCircle(c.x + 15, c.y - 17, 10);
    });
    this.door.clear();
    const dy = PLATFORMS[PLATFORMS.length - 1].y;
    this.door.fillStyle(PALETTE.n4, 1).fillRect(FINISH_X - 2, dy - 36, 24, 36);
    this.door.fillStyle(PALETTE.ink, 1).fillRect(FINISH_X + 1, dy - 33, 18, 33);
    const glow = 0.5 + 0.3 * Math.sin(t * 5);
    this.door.fillStyle(0xff3548, glow).fillRect(FINISH_X + 5, dy - 24, 4, 3).fillRect(FINISH_X + 12, dy - 24, 4, 3);

    this.fallsText.setText(`FALLS ${s.falls}`);
    const camX = Phaser.Math.Clamp(s.x - 110, 0, WORLD_W - VIEW.w);
    this.cameras.main.setScroll(Math.round(camX), 0);
  }
}
