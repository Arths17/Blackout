import { CFG, ROOM } from '../config';

export interface PlayerState {
  x: number;
  y: number;
  facing: number;
  moving: boolean;
}

export interface MoveInput {
  dx: number;
  dy: number;
  parry?: boolean; // true on the step the key goes down
  dash?: boolean; // true on the step the key goes down
}

export function makePlayer(x: number, y: number): PlayerState {
  return { x, y, facing: 0, moving: false };
}

export function stepPlayer(p: PlayerState, input: MoveInput, dt: number): void {
  let { dx, dy } = input;
  const len = Math.hypot(dx, dy);
  p.moving = len > 0;
  if (!p.moving) return;
  dx /= len;
  dy /= len;
  p.facing = Math.atan2(dy, dx);
  const r = CFG.playerRadius;
  p.x = Math.min(ROOM.x + ROOM.w - r, Math.max(ROOM.x + r, p.x + dx * CFG.playerSpeed * dt));
  p.y = Math.min(ROOM.y + ROOM.h - r, Math.max(ROOM.y + r, p.y + dy * CFG.playerSpeed * dt));
}
