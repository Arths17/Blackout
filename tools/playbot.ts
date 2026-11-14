import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import type { World } from '../src/sim/game.ts';
import type { Vec } from '../src/sim/routes.ts';

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
const { CFG, ROOM, applyBossLevel } = await import('../src/config.ts');
applyBossLevel(Number(process.env.LEVEL ?? 0));
const { createWorld, stepWorld, interact: press, tryInteract } = await import('../src/sim/game.ts');
const { ROUTES } = await import('../src/sim/routes.ts');
const { distToSegment } = await import('../src/sim/surge.ts');
const dt = 1 / CFG.stepHz;
// ASSUMPTION: a game still playing at ten minutes is censored, not a death.
const limit = 600;
const games = Number(process.argv[2] ?? 300);
const seedBase = Number(process.argv[3] ?? 1);
if (!Number.isSafeInteger(games) || games < 1 || !Number.isSafeInteger(seedBase)) {
  throw new Error('Usage: node tools/playbot.ts [positive games per strategy] [integer first seed]');
}
function rng(seed: number) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}
const isOfflineNow = (w: World, b: number) => w.lastHitBreaker === b;
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
function towards(w: World, target: Vec) {
  return distance(w.player, target) < CFG.playerSpeed * dt
    ? { dx: 0, dy: 0 }
    : { dx: target.x - w.player.x, dy: target.y - w.player.y };
}
function predictsHit(w: World) {
  // Look ahead only on a detached copy; the actual game receives movement and interact.
  const copy = { ...w, player: { ...w.player }, creature: { ...w.creature, target: { ...w.creature.target } },
    lampLitAt: w.lampLitAt.map(row => [...row]), listeners: [] } as World;
  if (copy.charged < 0 || press(copy) !== 'ok') return false;
  while (copy.surge && copy.phase === 'play') stepWorld(copy, { dx: 0, dy: 0 }, dt);
  return copy.shocks > w.shocks;
}
function dodge(w: World, target: Vec) {
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
    const gap = distance(q, c);
    let value = -distance(q, target) - Math.max(0, 110 - gap) * 5;
    if (c.state === 'lunge') {
      const end = { x: c.x + c.dirX * c.lungeLeft, y: c.y + c.dirY * c.lungeLeft };
      value -= Math.max(0, 55 - distToSegment(q, c, end)) * 8;
    }
    if (w.surge) {
      const s = w.surge;
      const points = s.route.points;
      const leg = s.route.cum.findIndex((end, j) => j > 0 && end >= s.dist);
      if (leg > 0) value -= Math.max(0, 55 - distToSegment(q, points[leg - 1], points[leg])) * 3;
    }
    if (value > score) { score = value; best = { dx, dy }; }
  }
  return distance(p, target) < 8 && distance(p, c) > 120 ? { dx: 0, dy: 0 } : best;
}

type Strategy = 'random' | 'baiting' | 'spam';
function play(strategy: Strategy, seed: number, spamBreaker = 0) {
  const random = rng(seed);
  const w = createWorld();
  const shots = ROUTES.map(() => 0);
  const scores = ROUTES.map(() => 0);
  const offline = ROUTES.map(() => 0);
  const attempts = ROUTES.map(() => 0);
  let invalidScores = 0;
  let terminalScores = 0;
  let prior = -1;
  let destination = 0;
  let target: Vec = { ...ROUTES[0].switchPos };
  let nextDecision = 0;
  let arrivedAt = 0;
  w.listeners.push(e => {
    if (e.type === 'relayClick') shots[e.breaker]++;
    if (e.type === 'deadClick') offline[e.breaker]++;
    if (e.type === 'shock' && e.counted) {
      scores[e.breaker]++;
      if (w.phase === 'lost') terminalScores++;
      if (prior === e.breaker) invalidScores++;
      prior = e.breaker;
    }
  });
  for (let tick = 0; tick < limit * CFG.stepHz && w.phase === 'play'; tick++) {
    let input = { dx: 0, dy: 0 };
    const interact = () => {
      let closest = -1;
      let d = CFG.interactRange;
      for (const r of ROUTES) if (distance(w.player, r.switchPos) <= d) {
        closest = r.id; d = distance(w.player, r.switchPos);
      }
      if (closest >= 0) attempts[closest]++;
      return press(w);
    };
    if (strategy === 'spam') {
      target = ROUTES[spamBreaker].switchPos;
      input = towards(w, target);
      if (distance(w.player, target) < CFG.interactRange) interact();
    } else if (strategy === 'random') {
      if (tick >= nextDecision) {
        // Random walks include trips to switches, so this policy actually attempts shots.
        target = random() < 0.65 ? ROUTES[Math.floor(random() * ROUTES.length)].switchPos :
          { x: ROOM.x + 30 + random() * (ROOM.w - 60), y: ROOM.y + 30 + random() * (ROOM.h - 60) };
        nextDecision = tick + Math.round((1 + random() * 4) * CFG.stepHz);
      }
      input = towards(w, target);
      if (tick % 12 === 0 && random() < 0.7) interact();
    } else {
      if (tick === 0) interact();
      if (tick % 12 === 0) {
        const near = distance(w.player, ROUTES[destination].switchPos) <= CFG.interactRange;
        if (w.charged >= 0) {
          if (!w.surge && w.cooldown <= 0 && predictsHit(w)) {
            interact();
            destination = (destination + 1 + Math.floor(random() * 2)) % ROUTES.length;
            arrivedAt = w.time;
          } else if (w.time - arrivedAt > 25) {
            interact();
            arrivedAt = w.time;
          }
        } else if (near && !w.surge && !isOfflineNow(w, destination)) {
          interact();
        } else if (destination === w.lastHitBreaker || (near && w.time - arrivedAt > 3) || w.time - arrivedAt > 18) {
          destination = (destination + 1 + Math.floor(random() * 2)) % ROUTES.length;
          arrivedAt = w.time;
        }
        target = ROUTES[destination].switchPos;
      }
      input = dodge(w, target);
    }
    stepWorld(w, input, dt);
  }
  return { seed, spamBreaker: strategy === 'spam' ? spamBreaker : null, phase: w.phase,
    seconds: w.phase === 'play' ? w.time : w.endTime, shocks: w.shocks,
    shots, scores, offline, attempts, invalidScores, terminalScores };
}
function summary(strategy: Strategy) {
  const runs = Array.from({ length: games }, (_, i) => play(strategy, seedBase + i, i % ROUTES.length));
  const sum = (field: 'shots' | 'scores' | 'offline' | 'attempts') => ROUTES.map((_, b) => runs.reduce((n, r) => n + r[field][b], 0));
  const times = (subset: typeof runs) => subset.length ? {
    count: subset.length, average: subset.reduce((n, r) => n + r.seconds, 0) / subset.length,
    min: Math.min(...subset.map(r => r.seconds)), max: Math.max(...subset.map(r => r.seconds)),
  } : null;
  const won = runs.filter(r => r.phase === 'won' || r.phase === 'escaped');
  const lost = runs.filter(r => r.phase === 'lost');
  return { strategy, games, winRate: won.length / games, deathRate: lost.length / games,
    timeoutRate: runs.filter(r => r.phase === 'play').length / games,
    observedSeconds: times(runs), winSeconds: times(won), deathSeconds: times(lost),
    shots: sum('shots'), scores: sum('scores'), offline: sum('offline'), attempts: sum('attempts'),
    repeatScores: runs.reduce((n, r) => n + r.invalidScores, 0),
    terminalScores: runs.reduce((n, r) => n + r.terminalScores, 0),
    spam: strategy === 'spam' ? ROUTES.map(r => ({ breaker: r.id,
      games: runs.filter(run => run.spamBreaker === r.id).length,
      wins: runs.filter(run => run.spamBreaker === r.id && run.phase === 'won').length,
      shots: runs.filter(run => run.spamBreaker === r.id).reduce((n, run) => n + run.shots[r.id], 0),
      maxShocks: Math.max(...runs.filter(run => run.spamBreaker === r.id).map(run => run.shocks), 0),
    })) : null,
    winningShots: won.length ? won.reduce((n, r) => n + r.shots.reduce((a, b) => a + b, 0), 0) / won.length : null };
}
function fairness() {
  return ROUTES.map(route => {
    let hits = 0;
    let total = 0;
    let campHits = 0;
    let cleanCampHits = 0;
    const examples: { hit?: Vec; miss?: Vec } = {};
    for (let y = ROOM.y + CFG.creatureRadius; y < ROOM.y + ROOM.h; y += 30) {
      for (let x = ROOM.x + CFG.creatureRadius; x < ROOM.x + ROOM.w; x += 30) {
        total++;
        for (const camp of [false, true]) {
          const w = createWorld({ player: route.switchPos, creature: { x, y } });
          tryInteract(w);
          while (w.surge && w.phase === 'play') {
            const input = camp ? { dx: 0, dy: 0 } : towards(w, { x: ROOM.x + ROOM.w / 2, y: ROOM.y + ROOM.h / 2 });
            stepWorld(w, input, dt);
          }
          if (camp) {
            if (w.shocks) { campHits++; if (w.hp === CFG.healthPips) cleanCampHits++; }
          } else {
            if (w.shocks) { hits++; examples.hit ??= { x, y }; }
            else examples.miss ??= { x, y };
          }
        }
      }
    }
    return { breaker: route.id, total, hits, campHits, cleanCampHits, examples,
      switchLaneGap: Math.min(...route.points.slice(1).map((p, i) => distToSegment(route.switchPos, route.points[i], p))),
      surgePlayerReach: CFG.playerRadius + CFG.surgeHitRadius };
  });
}
console.log(JSON.stringify({ games, seedBase, limit, stepHz: CFG.stepHz,
  config: CFG, fairness: fairness(), results: (['random', 'baiting', 'spam'] as const).map(summary) }, null, 2));
