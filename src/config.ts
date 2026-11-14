export const W = 1152;
export const H = 648;

export const ROOM = { x: 76, y: 44, w: 1000, h: 560 };

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

  windup: 0.7, // shorter = harder
  lungeSpeed: 520,
  lungeMaxDist: 380,
  recoil: 0.5, // shorter = harder

  surgeSpeed: 650, // faster = harder to read
  surgeHitRadius: 18,

  graceSeconds: 1.0, // shorter = harder
  healthPips: 4, // fewer = harder
  shocksToWin: 5, // more = longer fight

  missWindupReduction: 0.08,
  windupFloor: 0.35,
  generatorCooldown: 1.5,
  missCooldownAdd: 0.6,

  darkness: 0.94, // higher = harder to see
  playerLightRadius: 130,
};
