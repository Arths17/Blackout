import { tuning } from '../config';
import { pointAtDistance, routeLength, type Route } from './routes';
import type { Point } from './types';

export type SurgeHit = { target: 'player' | 'creature'; position: Point };

export class Surge {
  readonly route: Route;
  readonly breaker: number;
  distance = 0;
  previousDistance = 0;
  finished = false;
  creatureHit = false;
  playerHit = false;
  readonly length: number;

  constructor(route: Route, breaker: number) {
    this.route = route;
    this.breaker = breaker;
    this.length = routeLength(route);
  }

  get position(): Point {
    return pointAtDistance(this.route, this.distance);
  }

  advance(seconds: number, creature: Point, player: Point): SurgeHit[] {
    if (this.finished) return [];
    this.previousDistance = this.distance;
    this.distance = Math.min(this.length, this.distance + tuning.surgeSpeed * seconds);
    const hits: SurgeHit[] = [];
    for (const target of ['creature', 'player'] as const) {
      const alreadyHit = target === 'creature' ? this.creatureHit : this.playerHit;
      if (alreadyHit) continue;
      const targetPoint = target === 'creature' ? creature : player;
      const targetDistance = this.distanceToTarget(targetPoint);
      if (targetDistance !== null &&
          targetDistance >= this.previousDistance - tuning.surgeHitRadius &&
          targetDistance <= this.distance + tuning.surgeHitRadius) {
        if (target === 'creature') this.creatureHit = true;
        else this.playerHit = true;
        hits.push({ target, position: targetPoint });
      }
    }
    if (this.distance >= this.length) this.finished = true;
    return hits;
  }

  private distanceToTarget(target: Point): number | null {
    let bestSquared = Number.POSITIVE_INFINITY;
    let bestDistance = 0;
    let distance = 0;
    for (let i = 1; i < this.route.points.length; i += 1) {
      const start = this.route.points[i - 1];
      const end = this.route.points[i];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.hypot(dx, dy);
      const t = Math.max(0, Math.min(1, ((target.x - start.x) * dx + (target.y - start.y) * dy) / (length * length)));
      const nearest = { x: start.x + dx * t, y: start.y + dy * t };
      const squared = (target.x - nearest.x) ** 2 + (target.y - nearest.y) ** 2;
      if (squared < bestSquared) {
        bestSquared = squared;
        bestDistance = distance + length * t;
      }
      distance += length;
    }
    return bestSquared <= tuning.surgeHitRadius ** 2 ? bestDistance : null;
  }
}
