// Player options. Kept in localStorage when the browser allows it; an itch.io iframe can block it.
const KEY = 'blackout.settings';

export const SHAKE_NAMES = ['OFF', 'LOW', 'FULL'];
export const SHAKE_SCALE = [0, 0.4, 1];
export const FLASH_NAMES = ['REDUCED', 'FULL'];

export const settings = {
  volume: 7, // 0..10
  shake: 2, // index into SHAKE_NAMES
  flash: 1, // index into FLASH_NAMES
};

export function loadSettings(): void {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    for (const k of Object.keys(settings) as (keyof typeof settings)[]) {
      if (Number.isInteger(saved[k])) settings[k] = saved[k];
    }
  } catch {
    // no storage here; the defaults stand
  }
  settings.volume = Math.max(0, Math.min(10, settings.volume));
  settings.shake = Math.max(0, Math.min(2, settings.shake));
  settings.flash = Math.max(0, Math.min(1, settings.flash));
}

export function saveSettings(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // same as above
  }
}
