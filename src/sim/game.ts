import { CFG, EXIT, FIRST_HIT_SPAWN, PLAYER_START, ROOM } from '../config';
import { hitCreature, makeCreature, startWindup, stepCreature, type Creature } from './creature';
import { makePlayer, stepPlayer, type MoveInput, type PlayerState } from './player';
import { directRoute, ROUTES, pointAt, type Vec } from './routes';
import { distToSegment, makeSurge, stepSurge, type Surge } from './surge';

export type SimEvent =
  | { type: 'relayClick'; breaker: number }
  | { type: 'energyGain'; breaker: number }
  | { type: 'deadClick'; breaker: number }
  | { type: 'lampLit'; breaker: number; lamp: number; x: number; y: number }
  | { type: 'bounce'; x: number; y: number }
  | { type: 'shock'; breaker: number; counted: boolean }
  | { type: 'bossShot' }
  | { type: 'ballStart' }
  | { type: 'ballHit' }
  | { type: 'miss'; breaker: number }
  | { type: 'powerBack' }
  | { type: 'playerHit' }
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
  shockwave: Shockwave | null;
  bossShot: BossShot | null;
  nextBossShot: number;
  ballActive: boolean;
  ballTimer: number;
  ballVx: number;
  ballVy: number;
  ballHitCreature: boolean;
  nextBall: number;
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
  energy: number;
  energyBreaker: number;
  shielding: boolean;
}

export interface Shockwave {
  radius: number;
  speed: number;
  maxRadius: number;
  hitPlayer: boolean;
}

export interface BossShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bouncesLeft: number;
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
    shockwave: null,
    bossShot: null,
    nextBossShot: CFG.bossShotInterval,
    ballActive: false,
    ballTimer: 0,
    ballVx: 0,
    ballVy: 0,
    ballHitCreature: false,
    nextBall: CFG.ballInterval,
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
    energy: 0,
    energyBreaker: -1,
    shielding: false,
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

function startFire(w: World, route: ReturnType<typeof directRoute>, breaker: number, hurtsPlayer = true): FireResult {
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
  w.surge = makeSurge(route, hurtsPlayer);
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

export function useEnergy(w: World): FireResult | 'none' | 'charged' {
  if (w.phase !== 'play') return 'over';
  let best = -1;
  let bestD = CFG.interactRange;
  for (const r of ROUTES) {
    const d = Math.hypot(w.player.x - r.switchPos.x, w.player.y - r.switchPos.y);
    if (d <= bestD && !isOffline(w, r.id)) {
      best = r.id;
      bestD = d;
    }
  }
  if (best >= 0 && w.energy === 0) {
    w.energy = 1;
    w.energyBreaker = best;
    emit(w, { type: 'energyGain', breaker: best });
    return 'charged';
  }
  if (w.energy === 0) return 'none';
  if (best >= 0) return 'charged';
  const result = startFire(w, directRoute({ x: w.player.x, y: w.player.y }, w.player.facing, w.energyBreaker), w.energyBreaker, false);
  if (result === 'ok') {
    w.energy = 0;
    w.energyBreaker = -1;
  }
  return result;
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
  hitCreature(w.creature);
  // Offline breakers can't be fired, so counted is only false if a surge was injected by hand.
  const counted = breaker !== w.lastHitBreaker;
  if (counted) {
    w.shocks++;
    w.lastHitBreaker = breaker;
  }
  emit(w, { type: 'shock', breaker, counted });
  if (counted) {
    w.shockwave = {
      radius: CFG.creatureRadius,
      speed: CFG.surgeSpeed,
      maxRadius: Math.hypot(ROOM.w, ROOM.h) + 100,
      hitPlayer: false,
    };
  }
  if (counted && w.shocks >= CFG.shocksToWin && w.phase === 'play') {
    w.phase = 'won';
    w.endTime = w.time;
    w.creature.alive = false;
    w.surge = null;
    w.shockwave = null;
    w.cooldown = 0;
    w.grace = 0;
    emit(w, { type: 'win' });
  }
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
  w.shielding = input.shield === true;

  // Terminal worlds stop counting: no power-return click after the win.
  if (w.cooldown > 0 && !w.surge && w.phase === 'play') {
    w.cooldown -= dt;
    if (w.cooldown <= CFG.timerEpsilon) {
      w.cooldown = 0;
      emit(w, { type: 'powerBack' });
    }
  }
  if (w.creature.asleep && w.time + CFG.timerEpsilon >= CFG.introSeconds) w.creature.asleep = false;

  stepPlayer(w.player, input, dt);
  if (w.creature.alive) {
    stepCreature(w.creature, dt, w.player);
    const c = w.creature;
    if (c.state !== 'recoil' && Math.hypot(c.x - w.player.x, c.y - w.player.y) < CFG.creatureRadius + CFG.playerRadius) {
      damagePlayer(w);
    }
  }
  // A lethal creature touch ends the tick: no shock, lamp or bounce may follow the lose event.
  if (isLost(w)) return;

  stepBall(w, dt);
  if (isLost(w)) return;

  stepBossShot(w, dt);
  if (isLost(w)) return;

  if (w.shockwave) {
    const previousRadius = w.shockwave.radius;
    w.shockwave.radius += w.shockwave.speed * dt;
    const distance = Math.hypot(w.player.x - w.creature.x, w.player.y - w.creature.y);
    if (!w.shockwave.hitPlayer && previousRadius <= distance + CFG.playerRadius && w.shockwave.radius >= distance - CFG.playerRadius) {
      w.shockwave.hitPlayer = true;
      if (!w.shielding) damagePlayer(w);
    }

    if (w.shockwave.radius >= w.shockwave.maxRadius) w.shockwave = null;
  }
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

function stepBall(w: World, dt: number): void {
  if (!w.ballActive && w.creature.alive && w.time >= w.nextBall) {
    w.ballActive = true;
    w.ballTimer = CFG.ballDuration;
    w.ballHitCreature = false;
    w.ballVx = Math.cos(w.player.facing) * CFG.ballSpeed;
    w.ballVy = Math.sin(w.player.facing) * CFG.ballSpeed;
    w.nextBall += CFG.ballInterval;
    emit(w, { type: 'ballStart' });
  }
  if (!w.ballActive) return;

  let remaining = dt;
  const radius = CFG.playerRadius;
  while (remaining > 0 && w.ballActive) {
    const start = { x: w.player.x, y: w.player.y };
    let hitTime = remaining;
    let wall: 'x' | 'y' | undefined;
    if (w.ballVx > 0) {
      const t = (ROOM.x + ROOM.w - radius - w.player.x) / w.ballVx;
      if (t >= 0 && t < hitTime) { hitTime = t; wall = 'x'; }
    } else if (w.ballVx < 0) {
      const t = (ROOM.x + radius - w.player.x) / w.ballVx;
      if (t >= 0 && t < hitTime) { hitTime = t; wall = 'x'; }
    }
    if (w.ballVy > 0) {
      const t = (ROOM.y + ROOM.h - radius - w.player.y) / w.ballVy;
      if (t >= 0 && t < hitTime) { hitTime = t; wall = 'y'; }
    } else if (w.ballVy < 0) {
      const t = (ROOM.y + radius - w.player.y) / w.ballVy;
      if (t >= 0 && t < hitTime) { hitTime = t; wall = 'y'; }
    }
    const end = {
      x: w.player.x + w.ballVx * hitTime,
      y: w.player.y + w.ballVy * hitTime,
    };
    if (!w.ballHitCreature && distToSegment(w.creature, start, end) <= CFG.playerRadius + CFG.creatureRadius) {
      w.ballHitCreature = true;
      registerBallHit(w);
      damagePlayer(w);
      if (isLost(w) || w.phase === 'won') return;
    }
    w.player.x = end.x;
    w.player.y = end.y;
    remaining -= hitTime;
    if (!wall) break;
    if (wall === 'x') w.ballVx *= -1;
    else w.ballVy *= -1;
    w.player.facing = Math.atan2(w.ballVy, w.ballVx);
    w.player.x += w.ballVx * 0.0001;
    w.player.y += w.ballVy * 0.0001;
  }
  w.ballTimer -= dt;
  if (w.ballTimer <= 0) w.ballActive = false;
  w.player.moving = true;
}

function registerBallHit(w: World): void {
  hitCreature(w.creature);
  w.shocks++;
  emit(w, { type: 'ballHit' });
  w.shockwave = {
    radius: CFG.creatureRadius,
    speed: CFG.surgeSpeed,
    maxRadius: Math.hypot(ROOM.w, ROOM.h) + 100,
    hitPlayer: false,
  };
  if (w.shocks >= CFG.shocksToWin && w.phase === 'play') {
    w.phase = 'won';
    w.endTime = w.time;
    w.creature.alive = false;
    w.surge = null;
    w.shockwave = null;
    w.ballActive = false;
    w.cooldown = 0;
    w.grace = 0;
    emit(w, { type: 'win' });
  }
}

function stepBossShot(w: World, dt: number): void {
  if (!w.creature.alive) return;
  if (!w.bossShot && !w.creature.asleep && w.time >= w.nextBossShot) {
    const angle = Math.atan2(w.player.y - w.creature.y, w.player.x - w.creature.x);
    w.bossShot = {
      x: w.creature.x,
      y: w.creature.y,
      vx: Math.cos(angle) * CFG.bossShotSpeed,
      vy: Math.sin(angle) * CFG.bossShotSpeed,
      bouncesLeft: CFG.bossShotBounces,
    };
    w.nextBossShot += CFG.bossShotInterval;
    emit(w, { type: 'bossShot' });
  }
  if (!w.bossShot) return;

  let remaining = dt;
  const radius = CFG.surgeHitRadius * 0.45;
  while (remaining > 0 && w.bossShot) {
    const shot = w.bossShot;
    const start = { x: shot.x, y: shot.y };
    let hitTime = remaining;
    let wall: 'x' | 'y' | undefined;
    if (shot.vx > 0) {
      const t = (ROOM.x + ROOM.w - radius - shot.x) / shot.vx;
      if (t >= 0 && t < hitTime) { hitTime = t; wall = 'x'; }
    } else if (shot.vx < 0) {
      const t = (ROOM.x + radius - shot.x) / shot.vx;
      if (t >= 0 && t < hitTime) { hitTime = t; wall = 'x'; }
    }
    if (shot.vy > 0) {
      const t = (ROOM.y + ROOM.h - radius - shot.y) / shot.vy;
      if (t >= 0 && t < hitTime) { hitTime = t; wall = 'y'; }
    } else if (shot.vy < 0) {
      const t = (ROOM.y + radius - shot.y) / shot.vy;
      if (t >= 0 && t < hitTime) { hitTime = t; wall = 'y'; }
    }
    const hitX = shot.x + shot.vx * hitTime;
    const hitY = shot.y + shot.vy * hitTime;
    if (distToSegment(w.player, start, { x: hitX, y: hitY }) <= CFG.surgeHitRadius + CFG.playerRadius) {
      w.bossShot = null;
      damagePlayer(w);
      return;
    }
    shot.x = hitX;
    shot.y = hitY;
    remaining -= hitTime;
    if (!wall) break;
    if (wall === 'x') shot.vx *= -1;
    else shot.vy *= -1;
    shot.bouncesLeft--;
    if (shot.bouncesLeft <= 0) {
      w.bossShot = null;
      return;
    }
    shot.x += shot.vx * 0.0001;
    shot.y += shot.vy * 0.0001;
  }
}

export function inExit(p: Vec): boolean {
  return p.y < ROOM.y + 26 && p.x > EXIT.x && p.x < EXIT.x + EXIT.w;
}

export function lampPos(breaker: number, lamp: number): Vec {
  const r = ROUTES[breaker];
  return pointAt(r, r.lampDists[lamp]);
}
