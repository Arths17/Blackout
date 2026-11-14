import { CFG } from '../config';
import { pathBetween, pointAt, type Route, type Vec } from './routes';

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface Surge {
  route: Route;
  dist: number;
  nextLamp: number;
  nextContact: number;
  hitCreature: boolean;
  hitPlayer: boolean;
  done: boolean;
}

export interface SurgeStepResult {
  lamps: number[];
  bounces: Vec[];
  hitCreature: boolean;
  hitPlayer: boolean;
  finished: boolean;
}

export function makeSurge(route: Route): Surge {
  return { route, dist: 0, nextLamp: 0, nextContact: 0, hitCreature: false, hitPlayer: false, done: false };
}

export function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2)) : 0;
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

function swept(path: Vec[], c: Circle): boolean {
  const reach = CFG.surgeHitRadius + c.r;
  for (let i = 1; i < path.length; i++) {
    if (distToSegment(c, path[i - 1], path[i]) <= reach) return true;
  }
  return false;
}

// canHurt is false while the player is in grace, so a blocked touch doesn't use up the shot's hit.
export function stepSurge(s: Surge, dt: number, creature: Circle, player: Circle, canHurt = true): SurgeStepResult {
  const r = s.route;
  const res: SurgeStepResult = { lamps: [], bounces: [], hitCreature: false, hitPlayer: false, finished: false };
  const prev = s.dist;
  s.dist = Math.min(r.total, prev + CFG.surgeSpeed * dt);

  // Sweep the whole stretch since last tick so a long frame can't skip over a target.
  const path = pathBetween(r, prev, s.dist);
  if (!s.hitCreature && swept(path, creature)) {
    s.hitCreature = true;
    res.hitCreature = true;
  }
  if (canHurt && !s.hitPlayer && swept(path, player)) {
    s.hitPlayer = true;
    res.hitPlayer = true;
  }

  while (s.nextLamp < r.lampDists.length && r.lampDists[s.nextLamp] <= s.dist) res.lamps.push(s.nextLamp++);
  while (s.nextContact < r.contacts.length && r.cum[r.contacts[s.nextContact]] <= s.dist) {
    res.bounces.push(r.points[r.contacts[s.nextContact++]]);
  }

  if (s.dist >= r.total) {
    s.done = true;
    res.finished = true;
  }
  return res;
}

export function surgeHead(s: Surge): Vec {
  return pointAt(s.route, s.dist);
}
