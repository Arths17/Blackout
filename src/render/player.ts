import type Phaser from 'phaser';
import { CFG, PALETTE } from '../config';
import type { PlayerState } from '../sim/player';

export function drawPlayer(g: Phaser.GameObjects.Graphics, p: PlayerState, t: number, hurt: boolean): void {
  const bob = p.moving ? Math.sin(t * 18) * 1.5 : 0;
  const cos = Math.cos(p.facing);
  const sin = Math.sin(p.facing);
  const r = CFG.playerRadius;
  const at = (u: number, v: number): [number, number] => [p.x + u * cos - v * sin, p.y + bob + u * sin + v * cos];

  const jacket = hurt ? 0x7a3434 : 0x3a475e;
  const [s1x, s1y] = at(-1, -r);
  const [s2x, s2y] = at(-1, r);
  g.lineStyle(7, jacket, 1).lineBetween(s1x, s1y, s2x, s2y);
  g.fillStyle(jacket, 1).fillCircle(p.x, p.y + bob, r - 1);
  // reflective stripe across the back so the figure reads in the dark
  const [b1x, b1y] = at(-5, -r + 2);
  const [b2x, b2y] = at(-5, r - 2);
  g.lineStyle(2, hurt ? PALETTE.strip : 0xcfd8e6, 0.9).lineBetween(b1x, b1y, b2x, b2y);
  const [hx, hy] = at(2, 0);
  g.fillStyle(hurt ? 0x8a5a5a : 0xd9e1ee, 1).fillCircle(hx, hy, 5.5);
  const [nx, ny] = at(10, 0);
  g.fillStyle(PALETTE.surge, 1).fillCircle(nx, ny, 2);
}
