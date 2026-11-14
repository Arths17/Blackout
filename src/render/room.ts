import Phaser from 'phaser';
import { EXIT, PALETTE, VIEW } from '../config';
import { ROUTES } from '../sim/routes';
import { DEPTH } from './layers';
import type { Light } from './darkness';
import { panelPos } from './panels';
import { atlasOf, px } from './pixel';
import { FLOOR, mx, my } from './layout';

export { FLOOR };

const hash = (a: number, b: number): number => {
  let h = Math.imul(a * 374761393 + b * 668265263, 1274126177) >>> 0;
  h ^= h >>> 13;
  return (Math.imul(h, 1103515245) >>> 0) / 4294967296;
};

interface PropPlacement {
  frame: number;
  x: number;
  y: number; // feet
  feet: number; // feet row inside the 32x32 cell
  fw: number; // footprint on the floor, used to cast shadows
  fh: number;
}

export class Room {
  blockers: { x0: number; y0: number; x1: number; y1: number }[] = [];
  private door: Phaser.GameObjects.Sprite;
  private strips: Phaser.GameObjects.Graphics;
  private lamps: { spr: Phaser.GameObjects.Sprite; x: number; y: number; seed: number }[] = [];
  private segs: { x: number; y: number; w: number; h: number; seed: number }[] = [];
  private sheet: (name: string, f: number) => { img: CanvasImageSource; sx: number; sy: number; w: number; h: number };

  constructor(private scene: Phaser.Scene) {
    const A = atlasOf(scene).sheets;
    this.sheet = (name, f) => {
      const [w, h] = A[name].frame as [number, number];
      const cols = A[name].cols as number;
      return { img: scene.textures.get(name).getSourceImage() as CanvasImageSource, sx: (f % cols) * w, sy: Math.floor(f / cols) * h, w, h };
    };
    this.bake();
    this.door = scene.add.sprite(px(EXIT.x), 0, 'door', 0).setOrigin(0, 0).setDepth(DEPTH.ghost - 3);
    this.props();
    this.strips = scene.add.graphics().setDepth(DEPTH.over);
    this.buildSegments();
  }

  private bake(): void {
    const A = atlasOf(this.scene).sheets;
    const tex = this.scene.textures.exists('room') ? this.scene.textures.get('room') as Phaser.Textures.CanvasTexture : this.scene.textures.createCanvas('room', VIEW.w, VIEW.h)!;
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    const blit = (name: string, f: number, x: number, y: number, flip = false) => {
      const s = this.sheet(name, f);
      if (flip) {
        ctx.save();
        ctx.translate(x + s.w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, 0, 0, s.w, s.h);
        ctx.restore();
      } else ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, x, y, s.w, s.h);
    };
    const dot = (x: number, y: number, c: number) => {
      ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
      ctx.fillRect(x, y, 1, 1);
    };

    ctx.fillStyle = `#${PALETTE.n1.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);

    const T = A.tiles;
    const special = new Map<string, number>();
    const set = (c: number, r: number, f: number) => special.set(`${c},${r}`, f);
    // hazard tiles in front of each breaker, a grate channel under the generator, stained corners by the first crates
    for (const r of ROUTES) {
      const p = panelPos(r);
      if (p.y > VIEW.h - 40) {
        const row = Math.floor((p.y - 1 - FLOOR.y0) / 16);
        for (let x = p.x; x < p.x + 36; x += 16) set(Math.floor((x - FLOOR.x0) / 16), row, T.hazard[Math.floor(x / 16) % 2]);
      } else {
        const col = Math.floor((p.x - 1 - FLOOR.x0) / 16);
        for (let y = p.y; y < p.y + 28; y += 16) set(col, Math.floor((y - FLOOR.y0) / 16), T.hazard[Math.floor(y / 16) % 2]);
      }
    }
    for (const c of [13, 14, 15, 16]) set(c, 8, T.grate[c % 2]);
    for (const c of [4, 5, 6]) set(c, 2, T.grate[0]);
    set(0, 7, T.blood); set(0, 8, T.wet); set(7, 4, T.blood); set(9, 5, T.wet); set(10, 1, T.crack[0]); set(3, 5, T.crack[1]);
    const rows = Math.ceil((FLOOR.y1 - FLOOR.y0) / 16);
    const cols = Math.ceil((FLOOR.x1 - FLOOR.x0) / 16);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = FLOOR.x0 + c * 16;
        const y = FLOOR.y0 + r * 16;
        const s = special.get(`${c},${r}`);
        let f: number;
        if (s !== undefined) f = s;
        else {
          const h = hash(c, r);
          f = h < 0.06 ? T.crack[h < 0.03 ? 0 : 1] : h < 0.09 ? T.wet : T.floor[Math.floor(hash(r, c) * 4)];
        }
        blit('tiles', f, x, y);
      }
    }

    // walls: north face, caps on the other three sides
    const faceOrder = [T.face[0], T.face[1], T.face[2], T.face[0], T.face[3], T.face[1], T.face[4], T.face[2], T.face[0], T.face[5], T.face[1], T.face[2], T.face[3], T.face[0], T.face[1], T.face[2], T.face[5], T.face[0], T.face[4], T.face[1], T.face[2], T.face[0], T.face[1], T.face[3]];
    for (let x = 0, i = 0; x < VIEW.w; x += 16, i++) blit('tiles', faceOrder[i % faceOrder.length], x, 0);
    for (let y = FLOOR.y0 - 1, i = 0; y < VIEW.h; y += 16, i++) {
      blit('tiles', T.cap[(i + 1) % 4], 0, y);
      blit('tiles', T.cap[(i + 2) % 4], FLOOR.x0 - 16, y);
      blit('tiles', T.cap[(i + 3) % 4], FLOOR.x1, y);
      blit('tiles', T.cap[i % 4], VIEW.w - 16, y);
    }
    for (let x = 0, i = 0; x < VIEW.w; x += 16, i++) blit('tiles', T.cap[i % 4], x, FLOOR.y1);
    for (let x = 0, i = 0; x < VIEW.w; x += 16, i++) blit('tiles', T.cap[(i + 2) % 4], x, FLOOR.y1 + 8);
    // the north face only needs 14 rows; redraw it over the cap seam
    for (let x = 0, i = 0; x < VIEW.w; x += 16, i++) blit('tiles', faceOrder[i % faceOrder.length], x, 0);

    // light comes from the top-left: walls throw a dithered shadow onto the floor below and to the right
    for (let x = FLOOR.x0; x < FLOOR.x1; x++) {
      dot(x, FLOOR.y0, PALETTE.ink);
      dot(x, FLOOR.y0 + 1, PALETTE.n1);
      if (x % 2 === 0) dot(x, FLOOR.y0 + 2, PALETTE.n1);
    }
    for (let y = FLOOR.y0; y < FLOOR.y1; y++) {
      dot(FLOOR.x0, y, PALETTE.n1);
      if (y % 2 === 0) dot(FLOOR.x0 + 1, y, PALETTE.n1);
    }
    for (let x = FLOOR.x0; x < FLOOR.x1; x++) dot(x, FLOOR.y1 - 1, PALETTE.n4);
    for (let y = FLOOR.y0; y < FLOOR.y1; y++) dot(FLOOR.x1 - 1, y, PALETTE.n4);

    // decals, placed rather than scattered: a drag mark from the creature's corner toward the first breaker
    const D = A.decals;
    const decals: [number, number, number, boolean?][] = [];
    // a drag mark from the creature's corner toward the first breaker
    const from = { x: px(732), y: px(324) };
    const to = { x: px(190), y: px(560) };
    for (let i = 0; i < 7; i++) {
      const t = 0.1 + i * 0.12;
      decals.push([D.drag[i % 2], Math.round(from.x + (to.x - from.x) * t) - 8, Math.round(from.y + (to.y - from.y) * t) - 8 + (i % 3) * 2, i % 3 === 0]);
    }
    decals.push(
      [D.blood[0], from.x - 6, from.y - 12], [D.blood[1], from.x - 22, from.y - 4], [D.blood[2], mx(100), my(140)], [D.blood[0], mx(270), my(118)], [D.puddle, mx(120), my(40)], [D.puddle, mx(240), my(112)],
      [D.slime, mx(268), my(128)], [D.debris[0], mx(70), my(100)], [D.debris[1], mx(170), my(56)], [D.debris[0], mx(250), my(48)], [D.debris[1], mx(50), my(70)], [D.paper, mx(80), my(140)],
      [D.paper, mx(225), my(96)], [D.rustdrip, mx(136), 12], [D.rustdrip, mx(214), 12], [D.cable, mx(84), my(150)], [D.cable, mx(100), my(150)], [D.cable, mx(116), my(152)], [D.cable, mx(128), my(152)],
      [D.cable, mx(270), my(80)], [D.blood[2], mx(44), my(118)],
    );
    for (const [f, x, y, fl] of decals) blit('decals', f, x, y, fl);
    // drain and skull sit on the floor, so they are baked in too
    const P = A.props;
    blit('props', P.drain, mx(162) - 16, my(92) - 16);
    blit('props', P.skull, mx(104) - 16, my(156) - 20);
    tex.refresh();
    this.scene.add.image(0, 0, 'room').setOrigin(0, 0).setDepth(DEPTH.room);
  }

  private props(): void {
    const P = atlasOf(this.scene).sheets.props;
    const list: PropPlacement[] = [
      { frame: P.crate_a, x: mx(36), y: my(152), feet: 29, fw: 22, fh: 11 },
      { frame: P.crate_b, x: mx(31), y: my(136), feet: 29, fw: 14, fh: 8 },
      { frame: P.toolchest, x: mx(94), y: my(166), feet: 26, fw: 16, fh: 7 },
      { frame: P.generator, x: mx(283), y: my(164), feet: 28, fw: 26, fh: 10 },
      { frame: P.barrel, x: mx(276), y: my(138), feet: 27, fw: 10, fh: 6 },
      { frame: P.barrel_toxic, x: mx(289), y: my(134), feet: 27, fw: 10, fh: 6 },
      { frame: P.barrel, x: mx(288), y: my(44), feet: 27, fw: 10, fh: 6 },
      { frame: P.locker, x: mx(36), y: my(40), feet: 28, fw: 12, fh: 8 },
      { frame: P.locker, x: mx(50), y: my(40), feet: 28, fw: 12, fh: 8 },
      { frame: P.bench, x: mx(96), y: my(38), feet: 27, fw: 26, fh: 8 },
      { frame: P.barrel_toxic, x: mx(290), y: my(112), feet: 27, fw: 10, fh: 6 },
    ];
    for (const p of list) this.blockers.push({ x0: p.x - p.fw / 2, y0: p.y - p.fh, x1: p.x + p.fw / 2, y1: p.y });
    for (const p of list) {
      this.scene.add.image(p.x, p.y, 'props', p.frame).setOrigin(0.5, p.feet / 32).setDepth(DEPTH.y + p.y);
      this.scene.add.image(p.x, p.y, 'shadow', 1).setOrigin(0.5, 0.2).setScale(1).setDepth(DEPTH.shadow).setAlpha(0.7);
    }
    // two dead wall lamps; one of them stutters red
    for (const [x, seed] of [[mx(125), 1], [mx(196), 2]] as const) {
      const spr = this.scene.add.sprite(x, 7, 'props', P.lamp_dead).setOrigin(0.5, 15 / 32).setDepth(DEPTH.y + 8);
      this.lamps.push({ spr, x, y: 7, seed });
    }
  }

  private buildSegments(): void {
    const seg = 22;
    const gap = 3;
    for (let x = FLOOR.x0 + 3; x + seg < FLOOR.x1; x += seg + gap) {
      this.segs.push({ x, y: FLOOR.y0 - 1, w: seg, h: 1, seed: x });
      this.segs.push({ x, y: FLOOR.y1, w: seg, h: 1, seed: x + 7 });
    }
    for (let y = FLOOR.y0 + 4; y + seg < FLOOR.y1; y += seg + gap) {
      this.segs.push({ x: FLOOR.x0 - 1, y, w: 1, h: seg, seed: y + 3 });
      this.segs.push({ x: FLOOR.x1, y, w: 1, h: seg, seed: y + 11 });
    }
  }

  // Emergency strips and flickering lamps. Returns their lights for the darkness pass.
  update(t: number, lit: boolean): Light[] {
    const g = this.strips;
    g.clear();
    const lights: Light[] = [];
    for (const s of this.segs) {
      const f = 0.55 + 0.25 * Math.sin(t * (1.3 + (s.seed % 7) * 0.27) + s.seed) + (Math.sin(t * 29 + s.seed * 5) > 0.94 ? -0.4 : 0);
      if (f < 0.2) continue;
      g.fillStyle(lit ? PALETTE.warm : f > 0.65 ? PALETTE.r4 : PALETTE.r3, 1);
      g.fillRect(s.x, s.y, s.w, s.h);
      if (f > 0.4) lights.push({ x: s.x + s.w / 2, y: s.y + s.h / 2, r: 10 * f + 8, tint: lit ? PALETTE.warm : undefined, floor: lit ? 0 : 2 });
    }
    for (const l of this.lamps) {
      const buzz = Math.sin(t * 41 + l.seed * 9) > 0.3 && Math.sin(t * 2.3 + l.seed) > 0.5;
      l.spr.setFrame(buzz ? atlasOf(this.scene).sheets.props.lamp_flicker : atlasOf(this.scene).sheets.props.lamp_dead);
      if (buzz) lights.push({ x: l.x, y: l.y + 6, r: 22, tint: PALETTE.r3 });
    }
    this.door.setFrame(lit ? 1 : 0);
    if (lit) lights.push({ x: px(EXIT.x) + 16, y: 12, r: 40, tint: PALETTE.warm });
    return lights;
  }
}
