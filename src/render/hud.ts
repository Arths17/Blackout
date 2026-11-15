import Phaser from 'phaser';
import { setVolume } from '../audio';
import { CFG, PALETTE, PATH_COLORS, ROOMS, VIEW } from '../config';
import { progress } from '../progress';
import { FLASH_NAMES, SHAKE_NAMES, saveSettings, settings } from '../settings';
import { type Hurt, type World } from '../sim/game';
import { DEPTH } from './layers';
import { atlasOf, px } from './pixel';

// The how-to-play panel opens once per page load; restarting with R skips it.
let introSeen = false;
// Set once the player has thrown a breaker, so the opening hint stops showing.
let thrown = false;

const CAUSE: Record<Hurt, string> = {
  creature: 'IT CAUGHT YOU',
  surge: 'YOUR OWN SURGE CAUGHT YOU',
  seed: 'A SEED HIT YOU',
};

const HOW = [
  'MOVE     WASD OR ARROWS',
  '1 2 3    THROW THAT BREAKER',
  'F        PARRY A LUNGE OR A SEED',
  'SHIFT    SHORT DASH',
  'R        RESTART THE ROOM',
  'ESC      PAUSE',
].join('\n');
const RULES = 'LURE IT ONTO A LINE. THROW THAT BREAKER.\nTHE SURGE BOUNCES BACK. KEEP OFF THE LINE.';

const PW = 270;
const PH = 184;
const PX = Math.round((VIEW.w - PW) / 2);
const PY = Math.round((VIEW.h - PH) / 2);
const OPTIONS_Y = PY + 116;

interface Note {
  text: Phaser.GameObjects.BitmapText;
  life: number;
}

export class Hud {
  private pips: Phaser.GameObjects.Image[] = [];
  private healthCaption: Phaser.GameObjects.BitmapText;
  private status: Phaser.GameObjects.BitmapText;
  private bar: Phaser.GameObjects.Rectangle;
  private banner: Phaser.GameObjects.BitmapText;
  private sub: Phaser.GameObjects.BitmapText;
  private sub2: Phaser.GameObjects.BitmapText;
  private prompt: Phaser.GameObjects.BitmapText;
  private notes: Note[] = [];
  private panel: Phaser.GameObjects.Container;
  private panelTitle: Phaser.GameObjects.BitmapText;
  private panelHint: Phaser.GameObjects.BitmapText;
  private optionRows: Phaser.GameObjects.BitmapText[] = [];
  private cursor: Phaser.GameObjects.BitmapText;
  private picked = 0;
  private open = false;
  private paused = false;

  constructor(private scene: Phaser.Scene, private onTitle: () => void) {
    const text = (x: number, y: number, value: string, tint: number, size = 7) =>
      scene.add.bitmapText(x, y, 'stencil', value, size).setTint(tint).setOrigin(0.5).setDepth(DEPTH.text);

    const frame = scene.add.graphics().setDepth(DEPTH.hud - 1);
    const box = (x: number, y: number, w: number, h: number) => {
      frame.fillStyle(PALETTE.ink, 0.9).fillRect(x, y, w, h);
      frame.lineStyle(1, PALETTE.n3, 1).strokeRect(x, y, w, h);
    };
    box(2, 1, 110, 15);
    box(2, VIEW.h - 17, VIEW.w - 4, 15);
    box(VIEW.w - 82, 1, 80, 15);
    text(VIEW.w - 42, 8, `ROOM ${progress.level + 1} OF ${ROOMS.length}`, PALETTE.warm);
    this.healthCaption = text(84, 8, 'HEALTH', PALETTE.n6);
    this.status = text(VIEW.w / 2, VIEW.h - 10, '', PALETTE.warm2);
    for (let i = 0; i < CFG.healthPips; i++) this.pips.push(scene.add.image(5 + i * 10, 2, 'ui', 0).setOrigin(0, 0).setDepth(DEPTH.hud));

    this.bar = scene.add.rectangle(0, VIEW.h / 2, VIEW.w, 48, PALETTE.ink, 0.92).setOrigin(0, 0.5).setDepth(DEPTH.banner - 1).setVisible(false);
    this.banner = text(VIEW.w / 2, VIEW.h / 2 - 12, '', PALETTE.n7, 14).setDepth(DEPTH.banner);
    this.sub = text(VIEW.w / 2, VIEW.h / 2 + 4, '', PALETTE.n7).setDepth(DEPTH.banner);
    this.sub2 = text(VIEW.w / 2, VIEW.h / 2 + 15, '', PALETTE.warm2).setDepth(DEPTH.banner);
    this.prompt = text(0, 0, '', PALETTE.w).setDepth(DEPTH.text).setVisible(false);
    for (let i = 0; i < 6; i++) this.notes.push({ text: text(0, 0, '', PALETTE.w).setVisible(false), life: 0 });

    const g = scene.add.graphics();
    g.fillStyle(PALETTE.ink, 0.96).fillRect(PX, PY, PW, PH);
    g.lineStyle(1, PALETTE.n6, 1).strokeRect(PX, PY, PW, PH);
    g.lineStyle(1, PALETTE.n3, 1).strokeRect(PX + 3, PY + 3, PW - 6, PH - 6);
    g.fillStyle(PALETTE.n3, 1).fillRect(PX + 12, PY + 78, PW - 24, 1).fillRect(PX + 12, OPTIONS_Y - 9, PW - 24, 1);
    const left = (x: number, y: number, value: string, tint: number) => scene.add.bitmapText(x, y, 'stencil', value, 7).setTint(tint);
    this.panelTitle = scene.add.bitmapText(VIEW.w / 2, PY + 13, 'stencil', '', 7).setTint(PALETTE.warm2).setOrigin(0.5);
    this.panelHint = scene.add.bitmapText(VIEW.w / 2, PY + PH - 12, 'stencil', '', 7).setTint(PALETTE.warm2).setOrigin(0.5);
    this.cursor = left(PX + 14, OPTIONS_Y, '>', PALETTE.warm2);
    for (let i = 0; i < 3; i++) this.optionRows.push(left(PX + 26, OPTIONS_Y + i * 10, '', PALETTE.w));
    this.panel = scene.add.container(0, 0, [
      g, this.panelTitle, left(PX + 14, PY + 24, HOW, PALETTE.w), left(PX + 14, PY + 85, RULES, PALETTE.warm),
      this.cursor, ...this.optionRows,
      left(PX + 14, OPTIONS_Y + 34, 'ARROW KEYS CHANGE THESE', PALETTE.n6), this.panelHint,
    ]).setDepth(DEPTH.banner + 2).setVisible(false);
    this.writeOptions();
    if (!introSeen) this.show(false);
  }

  private show(paused: boolean): void {
    this.open = true;
    this.paused = paused;
    this.panelTitle.setText(paused ? 'PAUSED' : 'HOW TO PLAY');
    this.panelHint.setText(paused ? 'ANY OTHER KEY RESUMES    [T] TITLE SCREEN' : 'ANY OTHER KEY BEGINS');
    this.panel.setVisible(true);
  }

  pause(): void {
    if (!this.open) this.show(true);
  }

  close(): void {
    this.open = false;
    introSeen = true;
    this.panel.setVisible(false);
  }

  isOpen(): boolean {
    return this.open;
  }

  // Keys while the panel is up: arrows work the options, T leaves a paused fight, anything else closes it.
  key(e: KeyboardEvent): void {
    const step = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0;
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      this.picked = (this.picked + (e.code === 'ArrowUp' ? 2 : 1)) % 3;
    } else if (step !== 0) {
      if (this.picked === 0) settings.volume = Math.max(0, Math.min(10, settings.volume + step));
      else if (this.picked === 1) settings.shake = (settings.shake + step + SHAKE_NAMES.length) % SHAKE_NAMES.length;
      else settings.flash = (settings.flash + step + FLASH_NAMES.length) % FLASH_NAMES.length;
      setVolume(settings.volume / 10);
      saveSettings();
    } else if (e.code === 'KeyT' && this.paused) {
      this.onTitle();
      return;
    } else if (!e.repeat && !/^(Shift|Control|Alt|Meta)|^Tab$/.test(e.code)) {
      this.close();
      return;
    }
    this.writeOptions();
  }

  private writeOptions(): void {
    const rows = [
      `VOLUME        < ${settings.volume} >`,
      `SCREEN SHAKE  < ${SHAKE_NAMES[settings.shake]} >`,
      `FLASHES       < ${FLASH_NAMES[settings.flash]} >`,
    ];
    rows.forEach((r, i) => this.optionRows[i].setText(r).setTint(i === this.picked ? PALETTE.warm2 : PALETTE.n7));
    this.cursor.setY(OPTIONS_Y + this.picked * 10);
  }

  // A short word that rises off a spot in the room: what just happened, where it happened.
  say(value: string, wx: number, wy: number, tint: number = PALETTE.w): void {
    const n = this.notes.reduce((a, b) => (b.life < a.life ? b : a));
    const half = value.length * 3 + 4;
    const x = Math.max(half, Math.min(VIEW.w - half, Math.round(px(wx))));
    n.text.setText(value).setTint(tint).setPosition(x, Math.max(26, Math.round(px(wy)) - 22)).setVisible(true).setAlpha(1);
    n.life = 1.1;
  }

  private statusLine(w: World, hot: number): string {
    if (w.phase === 'won') return 'THE EXIT IS OPEN  GO TO THE DOOR AT THE TOP RIGHT';
    if (w.phase !== 'play') return '';
    if (w.bounce) return w.bounce.super ? 'SUPER BOUNCE  YOU SHOCK IT IF YOU HIT IT' : 'KNOCKED BACK  YOU SHOCK IT IF YOU HIT IT';
    if (w.surge) return 'SURGE LIVE  KEEP OFF ITS LINE';
    if (w.cooldown > 0) {
      const back = `POWER BACK IN ${w.cooldown.toFixed(1)}`;
      return w.missStreak > 0 ? `MISSED  IT GETS FASTER  ${back}` : back;
    }
    if (w.parryStreak > 0) return `PARRY ${w.parryStreak} OF ${CFG.parriesForSuper}  ONE MORE FOR A SUPER BOUNCE`;
    if (hot >= 0) return `IT IS ON LINE ${hot + 1}  PRESS ${hot + 1} NOW`;
    if (!thrown) return 'WAIT UNTIL IT STANDS ON A LINE  THEN PRESS THAT NUMBER';
    if (w.lastHitBreaker >= 0) return `BREAKER ${w.lastHitBreaker + 1} IS OFFLINE UNTIL ANOTHER ONE HITS`;
    return 'PRESS 1  2  OR 3 TO THROW A BREAKER';
  }

  // hot is the breaker whose line the creature is standing on while the room 1 prompt is active, or -1.
  update(w: World, dt: number, hot: number): void {
    if (w.surge) thrown = true;
    const U = atlasOf(this.scene).sheets.ui;
    this.pips.forEach((p, i) => p.setFrame(i < w.hp ? U.pip.full : w.grace > 0.8 && i === w.hp ? U.pip.flash : U.pip.empty));
    this.healthCaption.setTint(w.hp <= 1 ? PALETTE.r4 : PALETTE.n6);
    this.status.setText(this.statusLine(w, hot));

    this.prompt.setVisible(hot >= 0 && !this.open);
    if (hot >= 0) {
      const blink = Math.floor(w.time * 6) % 2 === 0;
      this.prompt.setText(`[${hot + 1}]`).setTint(blink ? PALETTE.w : PATH_COLORS[hot]).setPosition(Math.round(px(w.creature.x)), Math.round(px(w.creature.y)) - 58);
    }

    for (const n of this.notes) {
      if (n.life <= 0) continue;
      n.life -= dt;
      n.text.y -= dt * 14;
      n.text.setAlpha(Math.min(1, n.life * 3)).setVisible(n.life > 0);
    }

    let banner = '', sub = '', sub2 = '';
    const since = w.time - w.endTime;
    if (w.phase === 'won' && since < 2.2) {
      banner = 'POWER RESTORED';
      sub = 'THE GENERATOR HOLDS';
    } else if (w.phase === 'escaped') {
      banner = progress.level >= ROOMS.length - 1 ? 'THE ROT ENDS' : `ROOM ${progress.level + 1} CLEARED`;
      sub = `${progress.levelTimes[progress.level].toFixed(1)} SECONDS`;
    } else if (w.phase === 'lost') {
      banner = 'BLACKED OUT';
      sub = `${CAUSE[w.hurtBy ?? 'creature']}  -  ${w.shocks} OF ${CFG.shocksToWin} SHOCKS LANDED`;
      if (since > 0.6) sub2 = '[R] TRY AGAIN';
    }
    this.bar.setVisible(banner !== '');
    this.banner.setText(banner).setTint(w.phase === 'lost' ? PALETTE.n7 : PALETTE.warm);
    this.sub.setText(sub);
    this.sub2.setText(sub2).setAlpha(Math.floor(w.time * 2.5) % 3 === 2 ? 0.4 : 1);
  }
}
