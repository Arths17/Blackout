import Phaser from 'phaser';
import { CFG, DARK, LURES, PALETTE, VIEW, VIS } from '../config';
import { createWorld, stepWorld, tryInteract, type SimEvent, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { CreatureView } from '../render/creature';
import { Darkness, type Light } from '../render/darkness';
import { Dust, Fx } from '../render/fx';
import { Hud } from '../render/hud';
import { DEPTH } from '../render/layers';
import { Breakers } from '../render/panels';
import { px } from '../render/pixel';
import { PlayerView } from '../render/player';
import { FLOOR, Room } from '../render/room';

const STEP = 1 / CFG.stepHz;

export class Game extends Phaser.Scene {
  private w!: World;
  private acc = 0;
  private hitStop = 0;
  private slow = 1;
  private pendingInteract = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private room!: Room;
  private breakers!: Breakers;
  private playerView!: PlayerView;
  private creatureView!: CreatureView;
  private fx!: Fx;
  private dust!: Dust;
  private dark!: Darkness;
  private hud!: Hud;
  private grain!: Phaser.GameObjects.Image;
  private hurt!: Phaser.GameObjects.Rectangle;
  private warm!: Phaser.GameObjects.Rectangle;
  private flashUntil = 0; // sim time
  private flashStrongUntil = 0;
  private lit = false;
  private autoFireAt = -1;
  private freezeAt = -1;

  constructor() {
    super('Game');
  }

  create(): void {
    // Dev flags: ?lure=early|hit|late replays a Quick bank shot, ?slow=0.25 slows the sim, ?freeze=1.8 stops it at that time.
    const q = new URLSearchParams(window.location.search);
    this.slow = Number(q.get('slow') ?? 1) || 1;
    this.freezeAt = Number(q.get('freeze') ?? -1);
    const lure = q.get('lure');
    const lured = lure !== null && lure in LURES;
    this.w = lured
      ? createWorld({ creature: LURES[lure as keyof typeof LURES], player: ROUTES[0].switchPos, asleep: true })
      : createWorld();
    this.autoFireAt = lured ? 0.6 : -1;
    (window as unknown as { __blackout: World }).__blackout = this.w;
    this.w.listeners.push((e) => this.onEvent(e));
    this.acc = 0;
    this.hitStop = 0;
    this.pendingInteract = false; // a queued E press must not fire in the restarted world
    this.flashUntil = 0;
    this.flashStrongUntil = 0;
    this.lit = false;

    this.room = new Room(this);
    this.breakers = new Breakers(this);
    this.playerView = new PlayerView(this);
    this.creatureView = new CreatureView(this);
    this.fx = new Fx(this);
    this.dust = new Dust(this);
    this.dark = new Darkness(this, { floor: { x0: FLOOR.x0, y0: FLOOR.y0, x1: FLOOR.x1, y1: FLOOR.y1 }, blockers: this.room.blockers });
    this.warm = this.add.rectangle(0, 0, VIEW.w, VIEW.h, PALETTE.warm, 0).setOrigin(0, 0).setDepth(DEPTH.over + 8);
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(DEPTH.vignette);
    this.grain = this.add.image(0, 0, 'grain').setOrigin(0, 0).setDepth(DEPTH.grain).setAlpha(0.07);
    this.hurt = this.add.rectangle(0, 0, VIEW.w, VIEW.h, PALETTE.r4, 0).setOrigin(0, 0).setDepth(DEPTH.flash);
    this.hud = new Hud(this);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,R') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-R', () => this.scene.restart());
    kb.on('keydown-E', () => (this.pendingInteract = true));
    kb.on('keydown-SPACE', () => (this.pendingInteract = true));
  }

  private onEvent(e: SimEvent): void {
    const cam = this.cameras.main;
    switch (e.type) {
      case 'relayClick':
        this.flashUntil = this.w.time + (VIS.flashMs / 1000) * 1.6;
        this.flashStrongUntil = this.w.time + (VIS.flashMs / 1000) * 0.9;
        break;
      case 'bounce':
        this.fx.burst(e.x, e.y, 14);
        this.flashUntil = Math.max(this.flashUntil, this.w.time + (VIS.flashMs / 1000) * 0.7);
        cam.shake(VIS.bounceShake.ms, VIS.bounceShake.amp);
        break;
      case 'shock':
        if (e.counted) {
          this.hitStop = VIS.hitStop;
          this.flashUntil = this.w.time + (VIS.flashMs / 1000) * 1.4;
          this.flashStrongUntil = this.w.time + (VIS.flashMs / 1000) * 0.8;
          this.fx.burst(this.w.creature.x, this.w.creature.y, 22);
          cam.shake(VIS.shockShake.ms, VIS.shockShake.amp);
        }
        break;
      case 'playerHit':
        this.hurt.setAlpha(0.35);
        this.tweens.add({ targets: this.hurt, alpha: 0, duration: 300 });
        cam.shake(VIS.hurtShake.ms, VIS.hurtShake.amp);
        break;
      case 'deadClick':
        this.breakers.deadClick(e.breaker, this.w.time);
        break;
      case 'win':
        this.lit = true;
        cam.flash(260, 234, 243, 255);
        this.tweens.add({ targets: this.warm, alpha: 0.07, duration: 900 });
        break;
      default:
        break;
    }
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    if (this.hitStop > 0) this.hitStop -= dt;
    else this.acc += dt * this.slow;
    while (this.acc >= STEP) {
      this.acc -= STEP;
      this.step();
    }
    this.render(dt);
  }

  private step(): void {
    const w = this.w;
    if (this.freezeAt >= 0 && w.time >= this.freezeAt) return;
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (this.pendingInteract) {
      tryInteract(w);
      this.pendingInteract = false;
    }
    if (this.autoFireAt >= 0 && w.time >= this.autoFireAt) {
      this.autoFireAt = -1;
      tryInteract(w);
    }
    stepWorld(w, { dx, dy }, STEP);
  }

  private render(dt: number): void {
    const w = this.w;
    const t = w.time;
    this.playerView.update(w, t);
    this.creatureView.update(w, t);
    this.dust.update(dt);

    const pl = { x: px(w.player.x), y: px(w.player.y) };
    const lights: Light[] = [{ ...pl, r: DARK.playerR }];
    if (w.phase !== 'lost') lights.push({ ...pl, r: DARK.coneR * (this.lit ? 1.6 : 1), cone: { angle: w.player.facing, half: DARK.coneHalf * (this.lit ? 1.4 : 1) }, shadows: true });
    lights.push(...this.room.update(t, this.lit));
    lights.push(...this.breakers.update(w, t));
    lights.push(...this.fx.update(w, dt));
    if (w.creature.alive && w.creature.state === 'windup') lights.push({ x: px(w.creature.x), y: px(w.creature.y), r: 13, tint: PALETTE.g3 });

    const ambient = this.lit ? 1 : t < this.flashStrongUntil ? 0 : t < this.flashUntil ? 1 : DARK.ambient;
    this.dark.render(lights, ambient);
    this.grain.setPosition(-Math.floor(Math.random() * 8), -Math.floor(Math.random() * 8));
    this.hud.update(w, t);
  }
}
