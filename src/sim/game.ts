import { CFG, EXIT, FIRST_HIT_SPAWN, PLAYER_START, ROOM } from '../config';
import { hitCreature, makeCreature, startWindup, stepCreature, type Creature } from './creature';
import { makePlayer, stepPlayer, type MoveInput, type PlayerState } from './player';
import { ROUTES, pointAt, type Vec } from './routes';
import { makeSurge, stepSurge, type Surge } from './surge';

export type SimEvent =
  | { type: 'relayClick'; breaker: number }
  | { type: 'deadClick'; breaker: number }
  | { type: 'lampLit'; breaker: number; lamp: number; x: number; y: number }
  | { type: 'bounce'; x: number; y: number }
  | { type: 'shock'; breaker: number; counted: boolean }
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
  if (w.phase !== 'play') return 'over';
  if (w.surge) return 'busy';
  if (w.cooldown > 0) return 'cooling';
  if (isOffline(w, breaker)) {
    emit(w, { type: 'deadClick', breaker });
    return 'offline';
  }
  const route = ROUTES[breaker];
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
