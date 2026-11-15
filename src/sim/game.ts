import { BOSS_START, CFG, EXIT, PLAYER_START, ROOM } from '../config';
import { hitCreature, makeCreature, react, startWindup, stepCreature, type Creature } from './creature';
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
  | { type: 'playerHit'; by: Hurt }
  | { type: 'seeds' }
  | { type: 'dash' }
  | { type: 'parryStart' }
  | { type: 'parry'; streak: number }
  | { type: 'superStart' }
  | { type: 'superHit' }
  | { type: 'bounceStart' }
  | { type: 'bounceHit' }
  | { type: 'ballBounce'; x: number; y: number }
  | { type: 'win' }
  | { type: 'lose' }
  | { type: 'escape' };

export type Hurt = 'creature' | 'surge' | 'seed';
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
  hurtBy: Hurt | null; // what last hurt the player, for the death screen
  seeds: Seed[];
  nextLunge: number;
  nextSeeds: number;
  hitsTaken: number;
  parryLeft: number;
  parryCool: number;
  parryStreak: number;
  parryStreakLeft: number;
  dashCool: number;
  // A short shove on the player: the dash, or being knocked back by a parry.
  impulse: { vx: number; vy: number; left: number } | null;
  bounce: Bounce | null;
  // Set when a bounce damaged the creature: the next creature hit on the player can't start another.
  bounceLocked: boolean;
}

export interface Seed {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bouncesLeft: number;
}

export interface Bounce {
  vx: number;
  vy: number;
  left: number;
  super: boolean;
  // Only live once it has cleared the creature, so the launch itself can't count as the return hit.
  armed: boolean;
}

export interface WorldOpts {
  player?: Vec;
  creature?: Vec;
  asleep?: boolean;
  seed?: number; // for the dice rolls; the game passes a random one, tests keep the default
}

export function createWorld(opts: WorldOpts = {}): World {
  const p = opts.player ?? PLAYER_START;
  const c = opts.creature ?? BOSS_START;
  const creature = makeCreature(c.x, c.y);
  // The boss comes straight for the player; tests that need it still can pass asleep.
  creature.asleep = opts.asleep ?? false;
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
    rng: opts.seed ?? 12345,
    hurtBy: null,
    seeds: [],
    nextLunge: CFG.introSeconds + CFG.autoLungeEvery,
    nextSeeds: CFG.introSeconds + CFG.seedEvery,
    hitsTaken: 0,
    parryLeft: 0,
    parryCool: 0,
    parryStreak: 0,
    parryStreakLeft: 0,
    dashCool: 0,
    impulse: null,
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

// The other half of the miss penalty: it stalks a little faster per miss in a row.
export function stalkBoost(w: World): number {
  return 1 + Math.min(CFG.missSpeedUpMax, w.missStreak * CFG.missSpeedUp);
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
  react(w.creature, route.switchPos, currentWindup(w));
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

export function damagePlayer(w: World, by: Hurt): boolean {
  if (w.phase !== 'play' || w.grace > 0) return false;
  w.hp--;
  w.grace = CFG.graceSeconds;
  w.hurtBy = by;
  emit(w, { type: 'playerHit', by });
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
  // A later pass of the same surge still counts: the same breaker can't start a second shot, but one shot can hit twice.
  const counted = breaker !== w.lastHitBreaker || (w.surge?.hits ?? 0) > 1;
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
    w.seeds = [];
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
  w.bounce = { vx: Math.cos(away) * CFG.bounceSpeed, vy: Math.sin(away) * CFG.bounceSpeed, left: CFG.bounceSeconds, super: false, armed: false };
  w.player.facing = away;
  emit(w, { type: 'bounceStart' });
}

// Shoves the player clear; a parry that counts adds to the streak, and the second in a row launches a super bounce.
function parryGain(w: World, ux: number, uy: number, counts = true): void {
  w.parryLeft = 0;
  w.impulse = { vx: ux * CFG.parryPush, vy: uy * CFG.parryPush, left: CFG.parryPushSeconds };
  w.grace = Math.max(w.grace, CFG.parryGrace);
  if (counts) {
    w.parryStreak++;
    w.parryStreakLeft = CFG.parryStreakSeconds;
  }
  emit(w, { type: 'parry', streak: w.parryStreak });
  if (w.parryStreak >= CFG.parriesForSuper) {
    w.parryStreak = 0;
    const c = w.creature;
    const away = Math.atan2(w.player.y - c.y, w.player.x - c.x) + (roll(w) - 0.5) * 0.5;
    w.bounce = { vx: Math.cos(away) * CFG.superSpeed, vy: Math.sin(away) * CFG.superSpeed, left: CFG.superSeconds, super: true, armed: false };
    w.player.facing = away;
    emit(w, { type: 'superStart' });
  }
}

// Blocks the creature's touch: no damage, and the two are thrown apart. Only a blocked lunge
// counts toward the super bounce; walking into a mashed parry key earns nothing.
function parried(w: World): void {
  const c = w.creature;
  const dx = c.x - w.player.x;
  const dy = c.y - w.player.y;
  const d = Math.hypot(dx, dy) || 1;
  const lunging = c.state === 'lunge';
  hitCreature(c, { x: dx / d, y: dy / d });
  parryGain(w, -dx / d, -dy / d, lunging);
}

const enraged = (w: World): boolean => CFG.enrage > 1 && w.shocks >= Math.ceil(CFG.shocksToWin * CFG.enrageAt);

// The boss's own attacks: a telegraphed lunge at where the player stands, and bouncing seeds.
function bossAttacks(w: World): void {
  const c = w.creature;
  if (!c.alive || c.asleep) return;
  const scale = enraged(w) ? 0.75 : 1;
  if (CFG.autoLungeEvery > 0 && c.state === 'stalk' && w.time >= w.nextLunge) {
    startWindup(c, { x: w.player.x, y: w.player.y }, currentWindup(w) * CFG.autoLungeWindup);
    w.nextLunge = w.time + CFG.autoLungeEvery * scale;
  }
  if (CFG.seedEvery > 0 && w.time >= w.nextSeeds) {
    const aim = Math.atan2(w.player.y - c.y, w.player.x - c.x);
    const n = CFG.seedCount;
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * CFG.seedSpread;
      w.seeds.push({ x: c.x, y: c.y, vx: Math.cos(a) * CFG.seedSpeed, vy: Math.sin(a) * CFG.seedSpeed, bouncesLeft: CFG.seedBounces });
    }
    w.nextSeeds = w.time + CFG.seedEvery * scale;
    emit(w, { type: 'seeds' });
  }
}

function stepSeeds(w: World, dt: number): void {
  const radius = CFG.seedRadius;
  w.seeds = w.seeds.filter((shot) => {
    let remaining = dt;
    while (remaining > 0) {
      const start = { x: shot.x, y: shot.y };
      let hitTime = remaining;
      let wall: 'x' | 'y' | undefined;
      if (shot.vx !== 0) {
        const t = ((shot.vx > 0 ? ROOM.x + ROOM.w - radius : ROOM.x + radius) - shot.x) / shot.vx;
        if (t >= 0 && t < hitTime) { hitTime = t; wall = 'x'; }
      }
      if (shot.vy !== 0) {
        const t = ((shot.vy > 0 ? ROOM.y + ROOM.h - radius : ROOM.y + radius) - shot.y) / shot.vy;
        if (t >= 0 && t < hitTime) { hitTime = t; wall = 'y'; }
      }
      const end = { x: shot.x + shot.vx * hitTime, y: shot.y + shot.vy * hitTime };
      if (!w.bounce && distToSegment(w.player, start, end) <= CFG.seedRadius + CFG.playerRadius) {
        if (w.parryLeft > 0 && w.grace <= 0) {
          const sp = Math.hypot(shot.vx, shot.vy) || 1;
          parryGain(w, shot.vx / sp, shot.vy / sp);
          return false;
        }
        if (w.grace <= 0) {
          damagePlayer(w, 'seed');
          return false;
        }
      }
      shot.x = end.x;
      shot.y = end.y;
      remaining -= hitTime;
      if (!wall) break;
      if (wall === 'x') shot.vx *= -1;
      else shot.vy *= -1;
      if (--shot.bouncesLeft <= 0) return false;
      shot.x += shot.vx * 0.0001;
      shot.y += shot.vy * 0.0001;
    }
    return true;
  });
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
    const reach = (b.super ? CFG.superRadius : r) + CFG.creatureRadius + CFG.creatureHitBonus;
    const speed = b.super ? CFG.superSpeed : CFG.bounceSpeed;
    if (!b.armed && Math.hypot(c.x - p.x, c.y - p.y) > reach + 12) b.armed = true;
    if (b.armed && c.alive && (b.super || c.state !== 'recoil') && distToSegment(c, start, end) <= reach) {
      hitCreature(c, { x: b.vx / speed, y: b.vy / speed });
      w.shocks = Math.min(CFG.shocksToWin, w.shocks + (b.super ? CFG.superShocks : 1));
      w.bounceLocked = true;
      w.bounce = null;
      w.grace = Math.max(w.grace, CFG.bounceHitGrace);
      emit(w, { type: b.super ? 'superHit' : 'bounceHit' });
      if (w.shocks >= CFG.shocksToWin) {
        w.phase = 'won';
        w.endTime = w.time;
        c.alive = false;
        w.surge = null;
        w.seeds = [];
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
  w.parryLeft = Math.max(0, w.parryLeft - dt);
  w.parryCool = Math.max(0, w.parryCool - dt);
  if (w.parryStreak > 0) {
    w.parryStreakLeft -= dt;
    if (w.parryStreakLeft <= 0) w.parryStreak = 0;
  }
  w.dashCool = Math.max(0, w.dashCool - dt);
  if (input.dash && w.dashCool <= 0 && !w.bounce) {
    let dx = input.dx;
    let dy = input.dy;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(w.player.facing);
      dy = Math.sin(w.player.facing);
    }
    const len = Math.hypot(dx, dy) || 1;
    w.impulse = { vx: (dx / len) * CFG.dashSpeed, vy: (dy / len) * CFG.dashSpeed, left: CFG.dashSeconds };
    w.dashCool = CFG.dashCooldown;
    emit(w, { type: 'dash' });
  }
  if (input.parry && w.parryCool <= 0 && !w.bounce) {
    w.parryLeft = CFG.parryWindow;
    w.parryCool = CFG.parryCooldown;
    emit(w, { type: 'parryStart' });
  }

  if (w.bounce) stepBounce(w, w.bounce, dt);
  else {
    stepPlayer(w.player, input, dt);
    if (w.impulse) {
      const r = CFG.playerRadius;
      const step = Math.min(dt, w.impulse.left);
      w.player.x = Math.min(ROOM.x + ROOM.w - r, Math.max(ROOM.x + r, w.player.x + w.impulse.vx * step));
      w.player.y = Math.min(ROOM.y + ROOM.h - r, Math.max(ROOM.y + r, w.player.y + w.impulse.vy * step));
      w.impulse.left -= dt;
      if (w.impulse.left <= 0) w.impulse = null;
    }
  }
  if (w.phase !== 'play') return;
  if (w.creature.alive) {
    stepCreature(w.creature, dt, w.player, (enraged(w) ? CFG.enrage : 1) * stalkBoost(w));
    bossAttacks(w);
    const c = w.creature;
    if (!w.bounce && c.state !== 'recoil' && Math.hypot(c.x - w.player.x, c.y - w.player.y) < CFG.creatureRadius + CFG.playerRadius) {
      if (w.parryLeft > 0 && w.grace <= 0) parried(w);
      else if (damagePlayer(w, 'creature')) maybeBounce(w);
    }
  }
  // A lethal creature touch ends the tick: no shock, lamp or bounce may follow the lose event.
  if (isLost(w)) return;
  stepSeeds(w, dt);
  if (isLost(w)) return;

  const s = w.surge;
  if (!s) return;
  const id = s.route.id;
  const res = stepSurge(
    s,
    dt,
    { x: w.creature.x, y: w.creature.y, r: CFG.creatureRadius + CFG.creatureHitBonus },
    { x: w.player.x, y: w.player.y, r: CFG.playerRadius },
    w.grace <= 0,
  );
  for (const i of res.lamps) {
    w.lampLitAt[id][i] = w.time;
    w.revealUntil = w.time + CFG.revealSeconds;
    const pos = lampPos(id, i);
    emit(w, { type: 'lampLit', breaker: id, lamp: i, x: pos.x, y: pos.y });
  }
  for (const b of res.bounces) {
    emit(w, { type: 'bounce', x: b.x, y: b.y });
    w.revealUntil = w.time + CFG.revealSeconds;
  }
  // Same-tick priority: the player's death beats a shock, even a fifth one.
  if (res.hitPlayer) damagePlayer(w, 'surge');
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
