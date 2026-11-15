import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import type { World } from '../src/sim/game.ts';
import type { Vec } from '../src/sim/routes.ts';

// Plays the sim headlessly with a few fixed strategies and prints win rates per room.
// Usage: node tools/playbot.ts [games per strategy] [first seed]
// Node strips types, but the browser sim deliberately uses extensionless imports.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(url)) return next(url.href, context);
    }
    return next(specifier, context);
  },
});
const { CFG, ROOM, ROOMS, applyRoom } = await import('../src/config.ts');
const { createWorld, stepWorld, fire } = await import('../src/sim/game.ts');
const { ROUTES } = await import('../src/sim/routes.ts');
const { distToSegment } = await import('../src/sim/surge.ts');

const dt = 1 / CFG.stepHz;
const limit = 300; // seconds; a fight still going by then counts as a timeout
const games = Number(process.argv[2] ?? 200);
const seedBase = Number(process.argv[3] ?? 1);

function rng(seed: number) {
  let n = seed >>> 0;
  return () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const onRoute = (p: Vec, b: number, reach: number) => {
  const pts = ROUTES[b].points;
  for (let i = 1; i < pts.length; i++) if (distToSegment(p, pts[i - 1], pts[i]) <= reach) return true;
  return false;
};

// Runs a detached copy forward to see whether throwing b right now would land.
function predictsHit(w: World, b: number) {
  const copy = { ...w, player: { ...w.player }, creature: { ...w.creature, target: { ...w.creature.target }, queued: null },
    lampLitAt: w.lampLitAt.map((row) => [...row]), seeds: w.seeds.map((s) => ({ ...s })), listeners: [] } as World;
  if (fire(copy, b) !== 'ok') return false;
  while (copy.surge && copy.phase === 'play') stepWorld(copy, { dx: 0, dy: 0 }, dt);
  return copy.shocks > w.shocks;
}

// Picks the step that gets toward the target while staying out of the creature, its lunge, seeds and the live lane.
function dodge(w: World, target: Vec, care: number) {
  const p = w.player;
  const c = w.creature;
  let best = { dx: 0, dy: 0 };
  let score = -Infinity;
  for (let i = 0; i < 16; i++) {
    const dx = Math.cos(i * Math.PI / 8);
    const dy = Math.sin(i * Math.PI / 8);
    const q = { x: p.x + dx * CFG.playerSpeed * 0.25, y: p.y + dy * CFG.playerSpeed * 0.25 };
    if (q.x < ROOM.x + CFG.playerRadius || q.x > ROOM.x + ROOM.w - CFG.playerRadius ||
        q.y < ROOM.y + CFG.playerRadius || q.y > ROOM.y + ROOM.h - CFG.playerRadius) continue;
    let value = -dist(q, target) - Math.max(0, 110 - dist(q, c)) * 5;
    if (c.state === 'windup') value -= Math.max(0, 70 - distToSegment(q, c, c.target)) * 6 * care;
    for (const s of w.seeds) {
      const ahead = { x: s.x + s.vx * 0.5, y: s.y + s.vy * 0.5 };
      value -= Math.max(0, 55 - distToSegment(q, s, ahead)) * 7 * care;
    }
    if (c.state === 'lunge') {
      const end = { x: c.x + c.dirX * c.lungeLeft, y: c.y + c.dirY * c.lungeLeft };
      value -= Math.max(0, 55 - distToSegment(q, c, end)) * 8 * care;
    }
    if (w.surge) {
      const pts = w.surge.route.points;
      for (let j = 1; j < pts.length; j++) value -= Math.max(0, 50 - distToSegment(q, pts[j - 1], pts[j])) * 3 * care;
    }
    if (value > score) { score = value; best = { dx, dy }; }
  }
  return best;
}

// expert: full-state forecast, perfect parries. Roughly the skill ceiling.
// novice: wanders away from the creature and throws a breaker whenever the creature is standing on its line. No parry, sloppy dodging.
// spam: stands still and throws whatever is ready.   parry: stands still and mashes parry.   idle: does nothing.
type Strategy = 'expert' | 'novice' | 'spam' | 'parry' | 'idle';

function play(strategy: Strategy, seed: number) {
  const random = rng(seed);
  const w = createWorld({ seed });
  let thrown = 0;
  let repeats = 0;
  let prior = -1;
  let waypoint: Vec = { x: ROOM.x + ROOM.w / 2, y: ROOM.y + ROOM.h / 2 };
  let nextWaypoint = 0;
  w.listeners.push((e) => {
    if (e.type === 'relayClick') thrown++;
    if (e.type === 'shock' && e.counted) {
      if (prior === e.breaker && (w.surge?.hits ?? 0) <= 1) repeats++;
      prior = e.breaker;
    }
  });
  for (let tick = 0; tick < limit * CFG.stepHz && w.phase === 'play'; tick++) {
    let input = { dx: 0, dy: 0, parry: false };
    const c = w.creature;
    const ready = !w.surge && w.cooldown <= 0;
    const far = { x: c.x < ROOM.x + ROOM.w / 2 ? ROOM.x + ROOM.w - 80 : ROOM.x + 80, y: c.y < ROOM.y + ROOM.h / 2 ? ROOM.y + ROOM.h - 80 : ROOM.y + 80 };
    if (strategy === 'spam') {
      if (tick % 12 === 0) for (let b = 0; b < ROUTES.length; b++) if (fire(w, (b + tick / 12) % ROUTES.length) === 'ok') break;
    } else if (strategy === 'parry') {
      input.parry = w.parryCool <= 0;
    } else if (strategy === 'novice') {
      // reacts a few ticks late, and only to what is on screen right now
      if (ready && tick % 10 === 0 && c.state === 'stalk') {
        for (let b = 0; b < ROUTES.length; b++) {
          if (w.lastHitBreaker !== b && onRoute(c, b, 14) && !onRoute(w.player, b, 40)) { fire(w, b); break; }
        }
      }
      if (tick >= nextWaypoint || dist(w.player, waypoint) < 20) {
        do waypoint = { x: ROOM.x + 60 + random() * (ROOM.w - 120), y: ROOM.y + 60 + random() * (ROOM.h - 120) };
        while (dist(waypoint, c) < 300);
        nextWaypoint = tick + Math.round((2 + random() * 3) * CFG.stepHz);
      }
      input = { ...dodge(w, waypoint, random() < 0.7 ? 0.5 : 0), parry: false };
    } else if (strategy === 'expert') {
      if (ready && tick % 6 === 0) {
        for (let b = 0; b < ROUTES.length; b++) if (w.lastHitBreaker !== b && predictsHit(w, b)) { fire(w, b); break; }
      }
      const gap = dist(c, w.player);
      const seedNear = w.seeds.some((s) => dist(s, w.player) < 40);
      const touching = (c.state === 'lunge' || c.state === 'stalk') && gap < CFG.creatureRadius + CFG.playerRadius + 30;
      input = { ...dodge(w, far, 1), parry: (seedNear || touching) && w.parryCool <= 0 };
    }
    stepWorld(w, input, dt);
  }
  return { won: w.phase === 'won', lost: w.phase === 'lost', seconds: w.phase === 'play' ? w.time : w.endTime, shocks: w.shocks, thrown, repeats, hp: w.hp };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const cell = (v: number, digits = 0) => (Number.isNaN(v) ? '-' : v.toFixed(digits)).padStart(6);

console.log(`${games} games per cell, seeds from ${seedBase}`);
console.log('room strategy   win%  time s  die s  thrown  shocks  hp left  repeats');
for (let room = 0; room < ROOMS.length; room++) {
  applyRoom(room);
  for (const strategy of ['expert', 'novice', 'spam', 'parry', 'idle'] as const) {
    const runs = Array.from({ length: games }, (_, i) => play(strategy, seedBase + i));
    const won = runs.filter((r) => r.won);
    const lost = runs.filter((r) => r.lost);
    console.log(`${room + 1}    ${strategy.padEnd(8)}${cell(won.length / games * 100)}  ${cell(avg(won.map((r) => r.seconds)))} ${cell(avg(lost.map((r) => r.seconds)))}  ${cell(avg(runs.map((r) => r.thrown)), 1)}  ${cell(avg(runs.map((r) => r.shocks)), 1)}   ${cell(avg(won.map((r) => r.hp)), 1)}  ${cell(runs.reduce((n, r) => n + r.repeats, 0))}`);
  }
}
