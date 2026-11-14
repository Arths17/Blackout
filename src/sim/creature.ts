import { CFG, ROOM } from '../config';
import type { Vec } from './routes';

export type CreatureState = 'stalk' | 'windup' | 'lunge' | 'recoil' | 'freeze';

export interface Creature {
  x: number;
  y: number;
  facing: number;
  state: CreatureState;
  timer: number;
  windupTotal: number;
  target: Vec;
  dirX: number;
  dirY: number;
  lungeLeft: number;
  asleep: boolean;
  alive: boolean;
}

export function makeCreature(x: number, y: number): Creature {
  return { x, y, facing: Math.PI, state: 'stalk', timer: 0, windupTotal: 1, target: { x, y }, dirX: 0, dirY: 0, lungeLeft: 0, asleep: false, alive: true };
}

export function startWindup(c: Creature, target: Vec, windup: number): void {
  c.state = 'windup';
  c.timer = windup;
  c.windupTotal = windup;
  c.target = { x: target.x, y: target.y };
  c.facing = Math.atan2(target.y - c.y, target.x - c.x);
}

// Stands completely still for `seconds`; used by boss 1 while a surge is on its way.
export function freezeCreature(c: Creature, seconds: number): void {
  c.state = 'freeze';
  c.timer = seconds;
}

export function hitCreature(c: Creature, dir: Vec): void {
  c.state = 'recoil';
  c.timer = CFG.recoil;
  c.dirX = dir.x;
  c.dirY = dir.y;
}

function clampToRoom(c: Creature): void {
  const r = CFG.creatureRadius;
  c.x = Math.min(ROOM.x + ROOM.w - r, Math.max(ROOM.x + r, c.x));
  c.y = Math.min(ROOM.y + ROOM.h - r, Math.max(ROOM.y + r, c.y));
}

export function stepCreature(c: Creature, dt: number, player: Vec, speedMul = 1): void {
  switch (c.state) {
    case 'stalk': {
      if (c.asleep) break;
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      const d = Math.hypot(dx, dy);
      c.facing = Math.atan2(dy, dx);
      if (d > CFG.creatureRadius + CFG.playerRadius) {
        const step = Math.min(CFG.creatureStalkSpeed * speedMul * dt, d);
        c.x += (dx / d) * step;
        c.y += (dy / d) * step;
        clampToRoom(c);
      }
      break;
    }
    case 'windup': {
      c.timer -= dt;
      if (c.timer <= CFG.timerEpsilon) {
        c.timer = 0;
        const dx = c.target.x - c.x;
        const dy = c.target.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        // Direction is fixed here; nothing steers it afterwards.
        c.dirX = dx / d;
        c.dirY = dy / d;
        c.lungeLeft = Math.min(d, CFG.lungeMaxDist);
        c.state = 'lunge';
      }
      break;
    }
    case 'lunge': {
      const step = Math.min(CFG.lungeSpeed * dt, c.lungeLeft);
      c.x += c.dirX * step;
      c.y += c.dirY * step;
      c.lungeLeft -= step;
      clampToRoom(c);
      if (c.lungeLeft <= CFG.timerEpsilon) { c.lungeLeft = 0; c.state = 'stalk'; }
      break;
    }
    case 'freeze': {
      c.timer -= dt;
      if (c.timer <= CFG.timerEpsilon) { c.timer = 0; c.state = 'stalk'; }
      break;
    }
    case 'recoil': {
      c.x += c.dirX * CFG.recoilKnock * dt;
      c.y += c.dirY * CFG.recoilKnock * dt;
      clampToRoom(c);
      c.timer -= dt;
      if (c.timer <= CFG.timerEpsilon) { c.timer = 0; c.state = 'stalk'; }
      break;
    }
  }
}
