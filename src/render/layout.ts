import { ROOM, VIEW } from '../config';
import { px } from './pixel';

// Floor and wall bounds in screen px. They follow the sim's room rectangle (ROOM / VIEW.s) to within a pixel.
export const FLOOR = {
  x0: Math.floor(px(ROOM.x)),
  y0: Math.ceil(px(ROOM.y)),
  x1: Math.ceil(px(ROOM.x + ROOM.w)),
  y1: Math.ceil(px(ROOM.y + ROOM.h)),
};

// The room art was authored for a 320 x 180 view where the floor ran from (21, 13) to (299, 168).
// These map those authored coordinates onto the current floor so props, decals and decor keep their place.
const KX = (FLOOR.x1 - FLOOR.x0) / 278;
const KY = (FLOOR.y1 - FLOOR.y0) / 155;
export const mx = (x: number): number => Math.round(FLOOR.x0 + (x - 21) * KX);
export const my = (y: number): number => Math.round(FLOOR.y0 + (y - 13) * KY);
// Offset that centres something authored for the old 320 x 180 screen.
export const OX = Math.round((VIEW.w - 320) / 2);
export const OY = Math.round((VIEW.h - 180) / 2);
