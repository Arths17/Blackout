import { describe, expect, it } from 'vitest';
import { CFG, COINS, EXIT, ROOM, ROOMS, applyRoom } from '../src/config';
import { coinsFor } from '../src/sim/coins';
import { createWorld, currentWindup, damagePlayer, fire, missCooldown, stalkBoost, stepWorld, type World } from '../src/sim/game';
import { ROUTES } from '../src/sim/routes';
import { makeSurge } from '../src/sim/surge';
import { snapshot } from './helpers';

const DT = 1 / 60;
const idle = { dx: 0, dy: 0 };

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
});

describe('multi-hit surge', () => {
  it('a surge that passes over the creature twice scores two shocks', () => {
    const w = createWorld({ player: { x: 600, y: 300 }, creature: { x: 1060, y: 590 }, asleep: true });
    const r = ROUTES[1];
    w.surge = makeSurge(r);
    const spot = r.points[1];
    w.creature.x = spot.x;
    w.creature.y = spot.y;
    w.creature.alive = true;
    let moved = false;
    for (let i = 0; i < 600 && w.surge; i++) {
      stepWorld(w, idle, DT);
      // After the first hit, drop the creature onto the next bounce point so the head crosses it again.
      if (w.shocks === 1 && !moved) {
        moved = true;
        w.creature.state = 'stalk';
        w.creature.x = r.points[2].x;
        w.creature.y = r.points[2].y;
      }
    }
    expect(w.shocks).toBe(2);
    expect(w.lastHitBreaker).toBe(1);
  });

  it('one long pass over the creature is a single hit', () => {
    const w = createWorld({ player: { x: 600, y: 300 }, creature: { x: 1060, y: 590 }, asleep: true });
    const r = ROUTES[1];
    w.surge = makeSurge(r);
    w.creature.x = (r.points[0].x + r.points[1].x) / 2;
    w.creature.y = (r.points[0].y + r.points[1].y) / 2;
    w.creature.alive = true;
    w.creature.state = 'stalk';
    for (let i = 0; i < 60; i++) { stepWorld(w, idle, DT); w.creature.state = 'stalk'; }
    expect(w.shocks).toBe(1);
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
    expect(damagePlayer(w, 'creature')).toBe(true);
    run(w, CFG.graceSeconds * 0.4);
    expect(damagePlayer(w, 'creature')).toBe(false);
    expect(w.hp).toBe(CFG.healthPips - 1);
    run(w, CFG.graceSeconds);
    expect(damagePlayer(w, 'creature')).toBe(true);
    expect(w.hp).toBe(CFG.healthPips - 2);
  });

  it('running out of pips ends the run', () => {
    const w = createWorld();
    for (let i = 0; i < CFG.healthPips; i++) {
      damagePlayer(w, 'creature');
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

describe('bounce back', () => {
  const touching = () => createWorld({ player: { x: 600, y: 324 }, creature: { x: 610, y: 324 }, asleep: false });
  const takeHit = (w: World) => {
    w.bounce = null;
    w.creature.state = 'stalk';
    w.creature.x = w.player.x + 5;
    w.creature.y = w.player.y;
    w.grace = 0;
    stepWorld(w, idle, DT);
  };

  it('every other creature hit throws the player into a bounce', () => {
    const w = touching();
    const seen: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      takeHit(w);
      seen.push(w.bounce !== null);
    }
    expect(seen).toEqual([true, false, true]);
  });

  it('a bounce that hits the creature scores a shock, and the next creature hit cannot bounce', () => {
    const w = createWorld({ player: { x: 600, y: 324 }, creature: { x: 900, y: 324 }, asleep: true });
    w.bounce = { vx: CFG.bounceSpeed, vy: 0, left: CFG.bounceSeconds, super: false, armed: true };
    for (let i = 0; i < 120 && w.bounce; i++) stepWorld(w, idle, DT);
    expect(w.shocks).toBe(1);
    expect(w.bounce).toBeNull();
    expect(w.bounceLocked).toBe(true);
    expect(w.lastHitBreaker).toBe(-1);
    expect(w.grace).toBeGreaterThanOrEqual(CFG.bounceHitGrace - 0.05);

    // Immune right after the hit, so the creature touching them costs nothing.
    w.creature.state = 'stalk';
    w.creature.x = w.player.x + 5;
    w.creature.y = w.player.y;
    stepWorld(w, idle, DT);
    expect(w.hp).toBe(CFG.healthPips);
    w.grace = 0;

    takeHit(w);
    expect(w.bounce).toBeNull();
    expect(w.bounceLocked).toBe(false);
  });

  it('a bounce that misses does not lock the next one', () => {
    const w = createWorld({ player: { x: 600, y: 100 }, creature: { x: 1000, y: 560 }, asleep: true });
    w.bounce = { vx: CFG.bounceSpeed, vy: 0, left: 0.1, super: false, armed: true };
    for (let i = 0; i < 30; i++) stepWorld(w, idle, DT);
    expect(w.bounce).toBeNull();
    expect(w.bounceLocked).toBe(false);
  });
});


describe('parry', () => {
  const touching = () => createWorld({ player: { x: 600, y: 324 }, creature: { x: 610, y: 324 }, asleep: false });
  const press = { dx: 0, dy: 0, parry: true };
  // A lunge that is already on top of the player.
  const lunging = (): World => {
    const w = touching();
    Object.assign(w.creature, { state: 'lunge', dirX: -1, dirY: 0, lungeLeft: 40 });
    return w;
  };

  it('a touch inside the parry window does no damage and throws the boss back', () => {
    const w = touching();
    stepWorld(w, press, DT);
    expect(w.hp).toBe(CFG.healthPips);
    expect(w.creature.state).toBe('recoil');
    expect(w.bounce).toBeNull();
  });

  it('only a parried lunge counts toward the super bounce', () => {
    const walk = touching();
    stepWorld(walk, press, DT);
    expect(walk.parryStreak).toBe(0);
    const lunge = lunging();
    stepWorld(lunge, press, DT);
    expect(lunge.hp).toBe(CFG.healthPips);
    expect(lunge.parryStreak).toBe(1);
  });

  it('mashing parry against a creature that just walks in never launches a super bounce', () => {
    const w = touching();
    for (let i = 0; i < 60 * 20 && w.phase === 'play'; i++) {
      stepWorld(w, { dx: 0, dy: 0, parry: w.parryCool <= 0 }, DT);
      expect(w.bounce?.super ?? false).toBe(false);
    }
  });

  it('a touch with no parry still hurts', () => {
    const w = touching();
    stepWorld(w, idle, DT);
    expect(w.hp).toBe(CFG.healthPips - 1);
  });

  it('pressing too early lets the window lapse, and a whiff has a cooldown', () => {
    const w = createWorld({ player: { x: 600, y: 324 }, creature: { x: 1000, y: 560 }, asleep: true });
    stepWorld(w, press, DT);
    expect(w.parryLeft).toBeGreaterThan(0);
    for (let i = 0; i < Math.round((CFG.parryWindow + 0.1) * 60); i++) stepWorld(w, idle, DT);
    expect(w.parryLeft).toBe(0);
    expect(w.parryCool).toBeGreaterThan(0);
    stepWorld(w, press, DT);
    expect(w.parryLeft).toBe(0);
  });

  it('two parries in a row launch a super bounce that deals several shocks', () => {
    const w = lunging();
    stepWorld(w, press, DT);
    w.parryCool = 0;
    w.grace = 0;
    Object.assign(w.creature, { state: 'lunge', dirX: -1, dirY: 0, lungeLeft: 40, x: w.player.x + 5, y: w.player.y });
    stepWorld(w, press, DT);
    expect(w.bounce?.super).toBe(true);
    expect(w.parryStreak).toBe(0);
    // Put the creature in the ball's path and let it land.
    w.creature.state = 'stalk';
    w.creature.asleep = true;
    const b = w.bounce!;
    const ux = b.vx / CFG.superSpeed;
    const uy = b.vy / CFG.superSpeed;
    w.creature.x = w.player.x + ux * 300;
    w.creature.y = w.player.y + uy * 300;
    for (let i = 0; i < 120 && w.bounce; i++) stepWorld(w, idle, DT);
    expect(w.shocks).toBe(Math.min(CFG.shocksToWin, CFG.superShocks));
    expect(w.grace).toBeGreaterThan(0);
  });

  it('a lapsed streak does not count toward a super bounce', () => {
    const w = lunging();
    stepWorld(w, press, DT);
    expect(w.parryStreak).toBe(1);
    for (let i = 0; i < Math.round((CFG.parryStreakSeconds + 0.5) * 60); i++) stepWorld(w, idle, DT);
    expect(w.parryStreak).toBe(0);
  });
});

describe('boss levels', () => {
  it('each level is faster and tougher than the last but the boss never outruns the player', () => {
    for (let i = 1; i < ROOMS.length; i++) {
      const a = ROOMS[i - 1];
      const b = ROOMS[i];
      expect(b.stalk).toBeGreaterThan(a.stalk);
      expect(b.windup).toBeLessThan(a.windup);
      expect(b.lunge).toBeGreaterThan(a.lunge);
      expect(b.recoil).toBeLessThan(a.recoil);
      expect(b.shocks).toBeGreaterThanOrEqual(a.shocks);
      expect(b.radius).toBeGreaterThanOrEqual(a.radius);
      expect(b.enrage).toBeGreaterThanOrEqual(a.enrage);
      // attacks only ever get more frequent once they exist
      if (a.lungeEvery > 0) expect(b.lungeEvery).toBeLessThan(a.lungeEvery);
      if (a.seedEvery > 0) {
        expect(b.seedEvery).toBeLessThan(a.seedEvery);
        expect(b.seeds).toBeGreaterThanOrEqual(a.seeds);
        expect(b.seedSpeed).toBeGreaterThan(a.seedSpeed);
      }
    }
    for (const b of ROOMS) {
      expect(b.stalk * b.enrage * (1 + CFG.missSpeedUpMax)).toBeLessThan(CFG.playerSpeed);
      expect(b.windup).toBeGreaterThan(CFG.windupFloor);
    }
    expect(ROOMS.length).toBe(5);
  });

  it('the first boss only reacts, and the last one attacks on its own', () => {
    expect(ROOMS[0].lungeEvery).toBe(0);
    expect(ROOMS[0].seedEvery).toBe(0);
    expect(ROOMS[4].lungeEvery).toBeGreaterThan(0);
    expect(ROOMS[4].seedEvery).toBeGreaterThan(0);
    expect(ROOMS[4].seeds).toBeGreaterThanOrEqual(3);
  });

  it('applying a level changes the tuning and level 1 restores the defaults', () => {
    applyRoom(4);
    expect(CFG.creatureStalkSpeed).toBe(ROOMS[4].stalk);
    expect(CFG.shocksToWin).toBe(ROOMS[4].shocks);
    expect(CFG.autoLungeEvery).toBe(ROOMS[4].lungeEvery);
    applyRoom(0);
    expect(CFG.creatureStalkSpeed).toBe(ROOMS[0].stalk);
    expect(CFG.shocksToWin).toBe(5);
    expect(CFG.autoLungeEvery).toBe(0);
  });
});

describe('boss attacks', () => {
  const far = { player: { x: 300, y: 300 }, creature: { x: 800, y: 300 }, asleep: false };
  const withLevel = (i: number, fn: () => void) => {
    applyRoom(i);
    try { fn(); } finally { applyRoom(0); }
  };

  it('level 1 never attacks on its own', () => {
    const w = createWorld(far);
    for (let i = 0; i < 60 * 30; i++) stepWorld(w, idle, DT);
    expect(w.seeds.length).toBe(0);
    expect(w.creature.state === 'windup' || w.creature.state === 'lunge').toBe(false);
  });

  it('a later boss starts its own telegraphed lunge at where the player stands', () => {
    withLevel(4, () => {
      const w = createWorld(far);
      w.nextLunge = 1;
      let target: { x: number; y: number } | null = null;
      for (let i = 0; i < 60 * 3 && !target; i++) {
        stepWorld(w, idle, DT);
        if (w.creature.state === 'windup') target = { ...w.creature.target };
      }
      expect(target).not.toBeNull();
      expect(target!.x).toBeCloseTo(w.player.x, 0);
      expect(target!.y).toBeCloseTo(w.player.y, 0);
    });
  });

  it('a later boss fires a fan of bouncing seeds that can hurt the player', () => {
    withLevel(4, () => {
      const w = createWorld({ ...far, creature: { x: 800, y: 300 } });
      w.nextSeeds = 1;
      w.nextLunge = 1e9;
      for (let i = 0; i < 60 * 2 && w.seeds.length === 0; i++) stepWorld(w, { dx: 0, dy: 0 }, DT);
      expect(w.seeds.length).toBe(CFG.seedCount);
      for (let i = 0; i < 60 * 3 && w.hp === CFG.healthPips; i++) stepWorld(w, { dx: 0, dy: 0 }, DT);
      expect(w.hp).toBeLessThan(CFG.healthPips);
    });
  });

  it('a parry blocks a seed and counts toward the streak', () => {
    withLevel(4, () => {
      const w = createWorld({ player: { x: 400, y: 300 }, creature: { x: 1000, y: 300 }, asleep: true });
      w.seeds.push({ x: 480, y: 300, vx: -CFG.seedSpeed, vy: 0, bouncesLeft: 4 });
      w.parryLeft = 0.3;
      stepWorld(w, { dx: 0, dy: 0 }, DT);
      for (let i = 0; i < 30; i++) stepWorld(w, { dx: 0, dy: 0 }, DT);
      expect(w.hp).toBe(CFG.healthPips);
      expect(w.parryStreak).toBe(1);
      expect(w.seeds.length).toBe(0);
    });
  });

  it('the last boss speeds up once it is badly hurt', () => {
    withLevel(4, () => {
      const w = createWorld({ player: { x: 100, y: 300 }, creature: { x: 1000, y: 300 }, asleep: false });
      w.nextLunge = 1e9;
      w.nextSeeds = 1e9;
      stepWorld(w, idle, DT);
      const calm = 1000 - w.creature.x;
      const h = createWorld({ player: { x: 100, y: 300 }, creature: { x: 1000, y: 300 }, asleep: false });
      h.nextLunge = 1e9;
      h.nextSeeds = 1e9;
      h.shocks = Math.ceil(CFG.shocksToWin * 0.6);
      stepWorld(h, idle, DT);
      expect(1000 - h.creature.x).toBeGreaterThan(calm);
    });
  });
});

describe('coins', () => {
  it('a fast kill pays the most and a slow one the least', () => {
    for (let i = 0; i < ROOMS.length; i++) {
      const fast = COINS.fast[i];
      expect(coinsFor(i, 1)).toBe(COINS.max);
      expect(coinsFor(i, fast)).toBe(COINS.max);
      expect(coinsFor(i, fast * COINS.slowMul)).toBe(COINS.min);
      expect(coinsFor(i, 9999)).toBe(COINS.min);
    }
  });

  it('every extra second never pays more', () => {
    for (let i = 0; i < ROOMS.length; i++) {
      let prev = Infinity;
      for (let s = 0; s <= 400; s += 5) {
        const c = coinsFor(i, s);
        expect(c).toBeLessThanOrEqual(prev);
        expect(c).toBeGreaterThanOrEqual(COINS.min);
        prev = c;
      }
    }
  });

  it('there is a fast time for every boss', () => {
    expect(COINS.fast.length).toBe(ROOMS.length);
  });
});

describe('throwing a breaker', () => {
  const far = { player: { x: 600, y: 300 }, creature: { x: 800, y: 300 }, asleep: false };

  it('makes the creature wind up and lunge at that breaker in every room, on the same tick every time', () => {
    for (let room = 0; room < ROOMS.length; room++) {
      applyRoom(room);
      try {
        const w = createWorld(far);
        w.nextLunge = 1e9;
        w.nextSeeds = 1e9;
        expect(fire(w, 0)).toBe('ok');
        expect(w.creature.state).toBe('windup');
        const at = { x: w.creature.x, y: w.creature.y };
        let ticks = 0;
        while (w.creature.state === 'windup' && ticks < 600) { stepWorld(w, idle, DT); ticks++; }
        expect(ticks).toBe(Math.round(ROOMS[room].windup * 60));
        expect(w.creature.state).toBe('lunge');
        const sw = ROUTES[0].switchPos;
        const d = Math.hypot(sw.x - at.x, sw.y - at.y);
        expect(w.creature.dirX).toBeCloseTo((sw.x - at.x) / d);
        expect(w.creature.dirY).toBeCloseTo((sw.y - at.y) / d);
      } finally {
        applyRoom(0);
      }
    }
  });

  it('does not turn a lunge that is already under way', () => {
    const w = createWorld(far);
    w.creature.state = 'lunge';
    w.creature.dirX = 1;
    w.creature.dirY = 0;
    w.creature.lungeLeft = 120;
    expect(fire(w, 0)).toBe('ok');
    stepWorld(w, idle, DT);
    expect(w.creature.state).toBe('lunge');
    expect(w.creature.dirX).toBe(1);
    for (let i = 0; i < 60 && w.creature.state === 'lunge'; i++) stepWorld(w, idle, DT);
    expect(w.creature.state).toBe('windup');
    expect(w.creature.target).toEqual(ROUTES[0].switchPos);
  });
});

describe('a miss makes the creature faster', () => {
  it('each miss in a row adds stalk speed up to a cap, and a hit clears it', () => {
    const w = createWorld(farAway);
    expect(stalkBoost(w)).toBe(1);
    w.missStreak = 1;
    expect(stalkBoost(w)).toBeCloseTo(1 + CFG.missSpeedUp);
    w.missStreak = 50;
    expect(stalkBoost(w)).toBeCloseTo(1 + CFG.missSpeedUpMax);
    forceHit(w, 1);
    expect(stalkBoost(w)).toBe(1);
  });

  it('it covers more ground per second after a miss', () => {
    const walk = (misses: number): number => {
      const w = createWorld({ player: { x: 100, y: 300 }, creature: { x: 1000, y: 300 }, asleep: false });
      w.missStreak = misses;
      run(w, 1);
      return 1000 - w.creature.x;
    };
    expect(walk(0)).toBeCloseTo(CFG.creatureStalkSpeed, 0);
    expect(walk(2)).toBeCloseTo(CFG.creatureStalkSpeed * (1 + 2 * CFG.missSpeedUp), 0);
  });
});

describe('what hurt the player', () => {
  it('is reported with the hit and kept for the death screen', () => {
    const w = createWorld(farAway);
    const seen: string[] = [];
    w.listeners.push((e) => { if (e.type === 'playerHit') seen.push(e.by); });
    damagePlayer(w, 'surge');
    w.grace = 0;
    damagePlayer(w, 'seed');
    expect(seen).toEqual(['surge', 'seed']);
    expect(w.hurtBy).toBe('seed');
  });
});

describe('dash', () => {
  const far = { player: { x: 500, y: 300 }, creature: { x: 1000, y: 560 }, asleep: true };

  it('is a very small hop in the direction you are moving', () => {
    const w = createWorld(far);
    const x0 = w.player.x;
    stepWorld(w, { dx: 1, dy: 0, dash: true }, DT);
    for (let i = 0; i < 30; i++) stepWorld(w, { dx: 0, dy: 0 }, DT);
    const dist = w.player.x - x0;
    expect(dist).toBeGreaterThan(40);
    expect(dist).toBeLessThan(80);
  });

  it('has a cooldown', () => {
    const w = createWorld(far);
    stepWorld(w, { dx: 1, dy: 0, dash: true }, DT);
    expect(w.dashCool).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) stepWorld(w, { dx: 0, dy: 0 }, DT);
    const x = w.player.x;
    for (let i = 0; i < 10; i++) stepWorld(w, { dx: 0, dy: 0, dash: true }, DT);
    expect(w.player.x).toBe(x);
  });

  it('never leaves the room', () => {
    const w = createWorld({ ...far, player: { x: ROOM.x + ROOM.w - 12, y: 300 } });
    stepWorld(w, { dx: 1, dy: 0, dash: true }, DT);
    for (let i = 0; i < 30; i++) stepWorld(w, { dx: 0, dy: 0 }, DT);
    expect(w.player.x).toBeLessThanOrEqual(ROOM.x + ROOM.w);
  });
});

describe('parry pushback', () => {
  it('a parried touch shoves the player one way and the boss the other', () => {
    const w = createWorld({ player: { x: 600, y: 324 }, creature: { x: 610, y: 324 }, asleep: false });
    const px0 = w.player.x;
    const cx0 = w.creature.x;
    stepWorld(w, { dx: 0, dy: 0, parry: true }, DT);
    for (let i = 0; i < 40; i++) stepWorld(w, { dx: 0, dy: 0 }, DT);
    expect(w.player.x).toBeLessThan(px0 - 30);
    expect(w.creature.x).toBeGreaterThan(cx0 + 20);
  });

  it('the player is shoved from the right when the boss is on the left', () => {
    const w = createWorld({ player: { x: 610, y: 324 }, creature: { x: 600, y: 324 }, asleep: false });
    const px0 = w.player.x;
    stepWorld(w, { dx: 0, dy: 0, parry: true }, DT);
    for (let i = 0; i < 40; i++) stepWorld(w, { dx: 0, dy: 0 }, DT);
    expect(w.player.x).toBeGreaterThan(px0 + 30);
  });
});
