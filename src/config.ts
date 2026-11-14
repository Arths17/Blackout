export const W = 1152;
export const H = 648;

export const ROOM = { x: 76, y: 44, w: 1000, h: 560 };
export const EXIT = { x: 880, w: 100 }; // door in the top wall

export const PLAYER_START = { x: 190, y: 560 };
// Sweep result for Quick bank: pressing at the start from here lands the opening hit on leg 2.
export const FIRST_HIT_SPAWN = { x: 732, y: 324 };
// Same row, same switch: where the creature stands when the button is pressed.
export const LURES = {
  early: { x: 570, y: 324 },
  hit: { x: 732, y: 324 },
  late: { x: 880, y: 324 },
};

export const PALETTE = {
  floor: 0x0a0f18,
  wall: 0x141c2b,
  strip: 0x8a1f1f,
  surge: 0xf4fbff,
  creature: 0x9bd13a,
  warm: 0xffb14a,
  ink: 0x05070b,
};

export const CFG = {
  stepHz: 60,

  playerSpeed: 220,
  playerRadius: 11,
  creatureStalkSpeed: 130, // closer to playerSpeed = harder
  creatureRadius: 20,

  windup: 1.0, // shorter = harder; 1.0 gives early/hit/late regions of similar size on Quick bank
  lungeSpeed: 520,
  lungeMaxDist: 380,
  recoil: 0.5, // shorter = harder

  surgeSpeed: 650, // faster = harder to read
  surgeHitRadius: 24, // bigger = wider hit band, easier to land and to get hit

  graceSeconds: 1.0, // shorter = harder
  healthPips: 4, // fewer = harder
  shocksToWin: 5, // more = longer fight

  missWindupReduction: 0.08, // per consecutive miss; bigger = harder
  windupFloor: 0.35,
  generatorCooldown: 1.5,
  missCooldownAdd: 0.6, // per consecutive miss
  cooldownMax: 3.5,
  introSeconds: 8, // creature stays put this long unless the first breaker is thrown

  interactRange: 70, // px from a switch; smaller = harder to fire under pressure
  lampFade: 0.3,
  revealSeconds: 0.3,

  darkness: 0.94, // higher = harder to see
  playerLightRadius: 130,
};
