import { describe, expect, it } from 'vitest';
import { CFG, ROOM } from '../src/config';
import { makePlayer, stepPlayer } from '../src/sim/player';

describe('player', () => {
  it('moves at playerSpeed and normalizes diagonals', () => {
    const p = makePlayer(500, 300);
    stepPlayer(p, { dx: 1, dy: 0 }, 1);
    expect(p.x).toBeCloseTo(500 + CFG.playerSpeed);
    const q = makePlayer(500, 300);
    stepPlayer(q, { dx: 1, dy: 1 }, 1);
    expect(Math.hypot(q.x - 500, q.y - 300)).toBeCloseTo(CFG.playerSpeed);
  });

  it('stays inside the room', () => {
    const p = makePlayer(ROOM.x + 20, ROOM.y + 20);
    stepPlayer(p, { dx: -1, dy: -1 }, 5);
    expect(p.x).toBe(ROOM.x + CFG.playerRadius);
    expect(p.y).toBe(ROOM.y + CFG.playerRadius);
  });
});
