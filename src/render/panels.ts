import Phaser from 'phaser';
import { DARK, PALETTE, ROOM, VIEW } from '../config';
import { isOffline, type World } from '../sim/game';
import { ROUTES, pathBetween, type Route } from '../sim/routes';
import type { Light } from './darkness';
import { DEPTH } from './layers';
import { atlasOf, px } from './pixel';

const W = 36;
const H = 28;
const SCREEN = { x: 3, y: 10, w: 30, h: 16 };
const SC = 0.0285; // diagram px per world px: the whole room fits the 30 x 16 px screen

const DIGITS: Record<string, string[]> = {
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
};

export function panelPos(r: Route): { x: number; y: number } {
  if (r.switchPos.y > ROOM.y + ROOM.h - 30) return { x: Math.round(px(r.switchPos.x) - W / 2), y: VIEW.h - H };
  return { x: VIEW.w - W, y: Math.round(px(r.switchPos.y) - H / 2) };
}

const hexs = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

export class Breakers {
  private sprites: Phaser.GameObjects.Sprite[] = [];
  private screens: CanvasRenderingContext2D[] = [];
  private textures: Phaser.Textures.CanvasTexture[] = [];
  private keys: string[] = [];
  private shake: number[] = [];

  constructor(private scene: Phaser.Scene) {
    for (const r of ROUTES) {
      const p = panelPos(r);
      this.sprites.push(scene.add.sprite(p.x, p.y, 'breaker', 0).setOrigin(0, 0).setDepth(DEPTH.ghost - 2));
      const tex = scene.textures.createCanvas(`screen${r.id}`, W, H)!;
      this.textures.push(tex);
      this.screens.push(tex.getContext());
      scene.add.image(p.x, p.y, `screen${r.id}`).setOrigin(0, 0).setDepth(DEPTH.ghost - 1);
      this.keys.push('');
      this.shake.push(-1);
    }
  }

  deadClick(b: number, t: number): void {
    this.shake[b] = t;
  }

  private digit(ctx: CanvasRenderingContext2D, n: number, x: number, y: number, c: number): void {
    ctx.fillStyle = hexs(c);
    DIGITS[String(n)].forEach((row, j) => [...row].forEach((v, i) => v === '1' && ctx.fillRect(x + i, y + j, 1, 1)));
  }

  private line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  update(w: World, t: number): Light[] {
    const A = atlasOf(this.scene).sheets.breaker;
    const lights: Light[] = [];
    const cooling = w.cooldown > 0;
    for (const r of ROUTES) {
      const off = isOffline(w, r.id);
      const busy = w.surge?.route.id === r.id;
      const state = off ? A.states.offline : busy ? A.states.busy : cooling ? A.states.cooling : A.states.ready;
      const spr = this.sprites[r.id];
      const p = panelPos(r);
      const sk = this.shake[r.id] >= 0 && t - this.shake[r.id] < 0.25 ? Math.round(Math.sin(t * 90) * 1.5) : 0;
      spr.setFrame(state + (r.id === 1 ? A.dentOffset : 0)).setPosition(p.x + sk, p.y);

      const progress = busy && w.surge ? Math.floor(w.surge.dist / 40) : -1;
      const key = `${state}:${progress}`;
      if (key !== this.keys[r.id]) {
        this.keys[r.id] = key;
        this.draw(r, state, w, A.states);
      }
      lights.push({ x: p.x + W / 2, y: p.y + H / 2, r: DARK.panelR * (off ? 0.55 : cooling ? 0.75 : 1), tint: off ? undefined : PALETTE.r3 });
    }
    return lights;
  }

  private draw(r: Route, state: number, w: World, S: Record<string, number>): void {
    const ctx = this.screens[r.id];
    ctx.clearRect(0, 0, W, H);
    this.digit(ctx, r.id + 1, 8, 2, state === S.offline ? PALETTE.n4 : PALETTE.n7);
    ctx.fillStyle = hexs(PALETTE.n4);
    ctx.fillRect(5, 4, 2, 1);
    ctx.fillRect(13, 4, 2, 1);
    // faint grid so the diagram reads as a screen
    ctx.fillStyle = hexs(PALETTE.n3);
    for (let gx = 0; gx < SCREEN.w; gx += 8) for (let gy = 0; gy < SCREEN.h; gy += 8) ctx.fillRect(SCREEN.x + gx, SCREEN.y + gy, 1, 1);
    const map = (x: number, y: number): [number, number] => [SCREEN.x + (x - ROOM.x) * SC, SCREEN.y + (y - ROOM.y) * SC];
    const base = state === S.offline ? PALETTE.n4 : state === S.cooling ? PALETTE.r3 : PALETTE.r5;
    ctx.fillStyle = hexs(base);
    for (let i = 1; i < r.points.length; i++) {
      const [ax, ay] = map(r.points[i - 1].x, r.points[i - 1].y);
      const [bx, by] = map(r.points[i].x, r.points[i].y);
      this.line(ctx, ax, ay, bx, by);
    }
    if (state === S.busy && w.surge) {
      ctx.fillStyle = hexs(PALETTE.w);
      const path = pathBetween(r, 0, w.surge.dist);
      for (let i = 1; i < path.length; i++) {
        const [ax, ay] = map(path[i - 1].x, path[i - 1].y);
        const [bx, by] = map(path[i].x, path[i].y);
        this.line(ctx, ax, ay, bx, by);
      }
    }
    ctx.fillStyle = hexs(state === S.offline ? PALETTE.n4 : PALETTE.c1);
    for (const ci of r.contacts) {
      const [x, y] = map(r.points[ci].x, r.points[ci].y);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    const [sx, sy] = map(r.switchPos.x, r.switchPos.y);
    ctx.fillStyle = hexs(PALETTE.n7);
    ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 2, 2);
    this.textures[r.id].refresh();
  }
}
