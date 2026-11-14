import { describe, expect, it } from 'vitest';
import { OBBY } from '../src/config';
import { CHECKPOINTS, FINISH_X, PLATFORMS, createObby, stepObby, type Obby } from '../src/sim/obby';

const DT = 1 / 60;
const none = { dx: 0, jumpHeld: false, jumpPressed: false, dashPressed: false };

function gapAfter(i: number): number {
  const p = PLATFORMS[i];
  return PLATFORMS[i + 1].x - (p.x + p.w);
}

// Runs right, jumping `early` px before each platform's edge, dashing over wide gaps.
function runCourse(early: number, limit = 90): Obby {
  const s = createObby();
  let jumpHeldFor = 0;
  let from = 0;
  for (let t = 0; t < limit * 60 && !s.finished; t++) {
    const i = PLATFORMS.findIndex((p) => s.x >= p.x - OBBY.edge && s.x <= p.x + p.w + OBBY.edge && Math.abs(s.y - p.y) < 1);
    let jumpPressed = false;
    let dashPressed = false;
    if (s.grounded && i >= 0 && i < PLATFORMS.length - 1) {
      const edge = PLATFORMS[i].x + PLATFORMS[i].w;
      if (s.x >= edge - early) {
        from = i;
        jumpPressed = true;
        jumpHeldFor = 0.35;
      }
    }
    if (!s.grounded && s.airDash && s.vy > -50 && s.vy < 120) {
      if (gapAfter(from) > 90) dashPressed = true;
    }
    jumpHeldFor = Math.max(0, jumpHeldFor - DT);
    stepObby(s, { dx: 1, jumpHeld: jumpHeldFor > 0, jumpPressed, dashPressed }, DT);
  }
  return s;
}

describe('obby', () => {
  it('every ordinary gap is inside a plain jump', () => {
    for (let i = 0; i < PLATFORMS.length - 1; i++) {
      const g = gapAfter(i);
      if (g < 90) expect(g).toBeLessThanOrEqual(54);
    }
  });

  it('a full-speed run with no jump falls in the first gap and respawns at the start', () => {
    const s = createObby();
    for (let t = 0; t < 60 * 6; t++) stepObby(s, { ...none, dx: 1 }, DT);
    expect(s.falls).toBeGreaterThan(0);
    expect(s.finished).toBe(false);
  });

  it('a bot that jumps at the edge beats the course without falling', () => {
    const s = runCourse(2);
    expect(s.finished).toBe(true);
    expect(s.falls).toBe(0);
    expect(s.time).toBeLessThan(60);
  });

  it('jump timing is forgiving: anywhere from 0 to 8 px before the edge still clears it', () => {
    for (const early of [0, 2, 4, 6, 8]) {
      const s = runCourse(early);
      expect(s.finished, `early ${early}`).toBe(true);
      expect(s.falls, `early ${early}`).toBe(0);
    }
  });

  it('the wide gap needs the dash', () => {
    const wides = PLATFORMS.map((_, i) => i).filter((i) => i < PLATFORMS.length - 1 && gapAfter(i) > 90);
    expect(wides.length).toBe(2);
    const wide = wides[0];
    const s = createObby();
    const p = PLATFORMS[wide];
    s.x = p.x + p.w - 2;
    s.y = p.y;
    s.checkpoint = { x: p.x, y: p.y };
    stepObby(s, { dx: 1, jumpHeld: true, jumpPressed: true, dashPressed: false }, DT);
    for (let t = 0; t < 60 * 2; t++) stepObby(s, { dx: 1, jumpHeld: t < 20, jumpPressed: false, dashPressed: false }, DT);
    expect(s.falls).toBeGreaterThan(0);
  });

  it('a checkpoint keeps your progress after a fall', () => {
    const s = createObby();
    const c = CHECKPOINTS[0];
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
    const s = createObby();
    const last = PLATFORMS[PLATFORMS.length - 1];
    s.x = FINISH_X - 1;
    s.y = last.y;
    s.grounded = true;
    expect(stepObby(s, { ...none, dx: 1 }, DT)).toContain('finish');
  });
});
