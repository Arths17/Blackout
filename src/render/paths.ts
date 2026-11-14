import Phaser from 'phaser';
import { PATH_COLORS } from '../config';
import { isOffline, type World } from '../sim/game';
import { ROUTES } from '../sim/routes';
import { DEPTH } from './layers';
import { px } from './pixel';

const COLORS = PATH_COLORS;

// Every generator's path stays on screen, above the darkness, so you can see where the boss
// crosses one and press that generator's number.
export class Paths {
  private g: Phaser.GameObjects.Graphics;
  private tags: Phaser.GameObjects.BitmapText[] = [];

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.over + 2);
    for (const r of ROUTES) {
      const p = r.points[0];
      this.tags.push(scene.add.bitmapText(Math.round(px(p.x)), Math.round(px(p.y)), 'stencil', String(r.id + 1), 7).setTint(COLORS[r.id]).setOrigin(0.5).setDepth(DEPTH.over + 3));
    }
  }

  update(w: World, t: number): void {
    const g = this.g;
    g.clear();
    for (const r of ROUTES) {
      const off = isOffline(w, r.id);
      const live = w.surge?.route.id === r.id;
      const alpha = live ? 0.95 : off ? 0.16 : 0.6;
      const color = COLORS[r.id];
      let on = true;
      let run = 0;
      const dash = 5;
      const gap = off ? 5 : 3;
      const march = live ? t * 40 : 0;
      for (let i = 1; i < r.points.length; i++) {
        const ax = px(r.points[i - 1].x);
        const ay = px(r.points[i - 1].y);
        const bx = px(r.points[i].x);
        const by = px(r.points[i].y);
        const len = Math.hypot(bx - ax, by - ay);
        const ux = (bx - ax) / len;
        const uy = (by - ay) / len;
        for (let d = 0; d < len; d += 1) {
          if (run >= (on ? dash : gap)) {
            on = !on;
            run = 0;
          }
          run++;
          if (on && ((d + march) | 0) % 2 === 0) g.fillStyle(color, alpha).fillRect(Math.round(ax + ux * d), Math.round(ay + uy * d), 1, 1);
        }
      }
      // diamonds where the path meets a wall, so every bounce is easy to read
      for (const c of r.contacts) {
        const p = r.points[c];
        const x = Math.round(px(p.x));
        const y = Math.round(px(p.y));
        g.fillStyle(color, alpha + 0.2).fillRect(x - 1, y, 3, 1).fillRect(x, y - 1, 1, 3);
      }
      this.tags[r.id].setAlpha(off ? 0.3 : 1);
    }
  }
}
