import { describe, expect, it } from 'vitest';
import { GameSim } from '../src/sim/game';

describe('Phase 1 Quick bank outcomes', () => {
  it('can deliberately produce early, hit, and late crossings from one switch', () => {
    const positions = {
      early: { x: 190, y: 430 },
      hit: { x: 410, y: 430 },
      late: { x: 120, y: 400 },
    };
    const outcomes = Object.entries(positions).map(([name, position]) => {
      const sim = new GameSim(position);
      sim.throwBreaker(0);
      const events = sim.runUntilSurgeEnds();
      return { name, hit: events.some((event) => event.type === 'shock') };
    });
    const grid: Array<{ position: { x: number; y: number }; hit: boolean }> = [];
    for (let x = 120; x <= 1000; x += 100) {
      for (let y = 100; y <= 550; y += 100) {
        const sim = new GameSim({ x, y });
        sim.throwBreaker(0);
        grid.push({ position: { x, y }, hit: sim.runUntilSurgeEnds().some((event) => event.type === 'shock') });
      }
    }
    console.log(outcomes);
    expect(outcomes).toEqual([
      { name: 'early', hit: false },
      { name: 'hit', hit: true },
      { name: 'late', hit: false },
    ]);
  });
});
