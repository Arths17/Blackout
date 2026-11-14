import type { World } from '../src/sim/game';

export function snapshot(w: World) {
  const { listeners: _l, ...rest } = w;
  return rest;
}
