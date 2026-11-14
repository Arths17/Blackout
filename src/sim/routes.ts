import { ROOM } from '../config';

export interface Vec {
  x: number;
  y: number;
}

export interface Route {
  id: number;
  name: string;
  switchPos: Vec;
  points: Vec[];
  contacts: number[];
  lampDists: number[];
  cum: number[];
  total: number;
}

interface RouteDef {
  id: number;
  name: string;
  switchPos: Vec;
  points: Vec[];
  contacts: number[];
  lampDists: number[];
}

export function buildRoute(def: RouteDef): Route {
  const cum = [0];
  for (let i = 1; i < def.points.length; i++) {
    const a = def.points[i - 1];
    const b = def.points[i];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { ...def, cum, total: cum[cum.length - 1] };
}

// Each lane starts about 80px from its switch so someone standing at the switch is outside it.
// Reflections are worked out by hand: the angle in equals the angle out at every wall contact.

// Quick bank: top wall, then bottom wall, all in the left half. Long first leg so the surge
// reaches leg 2 after the creature's windup ends, which is what makes "too early" possible.
const quickBank = buildRoute({
  id: 0,
  name: 'QUICK BANK',
  switchPos: { x: 200, y: ROOM.y + ROOM.h - 14 },
  points: [
    { x: 280, y: 560 },
    { x: 420, y: ROOM.y },
    { x: 572, y: ROOM.y + ROOM.h },
    { x: 640, y: 355 },
  ],
  contacts: [1, 2],
  lampDists: [260, 700, 960, 1230],
});

// Cross-room: top, bottom, then the far (left) wall, three long legs through the middle.
const crossRoom = buildRoute({
  id: 1,
  name: 'CROSS-ROOM',
  switchPos: { x: 900, y: ROOM.y + ROOM.h - 14 },
  points: [
    { x: 840, y: 560 },
    { x: 560, y: ROOM.y },
    { x: 256, y: ROOM.y + ROOM.h },
    { x: ROOM.x, y: 272 },
  ],
  contacts: [1, 2, 3],
  lampDists: [300, 800, 1000, 1400],
});

// Return loop: out to the left wall, across the top, down the right wall and back over its own
// switch. The last leg ends 50px from where the player stands to fire.
const returnLoop = buildRoute({
  id: 2,
  name: 'RETURN LOOP',
  switchPos: { x: ROOM.x + ROOM.w - 36, y: 330 },
  points: [
    { x: 960, y: 330 },
    { x: ROOM.x, y: 76 },
    { x: 186, y: ROOM.y },
    { x: ROOM.x + ROOM.w, y: 300 },
    { x: 990, y: 324 },
  ],
  contacts: [1, 2, 3],
  lampDists: [450, 1000, 1500, 1800, 1930, 2020],
});

export const ROUTES: Route[] = [quickBank, crossRoom, returnLoop];

export function pointAt(r: Route, d: number): Vec {
  const dd = Math.min(r.total, Math.max(0, d));
  let i = 0;
  while (i < r.points.length - 2 && r.cum[i + 1] < dd) i++;
  const a = r.points[i];
  const b = r.points[i + 1];
  const seg = r.cum[i + 1] - r.cum[i];
  const t = seg > 0 ? (dd - r.cum[i]) / seg : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// The polyline the head covered between two distances, as consecutive points.
export function pathBetween(r: Route, d0: number, d1: number): Vec[] {
  const out = [pointAt(r, d0)];
  for (let i = 1; i < r.points.length - 1; i++) {
    if (r.cum[i] > d0 && r.cum[i] < d1) out.push(r.points[i]);
  }
  out.push(pointAt(r, d1));
  return out;
}

// Unit direction of the leg the head is on at distance d.
export function dirAt(r: Route, d: number): Vec {
  let i = 0;
  while (i < r.points.length - 2 && r.cum[i + 1] < d) i++;
  const a = r.points[i];
  const b = r.points[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}
