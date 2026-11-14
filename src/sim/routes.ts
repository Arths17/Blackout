import type { Point } from './types';

export type Route = {
  name: string;
  points: Point[];
  lampDistances: number[];
};

export const routes: Route[] = [
  {
    name: 'QUICK BANK',
    points: [
      { x: 190, y: 170 },
      { x: 410, y: 170 },
      { x: 410, y: 430 },
      { x: 190, y: 430 },
    ],
    lampDistances: [220, 480, 700],
  },
  {
    name: 'CROSS-ROOM',
    points: [
      { x: 240, y: 520 },
      { x: 470, y: 160 },
      { x: 840, y: 490 },
      { x: 980, y: 130 },
    ],
    lampDistances: [426, 922, 1308],
  },
  {
    name: 'RETURN LOOP',
    points: [
      { x: 920, y: 480 },
      { x: 720, y: 130 },
      { x: 250, y: 180 },
      { x: 450, y: 500 },
      { x: 920, y: 480 },
    ],
    lampDistances: [403, 873, 1278, 1770],
  },
];

export function routeLength(route: Route): number {
  let length = 0;
  for (let i = 1; i < route.points.length; i += 1) {
    length += Math.hypot(
      route.points[i].x - route.points[i - 1].x,
      route.points[i].y - route.points[i - 1].y,
    );
  }
  return length;
}

export function pointAtDistance(route: Route, distance: number): Point {
  if (distance <= 0) return { ...route.points[0] };
  let remaining = distance;
  for (let i = 1; i < route.points.length; i += 1) {
    const start = route.points[i - 1];
    const end = route.points[i];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    if (remaining <= segmentLength) {
      const ratio = remaining / segmentLength;
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    remaining -= segmentLength;
  }
  return { ...route.points[route.points.length - 1] };
}

export function nearestDistanceOnRoute(route: Route, point: Point): number {
  let bestDistance = 0;
  let bestSquared = Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 1; i < route.points.length; i += 1) {
    const start = route.points[i - 1];
    const end = route.points[i];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    const candidate = { x: start.x + dx * t, y: start.y + dy * t };
    const squared = (point.x - candidate.x) ** 2 + (point.y - candidate.y) ** 2;
    if (squared < bestSquared) {
      bestSquared = squared;
      bestDistance = distance + Math.sqrt(lengthSquared) * t;
    }

    distance += Math.sqrt(lengthSquared);
  }
  return bestDistance;
}

export function distanceToRoute(route: Route, point: Point): number {
  let bestSquared = Number.POSITIVE_INFINITY;
  for (let i = 1; i < route.points.length; i += 1) {
    const start = route.points[i - 1];
    const end = route.points[i];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    const x = start.x + dx * t;
    const y = start.y + dy * t;
    bestSquared = Math.min(bestSquared, (point.x - x) ** 2 + (point.y - y) ** 2);
  }
  return Math.sqrt(bestSquared);
}
