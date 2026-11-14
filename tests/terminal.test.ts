import { describe, expect, it } from 'vitest';
import { CFG } from '../src/config';
import { createWorld, stepWorld, type SimEvent } from '../src/sim/game';
import { ROUTES } from '../src/sim/routes';
import { makeSurge } from '../src/sim/surge';

const DT = 1 / 60;
const idle = { dx: 0, dy: 0 };

function winningShock(): { w: ReturnType<typeof createWorld>; events: SimEvent[] } {
  const r = ROUTES[1];
  const w = createWorld({ player: { x: 600, y: 300 }, creature: { x: r.points[1].x, y: r.points[1].y }, asleep: true });
  w.shocks = CFG.shocksToWin - 1;
  w.surge = makeSurge(r);
  w.surge.dist = r.cum[1] - 5;
  const events: SimEvent[] = [];
  w.listeners.push((e) => events.push(e));
  return { w, events };
}

describe('after the win', () => {
  it('the generator countdown stops and no power-return or miss event follows', () => {
    const { w, events } = winningShock();
    for (let i = 0; i < 60 * 6; i++) stepWorld(w, idle, DT);
    expect(w.phase).toBe('won');
    const types = events.map((e) => e.type);
    expect(types).toContain('win');
    expect(types).not.toContain('powerBack');
    expect(types).not.toContain('miss');
    expect(w.cooldown).toBe(0);
  });
});

describe('a new world carries nothing over', () => {
  it('after a played-out win, createWorld starts from tick zero with no cooldown', () => {
    const { w } = winningShock();
    for (let i = 0; i < 60 * 3; i++) stepWorld(w, idle, DT);
    const fresh = createWorld();
    expect(fresh.time).toBe(0);
    expect(fresh.cooldown).toBe(0);
    expect(fresh.phase).toBe('play');
    expect(fresh.shocks).toBe(0);
  });
});
