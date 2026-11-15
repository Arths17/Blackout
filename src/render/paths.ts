import Phaser from 'phaser';
import { PALETTE, PATH_COLORS, PATH_DASH } from '../config';
import { isOffline, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { DEPTH } from './layers';
import { px } from './pixel';

// Every breaker's line stays on screen, above the darkness, so you can see where the creature
// crosses one and press that breaker's number.
export class Paths {
  private g: Phaser.GameObjects.Graphics[] = [];
  private tags: Phaser.GameObjects.BitmapText[] = [];
  private drawn: string[] = [];

  constructor(scene: Phaser.Scene) {
    for (const r of ROUTES) {
      const p = r.points[0];
      this.g.push(scene.add.graphics().setDepth(DEPTH.over + 2));
      this.tags.push(scene.add.bitmapText(Math.round(px(p.x)), Math.round(px(p.y)), 'stencil', String(r.id + 1), 7).setTint(PATH_COLORS[r.id]).setOrigin(0.5).setDepth(DEPTH.over + 3));
      this.drawn.push('');
    }
  }

  // hot is the line the room 1 prompt is pointing at, or -1.
  update(w: World, t: number, hot: number): void {
    for (const r of ROUTES) {
      const off = isOffline(w, r.id);
      const live = w.surge?.route.id === r.id;
      const blink = hot === r.id && Math.floor(t * 6) % 2 === 0;
      const march = live ? Math.floor(t * 40) % 2 : 0;
      this.tags[r.id].setAlpha(off ? 0.3 : 1).setTint(blink ? PALETTE.w : PATH_COLORS[r.id]);
      // A line only changes look a few times a fight, so it is redrawn then and not every frame.
      const key = `${off}${live}${hot === r.id}${blink}${march}`;
      if (key === this.drawn[r.id]) continue;
      this.drawn[r.id] = key;
      this.draw(r.id, off ? 0.16 : live || hot === r.id ? 0.95 : 0.7, blink ? PALETTE.w : PATH_COLORS[r.id], off, march, hot === r.id);
    }
  }

  private draw(id: number, alpha: number, color: number, off: boolean, march: number, thick: boolean): void {
    const r = ROUTES[id];
    const g = this.g[id];
    g.clear();
    g.fillStyle(color, alpha);
    // Each line has its own dash length as well as its own color.
    const dash = PATH_DASH[id];
    const gap = off ? 5 : 3;
    let on = true;
    let run = 0;
    for (let i = 1; i < r.points.length; i++) {
      const ax = px(r.points[i - 1].x);
      const ay = px(r.points[i - 1].y);
      const bx = px(r.points[i].x);
      const by = px(r.points[i].y);
      const len = Math.hypot(bx - ax, by - ay);
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      for (let d = 0; d < len; d++) {
        if (run >= (on ? dash : gap)) {
          on = !on;
          run = 0;
        }
        run++;
        if (on && (d + march) % 2 === 0) g.fillRect(Math.round(ax + ux * d), Math.round(ay + uy * d), thick ? 2 : 1, thick ? 2 : 1);
      }
    }
    // diamonds where the line meets a wall, so every bounce is easy to read
    g.fillStyle(color, Math.min(1, alpha + 0.2));
    for (const c of r.contacts) {
      const x = Math.round(px(r.points[c].x));
      const y = Math.round(px(r.points[c].y));
      g.fillRect(x - 1, y, 3, 1).fillRect(x, y - 1, 1, 3);
    }
  }
}
