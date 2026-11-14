import Phaser from 'phaser';
import { CFG, EXIT, H, LURES, PALETTE, ROOM, VIS, W } from '../config';
import { createWorld, stepWorld, tryInteract, type SimEvent, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { BODY_STYLE, FLASH_STYLE, GHOST_STYLE, drawCreature, drawEyes, drawTelegraph, rimStyle } from '../render/creature';
import { Sparks, drawLamps, drawSurge } from '../render/fx';
import { Hud } from '../render/hud';
import { DEPTH } from '../render/layers';
import { Lights } from '../render/lights';
import { Panels } from '../render/panels';
import { drawPlayer } from '../render/player';
import { RoomFx, buildRoom, drawExit } from '../render/room';

const STEP = 1 / CFG.stepHz;

export class Game extends Phaser.Scene {
  private w!: World;
  private acc = 0;
  private hitStop = 0;
  private slow = 1;
  private pendingInteract = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private under!: Phaser.GameObjects.Graphics;
  private over!: Phaser.GameObjects.Graphics;
  private light!: Lights;
  private panels!: Panels;
  private roomFx!: RoomFx;
  private hud!: Hud;
  private sparks = new Sparks();
  private flash!: Phaser.GameObjects.Rectangle;
  private warm!: Phaser.GameObjects.Rectangle;
  private darkLevel: number = CFG.darkness;
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
    this.sparks = new Sparks();
    this.darkLevel = CFG.darkness;

    buildRoom(this);
    this.panels = new Panels(this);
    this.under = this.add.graphics().setDepth(DEPTH.under);
    this.light = new Lights(this);
    this.over = this.add.graphics().setDepth(DEPTH.over);
    this.roomFx = new RoomFx(this);
    this.warm = this.add.rectangle(0, 0, W, H, PALETTE.warm, 0).setOrigin(0, 0).setDepth(DEPTH.over + 1);
    this.flash = this.add.rectangle(0, 0, W, H, 0xff2a1a, 0).setOrigin(0, 0).setDepth(DEPTH.flash);
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
      case 'bounce':
        this.sparks.add(e.x, e.y, this.w.time);
        cam.shake(VIS.bounceShake.ms, VIS.bounceShake.amp);
        break;
      case 'shock':
        if (e.counted) {
          this.hitStop = VIS.hitStop;
          cam.shake(VIS.shockShake.ms, VIS.shockShake.amp);
        }
        break;
      case 'playerHit':
        this.flash.setFillStyle(0xff2a1a).setAlpha(0.4);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 350 });
        cam.shake(VIS.hurtShake.ms, VIS.hurtShake.amp);
        break;
      case 'deadClick':
        this.panels.deadClick(e.breaker, this.w.time);
        break;
      case 'win':
        this.tweens.add({ targets: cam, zoom: 1.05, duration: 220, yoyo: true, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: this.warm, alpha: 0.1, duration: 900 });
        this.tweens.addCounter({ from: this.darkLevel, to: 0.25, duration: 900, onUpdate: (t) => (this.darkLevel = t.getValue() ?? 0.25) });
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
    this.render();
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

  private render(): void {
    const w = this.w;
    const t = w.time;
    const c = w.creature;
    const lit = w.phase === 'won' || w.phase === 'escaped';
    const L = this.light;
    L.begin(this.darkLevel, t);

    this.panels.draw(w, t, L);

    const u = this.under;
    u.clear();
    const flashing = c.state === 'recoil' && c.alive && Math.floor(t * 30) % 2 === 0;
    drawCreature(u, c, t, flashing ? FLASH_STYLE : c.alive ? BODY_STYLE : { ...BODY_STYLE, alpha: 0.55 });
    drawPlayer(u, w.player, t, w.grace > 0 && Math.floor(t * 14) % 2 === 0);

    L.pool(w.player.x, w.player.y, CFG.playerLightRadius * (lit ? 2.2 : 1));
    L.halo(w.player.x, w.player.y, CFG.playerLightRadius * 1.1, 0.16, 0x8fa6cc);
    if (lit) L.pool(EXIT.x + EXIT.w / 2, ROOM.y + 60, 260, 0.9);

    const o = this.over;
    o.clear();
    drawLamps(o, w, L);
    drawSurge(o, w, L);
    this.sparks.draw(o, L, t);
    if (c.alive) {
      const reveal = Math.max(0, Math.min(1, (w.revealUntil - t) / CFG.revealSeconds));
      if (reveal > 0) drawCreature(o, c, t, { ...GHOST_STYLE, alpha: GHOST_STYLE.alpha * reveal });
      if (!reveal) drawCreature(o, c, t, rimStyle(c));
      drawTelegraph(o, c);
      drawEyes(o, c, t);
    }
    drawExit(o, lit, t);
    this.roomFx.draw(t, lit);

    L.end();
    this.hud.draw(w);
  }
}
