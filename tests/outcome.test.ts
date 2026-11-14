import { describe, expect, it } from 'vitest';
import { ROOM } from '../src/config';
import { FIRST_HIT_SPAWN, PLAYER_START, createWorld, stepWorld, tryInteract } from '../src/sim/game';
import { simulateShot } from './shot';

// Same switch (Quick bank), same row, three places to have the creature standing when you press.
const LURES = {
  early: { x: 570, y: 324 },
  hit: { x: 732, y: 324 },
  late: { x: 880, y: 324 },
};

const WANT = { early: 'too early', hit: 'hit', late: 'too late' } as const;

describe('quick bank outcomes', () => {
  it('three lure positions give three different outcomes', () => {
    const lines: string[] = [];
    for (const [name, pos] of Object.entries(LURES)) {
      const r = simulateShot(0, pos);
      lines.push(
        `${name.padEnd(6)} creature at (${pos.x},${pos.y}) -> ${r.verdict}` +
          (r.crossTime !== null
            ? `, crosses leg 2 at ${r.crossTime.toFixed(2)}s, surge arrives ${r.arriveTime!.toFixed(2)}s`
            : `, hit at ${r.hitTime!.toFixed(2)}s`),
      );
      expect(r.verdict).toBe(WANT[name as keyof typeof WANT]);
    }
    console.log('Quick bank, pressing from the switch:\n' + lines.join('\n'));
  });

  it('each outcome holds for 40px either side, so a player can aim for it', () => {
    for (const [name, pos] of Object.entries(LURES)) {
      for (const dx of [-40, 40]) {
        expect(simulateShot(0, { x: pos.x + dx, y: pos.y }).verdict).toBe(WANT[name as keyof typeof WANT]);
      }
    }
  });

  it('early, hit and late each cover a real share of the room', () => {
    const n: Record<string, number> = {};
    let total = 0;
    for (let y = ROOM.y + 20; y < ROOM.y + ROOM.h; y += 20) {
      for (let x = ROOM.x + 20; x < ROOM.x + ROOM.w; x += 20) {
        const v = simulateShot(0, { x, y }).verdict;
        n[v] = (n[v] ?? 0) + 1;
        total++;
      }
    }
    const pct = (k: string) => ((n[k] ?? 0) / total) * 100;
    console.log(
      `share of room: early ${pct('too early').toFixed(1)}%, hit ${pct('hit').toFixed(1)}%, late ${pct('too late').toFixed(1)}%, ` +
        `hit by another leg ${pct('hit elsewhere').toFixed(1)}%, never crosses ${pct('no crossing').toFixed(1)}%`,
    );
    expect(pct('too early')).toBeGreaterThan(10);
    expect(pct('hit')).toBeGreaterThan(10);
    expect(pct('too late')).toBeGreaterThan(10);
  });
});

describe('first hit', () => {
  it('pressing breaker 1 at the start lands a shock without costing health', () => {
    const w = createWorld();
    expect(w.creature.x).toBe(FIRST_HIT_SPAWN.x);
    w.player.x = PLAYER_START.x;
    w.player.y = PLAYER_START.y;
    expect(tryInteract(w)).toBe('ok');
    for (let i = 0; i < 400 && w.surge; i++) stepWorld(w, { dx: 0, dy: 0 }, 1 / 60);
    expect(w.shocks).toBe(1);
    expect(w.lastHitBreaker).toBe(0);
    expect(w.hp).toBe(4);
  });

  it('the creature does not wander off before the player acts', () => {
    const w = createWorld();
    for (let i = 0; i < 60 * 5; i++) stepWorld(w, { dx: 0, dy: 0 }, 1 / 60);
    expect(w.creature.x).toBe(FIRST_HIT_SPAWN.x);
  });
});
