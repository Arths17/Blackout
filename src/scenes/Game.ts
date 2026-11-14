import Phaser from 'phaser';
import { CFG, H, PALETTE, ROOM, W } from '../config';
import { makePlayer, stepPlayer, type PlayerState } from '../sim/player';

const STEP = 1 / CFG.stepHz;

export class Game extends Phaser.Scene {
  private player!: PlayerState;
  private acc = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private playerGfx!: Phaser.GameObjects.Graphics;
  private dark!: Phaser.GameObjects.RenderTexture;
  private glow!: Phaser.GameObjects.Image;

  constructor() {
    super('Game');
  }

  create(): void {
    this.drawRoom();
    this.player = makePlayer(ROOM.x + 120, ROOM.y + ROOM.h / 2);
    this.playerGfx = this.add.graphics();

    this.glow = new Phaser.GameObjects.Image(this, 0, 0, 'glow');
    this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,R') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-R', () => this.scene.restart());
  }

  private drawRoom(): void {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.wall, 1).fillRect(0, 0, W, H);
    g.fillStyle(PALETTE.floor, 1).fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
    g.lineStyle(1, PALETTE.wall, 0.6);
    for (let x = ROOM.x; x <= ROOM.x + ROOM.w; x += 80) g.lineBetween(x, ROOM.y, x, ROOM.y + ROOM.h);
    for (let y = ROOM.y; y <= ROOM.y + ROOM.h; y += 80) g.lineBetween(ROOM.x, y, ROOM.x + ROOM.w, y);
    g.lineStyle(3, PALETTE.strip, 0.8).strokeRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
  }

  update(_t: number, deltaMs: number): void {
    this.acc += Math.min(deltaMs / 1000, 0.1);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step();
    }
    this.render();
  }

  private step(): void {
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    stepPlayer(this.player, { dx, dy }, STEP);
  }

  private render(): void {
    const p = this.player;
    const g = this.playerGfx;
    g.clear();
    g.fillStyle(0xcfd8e6, 1).fillCircle(p.x, p.y, CFG.playerRadius);
    g.fillStyle(PALETTE.surge, 1).fillCircle(p.x + Math.cos(p.facing) * 8, p.y + Math.sin(p.facing) * 8, 3);

    const d = this.dark;
    d.clear();
    d.fill(PALETTE.ink, CFG.darkness);
    const scale = (CFG.playerLightRadius * 2) / 256;
    this.glow.setScale(scale);
    d.erase(this.glow, p.x, p.y);
  }
}
