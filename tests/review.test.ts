import { describe, expect, it } from 'vitest';
import { CFG } from '../src/config';
import { createWorld, damagePlayer, fire, stepWorld, type SimEvent } from '../src/sim/game';
import { ROUTES, pointAt } from '../src/sim/routes';
import { makeSurge } from '../src/sim/surge';

const DT = 1 / 60;
const idle = { dx: 0, dy: 0 };

describe('grace does not use up the surge hit', () => {
  it('a touch blocked by grace still lets a later separate contact hurt', () => {
    const r = ROUTES[0];
    const w = createWorld({ player: pointAt(r, 100), creature: { x: 1000, y: 560 }, asleep: true });
    w.creature.alive = false; // keep the creature out of the damage bookkeeping
    w.grace = 0.5;
    w.surge = makeSurge(r);
    while (w.time < 0.25) stepWorld(w, idle, DT);
    expect(w.hp).toBe(CFG.healthPips); // the early touch was blocked by grace
    const later = pointAt(r, 700);
    w.player.x = later.x;
    w.player.y = later.y;
    while (w.surge) stepWorld(w, idle, DT);
    expect(w.hp).toBe(CFG.healthPips - 1);
  });
});

describe('a lethal contact ends scoring', () => {
  const r = ROUTES[0];
  const contact = r.points[r.contacts[0]];

  function nearDeath(player: { x: number; y: number }, creature: { x: number; y: number }) {
    const w = createWorld({ player, creature, asleep: true });
    w.hp = 1;
    w.shocks = 4;
    w.surge = makeSurge(r);
    w.surge.dist = r.cum[1] - 5;
    const events: SimEvent[] = [];
    w.listeners.push((e) => events.push(e));
    stepWorld(w, idle, DT);
    return { w, events };
  }

  it('creature contact that kills the player scores no shock the same tick', () => {
    const { w, events } = nearDeath({ x: contact.x, y: contact.y + 11 }, { x: contact.x, y: contact.y + 20 });
    expect(w.phase).toBe('lost');
    expect(w.shocks).toBe(4);
    expect(w.lastHitBreaker).toBe(-1);
    expect(events.map((e) => e.type)).not.toContain('shock');
  });

  it('a surge that kills the player beats a fifth shock on the same tick', () => {
    const { w, events } = nearDeath({ x: contact.x - 25, y: contact.y + 16 }, { x: contact.x + 20, y: contact.y + 20 });
    expect(w.phase).toBe('lost');
    expect(w.shocks).toBe(4);
    expect(events.map((e) => e.type)).not.toContain('win');
  });
});

describe('timers count whole ticks', () => {
  it('the minimum windup lunges on tick 21', () => {
    const w = createWorld();
    w.missStreak = 200;
    fire(w, 0);
    let ticks = 0;
    while (w.creature.state === 'windup' && ticks < 200) {
      stepWorld(w, idle, DT);
      ticks++;
    }
    expect(ticks).toBe(Math.round(CFG.windupFloor * CFG.stepHz));
  });

  it('the generator cooldown ends on tick 90', () => {
    const w = createWorld();
    w.cooldown = CFG.generatorCooldown;
    let ticks = 0;
    let back = false;
    w.listeners.push((e) => { if (e.type === 'powerBack') back = true; });
    while (!back && ticks < 200) {
      stepWorld(w, idle, DT);
      ticks++;
    }
    expect(ticks).toBe(Math.round(CFG.generatorCooldown * CFG.stepHz));
  });
});

describe('timer boundaries across restart and win', () => {
  it('grace ends exactly at one second and permits the next contact', () => {
    const w = createWorld();
    damagePlayer(w);
    for (let tick = 0; tick < CFG.graceSeconds * CFG.stepHz - 1; tick++) stepWorld(w, idle, DT);
    expect(damagePlayer(w)).toBe(false);
    stepWorld(w, idle, DT);
    expect(w.grace).toBe(0);
    expect(damagePlayer(w)).toBe(true);
  });

  it('recoil and intro end on their configured ticks', () => {
    const w = createWorld();
    w.creature.state = 'recoil';
    w.creature.timer = CFG.recoil;
    for (let tick = 0; tick < CFG.recoil * CFG.stepHz; tick++) stepWorld(w, idle, DT);
    expect(w.creature.state).toBe('stalk');
    expect(w.creature.timer).toBe(0);
    for (let tick = CFG.recoil * CFG.stepHz; tick < CFG.introSeconds * CFG.stepHz; tick++) stepWorld(w, idle, DT);
    expect(w.creature.asleep).toBe(false);
  });

  it('a new world resets every active timer after a failed run', () => {
    const first = createWorld();
    first.missStreak = 200;
    fire(first, 0);
    damagePlayer(first);
    stepWorld(first, idle, DT);
    const restarted = createWorld();
    expect(restarted).toEqual(createWorld());
    expect(restarted.surge).toBeNull();
    expect(restarted.cooldown).toBe(0);
    expect(restarted.grace).toBe(0);
    expect(restarted.creature.timer).toBe(0);
    expect(fire(restarted, 0)).toBe('ok');
    for (let tick = 0; tick < CFG.windup * CFG.stepHz; tick++) stepWorld(restarted, idle, DT);
    expect(restarted.creature.state).toBe('lunge');
    expect(restarted.creature.timer).toBe(0);
  });

  it('winning clears the active surge and never starts a post-win cooldown', () => {
    const r = ROUTES[0];
    const w = createWorld({ player: { x: 950, y: 560 }, creature: r.points[1], asleep: true });
    w.shocks = CFG.shocksToWin - 1;
    w.surge = makeSurge(r);
    w.surge.dist = r.cum[1] - 5;
    const events: SimEvent[] = [];
    w.listeners.push(e => events.push(e));
    stepWorld(w, idle, DT);
    expect(w.phase).toBe('won');
    expect(w.surge).toBeNull();
    expect(w.cooldown).toBe(0);
    for (let tick = 0; tick < CFG.stepHz * 10; tick++) stepWorld(w, idle, DT);
    expect(events.filter(e => e.type === 'win')).toHaveLength(1);
    expect(events.some(e => e.type === 'powerBack' || e.type === 'miss' || e.type === 'playerHit')).toBe(false);
    expect(w.cooldown).toBe(0);
  });
});
