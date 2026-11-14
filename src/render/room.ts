import Phaser from 'phaser';
import { EXIT, PALETTE, ROOM, VIEW } from '../config';
import { DEPTH } from './layers';
import type { Light } from './darkness';
import { atlasOf, px } from './pixel';

// Floor and wall bounds in screen px. They follow the sim's room rectangle (ROOM / 3) to within a pixel.
export const FLOOR = {
  x0: Math.floor(px(ROOM.x)),
  y0: Math.ceil(px(ROOM.y)),
  x1: Math.ceil(px(ROOM.x + ROOM.w)),
  y1: Math.ceil(px(ROOM.y + ROOM.h)),
};

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
}

export class Room {
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
    const tex = this.scene.textures.createCanvas('room', VIEW.w, VIEW.h)!;
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
    // hazard tiles in front of each breaker, a grate channel under the generator, a stained corner by the first crates
    for (const c of [2, 3, 4]) set(c, 10, T.hazard[c % 2]);
    for (const c of [16, 17, 18]) set(c, 10, T.hazard[c % 2]);
    set(20, 5, T.hazard[0]); set(20, 6, T.hazard[1]);
    for (const c of [17, 18, 19, 20]) set(c, 9, T.grate[c % 2]);
    for (const c of [5, 6, 7]) set(c, 3, T.grate[0]);
    set(1, 9, T.blood); set(1, 10, T.wet); set(8, 5, T.blood); set(11, 7, T.wet); set(13, 2, T.crack[0]); set(4, 6, T.crack[1]);
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 22; c++) {
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
    const decals: [number, number, number, boolean?][] = [
      [D.drag[0], 262, 100], [D.drag[1], 246, 108], [D.drag[0], 230, 118, true], [D.drag[1], 214, 126], [D.drag[0], 198, 138], [D.drag[1], 182, 148, true],
      [D.blood[0], 270, 96], [D.blood[1], 250, 106], [D.blood[2], 120, 160], [D.blood[0], 340, 150], [D.puddle, 150, 60], [D.puddle, 296, 150],
      [D.slime, 326, 150], [D.debris[0], 90, 130], [D.debris[1], 214, 70], [D.debris[0], 300, 60], [D.debris[1], 60, 90], [D.paper, 104, 180],
      [D.paper, 280, 120], [D.rustdrip, 168, 15], [D.rustdrip, 264, 15], [D.cable, 100, 184], [D.cable, 116, 184], [D.cable, 132, 186], [D.cable, 144, 186],
      [D.cable, 328, 100], [D.blood[2], 50, 150],
    ];
    for (const [f, x, y, fl] of decals) blit('decals', f, x, y, fl);
    // drain and skull sit on the floor, so they are baked in too
    const P = A.props;
    blit('props', P.drain, 196 - 16, 112 - 16);
    blit('props', P.skull, 124 - 16, 188 - 20);
    tex.refresh();
    this.scene.add.image(0, 0, 'room').setOrigin(0, 0).setDepth(DEPTH.room);
  }

  private props(): void {
    const P = atlasOf(this.scene).sheets.props;
    const list: PropPlacement[] = [
      { frame: P.crate_a, x: 40, y: 196, feet: 29 },
      { frame: P.crate_b, x: 34, y: 177, feet: 29 },
      { frame: P.toolchest, x: 104, y: 198, feet: 26 },
      { frame: P.generator, x: 341, y: 196, feet: 28 },
      { frame: P.barrel, x: 330, y: 168, feet: 27 },
      { frame: P.barrel_toxic, x: 346, y: 164, feet: 27 },
      { frame: P.barrel, x: 336, y: 52, feet: 27 },
      { frame: P.locker, x: 42, y: 44, feet: 28 },
      { frame: P.locker, x: 57, y: 44, feet: 28 },
      { frame: P.bench, x: 112, y: 42, feet: 27 },
      { frame: P.barrel_toxic, x: 344, y: 138, feet: 27 },
    ];
    for (const p of list) {
      this.scene.add.image(p.x, p.y, 'props', p.frame).setOrigin(0.5, p.feet / 32).setDepth(DEPTH.y + p.y);
      this.scene.add.image(p.x, p.y, 'shadow', 1).setOrigin(0.5, 0.2).setScale(1).setDepth(DEPTH.shadow).setAlpha(0.7);
    }
    // two dead wall lamps; one of them stutters red
    for (const [x, seed] of [[152, 1], [236, 2]] as const) {
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
