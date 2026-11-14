import Phaser from 'phaser';
import { CFG, EXIT, H, LURES, PALETTE, ROOM, W } from '../config';
import type { Creature } from '../sim/creature';
import {
  createWorld,
  currentWindup,
  inExit,
  isOffline,
  lampPos,
  stepWorld,
  tryInteract,
  type SimEvent,
  type World,
} from '../sim/game';
import { ROUTES, pathBetween, type Route, type Vec } from '../sim/routes';
import { surgeHead } from '../sim/surge';

const STEP = 1 / CFG.stepHz;
const FONT = 'Menlo, Consolas, "Courier New", monospace';
const TRAIL = 140;

interface Spark {
  x: number;
  y: number;
  at: number;
}

export class Game extends Phaser.Scene {
  private w!: World;
  private acc = 0;
  private hitStop = 0;
  private slow = 1;
  private pendingInteract = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private under!: Phaser.GameObjects.Graphics;
  private over!: Phaser.GameObjects.Graphics;
  private panels!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private dark!: Phaser.GameObjects.RenderTexture;
  private erasers: Phaser.GameObjects.Image[] = [];
  private eraserUsed = 0;
  private surgeGlow!: Phaser.GameObjects.Image;
  private lampGlows: Phaser.GameObjects.Image[][] = [];
  private flash!: Phaser.GameObjects.Rectangle;
  private warm!: Phaser.GameObjects.Rectangle;
  private prompt!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private sparks: Spark[] = [];
  private autoFireAt = -1;
  private freezeAt = -1;
  private darkLevel: number = CFG.darkness;

  constructor() {
    super('Game');
  }

  create(): void {
    const q = new URLSearchParams(window.location.search);
    this.slow = Number(q.get('slow') ?? 1) || 1;
    this.freezeAt = Number(q.get('freeze') ?? -1);
    const lure = q.get('lure');
    this.w = lure && lure in LURES
      ? createWorld({ creature: LURES[lure as keyof typeof LURES], player: ROUTES[0].switchPos, asleep: true })
      : createWorld();
    if (lure && lure in LURES) this.autoFireAt = 0.6;
    (window as unknown as { __blackout: World }).__blackout = this.w;
    this.w.listeners.push((e) => this.onEvent(e));
    this.acc = 0;
    this.hitStop = 0;
    this.sparks = [];
    this.darkLevel = CFG.darkness;
    this.lampGlows = [];

    this.drawRoom();
    this.panels = this.add.graphics().setDepth(12);
    this.under = this.add.graphics().setDepth(2);
    this.erasers = [];
    this.dark = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(10);
    this.warm = this.add.rectangle(0, 0, W, H, PALETTE.warm, 0).setOrigin(0, 0).setDepth(11);
    this.surgeGlow = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(11).setVisible(false);
    for (const r of ROUTES) {
      this.lampGlows.push(
        r.lampDists.map((_, i) => {
          const p = lampPos(r.id, i);
          return this.add.image(p.x, p.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setDepth(11).setAlpha(0);
        }),
      );
    }
    this.over = this.add.graphics().setDepth(12);
    this.hud = this.add.graphics().setDepth(20);
    this.flash = this.add.rectangle(0, 0, W, H, 0xff2a1a, 0).setOrigin(0, 0).setDepth(25);

    const label = { fontFamily: FONT, fontSize: '16px', color: '#9aa7ba' };
    this.prompt = this.add.text(0, 0, '[E]', label).setOrigin(0.5).setDepth(21).setVisible(false);
    this.status = this.add.text(W / 2, 22, '', { ...label, fontSize: '18px' }).setOrigin(0.5).setDepth(21);
    this.banner = this.add.text(W / 2, H / 2 - 30, '', { fontFamily: FONT, fontSize: '56px', color: '#ffb14a', fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
    this.sub = this.add.text(W / 2, H / 2 + 30, '', { fontFamily: FONT, fontSize: '22px', color: '#cfd8e6' }).setOrigin(0.5).setDepth(30);
    this.add.text(W - 16, H - 14, 'MOVE WASD  FIRE E  RESTART R', { ...label, fontSize: '13px', color: '#56627a' }).setOrigin(1, 1).setDepth(21);
    ROUTES.forEach((r) => {
      const c = this.panelCenter(r);
      this.add.text(c.x - 24, c.y, String(r.id + 1), { fontFamily: FONT, fontSize: '22px', color: '#7b8699', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3);
    });

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,R') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-R', () => this.scene.restart());
    kb.on('keydown-E', () => (this.pendingInteract = true));
    kb.on('keydown-SPACE', () => (this.pendingInteract = true));
  }

  private onEvent(e: SimEvent): void {
    const cam = this.cameras.main;
    switch (e.type) {
      case 'bounce':
        this.sparks.push({ x: e.x, y: e.y, at: this.w.time });
        cam.shake(70, 0.0025);
        break;
      case 'shock':
        if (e.counted) {
          this.hitStop = 0.07;
          cam.shake(180, 0.008);
        }
        break;
      case 'playerHit':
        this.flash.setAlpha(0.45);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 350 });
        cam.shake(160, 0.006);
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

  private panelCenter(r: Route): Vec {
    const s = r.switchPos;
    if (s.y > ROOM.y + ROOM.h - 30) return { x: s.x, y: ROOM.y + ROOM.h + 24 };
    return { x: ROOM.x + ROOM.w + 38, y: s.y };
  }

  private drawRoom(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(PALETTE.wall, 1).fillRect(0, 0, W, H);
    g.fillStyle(PALETTE.floor, 1).fillRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
    g.lineStyle(1, PALETTE.wall, 0.7);
    for (let x = ROOM.x; x <= ROOM.x + ROOM.w; x += 80) g.lineBetween(x, ROOM.y, x, ROOM.y + ROOM.h);
    for (let y = ROOM.y; y <= ROOM.y + ROOM.h; y += 80) g.lineBetween(ROOM.x, y, ROOM.x + ROOM.w, y);
    this.add.graphics().setDepth(12).lineStyle(3, PALETTE.strip, 0.6).strokeRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);
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

  private erase(x: number, y: number, radius: number, alpha = 1): void {
    // Draw commands are queued until the texture renders, so each erase needs its own sprite.
    let img = this.erasers[this.eraserUsed++];
    if (!img) {
      img = new Phaser.GameObjects.Image(this, 0, 0, 'glow');
      this.erasers.push(img);
    }
    img.setScale((radius * 2) / 256).setAlpha(alpha);
    this.dark.erase(img, x, y);
  }

  private render(): void {
    const w = this.w;
    const t = w.time;
    this.renderPanels();
    this.renderUnder();

    const d = this.dark;
    this.eraserUsed = 0;
    d.clear();
    d.fill(PALETTE.ink, this.darkLevel);
    const pl = CFG.playerLightRadius * (w.phase === 'won' || w.phase === 'escaped' ? 2.2 : 1);
    this.erase(w.player.x, w.player.y, pl);
    if (w.phase === 'won' || w.phase === 'escaped') {
      this.erase(EXIT.x + EXIT.w / 2, ROOM.y + 20, 200, 0.9);
    }

    const og = this.over;
    og.clear();
    this.renderLamps(og, t);
    this.renderSurge(og);
    this.renderSparks(og, t);
    this.renderCreatureOver(og, t);
    this.renderExit(og);
    // Phaser 4 render textures only display; the queued fill/erase commands run on render().
    d.render();
    this.renderHud();
    this.renderText();
  }

  private renderPanels(): void {
    const g = this.panels;
    g.clear();
    const w = this.w;
    const cooling = w.cooldown > 0;
    for (const r of ROUTES) {
      const c = this.panelCenter(r);
      const off = isOffline(w, r.id);
      const busy = w.surge?.route.id === r.id;
      g.fillStyle(0x0d1320, 1).fillRect(c.x - 33, c.y - 20, 66, 40);
      g.lineStyle(2, off ? 0x2a3140 : 0x3a4559, 1).strokeRect(c.x - 33, c.y - 20, 66, 40);
      const stripColor = off ? 0x2a3140 : cooling ? 0x4a1c1c : busy ? PALETTE.surge : 0xd8402f;
      g.fillStyle(stripColor, 1).fillRect(c.x - 33, c.y - 20, 66, 4);
      // handle up = ready, down = offline
      g.fillStyle(off ? 0x39435a : 0x9aa7ba, 1).fillRect(c.x - 40 + 4, off ? c.y + 2 : c.y - 12, 8, 12);
      g.lineStyle(1, 0x56627a, 0.9);
      const s = 0.06;
      const ox = c.x - 25;
      const oy = c.y - 14;
      g.lineStyle(2, off ? 0x39435a : cooling ? 0x7a3a34 : 0xd8402f, 1);
      g.beginPath();
      r.points.forEach((p, i) => {
        const px = ox + (p.x - ROOM.x) * s;
        const py = oy + (p.y - ROOM.y) * s;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      g.strokePath();
      g.fillStyle(PALETTE.surge, off ? 0.3 : 0.9);
      for (const ci of r.contacts) {
        const p = r.points[ci];
        g.fillCircle(ox + (p.x - ROOM.x) * s, oy + (p.y - ROOM.y) * s, 2);
      }
      if (off) {
        g.lineStyle(2, 0x6b2b2b, 1);
        g.lineBetween(c.x - 33, c.y - 20, c.x + 33, c.y + 20);
      }
    }
  }

  private creatureShape(c: Creature, t: number): { pts: number[][]; eyes: Vec[]; scaleAlong: number } {
    let along = 1;
    let across = 1;
    let jx = 0;
    let jy = 0;
    if (c.state === 'stalk') {
      const b = 1 + 0.05 * Math.sin(t * 3);
      along = b;
      across = b;
    } else if (c.state === 'windup') {
      along = 0.78;
      across = 1.22;
      jx = (Math.random() - 0.5) * 4;
      jy = (Math.random() - 0.5) * 4;
    } else if (c.state === 'lunge') {
      along = 1.7;
      across = 0.7;
    } else {
      along = 0.7;
      across = 0.7;
    }
    const R = CFG.creatureRadius;
    const cos = Math.cos(c.facing);
    const sin = Math.sin(c.facing);
    const tx = (u: number, v: number): number[] => {
      const lu = u * along;
      const lv = v * across;
      return [c.x + jx + lu * cos - lv * sin, c.y + jy + lu * sin + lv * cos];
    };
    const pts: number[][] = [];
    const n = 9;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const spike = i % 2 === 0 ? 1.55 : 0.85;
      const rr = R * spike * (i === 0 ? 1.2 : 1);
      pts.push(tx(Math.cos(a) * rr, Math.sin(a) * rr));
    }
    const eyes = [tx(R * 0.55, -R * 0.28), tx(R * 0.55, R * 0.28)].map(([x, y]) => ({ x, y }));
    return { pts, eyes, scaleAlong: along };
  }

  private fillPoly(g: Phaser.GameObjects.Graphics, pts: number[][], color: number, alpha: number): void {
    g.fillStyle(color, alpha);
    g.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
    g.closePath();
    g.fillPath();
  }

  private renderUnder(): void {
    const g = this.under;
    g.clear();
    const w = this.w;
    const c = w.creature;
    const sh = this.creatureShape(c, w.time);
    if (!c.alive) {
      g.fillStyle(0x1a221c, 1).fillEllipse(c.x, c.y, 70, 40);
    } else {
      const recoilFlash = c.state === 'recoil' && Math.floor(w.time * 30) % 2 === 0;
      this.fillPoly(g, sh.pts, recoilFlash ? PALETTE.surge : 0x1b2a1e, 1);
    }
    const p = w.player;
    const bob = p.moving ? Math.sin(w.time * 18) * 1.5 : 0;
    const blink = w.grace > 0 && Math.floor(w.time * 14) % 2 === 0;
    g.fillStyle(blink ? 0x6b3a3a : 0xcfd8e6, 1).fillCircle(p.x, p.y + bob, CFG.playerRadius);
    g.fillStyle(PALETTE.surge, 1).fillCircle(p.x + Math.cos(p.facing) * 8, p.y + bob + Math.sin(p.facing) * 8, 3);
  }

  private renderCreatureOver(g: Phaser.GameObjects.Graphics, t: number): void {
    const w = this.w;
    const c = w.creature;
    if (!c.alive) return;
    const sh = this.creatureShape(c, t);
    const reveal = Math.max(0, Math.min(1, (w.revealUntil - t) / CFG.revealSeconds));
    if (reveal > 0) this.fillPoly(g, sh.pts, 0xd9e8d0, 0.55 * reveal);
    const hot = c.state === 'windup' ? 1 : c.state === 'lunge' ? 0.8 : 0.35;
    const er = c.state === 'windup' ? 5.5 : 3.5;
    for (const e of sh.eyes) {
      g.fillStyle(PALETTE.creature, 0.25 + hot * 0.3).fillCircle(e.x, e.y, er * 2.2);
      g.fillStyle(c.state === 'windup' ? 0xeaffb0 : PALETTE.creature, 0.4 + hot * 0.6).fillCircle(e.x, e.y, er);
    }
    if (c.state === 'windup') {
      // chevron pointing along the lunge so the windup reads with the sound off
      const k = 1 - Math.max(0, c.timer) / Math.max(0.01, currentWindup(w));
      const reach = 40 + 36 * k;
      const ax = c.x + Math.cos(c.facing) * (CFG.creatureRadius + 12);
      const ay = c.y + Math.sin(c.facing) * (CFG.creatureRadius + 12);
      const nx = -Math.sin(c.facing);
      const ny = Math.cos(c.facing);
      g.lineStyle(3, PALETTE.creature, 0.4 + 0.5 * k);
      g.beginPath();
      g.moveTo(ax + nx * 14, ay + ny * 14);
      g.lineTo(c.x + Math.cos(c.facing) * (CFG.creatureRadius + reach), c.y + Math.sin(c.facing) * (CFG.creatureRadius + reach));
      g.lineTo(ax - nx * 14, ay - ny * 14);
      g.strokePath();
    }
  }

  private renderLamps(g: Phaser.GameObjects.Graphics, t: number): void {
    for (const r of ROUTES) {
      r.lampDists.forEach((_, i) => {
        const p = lampPos(r.id, i);
        const f = Math.max(0, 1 - (t - this.w.lampLitAt[r.id][i]) / CFG.lampFade);
        g.fillStyle(0x2c3547, 1).fillCircle(p.x, p.y, 4);
        g.lineStyle(1, 0x56627a, 0.8).strokeCircle(p.x, p.y, 6);
        const glow = this.lampGlows[r.id][i];
        glow.setAlpha(f * 0.9).setScale((150 * (0.6 + 0.4 * f)) / 256);
        if (f > 0) {
          g.fillStyle(PALETTE.surge, f).fillCircle(p.x, p.y, 6);
          this.erase(p.x, p.y, 150 * f, 0.9);
        }
      });
    }
  }

  private renderSurge(g: Phaser.GameObjects.Graphics): void {
    const s = this.w.surge;
    if (!s) {
      this.surgeGlow.setVisible(false);
      return;
    }
    const head = surgeHead(s);
    const from = Math.max(0, s.dist - TRAIL);
    const slices = 6;
    for (let i = 0; i < slices; i++) {
      const a = from + ((s.dist - from) * i) / slices;
      const b = from + ((s.dist - from) * (i + 1)) / slices;
      const path = pathBetween(s.route, a, b);
      const k = (i + 1) / slices;
      g.lineStyle(2 + k * 5, PALETTE.surge, 0.15 + 0.8 * k);
      g.beginPath();
      path.forEach((p, j) => (j === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      g.strokePath();
    }
    g.fillStyle(PALETTE.surge, 1).fillCircle(head.x, head.y, 8);
    this.surgeGlow.setVisible(true).setPosition(head.x, head.y).setScale(1.1).setAlpha(0.9);
    this.erase(head.x, head.y, 170, 1);
  }

  private renderSparks(g: Phaser.GameObjects.Graphics, t: number): void {
    this.sparks = this.sparks.filter((s) => t - s.at < 0.3);
    for (const s of this.sparks) {
      const k = 1 - (t - s.at) / 0.3;
      g.lineStyle(2, PALETTE.surge, k);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + s.at * 7;
        g.lineBetween(s.x + Math.cos(a) * 4, s.y + Math.sin(a) * 4, s.x + Math.cos(a) * (10 + 16 * (1 - k)), s.y + Math.sin(a) * (10 + 16 * (1 - k)));
      }
      this.erase(s.x, s.y, 90 * k, 0.8);
    }
  }

  private renderExit(g: Phaser.GameObjects.Graphics): void {
    const open = this.w.phase === 'won' || this.w.phase === 'escaped';
    const x = EXIT.x;
    const y = ROOM.y - 20;
    g.fillStyle(open ? PALETTE.warm : 0x1a2233, 1).fillRect(x, y, EXIT.w, 20);
    g.fillStyle(open ? 0x3a2a12 : PALETTE.strip, open ? 1 : 0.7);
    for (let i = 0; i < EXIT.w; i += 20) g.fillTriangle(x + i, y + 20, x + i + 10, y, x + i + 20, y + 20);
  }

  private renderHud(): void {
    const g = this.hud;
    g.clear();
    const w = this.w;
    for (let i = 0; i < CFG.healthPips; i++) {
      g.fillStyle(i < w.hp ? 0xd8402f : 0x2a1b1b, 1).fillRect(ROOM.x + i * 26, 12, 20, 20);
    }
    for (let i = 0; i < CFG.shocksToWin; i++) {
      const cx = ROOM.x + ROOM.w - 20 - i * 26;
      g.fillStyle(i < w.shocks ? PALETTE.surge : 0x1c2433, 1).fillTriangle(cx - 10, 32, cx, 12, cx + 10, 32);
    }
  }

  private renderText(): void {
    const w = this.w;
    let status = '';
    if (w.phase === 'play') {
      if (w.cooldown > 0) status = `GENERATOR  ${w.cooldown.toFixed(1)}`;
      else if (w.surge) status = '';
      else status = 'POWER READY';
    }
    this.status.setText(status).setColor(w.cooldown > 0 ? '#b0453a' : '#7b8699');

    this.prompt.setVisible(false);
    if (w.phase === 'play' && !w.surge && w.cooldown <= 0) {
      for (const r of ROUTES) {
        const d = Math.hypot(w.player.x - r.switchPos.x, w.player.y - r.switchPos.y);
        if (d <= CFG.interactRange && !isOffline(w, r.id)) {
          this.prompt.setVisible(true).setPosition(w.player.x, w.player.y - 26);
        }
      }
    }

    let banner = '';
    let sub = '';
    if (w.phase === 'won') {
      banner = 'POWER RESTORED';
      sub = 'EXIT OPEN';
    } else if (w.phase === 'escaped') {
      banner = 'OUT';
      sub = `${w.endTime.toFixed(1)}s   RESTART [R]`;
    } else if (w.phase === 'lost') {
      banner = 'BLACKED OUT';
      sub = 'RESTART [R]';
    }
    this.banner.setText(banner).setColor(w.phase === 'lost' ? '#d8402f' : '#ffb14a');
    this.sub.setText(sub);
    if (w.phase === 'won' && inExit(w.player)) this.banner.setText('');
  }
}
