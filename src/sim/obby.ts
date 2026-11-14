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
  checkpoint: Checkpoint;
  reached: number; // checkpoints touched, for the HUD
  falls: number;
  time: number;
  finished: boolean;
}

// Ordinary gaps run 30-54 px; a plain jump clears about 64 on the flat and about 59 up a step.
// The two wide gaps (100 and 104 px) need the dash.
export const PLATFORMS: Platform[] = [
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

export const CHECKPOINTS: Checkpoint[] = [
  { x: 495, y: 108 },
  { x: 930, y: 140 },
  { x: 1830, y: 140 },
];

export const FINISH_X = 2440;
export const START = { x: 24, y: 140 };

export function createObby(): Obby {
  return {
    x: START.x, y: START.y, vx: 0, vy: 0, face: 1, grounded: true, coyote: 0, buffer: 0,
    dashLeft: 0, dashCool: 0, airDash: true, checkpoint: { ...START }, reached: 0, falls: 0, time: 0, finished: false,
  };
}

function landing(prevY: number, y: number, x: number): Platform | null {
  for (const p of PLATFORMS) {
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
    const p = landing(prevY, s.y, s.x);
    if (p) {
      s.y = p.y;
      s.vy = 0;
      s.grounded = true;
      s.airDash = true;
      if (!wasGrounded) events.push('land');
    }
  }

  if (s.grounded) {
    CHECKPOINTS.forEach((c, i) => {
      if (s.x >= c.x && s.checkpoint.x < c.x) {
        s.checkpoint = { ...c };
        s.reached = i + 1;
        events.push('checkpoint');
      }
    });
    if (s.x >= FINISH_X) {
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
