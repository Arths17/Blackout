export type Point = { x: number; y: number };

export type CreatureStateName = 'stalk' | 'windup' | 'lunge' | 'recoil';

export type SimEvent =
  | { type: 'relayClick'; breaker: number }
  | { type: 'bounce'; position: Point }
  | { type: 'lampLit'; position: Point }
  | { type: 'shock'; breaker: number; position: Point }
  | { type: 'miss' }
  | { type: 'playerHit'; position: Point }
  | { type: 'recoil' };
