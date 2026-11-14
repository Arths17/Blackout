import { CFG } from '../src/config';
import { createWorld, fire, stepWorld } from '../src/sim/game';
import { ROUTES, type Vec } from '../src/sim/routes';

export interface ShotResult {
  hit: boolean;
  hitTime: number | null;
  hitLeg: number | null;
  crossTime: number | null;
  arriveTime: number | null;
  verdict: 'hit' | 'too early' | 'too late' | 'no crossing' | 'hit elsewhere';
}

const STEP = 1 / CFG.stepHz;

// Fires `breaker` from the switch with the creature frozen at `creature`, and reports how the
// creature's lunge lined up with leg 2 of the route (the leg between the two wall contacts).
export function simulateShot(breaker: number, creature: Vec, player?: Vec): ShotResult {
  const route = ROUTES[breaker];
  player ??= route.switchPos;
  const w = createWorld({ creature, player });
  let hitTime: number | null = null;
  w.listeners.push((e) => {
    if (e.type === 'shock') hitTime = w.time;
  });
  const a = route.points[1];
  const b = route.points[2];
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len = Math.hypot(abx, aby);
  const side = (x: number, y: number) => (abx * (y - a.y) - aby * (x - a.x)) / len;
  const along = (x: number, y: number) => ((x - a.x) * abx + (y - a.y) * aby) / len;

  let crossTime: number | null = null;
  let arriveTime: number | null = null;
  let prevSide = side(creature.x, creature.y);
  fire(w, breaker);
  for (let i = 0; i < 300 && (w.surge || w.creature.state === 'lunge'); i++) {
    stepWorld(w, { dx: 0, dy: 0 }, STEP);
    const c = w.creature;
    const s = side(c.x, c.y);
    if (crossTime === null && Math.sign(s) !== Math.sign(prevSide)) {
      const t = along(c.x, c.y);
      if (t >= 0 && t <= len) {
        crossTime = w.time;
        arriveTime = (route.cum[1] + t) / CFG.surgeSpeed;
      }
    }
    prevSide = s;
  }

  let hitLeg: number | null = null;
  if (hitTime !== null) {
    const d = hitTime * CFG.surgeSpeed;
    hitLeg = route.cum.findIndex((c, i) => i > 0 && d <= c);
  }
  let verdict: ShotResult['verdict'];
  if (hitTime !== null) verdict = hitLeg === 2 ? 'hit' : 'hit elsewhere';
  else if (crossTime === null) verdict = 'no crossing';
  else verdict = crossTime < arriveTime! ? 'too early' : 'too late';
  return { hit: hitTime !== null, hitTime, hitLeg, crossTime, arriveTime, verdict };
}
