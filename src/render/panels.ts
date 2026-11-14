import Phaser from 'phaser';
import { PALETTE, ROOM, VIS, W } from '../config';
import { isOffline, type World } from '../sim/game';
import { ROUTES, pathBetween, type Route } from '../sim/routes';
import { DEPTH } from './layers';
import type { Lights } from './lights';

export function panelRect(r: Route): { x: number; y: number; w: number; h: number } {
  const w = VIS.panelW;
  const h = VIS.panelH;
  if (r.switchPos.y > ROOM.y + ROOM.h - 30) return { x: r.switchPos.x - w / 2, y: ROOM.y + ROOM.h - 30, w, h };
  return { x: W - w, y: r.switchPos.y - h / 2, w, h };
}

export class Panels {
  private g: Phaser.GameObjects.Graphics;
  private nums: Phaser.GameObjects.Text[] = [];
  private tags: Phaser.GameObjects.Text[] = [];
  private shake: number[] = ROUTES.map(() => -1);

  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(DEPTH.props);
    for (const r of ROUTES) {
      const p = panelRect(r);
      this.nums.push(scene.add.text(p.x + 9, p.y + 8, `BRK ${r.id + 1}`, { fontFamily: VIS.font, fontSize: '12px', color: '#8794ad' }).setOrigin(0, 0.5).setDepth(DEPTH.props));
      this.tags.push(scene.add.text(p.x + p.w / 2, p.y + 43, '', { fontFamily: VIS.font, fontSize: '15px', color: '#9a2a22' }).setOrigin(0.5).setDepth(DEPTH.props));
    }
  }

  deadClick(breaker: number, t: number): void {
    this.shake[breaker] = t;
  }

  draw(w: World, t: number, lights: Lights): void {
    const g = this.g;
    g.clear();
    const cooling = w.cooldown > 0;
    for (const r of ROUTES) {
      const off = isOffline(w, r.id);
      const busy = w.surge?.route.id === r.id;
      const rect = panelRect(r);
      const shk = this.shake[r.id] >= 0 && t - this.shake[r.id] < 0.25 ? Math.sin(t * 90) * 2 : 0;
      const x = rect.x + shk;
      const y = rect.y;

      g.fillStyle(0x161d2c, 1).fillRect(x, y, rect.w, rect.h);
      g.lineStyle(2, off ? 0x2a3140 : 0x3d4863, 1).strokeRect(x, y, rect.w, rect.h);
      for (const [rx, ry] of [[4, 4], [rect.w - 4, 4], [4, rect.h - 4], [rect.w - 4, rect.h - 4]]) g.fillStyle(0x0a0d14, 1).fillCircle(x + rx, y + ry, 1.6);

      const head = off ? 0x2a3140 : busy ? PALETTE.surge : cooling ? 0x4a1c1c : PALETTE.strip;
      g.fillStyle(head, 1).fillRect(x + 3, y + 3, rect.w - 6, 11);

      // lever: up while the breaker is live, thrown down once it is offline
      g.fillStyle(0x0a0d14, 1).fillRect(x + rect.w - 40, y + 4, 14, 9);
      g.fillStyle(off ? 0x56627a : 0xc9d3e3, 1).fillRect(x + rect.w - 37, y + (off ? 8 : 4), 8, 5);
      // indicator lamp; dead once the breaker has scored
      if (off) {
        g.fillStyle(0x0a0d14, 1).fillCircle(x + rect.w - 14, y + 8.5, 4.5);
        g.lineStyle(1, 0x56627a, 1).lineBetween(x + rect.w - 17, y + 6, x + rect.w - 11, y + 11);
      } else {
        g.fillStyle(busy ? PALETTE.surge : cooling ? 0x5a2a26 : 0xe8a090, 1).fillCircle(x + rect.w - 14, y + 8.5, 4.5);
      }

      const sx = x + 7;
      const sy = y + 18;
      g.fillStyle(0x070a10, 1).fillRect(sx, sy, 90, 50);
      g.lineStyle(1, 0x1a2234, 1).strokeRect(sx, sy, 90, 50);
      g.lineStyle(1, 0x111826, 1);
      for (let i = 1; i < 4; i++) g.lineBetween(sx + i * 22.5, sy, sx + i * 22.5, sy + 50);
      for (let i = 1; i < 3; i++) g.lineBetween(sx, sy + i * 16.7, sx + 90, sy + i * 16.7);

      const sc = VIS.diagramScale;
      const mapPt = (px: number, py: number): [number, number] => [sx + (px - ROOM.x) * sc, sy + (py - ROOM.y) * sc];
      const base = off ? 0x39435a : cooling ? 0x7a3a34 : 0xd8402f;
      g.lineStyle(2, base, 1);
      g.beginPath();
      r.points.forEach((p, i) => {
        const [mx, my] = mapPt(p.x, p.y);
        if (i === 0) g.moveTo(mx, my);
        else g.lineTo(mx, my);
      });
      g.strokePath();
      if (busy && w.surge) {
        const lit = pathBetween(r, 0, w.surge.dist);
        g.lineStyle(2.5, PALETTE.surge, 1);
        g.beginPath();
        lit.forEach((p, i) => {
          const [mx, my] = mapPt(p.x, p.y);
          if (i === 0) g.moveTo(mx, my);
          else g.lineTo(mx, my);
        });
        g.strokePath();
      }
      for (const ci of r.contacts) {
        const [mx, my] = mapPt(r.points[ci].x, r.points[ci].y);
        g.fillStyle(off ? 0x56627a : PALETTE.surge, 1).fillCircle(mx, my, 2.2);
      }
      const [ox, oy] = mapPt(r.points[0].x, r.points[0].y);
      g.lineStyle(1.5, off ? 0x56627a : 0xe8a090, 1).strokeCircle(ox, oy, 3.5);
      const [wx, wy] = mapPt(r.switchPos.x, r.switchPos.y);
      g.fillStyle(0x8794ad, 1).fillRect(wx - 2, wy - 2, 4, 4);

      if (r.id === 1) {
        g.lineStyle(2, 0x070a10, 1).lineBetween(x + rect.w - 8, y + 3, x + rect.w - 24, y + 20);
        g.lineStyle(1, 0x4a5876, 1).lineBetween(x + rect.w - 7, y + 4, x + rect.w - 22, y + 19);
      }

      const a = off ? 0.3 : cooling ? 0.5 : 0.85;
      lights.pool(rect.x + rect.w / 2, rect.y + rect.h / 2, 96, a);
      this.tags[r.id].setText(off ? 'OFFLINE' : '').setPosition(x + rect.w / 2, y + 43);
      this.nums[r.id].setPosition(x + 9, y + 8.5).setColor(off ? '#39435a' : '#0b0e15');
    }
  }
}
