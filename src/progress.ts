import { BOSS_LEVELS } from './config';

// Which fight the player is on and how long the run has taken. Lives outside the scenes so it
// survives scene restarts; time counts every attempt but not the menus.
export const progress = {
  level: 0,
  total: 0,
  levelTimes: BOSS_LEVELS.map(() => 0),
  levelCoins: BOSS_LEVELS.map(() => 0),
};

export const totalCoins = (): number => progress.levelCoins.reduce((a, b) => a + b, 0);

export function resetRun(): void {
  progress.level = 0;
  progress.total = 0;
  progress.levelTimes = BOSS_LEVELS.map(() => 0);
  progress.levelCoins = BOSS_LEVELS.map(() => 0);
}
