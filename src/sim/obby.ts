import { OBBY } from '../config';

export interface Platform {
  x: number;
  y: number;
  w: number;
}

export interface Checkpoint {
  x: number;
  y: number;
}

export interface ObbyInput {
  dx: number;
  jumpHeld: boolean;
  jumpPressed: boolean;
  dashPressed: boolean;
}

export type ObbyEvent = 'jump' | 'dash' | 'land' | 'respawn' | 'checkpoint' | 'finish';

export interface Obby {
  x: number;
  y: number; // feet
  vx: number;
  vy: number;
  face: 1 | -1;
  grounded: boolean;
  coyote: number;
  buffer: number;
  dashLeft: number;
  dashCool: number;
  airDash: boolean;
  level: ObbyLevel;
  checkpoint: Checkpoint;
  reached: number; // checkpoints touched, for the HUD
  falls: number;
  time: number;
  finished: boolean;
}

// Ordinary gaps run 30-54 px; a plain jump clears about 64 on the flat and about 59 up a step.
// The two wide gaps (100 and 104 px) need the dash.
const L1_PLATFORMS: Platform[] = [
  { x: 0, y: 140, w: 170 },
  { x: 200, y: 140, w: 70 },
  { x: 306, y: 124, w: 46 },
  { x: 388, y: 108, w: 46 },
  { x: 470, y: 108, w: 70 },
  { x: 640, y: 108, w: 70 },
  { x: 745, y: 124, w: 46 },
  { x: 826, y: 140, w: 46 },
  { x: 906, y: 140, w: 90 },
  { x: 1030, y: 124, w: 46 },
  { x: 1110, y: 108, w: 46 },
  { x: 1190, y: 92, w: 46 },
  { x: 1275, y: 108, w: 60 },
  { x: 1385, y: 124, w: 34 },
  { x: 1470, y: 108, w: 30 },
  { x: 1550, y: 92, w: 30 },
  { x: 1634, y: 108, w: 36 },
  { x: 1720, y: 124, w: 34 },
  { x: 1804, y: 140, w: 60 },
  { x: 1968, y: 124, w: 40 },
  { x: 2058, y: 108, w: 34 },
  { x: 2142, y: 92, w: 34 },
  { x: 2228, y: 108, w: 40 },
  { x: 2318, y: 124, w: 160 },
];

const L1_CHECKPOINTS: Checkpoint[] = [
  { x: 495, y: 108 },
  { x: 930, y: 140 },
  { x: 1830, y: 140 },
];


export interface ObbyLevel {
  name: string;
  platforms: Platform[];
  checkpoints: Checkpoint[];
  finishX: number;
}

// Levels 2-6 are generated from a fixed seed so they never change between runs. Difficulty d (1-5)
// narrows the platforms, widens the gaps up to 54 px (48 when stepping up), and adds more dash gaps.
function generate(name: string, seed: number, d: number): ObbyLevel {
  let n = seed;
  const rnd = () => ((n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pick = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
  const platforms: Platform[] = [{ x: 0, y: 140, w: 170 }];
  const checkpoints: Checkpoint[] = [];
  const count = 22 + d * 4;
  const dashEvery = Math.max(5, 11 - d);
  let sinceDash = 0;
  let sinceCp = 0;
  for (let i = 1; i < count; i++) {
    const prev = platforms[platforms.length - 1];
    const dash = sinceDash >= dashEvery && prev.w >= 40;
    let y = prev.y;
    const step = [0, 0, 16, -16][Math.floor(rnd() * 4)];
    y = Math.max(92, Math.min(140, prev.y + step));
    const up = y < prev.y;
    const gap = dash ? pick(98, 104) : pick(30, up ? 46 : Math.min(52, 40 + d * 3));
    // A bot that never lets go of right lands about 64-74 px past the edge, so short gaps get wide platforms.
    const reach = y > prev.y ? 76 : y < prev.y ? 66 : 72;
    const w = dash ? pick(40, 50) : Math.max(reach - gap, pick(Math.max(28, 44 - d * 3), Math.max(34, 52 - d * 3)));
    platforms.push({ x: prev.x + prev.w + gap, y, w });
    sinceDash = dash ? 0 : sinceDash + 1;
    sinceCp++;
    if (sinceCp >= 8 && w >= 40 && !dash) {
      checkpoints.push({ x: platforms[platforms.length - 1].x + 18, y });
      sinceCp = 0;
    }
  }
  const last = platforms[platforms.length - 1];
  const end = { x: last.x + last.w + pick(34, 44), y: Math.min(140, Math.max(92, last.y)), w: 160 };
  platforms.push(end);
  return { name, platforms, checkpoints, finishX: end.x + 122 };
}

export const OBBY_LEVELS: ObbyLevel[] = [
  { name: 'THE WAY IN', platforms: L1_PLATFORMS, checkpoints: L1_CHECKPOINTS, finishX: 2440 },
  generate('MOSSY CROSSING', 2024, 1),
  generate('THE SUNKEN STEPS', 7311, 2),
  generate('ROOT AND RUIN', 1999, 3),
  generate('THE HANGING GARDEN', 4242, 4),
  generate('THE LONG DESCENT', 9001, 5),
];

export const PLATFORMS = OBBY_LEVELS[0].platforms;
export const CHECKPOINTS = OBBY_LEVELS[0].checkpoints;
export const FINISH_X = OBBY_LEVELS[0].finishX;

export const START = { x: 24, y: 140 };

export function createObby(level: ObbyLevel = OBBY_LEVELS[0]): Obby {
  return {
    level,
    x: START.x, y: START.y, vx: 0, vy: 0, face: 1, grounded: true, coyote: 0, buffer: 0,
    dashLeft: 0, dashCool: 0, airDash: true, checkpoint: { ...START }, reached: 0, falls: 0, time: 0, finished: false,
  };
}

function landing(level: ObbyLevel, prevY: number, y: number, x: number): Platform | null {
  for (const p of level.platforms) {
    if (x < p.x - OBBY.edge || x > p.x + p.w + OBBY.edge) continue;
    if (prevY <= p.y + 0.5 && y >= p.y) return p;
  }
  return null;
}

export function stepObby(s: Obby, input: ObbyInput, dt: number): ObbyEvent[] {
  const events: ObbyEvent[] = [];
  if (s.finished) return events;
  s.time += dt;
  s.coyote = s.grounded ? OBBY.coyote : Math.max(0, s.coyote - dt);
  s.buffer = input.jumpPressed ? OBBY.buffer : Math.max(0, s.buffer - dt);
  s.dashCool = Math.max(0, s.dashCool - dt);
  if (input.dx !== 0) s.face = input.dx > 0 ? 1 : -1;

  if (input.dashPressed && s.dashCool <= 0 && s.dashLeft <= 0 && (s.grounded || s.airDash)) {
    s.dashLeft = OBBY.dashSeconds;
    s.dashCool = OBBY.dashCooldown;
    if (!s.grounded) s.airDash = false;
    events.push('dash');
  }

  if (s.buffer > 0 && s.coyote > 0) {
    s.vy = -OBBY.jumpSpeed;
    s.grounded = false;
    s.coyote = 0;
    s.buffer = 0;
    events.push('jump');
  }
  if (!input.jumpHeld && s.vy < 0) s.vy *= OBBY.jumpCut;

  const prevY = s.y;
  if (s.dashLeft > 0) {
    s.dashLeft -= dt;
    s.vx = s.face * OBBY.dashSpeed;
    s.vy = 0;
  } else {
    s.vx = input.dx * OBBY.runSpeed;
    s.vy = Math.min(OBBY.maxFall, s.vy + OBBY.gravity * dt);
  }
  s.x = Math.max(OBBY.halfW, s.x + s.vx * dt);
  s.y += s.vy * dt;

  const wasGrounded = s.grounded;
  s.grounded = false;
  if (s.vy >= 0) {
    const p = landing(s.level, prevY, s.y, s.x);
    if (p) {
      s.y = p.y;
      s.vy = 0;
      s.grounded = true;
      s.airDash = true;
      if (!wasGrounded) events.push('land');
    }
  }

  if (s.grounded) {
    s.level.checkpoints.forEach((c, i) => {
      if (s.x >= c.x && s.checkpoint.x < c.x) {
        s.checkpoint = { ...c };
        s.reached = i + 1;
        events.push('checkpoint');
      }
    });
    if (s.x >= s.level.finishX) {
      s.finished = true;
      events.push('finish');
    }
  }

  if (s.y > OBBY.fallY) {
    s.x = s.checkpoint.x;
    s.y = s.checkpoint.y;
    s.vx = 0;
    s.vy = 0;
    s.dashLeft = 0;
    s.grounded = true;
    s.airDash = true;
    s.falls++;
    events.push('respawn');
  }
  return events;
}
