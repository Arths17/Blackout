import { CFG, EXIT, FIRST_HIT_SPAWN, PLAYER_START, ROOM } from '../config';
import { hitCreature, makeCreature, startWindup, stepCreature, type Creature } from './creature';
import { makePlayer, stepPlayer, type MoveInput, type PlayerState } from './player';
import { ROUTES, dirAt, pointAt, type Route, type Vec } from './routes';
import { distToSegment, makeSurge, stepSurge, type Surge } from './surge';

export type SimEvent =
  | { type: 'relayClick'; breaker: number }
  | { type: 'deadClick'; breaker: number }
  | { type: 'lampLit'; breaker: number; lamp: number; x: number; y: number }
  | { type: 'bounce'; x: number; y: number }
  | { type: 'shock'; breaker: number; counted: boolean }
  | { type: 'miss'; breaker: number }
  | { type: 'powerBack' }
  | { type: 'playerHit' }
  | { type: 'charge'; breaker: number }
  | { type: 'bounceStart' }
  | { type: 'bounceHit' }
  | { type: 'ballBounce'; x: number; y: number }
  | { type: 'win' }
  | { type: 'lose' }
  | { type: 'escape' };

export type Phase = 'play' | 'won' | 'lost' | 'escaped';
export type FireResult = 'ok' | 'busy' | 'cooling' | 'offline' | 'over';

export interface World {
  time: number;
  phase: Phase;
  player: PlayerState;
  creature: Creature;
  surge: Surge | null;
  lampLitAt: number[][];
  revealUntil: number;
  shocks: number;
  lastHitBreaker: number;
  missStreak: number;
  cooldown: number;
  hp: number;
  grace: number;
  endTime: number;
  listeners: ((e: SimEvent) => void)[];
  rng: number;
  // Breaker whose charge the player is holding, or -1. Released from anywhere.
  charged: number;
  hitsTaken: number;
  bounce: Bounce | null;
  // Set when a bounce damaged the creature: the next creature hit on the player can't start another.
  bounceLocked: boolean;
}

export interface Bounce {
  vx: number;
  vy: number;
  left: number;
  // Only live once it has cleared the creature, so the launch itself can't count as the return hit.
  armed: boolean;
}

export interface WorldOpts {
  player?: Vec;
  creature?: Vec;
  asleep?: boolean;
}

export function createWorld(opts: WorldOpts = {}): World {
  const p = opts.player ?? PLAYER_START;
  const c = opts.creature ?? FIRST_HIT_SPAWN;
  const creature = makeCreature(c.x, c.y);
  creature.asleep = opts.asleep ?? opts.creature === undefined;
  return {
    time: 0,
    phase: 'play',
    player: makePlayer(p.x, p.y),
    creature,
    surge: null,
    lampLitAt: ROUTES.map((r) => r.lampDists.map(() => -Infinity)),
    revealUntil: -Infinity,
    shocks: 0,
    lastHitBreaker: -1,
    missStreak: 0,
    cooldown: 0,
    hp: CFG.healthPips,
    grace: 0,
    endTime: 0,
    listeners: [],
    rng: 12345,
    charged: -1,
    hitsTaken: 0,
    bounce: null,
    bounceLocked: false,
  };
}

function emit(w: World, e: SimEvent): void {
  for (const fn of w.listeners) fn(e);
}

export function currentWindup(w: World): number {
  return Math.max(CFG.windupFloor, CFG.windup - w.missStreak * CFG.missWindupReduction);
}

export function missCooldown(w: World): number {
  return Math.min(CFG.cooldownMax, CFG.generatorCooldown + w.missStreak * CFG.missCooldownAdd);
}

export function isOffline(w: World, breaker: number): boolean {
  return w.lastHitBreaker === breaker;
}

export function fire(w: World, breaker: number): FireResult {
  return startFire(w, ROUTES[breaker], breaker);
}

function startFire(w: World, route: Route, breaker: number): FireResult {
  if (w.phase !== 'play') return 'over';
  if (w.surge) return 'busy';
  if (w.cooldown > 0) return 'cooling';
  if (isOffline(w, breaker)) {
    emit(w, { type: 'deadClick', breaker });
    return 'offline';
  }
  w.creature.asleep = false;
  // Click, windup and surge all start on this one call so their timing can't drift apart.
  startWindup(w.creature, route.switchPos, currentWindup(w));
  w.surge = makeSurge(route);
  emit(w, { type: 'relayClick', breaker });
  return 'ok';
}

export function tryInteract(w: World): FireResult | 'none' {
  let best = -1;
  let bestD = CFG.interactRange;
  for (const r of ROUTES) {
    const d = Math.hypot(w.player.x - r.switchPos.x, w.player.y - r.switchPos.y);
    if (d <= bestD) {
      best = r.id;
      bestD = d;
    }
  }
  return best >= 0 ? fire(w, best) : 'none';
}

// First press at an online breaker charges it and the charge is held; the next press releases it from anywhere.
export function interact(w: World): FireResult | 'charged' | 'none' {
  if (w.phase !== 'play') return 'over';
  if (w.charged >= 0) {
    const result = fire(w, w.charged);
    if (result === 'ok') w.charged = -1;
    return result;
  }
  let best = -1;
  let bestD = CFG.interactRange;
  for (const r of ROUTES) {
    const d = Math.hypot(w.player.x - r.switchPos.x, w.player.y - r.switchPos.y);
    if (d <= bestD) {
      best = r.id;
      bestD = d;
    }
  }
  if (best < 0) return 'none';
  if (isOffline(w, best)) {
    emit(w, { type: 'deadClick', breaker: best });
    return 'offline';
  }
  w.charged = best;
  emit(w, { type: 'charge', breaker: best });
  return 'charged';
}

export function damagePlayer(w: World): boolean {
  if (w.phase !== 'play' || w.grace > 0) return false;
  w.hp--;
  w.grace = CFG.graceSeconds;
  emit(w, { type: 'playerHit' });
  if (w.hp <= 0) {
    w.phase = 'lost';
    w.endTime = w.time;
    emit(w, { type: 'lose' });
  }
  return true;
}

// A function call, so TypeScript doesn't keep an earlier phase check's narrowing.
function isLost(w: World): boolean {
  return w.phase === 'lost';
}

function registerShock(w: World, breaker: number): void {
  hitCreature(w.creature, w.surge ? dirAt(w.surge.route, w.surge.dist) : { x: 0, y: 0 });
  // Offline breakers can't be fired, so counted is only false if a surge was injected by hand.
  const counted = breaker !== w.lastHitBreaker;
  if (counted) {
    w.shocks++;
    w.lastHitBreaker = breaker;
  }
  emit(w, { type: 'shock', breaker, counted });
  if (counted && w.shocks >= CFG.shocksToWin && w.phase === 'play') {
    w.phase = 'won';
    w.endTime = w.time;
    w.creature.alive = false;
    w.surge = null;
    w.cooldown = 0;
    w.grace = 0;
    emit(w, { type: 'win' });
  }
}

function roll(w: World): number {
  w.rng = (Math.imul(w.rng, 1664525) + 1013904223) >>> 0;
  return w.rng / 4294967296;
}

// The creature's hit throws the player into a ricochet every bounceEvery-th time. A bounce that
// scored locks out the next one.
// ASSUMPTION: a bounce hit counts as a shock but leaves lastHitBreaker alone, and the player can't steer mid-bounce.
function maybeBounce(w: World): void {
  if (w.phase !== 'play' || w.bounce) return;
  w.hitsTaken++;
  if (w.bounceLocked) {
    w.bounceLocked = false;
    return;
  }
  if (w.hitsTaken % CFG.bounceEvery !== 1 % CFG.bounceEvery) return;
  const c = w.creature;
  const away = Math.atan2(w.player.y - c.y, w.player.x - c.x) + (roll(w) - 0.5) * 1.0;
  w.bounce = { vx: Math.cos(away) * CFG.bounceSpeed, vy: Math.sin(away) * CFG.bounceSpeed, left: CFG.bounceSeconds, armed: false };
  w.player.facing = away;
  emit(w, { type: 'bounceStart' });
}

function stepBounce(w: World, b: Bounce, dt: number): void {
  const r = CFG.playerRadius;
  const p = w.player;
  let remaining = dt;
  while (remaining > 0 && w.bounce) {
    const start = { x: p.x, y: p.y };
    let t = remaining;
    let axis: 'x' | 'y' | undefined;
    const wallX = b.vx > 0 ? ROOM.x + ROOM.w - r : ROOM.x + r;
    const wallY = b.vy > 0 ? ROOM.y + ROOM.h - r : ROOM.y + r;
    if (b.vx !== 0) {
      const tx = (wallX - p.x) / b.vx;
      if (tx >= 0 && tx < t) { t = tx; axis = 'x'; }
    }
    if (b.vy !== 0) {
      const ty = (wallY - p.y) / b.vy;
      if (ty >= 0 && ty < t) { t = ty; axis = 'y'; }
    }
    const end = { x: p.x + b.vx * t, y: p.y + b.vy * t };
    const c = w.creature;
    if (!b.armed && Math.hypot(c.x - p.x, c.y - p.y) > r + CFG.creatureRadius + 12) b.armed = true;
    if (b.armed && c.alive && c.state !== 'recoil' && distToSegment(c, start, end) <= r + CFG.creatureRadius) {
      hitCreature(c, { x: b.vx / CFG.bounceSpeed, y: b.vy / CFG.bounceSpeed });
      w.shocks++;
      w.bounceLocked = true;
      w.bounce = null;
      emit(w, { type: 'bounceHit' });
      if (w.shocks >= CFG.shocksToWin) {
        w.phase = 'won';
        w.endTime = w.time;
        c.alive = false;
        w.surge = null;
        w.cooldown = 0;
        w.grace = 0;
        emit(w, { type: 'win' });
      }
      return;
    }
    p.x = end.x;
    p.y = end.y;
    remaining -= t;
    if (!axis) break;
    if (axis === 'x') b.vx *= -1;
    else b.vy *= -1;
    p.facing = Math.atan2(b.vy, b.vx);
    emit(w, { type: 'ballBounce', x: p.x, y: p.y });
  }
  p.moving = true;
  b.left -= dt;
  if (b.left <= 0) w.bounce = null;
}

export function stepWorld(w: World, input: MoveInput, dt: number): void {
  w.time += dt;
  if (w.phase === 'lost' || w.phase === 'escaped') return;
  if (w.phase === 'won') {
    stepPlayer(w.player, input, dt);
    if (inExit(w.player)) {
      w.phase = 'escaped';
      w.endTime = w.time;
      emit(w, { type: 'escape' });
    }
    return;
  }
  if (w.grace > 0) {
    w.grace -= dt;
    if (w.grace <= CFG.timerEpsilon) w.grace = 0;
  }

  // Terminal worlds stop counting: no power-return click after the win.
  if (w.cooldown > 0 && !w.surge && w.phase === 'play') {
    w.cooldown -= dt;
    if (w.cooldown <= CFG.timerEpsilon) {
      w.cooldown = 0;
      emit(w, { type: 'powerBack' });
    }
  }
  if (w.creature.asleep && w.time + CFG.timerEpsilon >= CFG.introSeconds) w.creature.asleep = false;

  if (w.bounce) stepBounce(w, w.bounce, dt);
  else stepPlayer(w.player, input, dt);
  if (w.phase !== 'play') return;
  if (w.creature.alive) {
    stepCreature(w.creature, dt, w.player);
    const c = w.creature;
    if (!w.bounce && c.state !== 'recoil' && Math.hypot(c.x - w.player.x, c.y - w.player.y) < CFG.creatureRadius + CFG.playerRadius) {
      if (damagePlayer(w)) maybeBounce(w);
    }
  }
  // A lethal creature touch ends the tick: no shock, lamp or bounce may follow the lose event.
  if (isLost(w)) return;

  const s = w.surge;
  if (!s) return;
  const id = s.route.id;
  const res = stepSurge(
    s,
    dt,
    { x: w.creature.x, y: w.creature.y, r: CFG.creatureRadius },
    { x: w.player.x, y: w.player.y, r: CFG.playerRadius },
    w.grace <= 0,
  );
  for (const i of res.lamps) {
    w.lampLitAt[id][i] = w.time;
    w.revealUntil = w.time + CFG.revealSeconds;
    const pos = lampPos(id, i);
    emit(w, { type: 'lampLit', breaker: id, lamp: i, x: pos.x, y: pos.y });
  }
  for (const b of res.bounces) emit(w, { type: 'bounce', x: b.x, y: b.y });
  // Same-tick priority: the player's death beats a shock, even a fifth one.
  if (res.hitPlayer) damagePlayer(w);
  if (isLost(w)) return;
  if (res.hitCreature && w.creature.alive) registerShock(w, id);
  if (w.shocks >= CFG.shocksToWin) return;
  if (res.finished) {
    w.surge = null;
    if (w.phase !== 'play') return;
    if (s.hitCreature) {
      w.missStreak = 0;
      w.cooldown = CFG.generatorCooldown;
    } else {
      w.missStreak++;
      w.cooldown = missCooldown(w);
      emit(w, { type: 'miss', breaker: id });
    }
  }
}

export function inExit(p: Vec): boolean {
  return p.y < ROOM.y + 26 && p.x > EXIT.x && p.x < EXIT.x + EXIT.w;
}

export function lampPos(breaker: number, lamp: number): Vec {
  const r = ROUTES[breaker];
  return pointAt(r, r.lampDists[lamp]);
}
