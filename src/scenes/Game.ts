import Phaser from 'phaser';
import { HEIGHT, WIDTH, palette, room } from '../config';
import { GameSim } from '../sim/game';
import { routes } from '../sim/routes';

export class GameScene extends Phaser.Scene {
  private sim = new GameSim();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private playerGraphic!: Phaser.GameObjects.Graphics;
  private creatureGraphic!: Phaser.GameObjects.Graphics;
  private surgeGraphic!: Phaser.GameObjects.Graphics;
  private lamps!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private accumulator = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(palette.void);
    this.drawRoom();
    this.playerGraphic = this.add.graphics();
    this.creatureGraphic = this.add.graphics();
    this.surgeGraphic = this.add.graphics();
    this.lamps = this.add.graphics();
    this.statusText = this.add.text(88, 20, 'BLACKOUT  //  FIND THE RELAY', {
      color: '#b7d34b',
      fontFamily: 'monospace',
      fontSize: '16px',
    });
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,E,SPACE,R') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on('keydown-E', () => this.sim.throwBreaker(0));
    this.input.keyboard!.on('keydown-SPACE', () => this.sim.throwBreaker(0));
    this.input.keyboard!.on('keydown-R', () => this.scene.restart());
  }

  update(_: number, delta: number): void {
    const dt = 1 / 60;
    this.movePlayer(delta / 1000);
    this.accumulator += Math.min(delta / 1000, 0.1);
    while (this.accumulator >= dt) {
      this.sim.advance(dt);
      this.accumulator -= dt;
    }
    this.drawState();
  }

  private movePlayer(seconds: number): void {
    let x = 0;
    let y = 0;
    if (this.keys.W.isDown || this.keys.UP.isDown) y -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) y += 1;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) x -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) x += 1;
    const length = Math.hypot(x, y);
    if (length > 0) {
      this.sim.player.x = Phaser.Math.Clamp(this.sim.player.x + (x / length) * 220 * seconds, room.left + 18, room.right - 18);
      this.sim.player.y = Phaser.Math.Clamp(this.sim.player.y + (y / length) * 220 * seconds, room.top + 18, room.bottom - 18);
    }
  }

  private drawRoom(): void {
    const g = this.add.graphics();
    g.fillStyle(palette.wall);
    g.fillRect(room.left - 20, room.top - 20, room.right - room.left + 40, room.bottom - room.top + 40);
    g.fillStyle(palette.floor);
    g.fillRect(room.left, room.top, room.right - room.left, room.bottom - room.top);
    g.lineStyle(1, palette.grout, 0.45);
    for (let x = room.left; x <= room.right; x += 40) g.lineBetween(x, room.top, x, room.bottom);
    for (let y = room.top; y <= room.bottom; y += 40) g.lineBetween(room.left, y, room.right, y);
    g.lineStyle(3, palette.emergency, 0.8);
    g.lineBetween(room.left, room.top, room.right, room.top);
    g.lineBetween(room.left, room.bottom, room.right, room.bottom);
    for (const route of routes) {
      g.lineStyle(1, palette.emergency, 0.3);
      for (let i = 1; i < route.points.length; i += 1) g.lineBetween(route.points[i - 1].x, route.points[i - 1].y, route.points[i].x, route.points[i].y);
    }
    g.fillStyle(palette.emergency, 0.9);
    g.fillRect(150, 265, 26, 120);
    g.fillStyle(palette.void, 1);
    g.fillRect(153, 270, 20, 110);
    g.fillStyle(palette.emergency, 0.9);
    g.fillRect(1000, 220, 40, 100);
    g.fillStyle(palette.void, 1);
    g.fillRect(1005, 225, 30, 90);
  }

  private drawState(): void {
    this.playerGraphic.clear().fillStyle(0xd8d5c7).fillCircle(this.sim.player.x, this.sim.player.y, 10).fillStyle(palette.emergency).fillTriangle(
      this.sim.player.x + 5, this.sim.player.y,
      this.sim.player.x + 15, this.sim.player.y - 5,
      this.sim.player.x + 15, this.sim.player.y + 5,
    );
    const c = this.sim.creature.position;
    this.creatureGraphic.clear().fillStyle(0x17121b).fillTriangle(c.x, c.y - 24, c.x - 20, c.y + 16, c.x + 20, c.y + 16).fillStyle(palette.creature).fillCircle(c.x - 7, c.y - 3, 3).fillCircle(c.x + 7, c.y - 3, 3);
    this.surgeGraphic.clear();
    if (this.sim.surge) {
      const p = this.sim.surge.position;
      this.surgeGraphic.lineStyle(7, palette.surge, 0.3);
      this.surgeGraphic.strokeCircle(p.x, p.y, 15);
      this.surgeGraphic.fillStyle(palette.surge).fillCircle(p.x, p.y, 5);
    }
    this.lamps.clear().fillStyle(palette.emergency, 0.9);
    for (const p of routes[0].points) this.lamps.fillCircle(p.x, p.y, 4);
    this.statusText.setText(this.sim.surge ? 'RELAY LIVE  //  MOVE' : 'BLACKOUT  //  PRESS E AT THE RELAY');
  }
}
