import { describe, expect, it } from 'vitest';
import { OBBY } from '../src/config';
import { OBBY_LEVELS, createObby, stepObby, type Obby, type ObbyLevel } from '../src/sim/obby';

const DT = 1 / 60;
const none = { dx: 0, jumpHeld: false, jumpPressed: false, dashPressed: false };

const gapAfter = (l: ObbyLevel, i: number): number => l.platforms[i + 1].x - (l.platforms[i].x + l.platforms[i].w);

// Runs right, jumping `early` px before each platform's edge, dashing over wide gaps.
function runCourse(level: ObbyLevel, early: number, limit = 240): Obby {
  const s = createObby(level);
  const P = level.platforms;
  let jumpHeldFor = 0;
  let from = 0;
  for (let t = 0; t < limit * 60 && !s.finished; t++) {
    const i = P.findIndex((p) => s.x >= p.x - OBBY.edge && s.x <= p.x + p.w + OBBY.edge && Math.abs(s.y - p.y) < 1);
    let jumpPressed = false;
    let dashPressed = false;
    if (s.grounded && i >= 0 && i < P.length - 1) {
      const edge = P[i].x + P[i].w;
      if (s.x >= edge - early) {
        from = i;
        jumpPressed = true;
        jumpHeldFor = 0.35;
      }
    }
    if (!s.grounded && s.airDash && s.vy > -50 && s.vy < 120) {
      if (gapAfter(level, from) > 90) dashPressed = true;
    }
    jumpHeldFor = Math.max(0, jumpHeldFor - DT);
    stepObby(s, { dx: 1, jumpHeld: jumpHeldFor > 0, jumpPressed, dashPressed }, DT);
  }
  return s;
}

describe('obby levels', () => {
  it('there are six levels and each is longer than the one before it', () => {
    expect(OBBY_LEVELS.length).toBe(6);
    for (let i = 1; i < OBBY_LEVELS.length; i++) expect(OBBY_LEVELS[i].finishX).toBeGreaterThan(OBBY_LEVELS[i - 1].finishX);
  });

  for (const level of OBBY_LEVELS) {
    describe(level.name, () => {
      it('every ordinary gap is inside a plain jump and the wide ones are dash gaps', () => {
        for (let i = 0; i < level.platforms.length - 1; i++) {
          const g = gapAfter(level, i);
          expect(g > 0).toBe(true);
          if (g < 90) expect(g).toBeLessThanOrEqual(54);
          else expect(g).toBeLessThanOrEqual(106);
        }
      });

      it('a bot beats it without falling, even jumping up to 6 px early', () => {
        for (const early of [0, 3, 6]) {
          const s = runCourse(level, early);
          expect(s.finished, `early ${early}`).toBe(true);
          expect(s.falls, `early ${early}`).toBe(0);
        }
      });

      it('has checkpoints on real platforms', () => {
        for (const c of level.checkpoints) {
          expect(level.platforms.some((p) => c.x >= p.x && c.x <= p.x + p.w && c.y === p.y)).toBe(true);
        }
      });
    });
  }

  it('a full-speed run with no jump falls in the first gap', () => {
    const s = createObby();
    for (let t = 0; t < 60 * 6; t++) stepObby(s, { ...none, dx: 1 }, DT);
    expect(s.falls).toBeGreaterThan(0);
    expect(s.finished).toBe(false);
  });

  it('the wide gap needs the dash', () => {
    const level = OBBY_LEVELS[0];
    const wide = level.platforms.findIndex((_, i) => i < level.platforms.length - 1 && gapAfter(level, i) > 90);
    const s = createObby(level);
    const p = level.platforms[wide];
    s.x = p.x + p.w - 2;
    s.y = p.y;
    s.checkpoint = { x: p.x, y: p.y };
    stepObby(s, { dx: 1, jumpHeld: true, jumpPressed: true, dashPressed: false }, DT);
    for (let t = 0; t < 60 * 2; t++) stepObby(s, { dx: 1, jumpHeld: t < 20, jumpPressed: false, dashPressed: false }, DT);
    expect(s.falls).toBeGreaterThan(0);
  });

  it('a checkpoint keeps your progress after a fall', () => {
    const level = OBBY_LEVELS[0];
    const s = createObby(level);
    const c = level.checkpoints[0];
    s.x = c.x;
    s.y = c.y;
    s.grounded = true;
    stepObby(s, { ...none, dx: 1 }, DT);
    expect(s.reached).toBe(1);
    s.x = 600;
    s.y = 300;
    s.grounded = false;
    const ev = stepObby(s, { ...none }, DT);
    expect(ev).toContain('respawn');
    expect(s.x).toBe(c.x);
    expect(s.y).toBe(c.y);
  });

  it('reaching the door finishes the course', () => {
    for (const level of OBBY_LEVELS) {
      const s = createObby(level);
      const last = level.platforms[level.platforms.length - 1];
      s.x = level.finishX - 1;
      s.y = last.y;
      s.grounded = true;
      expect(stepObby(s, { ...none, dx: 1 }, DT)).toContain('finish');
    }
  });
});
