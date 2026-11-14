import { describe, expect, it } from 'vitest';
import { CFG, EXIT } from '../src/config';
import { createWorld, currentWindup, damagePlayer, fire, missCooldown, stepWorld, useEnergy, type World } from '../src/sim/game';
import { ROUTES } from '../src/sim/routes';
import { makeSurge } from '../src/sim/surge';
import { snapshot } from './helpers';

const DT = 1 / 60;
const idle = { dx: 0, dy: 0, shield: true };

function run(w: World, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepWorld(w, idle, DT);
}

function runUntilSurgeEnds(w: World): void {
  for (let i = 0; i < 600 && w.surge; i++) stepWorld(w, idle, DT);
}

// Starts breaker b's surge just before leg 1 ends with the creature parked on its bounce point.
function forceHit(w: World, b: number): void {
  const r = ROUTES[b];
  w.cooldown = 0;
  w.creature.state = 'stalk';
  w.creature.asleep = true;
  w.creature.x = r.points[1].x;
  w.creature.y = r.points[1].y;
  w.surge = makeSurge(r);
  w.surge.dist = r.cum[1] - 5;
  runUntilSurgeEnds(w);
}

const farAway = { player: { x: 600, y: 300 }, creature: { x: 1060, y: 590 } };

describe('no-repeat rule', () => {
  it('a breaker that hit cannot score again until a different one hits', () => {
    const w = createWorld(farAway);
    forceHit(w, 0);
    expect(w.shocks).toBe(1);
    expect(w.lastHitBreaker).toBe(0);

    w.cooldown = 0;
    expect(fire(w, 0)).toBe('offline');

    // Even a surge injected by hand cannot score for the offline breaker.
    forceHit(w, 0);
    expect(w.shocks).toBe(1);

    forceHit(w, 1);
    expect(w.shocks).toBe(2);
    w.cooldown = 0;
    expect(fire(w, 0)).toBe('ok');
  });

  describe('stored generator energy', () => {
    it('charges at a generator and fires only after leaving it', () => {
      const w = createWorld({ player: ROUTES[0].switchPos, creature: { x: 1000, y: 560 }, asleep: true });
      expect(useEnergy(w)).toBe('charged');
      expect(w.energy).toBe(1);
      expect(useEnergy(w)).toBe('charged');
      w.player.x = 300;
      expect(useEnergy(w)).toBe('ok');
      expect(w.energy).toBe(0);
      expect(w.surge).not.toBeNull();
      expect(w.surge?.route.points[0]).toEqual({ x: w.player.x, y: w.player.y });
      stepWorld(w, { dx: 0, dy: 0 }, 1 / 60);
      expect(w.hp).toBe(CFG.healthPips);
    });

    it('the radial shockwave damages an unshielded player but not a shielded one', () => {
      const make = () => {
        const w = createWorld({ player: { x: 700, y: 324 }, creature: { x: 600, y: 324 }, asleep: true });
        w.shockwave = { radius: 0, speed: 2000, maxRadius: 500, hitPlayer: false };
        return w;
      };
      const unshielded = make();
      stepWorld(unshielded, { dx: 0, dy: 0 }, 0.1);
      expect(unshielded.hp).toBe(CFG.healthPips - 1);
      const shielded = make();
      stepWorld(shielded, { dx: 0, dy: 0, shield: true }, 0.1);
      expect(shielded.hp).toBe(CFG.healthPips);
    });

    it('a ball collision damages the monster and starts its shockwave', () => {
      const w = createWorld({ player: { x: 500, y: 324 }, creature: { x: 560, y: 324 }, asleep: true });
      w.nextBall = 0;
      for (let i = 0; i < 20 && w.shocks === 0; i++) stepWorld(w, { dx: 0, dy: 0 }, 1 / 60);
      expect(w.shocks).toBe(1);
      expect(w.hp).toBe(CFG.healthPips - 1);
      expect(w.shockwave).not.toBeNull();
    });
    });
});

describe('miss cost', () => {
  it('a miss shortens the next windup and lengthens the cooldown', () => {
    const w = createWorld(farAway);
    const before = currentWindup(w);
    expect(fire(w, 1)).toBe('ok');
    w.creature.state = 'recoil';
    w.creature.timer = 99;
    runUntilSurgeEnds(w);
    expect(w.surge).toBeNull();
    expect(w.missStreak).toBe(1);
    expect(currentWindup(w)).toBeCloseTo(before - CFG.missWindupReduction);
    expect(w.cooldown).toBeCloseTo(CFG.generatorCooldown + CFG.missCooldownAdd);
    expect(fire(w, 1)).toBe('cooling');
  });

  it('respects the windup floor and the cooldown ceiling', () => {
    const w = createWorld();
    w.missStreak = 200;
    expect(currentWindup(w)).toBe(CFG.windupFloor);
    expect(missCooldown(w)).toBe(CFG.cooldownMax);
  });

  it('a hit resets the streak and uses the base cooldown', () => {
    const w = createWorld(farAway);
    w.missStreak = 3;
    forceHit(w, 1);
    expect(w.missStreak).toBe(0);
    expect(w.cooldown).toBe(CFG.generatorCooldown);
  });
});

describe('grace period', () => {
  it('two overlaps inside the grace window cost one pip', () => {
    const w = createWorld();
    expect(damagePlayer(w)).toBe(true);
    run(w, CFG.graceSeconds * 0.4);
    expect(damagePlayer(w)).toBe(false);
    expect(w.hp).toBe(CFG.healthPips - 1);
    run(w, CFG.graceSeconds);
    expect(damagePlayer(w)).toBe(true);
    expect(w.hp).toBe(CFG.healthPips - 2);
  });

  it('running out of pips ends the run', () => {
    const w = createWorld();
    for (let i = 0; i < CFG.healthPips; i++) {
      damagePlayer(w);
      w.grace = 0;
    }
    expect(w.phase).toBe('lost');
  });
});

describe('win', () => {
  it('the fifth counted shock wins and the exit then triggers', () => {
    const w = createWorld(farAway);
    for (const b of [0, 1, 0, 1, 2]) forceHit(w, b);
    expect(w.shocks).toBe(CFG.shocksToWin);
    expect(w.phase).toBe('won');
    w.player.x = EXIT.x + EXIT.w / 2;
    w.player.y = 50;
    stepWorld(w, idle, DT);
    expect(w.phase).toBe('escaped');
  });
});

describe('determinism', () => {
  it('same inputs and step count give the same final state', () => {
    const play = () => {
      const w = createWorld();
      for (let i = 0; i < 60 * 40; i++) {
        const sx = Math.sin(i / 37);
        stepWorld(w, { dx: sx > 0.3 ? 1 : sx < -0.3 ? -1 : 0, dy: Math.cos(i / 53) > 0 ? 1 : -1 }, DT);
        if (i % 97 === 0) fire(w, (i / 97) % 3);
      }
      return JSON.stringify(snapshot(w));
    };
    expect(play()).toBe(play());
  });
});
