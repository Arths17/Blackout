import Phaser from 'phaser';
import { play, setCreatureDistance, setMusic, startAmbience, type MusicName } from '../audio';
import { CFG, DARK, LURES, PALETTE, PATH_COLORS, ROOMS, VIEW, VIS, applyRoom } from '../config';
import { progress, resetRun } from '../progress';
import { LORE } from '../lore';
import { SHAKE_SCALE, settings } from '../settings';
import { createWorld, fire, lineUnder, stepWorld, tryInteract, type FireResult, type SimEvent, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { CreatureView } from '../render/creature';
import { Darkness, type Light } from '../render/darkness';
import { Atmosphere } from '../render/atmosphere';
import { Entrance } from '../render/entrance';
import { Foliage } from '../render/foliage';
import { ExitCue } from '../render/exitcue';
import { Paths } from '../render/paths';
import { Dust, Fx } from '../render/fx';
import { Hud } from '../render/hud';
import { DEPTH } from '../render/layers';
import { Breakers } from '../render/panels';
import { px } from '../render/pixel';
import { PlayerView } from '../render/player';
import { FLOOR, Room } from '../render/room';

const STEP = 1 / CFG.stepHz;
// The fight music gets harder every couple of rooms, and the last room has its own.
const FIGHT: MusicName[] = ['fight_1', 'fight_1', 'fight_2', 'fight_2', 'fight_3'];
const HURT_NOTE = { creature: 'CAUGHT', surge: 'YOUR OWN SURGE', seed: 'SEED' };

export class Game extends Phaser.Scene {
  private w!: World;
  private acc = 0;
  private hitStop = 0;
  private slow = 1;
  private pendingFire = -1;
  private pendingInteract = false;
  private pendingParry = false;
  private pendingDash = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private room!: Room;
  private breakers!: Breakers;
  private playerView!: PlayerView;
  private creatureView!: CreatureView;
  private fx!: Fx;
  private dust!: Dust;
  private dark!: Darkness;
  private atmosphere!: Atmosphere;
  private entrance!: Entrance;
  private foliage!: Foliage;
  private exitCue!: ExitCue;
  private paths!: Paths;
  private card!: Phaser.GameObjects.Container;
  private hud!: Hud;
  private grain!: Phaser.GameObjects.Image;
  private hurt!: Phaser.GameObjects.Rectangle;
  private warm!: Phaser.GameObjects.Rectangle;
  private lightList: Light[] = [];
  private leaving = false;
  private vinesPlayed = false;
  private flashUntil = 0; // sim time
  private flashStrongUntil = 0;
  private lit = false;
  private autoFireAt = -1;
  private playerStepAt = 0;
  private creatureStepAt = 0;
  private lastTremor = -1;
  private prevCreature = 'stalk';
  private heartAt = 0;
  private noPowerAt = -1;

  constructor() {
    super('Game');
  }

  create(): void {
    // Dev flags: ?lure=early|hit|late replays a breaker 1 shot, ?slow=0.25 slows the sim.
    const q = new URLSearchParams(window.location.search);
    applyRoom(progress.level);
    this.slow = Number(q.get('slow') ?? 1) || 1;
    const lure = q.get('lure');
    const lured = lure !== null && lure in LURES;
    this.w = lured
      ? createWorld({ creature: LURES[lure as keyof typeof LURES], player: ROUTES[0].switchPos, asleep: true })
      : createWorld({ seed: (Math.random() * 4294967296) >>> 0 });
    this.autoFireAt = lured ? 0.6 : -1;
    (window as unknown as { __blackout: World }).__blackout = this.w;
    this.w.listeners.push((e) => this.onEvent(e));
    this.acc = 0;
    this.hitStop = 0;
    this.pendingFire = -1;
    this.pendingInteract = false;
    this.pendingParry = false;
    this.pendingDash = false;
    this.flashUntil = 0;
    this.flashStrongUntil = 0;
    this.lit = false;
    this.leaving = false;
    this.vinesPlayed = false;
    this.playerStepAt = 0;
    this.creatureStepAt = 0;
    this.lastTremor = -1;
    this.prevCreature = 'stalk';
    this.heartAt = 0;
    this.noPowerAt = -1;

    startAmbience();
    setMusic(FIGHT[progress.level]);
    this.cameras.main.fadeIn(250, 8, 13, 18);
    this.room = new Room(this);
    this.breakers = new Breakers(this);
    this.playerView = new PlayerView(this);
    this.creatureView = new CreatureView(this);
    this.atmosphere = new Atmosphere(this);
    this.entrance = new Entrance(this);
    this.foliage = new Foliage(this);
    this.exitCue = new ExitCue(this);
    this.paths = new Paths(this);
    this.fx = new Fx(this);
    this.dust = new Dust(this);
    this.dark = new Darkness(this, { floor: FLOOR, blockers: this.room.blockers });
    this.warm = this.add.rectangle(0, 0, VIEW.w, VIEW.h, PALETTE.warm, 0).setOrigin(0, 0).setDepth(DEPTH.over + 8);
    this.add.image(0, 0, 'vignette').setOrigin(0, 0).setDepth(DEPTH.vignette);
    this.grain = this.add.image(0, 0, 'grain').setOrigin(0, 0).setDepth(DEPTH.grain).setAlpha(DARK.grainAlpha);
    this.hurt = this.add.rectangle(0, 0, VIEW.w, VIEW.h, PALETTE.n7, 0).setOrigin(0, 0).setDepth(DEPTH.flash);
    this.hud = new Hud(this, () => {
      resetRun();
      this.scene.start('Title');
    });
    const line = (y: number, text: string, size: number, tint: number) => this.add.bitmapText(VIEW.w / 2, y, 'stencil', text, size).setTint(tint).setOrigin(0.5);
    this.card = this.add.container(0, 0, [
      line(27, `ROOM ${progress.level + 1} OF ${ROOMS.length}`, 7, PALETTE.warm),
      line(40, ROOMS[progress.level].name, 14, PALETTE.warm2),
      this.add.rectangle(VIEW.w / 2, 52, 150, 1, PALETTE.warm, 0.8),
      line(60, LORE[progress.level].warden, 7, PALETTE.n7),
    ]).setDepth(DEPTH.banner).setAlpha(0);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.input.on('pointerdown', () => {
      if (this.hud.isOpen()) this.hud.close();
    });
    // Tabbing away mid-fight pauses it; nobody should come back to a death they didn't see.
    const away = () => {
      if (this.w.phase === 'play') this.hud.pause();
    };
    this.game.events.on(Phaser.Core.Events.BLUR, away);
    this.game.events.on(Phaser.Core.Events.HIDDEN, away);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.BLUR, away);
      this.game.events.off(Phaser.Core.Events.HIDDEN, away);
    });
  }

  private onKey(e: KeyboardEvent): void {
    if (this.hud.isOpen()) {
      this.hud.key(e);
      return;
    }
    if (e.repeat) return;
    const phase = this.w.phase;
    switch (e.code) {
      case 'Escape':
        if (phase === 'play') this.hud.pause();
        break;
      case 'KeyR':
        // Not after a win: one stray key shouldn't throw the room away.
        if (phase === 'play' || phase === 'lost') this.scene.restart();
        break;
      case 'Enter':
        if (phase === 'escaped') this.toChest();
        else if (phase === 'lost') this.scene.restart();
        break;
      case 'Digit1': case 'Numpad1': this.pendingFire = 0; break;
      case 'Digit2': case 'Numpad2': this.pendingFire = 1; break;
      case 'Digit3': case 'Numpad3': this.pendingFire = 2; break;
      case 'KeyE': case 'Space': this.pendingInteract = true; break;
      case 'KeyF': case 'Digit4': case 'Numpad4': this.pendingParry = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.pendingDash = true; break;
    }
  }

  private toChest(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(350, 8, 13, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Chest'));
  }

  private shake(s: { ms: number; amp: number }): void {
    const k = SHAKE_SCALE[settings.shake];
    if (k > 0) this.cameras.main.shake(s.ms, s.amp * k);
  }

  // Lights the whole room for a moment. strong is the fully lit part; with flashes reduced only the dim part is kept.
  private flash(soft: number, strong = 0): void {
    const t = this.w.time;
    const ms = VIS.flashMs / 1000;
    this.flashUntil = Math.max(this.flashUntil, t + ms * soft);
    if (settings.flash > 0) this.flashStrongUntil = Math.max(this.flashStrongUntil, t + ms * strong);
  }

  private whiteout(ms: number, r: number, g: number, b: number): void {
    if (settings.flash > 0) this.cameras.main.flash(ms, r, g, b);
  }

  private onEvent(e: SimEvent): void {
    const w = this.w;
    const c = w.creature;
    const p = w.player;
    switch (e.type) {
      case 'relayClick':
        play('relay_click');
        play('surge_crack');
        this.flash(1.6, 0.9);
        this.playerView.interact(w.time);
        break;
      case 'bounce':
        play('wall_crack');
        this.fx.burst(e.x, e.y, 14);
        this.flash(0.7);
        this.shake(VIS.bounceShake);
        break;
      case 'shock':
        if (!e.counted) break;
        play('surge_crack');
        play('bounce_hit');
        this.hitStop = VIS.hitStop;
        this.flash(1.4, 0.8);
        this.fx.burst(c.x, c.y, 22);
        this.shake(VIS.shockShake);
        this.hud.say(`SHOCK ${w.shocks} OF ${CFG.shocksToWin}`, c.x, c.y, PALETTE.warm2);
        break;
      case 'miss':
        play('fizzle');
        this.hud.say('MISSED', c.x, c.y, PALETTE.n7);
        break;
      case 'playerHit':
        play('player_hurt');
        this.hitStop = Math.max(this.hitStop, VIS.hurtStop);
        this.hurt.setAlpha(settings.flash > 0 ? 0.35 : 0.15);
        this.tweens.add({ targets: this.hurt, alpha: 0, duration: 300 });
        this.shake(VIS.hurtShake);
        this.hud.say(HURT_NOTE[e.by], p.x, p.y, PALETTE.r5);
        break;
      case 'seeds':
        play('boss_shot');
        this.fx.burst(c.x, c.y, 10);
        break;
      case 'escape':
        this.time.delayedCall(1100, () => this.toChest());
        break;
      case 'dash':
        play('dash');
        this.fx.burst(p.x, p.y, 6);
        break;
      case 'parryStart':
        play('parry_swing');
        break;
      case 'parry':
        play('parry');
        this.hitStop = VIS.hitStop;
        this.flash(0.9);
        this.fx.burst(p.x, p.y, 14);
        this.shake(VIS.hurtShake);
        this.hud.say('PARRY', p.x, p.y, PALETTE.c1);
        break;
      case 'bounceStart':
        play('bounce_launch');
        break;
      case 'ballBounce':
        play('bounce_wall');
        this.fx.burst(e.x, e.y, 8);
        this.shake(VIS.bounceShake);
        break;
      case 'superStart':
        play('super_launch');
        this.whiteout(200, 255, 240, 200);
        this.shake(VIS.shockShake);
        break;
      case 'superHit':
      case 'bounceHit': {
        const big = e.type === 'superHit';
        play('bounce_hit');
        if (big) play('surge_crack');
        this.hitStop = VIS.hitStop * (big ? 2 : 1);
        this.flash(big ? 2 : 1.4, big ? 1.4 : 0.8);
        this.fx.burst(c.x, c.y, big ? 40 : 22);
        this.shake(big ? VIS.superShake : VIS.shockShake);
        this.hud.say(`SHOCK ${w.shocks} OF ${CFG.shocksToWin}`, c.x, c.y, PALETTE.warm2);
        break;
      }
      case 'lampLit':
        play('lamp');
        break;
      case 'powerBack':
        play('power_back');
        break;
      case 'lose':
        play('blackout');
        break;
      case 'deadClick':
        play('dead_click');
        this.breakers.deadClick(e.breaker, w.time);
        this.hud.say(`BREAKER ${e.breaker + 1} IS OFFLINE`, p.x, p.y, PALETTE.n7);
        break;
      case 'win':
        play('power_return');
        this.lit = true;
        this.whiteout(260, 234, 243, 255);
        this.tweens.add({ targets: this.warm, alpha: 0.07, duration: 900 });
        break;
    }
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.1);
    if (this.hud.isOpen()) this.acc = 0;
    else if (this.hitStop > 0) this.hitStop -= dt;
    else {
      this.acc += dt * this.slow;
      while (this.acc >= STEP) {
        this.acc -= STEP;
        this.step();
      }
    }
    this.render(dt);
  }

  // A throw that didn't go through because the power is still out gets a click and a word, not silence.
  private refused(result: FireResult | 'none'): void {
    const w = this.w;
    if (result !== 'cooling' || w.time < this.noPowerAt) return;
    this.noPowerAt = w.time + 0.5;
    play('dead_click');
    this.hud.say('NO POWER YET', w.player.x, w.player.y, PALETTE.n7);
  }

  private step(): void {
    const w = this.w;
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (this.pendingFire >= 0) this.refused(fire(w, this.pendingFire));
    if (this.pendingInteract) {
      const result = tryInteract(w);
      if (result === 'none' && w.phase === 'play') this.hud.say('STAND AT A PANEL OR PRESS 1 2 3', w.player.x, w.player.y, PALETTE.n7);
      this.refused(result);
    }
    if (this.autoFireAt >= 0 && w.time >= this.autoFireAt) {
      this.autoFireAt = -1;
      fire(w, 0);
    }
    if (w.phase === 'play' || w.phase === 'won') {
      progress.total += STEP;
      progress.levelTimes[progress.level] += STEP;
    }
    stepWorld(w, { dx, dy, parry: this.pendingParry, dash: this.pendingDash }, STEP);
    this.pendingFire = -1;
    this.pendingInteract = false;
    this.pendingParry = false;
    this.pendingDash = false;
  }

  private sounds(w: World, t: number, gap: number): void {
    setCreatureDistance(gap);
    if (w.phase !== 'play') return;
    const c = w.creature;
    if (w.player.moving && !w.bounce && t >= this.playerStepAt) {
      play('step_player');
      this.playerStepAt = t + VIS.playerStep;
    }
    if (c.alive && !c.asleep && c.state === 'stalk' && gap > CFG.creatureRadius + CFG.playerRadius + 4 && t >= this.creatureStepAt) {
      play('step_creature');
      this.creatureStepAt = t + VIS.creatureStep;
    }
    if (c.state !== this.prevCreature) {
      if (c.state === 'windup') play('windup');
      else if (c.state === 'lunge') {
        play('lunge');
        this.shake(VIS.lungeShake);
      }
    }
    this.prevCreature = c.state;
    // The heartbeat quickens as the creature closes in or health runs low.
    if (!c.asleep && t >= this.heartAt) {
      const fear = Math.max(1 - Math.min(1, gap / VIS.heartNear), (CFG.healthPips - w.hp) / CFG.healthPips);
      if (fear > 0.15) play('heartbeat');
      this.heartAt = t + 1.1 - 0.65 * fear;
    }
  }

  private render(dt: number): void {
    const w = this.w;
    const t = w.time;
    // Room 1 points at the line the creature is standing on; after that the player reads it alone.
    const hot = progress.level === 0 ? lineUnder(w) : -1;
    this.playerView.update(w, t);
    this.sounds(w, t, Math.hypot(w.player.x - w.creature.x, w.player.y - w.creature.y));
    this.creatureView.update(w, t);
    this.dust.update(dt);
    this.paths.update(w, t, hot);
    this.foliage.update(dt);

    const lights = this.lightList;
    lights.length = 0;
    const x = px(w.player.x);
    const y = px(w.player.y);
    lights.push({ x, y, r: DARK.playerHalo, shadows: true });
    if (w.phase !== 'lost') lights.push({ x, y, r: DARK.coneR, cone: { angle: w.player.facing, half: DARK.coneHalf }, shadows: true });
    this.room.update(t, this.lit, lights);
    if (this.atmosphere.update(w, t, lights) && this.lastTremor !== Math.floor(t)) {
      this.lastTremor = Math.floor(t);
      this.shake({ ms: 120, amp: 0.0015 });
    }
    this.entrance.update(t, lights);
    this.exitCue.update(w, t, lights);
    this.breakers.update(w, t, lights);
    this.fx.update(w, dt, lights);
    if (w.creature.alive && w.creature.state === 'windup') lights.push({ x: px(w.creature.x), y: px(w.creature.y), r: 13, tint: PALETTE.g3 });
    if (hot >= 0) lights.push({ x: px(w.creature.x), y: px(w.creature.y), r: 20, tint: PATH_COLORS[hot] });

    // Room name card over the first few seconds, hidden while the panel is up so the two never overlap.
    this.card.setAlpha(this.hud.isOpen() ? 0 : Math.max(0, Math.min(1, Math.min((t - 0.2) / 0.6, (VIS.cardSeconds - t) / 0.8))));
    if (!this.vinesPlayed && t >= 0.4) {
      this.vinesPlayed = true;
      play('vines');
    }

    const ambient = this.lit ? 1 : t < this.flashStrongUntil ? 0 : t < this.flashUntil ? 1 : DARK.ambient;
    this.dark.render(lights, ambient);
    this.grain.setPosition(-Math.floor(Math.random() * 8), -Math.floor(Math.random() * 8));
    this.hud.update(w, dt, hot);
  }
}
