import Phaser from 'phaser';
import { initAudio, play, setCreatureDistance, startAmbience } from '../audio';
import { CFG, DARK, LURES, PALETTE, VIEW, VIS } from '../config';
import { createWorld, stepWorld, useEnergy, type SimEvent, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { CreatureView } from '../render/creature';
import { Darkness, type Light } from '../render/darkness';
import { Atmosphere } from '../render/atmosphere';
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
  private atmosphere!: Atmosphere;
  private hud!: Hud;
  private grain!: Phaser.GameObjects.Image;
  private hurt!: Phaser.GameObjects.Rectangle;
  private warm!: Phaser.GameObjects.Rectangle;
  private flashUntil = 0; // sim time
  private flashStrongUntil = 0;
  private lit = false;
  private autoFireAt = -1;
  private freezeAt = -1;
  private playerStepAt = 0;
  private creatureStepAt = 0;
  private shieldUntil = 0;
  private lastTremor = -1;

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
    this.pendingInteract = false;
    this.flashUntil = 0;
    this.flashStrongUntil = 0;
    this.lit = false;
    this.playerStepAt = 0;
    this.creatureStepAt = 0;
    this.shieldUntil = 0;
    this.lastTremor = -1;

    initAudio();
    startAmbience();
    this.room = new Room(this);
    this.breakers = new Breakers(this);
    this.playerView = new PlayerView(this);
    this.creatureView = new CreatureView(this);
    this.atmosphere = new Atmosphere(this);
    this.fx = new Fx(this);
    this.dust = new Dust(this);
    this.dark = new Darkness(this, { floor: FLOOR, blockers: this.room.blockers });
    this.warm = this.add.rectangle(0, 0, VIEW.w, VIEW.h, PALETTE.warm, 0).setOrigin(0, 0).setDepth(DEPTH.over + 8);
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(DEPTH.vignette);
    this.grain = this.add.image(0, 0, 'grain').setOrigin(0, 0).setDepth(DEPTH.grain).setAlpha(DARK.grainAlpha);
    this.hurt = this.add.rectangle(0, 0, VIEW.w, VIEW.h, PALETTE.n7, 0).setOrigin(0, 0).setDepth(DEPTH.flash);
    this.hud = new Hud(this, () => this.cameras.main.flash(120, 225, 232, 227));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,Z,UP,DOWN,LEFT,RIGHT,R') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-R', () => this.scene.restart());
    kb.on('keydown-Z', (event: KeyboardEvent) => {
      if (!event.repeat && this.w.shockwave) this.shieldUntil = this.w.time + 2;
    });
    kb.on('keydown-E', () => (this.pendingInteract = true));
    kb.on('keydown-SPACE', () => (this.pendingInteract = true));
  }

  private onEvent(e: SimEvent): void {
    const cam = this.cameras.main;
    switch (e.type) {
      case 'relayClick':
        play('relay_click');
        play('surge_crack');
        this.playerView.interact(this.w.time);
        this.flashUntil = this.w.time + (VIS.flashMs / 1000) * 1.6;
        this.flashStrongUntil = this.w.time + (VIS.flashMs / 1000) * 0.9;
        break;
      case 'energyGain':
        play('relay_click');
        this.playerView.interact(this.w.time);
        break;
      case 'bounce':
        play('wall_crack');
        this.fx.burst(e.x, e.y, 14);
        this.flashUntil = Math.max(this.flashUntil, this.w.time + (VIS.flashMs / 1000) * 0.7);
        cam.shake(VIS.bounceShake.ms, VIS.bounceShake.amp);
        break;
      case 'shock':
        if (e.counted) {
          play('surge_crack');
          this.hitStop = VIS.hitStop;
          this.flashUntil = this.w.time + (VIS.flashMs / 1000) * 1.4;
          this.flashStrongUntil = this.w.time + (VIS.flashMs / 1000) * 0.8;
          this.fx.burst(this.w.creature.x, this.w.creature.y, 22);
          cam.shake(VIS.shockShake.ms, VIS.shockShake.amp);
        }
        break;
      case 'bossShot':
        this.fx.burst(this.w.creature.x, this.w.creature.y, 8);
        break;
      case 'ballStart':
        play('surge_crack');
        break;
      case 'ballHit':
        play('surge_crack');
        this.fx.burst(this.w.creature.x, this.w.creature.y, 18);
        break;
      case 'playerHit':
        play('surge_crack');
        this.hurt.setAlpha(0.35);
        this.tweens.add({ targets: this.hurt, alpha: 0, duration: 300 });
        cam.shake(VIS.hurtShake.ms, VIS.hurtShake.amp);
        break;
      case 'deadClick':
        this.breakers.deadClick(e.breaker, this.w.time);
        break;
      case 'win':
        play('power_return');
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
    if (this.hud.isControlsOpen()) this.acc = 0;
    else {
      while (this.acc >= STEP) {
        this.acc -= STEP;
        this.step();
      }
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
      useEnergy(w);
      this.pendingInteract = false;
    }
    if (this.autoFireAt >= 0 && w.time >= this.autoFireAt) {
      this.autoFireAt = -1;
      useEnergy(w);
    }
    stepWorld(w, { dx, dy, shield: this.shieldUntil > w.time && w.shockwave !== null }, STEP);
  }

  private render(dt: number): void {
    const w = this.w;
    const t = w.time;
    this.playerView.update(w, t);
    setCreatureDistance(Math.hypot(w.player.x - w.creature.x, w.player.y - w.creature.y));
    if (w.phase === 'play' && w.player.moving && t >= this.playerStepAt) { play('step_player'); this.playerStepAt = t + VIS.playerStep; }
    if (w.phase === 'play' && !w.creature.asleep && w.creature.state === 'stalk' && t >= this.creatureStepAt) { play('step_creature'); this.creatureStepAt = t + VIS.creatureStep; }
    this.creatureView.update(w, t);
    const atmosphere = this.atmosphere.update(w, t);
    if (atmosphere.tremor && this.lastTremor !== Math.floor(t)) {
      this.lastTremor = Math.floor(t);
      this.cameras.main.shake(120, 0.0015);
    }
    this.dust.update(dt);

    const pl = { x: px(w.player.x), y: px(w.player.y) };
    const lights: Light[] = [{ ...pl, r: DARK.playerHalo, shadows: true }];
    if (w.phase !== 'lost') lights.push({ ...pl, r: DARK.coneR, cone: { angle: w.player.facing, half: DARK.coneHalf }, shadows: true });
    lights.push(...this.room.update(t, this.lit));
    lights.push(...atmosphere.lights);
    lights.push(...this.breakers.update(w, t));
    lights.push(...this.fx.update(w, dt));
    if (w.creature.alive && w.creature.state === 'windup') lights.push({ x: px(w.creature.x), y: px(w.creature.y), r: 13, tint: PALETTE.g3 });

    const ambient = this.lit ? 1 : t < this.flashStrongUntil ? 0 : t < this.flashUntil ? 1 : DARK.ambient;
    this.dark.render(lights, ambient);
    const intro = Math.max(0, Math.min(1, t / CFG.introSeconds));
    const introZoom = 1.035 - intro * 0.035;
    this.cameras.main.setZoom(introZoom);
    if (intro < 1) {
      const bossX = px(w.creature.x);
      const bossY = px(w.creature.y);
      const centerX = VIEW.w / 2 + (bossX - VIEW.w / 2) * (1 - intro) * 0.18;
      const centerY = VIEW.h / 2 + (bossY - VIEW.h / 2) * (1 - intro) * 0.18;
      this.cameras.main.centerOn(centerX, centerY);
    } else {
      this.cameras.main.centerOn(VIEW.w / 2, VIEW.h / 2);
    }
    this.grain.setPosition(-Math.floor(Math.random() * 8), -Math.floor(Math.random() * 8));
    this.hud.update(w, t);
  }
}
