import { describe, expect, it } from 'vitest';
import { CFG, ROOM } from '../src/config';
import { createWorld, fire, stepWorld } from '../src/sim/game';
import { ROUTES } from '../src/sim/routes';

const DT = 1 / 60;
const CENTER = { x: ROOM.x + ROOM.w / 2, y: ROOM.y + ROOM.h / 2 };

interface Outcome {
  shocked: boolean;
  damaged: boolean;
}

function play(b: number, creature: { x: number; y: number }, policy: 'leave' | 'stay'): Outcome {
  const w = createWorld({ creature, player: ROUTES[b].switchPos });
  if (policy === 'stay') {
    // The creature walks up to the player standing on the switch before they press.
    for (let i = 0; i < 60 * 30; i++) {
      stepWorld(w, { dx: 0, dy: 0 }, DT);
      if (Math.hypot(w.creature.x - w.player.x, w.creature.y - w.player.y) < 140) break;
    }
  }
  const hp0 = w.hp;
  fire(w, b);
  for (let i = 0; i < 60 * 8 && (w.surge || w.creature.state === 'lunge'); i++) {
    let dx = 0;
    let dy = 0;
    if (policy === 'leave') {
      const d = Math.hypot(CENTER.x - w.player.x, CENTER.y - w.player.y) || 1;
      dx = (CENTER.x - w.player.x) / d;
      dy = (CENTER.y - w.player.y) / d;
    }
    stepWorld(w, { dx, dy }, DT);
    w.hp = Math.max(w.hp, 1);
  }
  return { shocked: w.shocks > 0, damaged: w.hp < hp0 || w.grace > 0 };
}

describe('fairness sweep', () => {
  for (const r of ROUTES) {
    it(`${r.name}: hits from some creature positions, not most, and not from camping`, () => {
      let hits = 0;
      let total = 0;
      for (let y = ROOM.y + 20; y < ROOM.y + ROOM.h; y += 30) {
        for (let x = ROOM.x + 20; x < ROOM.x + ROOM.w; x += 30) {
          total++;
          if (play(r.id, { x, y }, 'leave').shocked) hits++;
        }
      }
      const frac = hits / total;

      let clean = 0;
      let campShocks = 0;
      let campTotal = 0;
      for (let y = ROOM.y + 40; y < ROOM.y + ROOM.h; y += 80) {
        for (let x = ROOM.x + 40; x < ROOM.x + ROOM.w; x += 80) {
          campTotal++;
          const o = play(r.id, { x, y }, 'stay');
          if (o.shocked) campShocks++;
          if (o.shocked && !o.damaged) clean++;
        }
      }
      const campFrac = clean / campTotal;
      console.log(
        `${r.name}: hits from ${(frac * 100).toFixed(1)}% of creature positions; ` +
          `standing on the switch lands a shock ${((campShocks / campTotal) * 100).toFixed(1)}% and a damage-free shock ${(campFrac * 100).toFixed(1)}% of the time`,
      );

      expect(frac, 'never hits from anywhere').toBeGreaterThan(0.03);
      expect(frac, 'hits from too much of the room').toBeLessThanOrEqual(0.6);
      expect(campFrac, 'camping at the switch always wins').toBeLessThanOrEqual(0.6);
    });
  }

  it('shocks to win is a plain knob', () => {
    expect(CFG.shocksToWin).toBeGreaterThan(0);
  });
});
