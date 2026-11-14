import { COINS } from '../config';

// Faster kills pay more: the maximum at or under the fast time, the minimum at fast * slowMul or longer.
export function coinsFor(level: number, seconds: number): number {
  const fast = COINS.fast[Math.max(0, Math.min(COINS.fast.length - 1, level))];
  const slow = fast * COINS.slowMul;
  const k = Math.max(0, Math.min(1, (seconds - fast) / (slow - fast)));
  return Math.round(COINS.max - (COINS.max - COINS.min) * k);
}
