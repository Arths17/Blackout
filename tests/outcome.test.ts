import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BOSS_START, CFG, EXIT, LURES, ROOM, applyRoom } from '../src/config';
import { createWorld, stepWorld } from '../src/sim/game';
import { simulateShot } from './shot';

const WANT = { early: 'too early', hit: 'hit', late: 'too late' } as const;

describe('quick bank outcomes', () => {
  // The three lure marks were measured with this timing; the rooms now each set their own.
  beforeAll(() => Object.assign(CFG, { windup: 1.0, lungeSpeed: 520, lungeMaxDist: 380, creatureStalkSpeed: 130 }));
  afterAll(() => applyRoom(0));

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

describe('boss start', () => {
  it('the boss starts in the top-right corner guarding the exit door', () => {
    const w = createWorld();
    expect(w.creature.x).toBe(BOSS_START.x);
    expect(w.creature.y).toBe(BOSS_START.y);
    expect(w.creature.x).toBeGreaterThan(EXIT.x);
    expect(w.creature.y).toBeLessThan(ROOM.y + 120);
  });

  it('the boss starts running at the player straight away', () => {
    const w = createWorld();
    expect(w.creature.asleep).toBe(false);
    const d0 = Math.hypot(w.creature.x - w.player.x, w.creature.y - w.player.y);
    for (let i = 0; i < 60; i++) stepWorld(w, { dx: 0, dy: 0 }, 1 / 60);
    const d1 = Math.hypot(w.creature.x - w.player.x, w.creature.y - w.player.y);
    expect(d1).toBeLessThan(d0 - 100);
    expect(w.creature.state).toBe('stalk');
  });
});
