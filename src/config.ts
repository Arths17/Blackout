export const W = 1152;
export const H = 648;

export const ROOM = { x: 76, y: 44, w: 1000, h: 560 };
export const EXIT = { x: 960, w: 100 }; // door in the top wall

export const PLAYER_START = { x: 190, y: 560 };
// Sweep result for Quick bank: pressing at the start from here lands the opening hit on leg 2.
export const FIRST_HIT_SPAWN = { x: 732, y: 324 };
// The boss starts at the top-right corner, guarding the exit door.
export const BOSS_START = { x: 1000, y: 112 };
// Same row, same switch: where the creature stands when the button is pressed.
export const LURES = {
  early: { x: 570, y: 324 },
  hit: { x: 732, y: 324 },
  late: { x: 880, y: 324 },
};

// Master art palette. The art script exports tools/palette.json from these values.
// Amber is reserved for working lamps, emergency strips, surges and restored power.
export const PALETTE = {
  ink: 0x080d12,
  n1: 0x101922,
  n2: 0x19252e,
  n3: 0x24323b,
  n4: 0x35454e,
  n5: 0x4d6068,
  n6: 0x71838a,
  n7: 0x9ba9ad,
  g1: 0x121e21,
  g2: 0x263739,
  g3: 0x3d5252,
  g4: 0x617671,
  g5: 0xb0c1b0,
  rust1: 0x1a2029,
  rust2: 0x2c333e,
  rust3: 0x47505b,
  rust4: 0x65727d,
  r1: 0x1d202e,
  r2: 0x383747,
  r3: 0x754d39,
  r4: 0xc28d55,
  r5: 0xe2bd82,
  w: 0xe1e8e3,
  c1: 0xc2d2d5,
  c2: 0x8faeb7,
  c3: 0x527582,
  bone: 0xbac0bd,
  bone2: 0x7b8585,
  warm: 0xd4aa70,
  warm2: 0xf1d8a1,
};

// The game renders at VIEW.w x VIEW.h and is scaled up by a whole number. The sim stays in world units.
export const VIEW = { w: 384, h: 216, s: 3.0 }; // s = world px per screen px

export const DARK = {
  cell: 2, // darkness is painted in flat 2 px cells
  alpha: [0, 0.15, 0.33, 0.56], // tier 0 lit ... tier 3 ambient dark; higher = harder to see
  ambient: 3,
  vignette: [0, 0.03, 0.07, 0.12],
  grainAlpha: 0.035,
  playerR: 60, // light radii in screen px
  playerHalo: 19,
  coneR: 120,
  coneHalf: 0.6,
  coneCos: 0.72,
  stripR: 16,
  lampR: 38,
  surgeR: 64,
  panelR: 30,
};

// One clearly different color per generator: its path on the floor, its number and its panel diagram.
export const PATH_COLORS = [0x3fd2ff, 0xffa530, 0xd774ff];

export const VIS = {
  playerStep: 0.32,
  creatureStep: 0.47,
  hitStop: 0.07, // seconds the sim freezes on a counted shock
  shockShake: { ms: 200, amp: 0.008 },
  bounceShake: { ms: 60, amp: 0.003 },
  hurtShake: { ms: 150, amp: 0.006 },
  trailLen: 70, // screen px of jagged trail behind the surge head
  flashMs: 120, // how long a surge flash keeps the whole room lit
};

export const CFG = {
  stepHz: 60,
  timerEpsilon: 1e-9, // float slack so a 0.35 s timer ends on tick 21, not 22

  playerSpeed: 220,
  playerRadius: 11,
  creatureStalkSpeed: 130, // closer to playerSpeed = harder
  creatureRadius: 20,

  windup: 1.0, // shorter = harder; 1.0 gives early/hit/late regions of similar size on Quick bank
  lungeSpeed: 520,
  lungeMaxDist: 380,
  recoil: 0.5, // shorter = harder
  recoilKnock: 150, // px/s the creature is thrown back along the surge during recoil

  surgeSpeed: 650, // faster = harder to read
  surgeHitRadius: 24, // bigger = wider hit band, easier to land and to get hit

  bounceEvery: 2, // every Nth creature hit on the player sends them bouncing
  bounceSpeed: 520,
  bounceSeconds: 4.0,
  parryWindow: 0.42, // seconds after pressing Shift that a touch from the boss is blocked
  parryCooldown: 0.7, // whiffing costs you this long before the next try
  parryStreakSeconds: 6, // a parry streak lapses if the next one takes longer than this
  parriesForSuper: 2,
  parryPush: 360, // px/s the player is shoved away from what they parried
  parryPushSeconds: 0.18,
  dashSpeed: 520, // a very small hop: dashSpeed * dashSeconds is about 52 px
  dashSeconds: 0.1,
  dashCooldown: 0.9,
  freezeOnFire: false, // set per level: boss 1 stands still while a surge is live
  superSpeed: 640,
  superSeconds: 5,
  superRadius: 34, // reach of the super bounce, against bounce's own playerRadius
  superShocks: 3, // shocks a super bounce deals to the boss
  bounceHitGrace: 1.0, // immunity after a bounce hits the creature, so the player can get away

  graceSeconds: 1.0, // shorter = harder
  healthPips: 4, // fewer = harder
  shocksToWin: 5, // more = longer fight

  missWindupReduction: 0.08, // per consecutive miss; bigger = harder
  windupFloor: 0.35,
  generatorCooldown: 1.5,
  missCooldownAdd: 0.6, // per consecutive miss
  cooldownMax: 3.5,
  introSeconds: 8, // creature stays put this long unless the first breaker is thrown

  autoLungeEvery: 0, // set per level
  bossShotEvery: 0,
  bossShotCount: 0,
  bossShotSpeed: 0,
  bossShotBounces: 4,
  bossShotSpread: 0.3, // radians between shots in a fan
  enrage: 1,
  interactRange: 70, // px from a switch; smaller = harder to fire under pressure
  lampFade: 0.3,
  revealSeconds: 0.3,

};

// Boss fight difficulty per level. Stalk stays under playerSpeed so there is always a gap to open.
// lungeEvery / shotEvery are seconds between the boss's own attacks (0 = never); enrage speeds the
// boss up once it is down to its last 40% of health.
export const BOSS_LEVELS = [
  { name: 'THE HOLLOW TREE', stalk: 130, windup: 1.0, lunge: 520, lungeMax: 380, recoil: 0.5, shocks: 5, radius: 20, lungeEvery: 0, shotEvery: 0, shots: 0, shotSpeed: 0, enrage: 1, freeze: true },
  { name: 'THE GNARLED DEEP', stalk: 140, windup: 0.92, lunge: 560, lungeMax: 410, recoil: 0.46, shocks: 5, radius: 21, lungeEvery: 9, shotEvery: 0, shots: 0, shotSpeed: 0, enrage: 1, freeze: false },
  { name: 'THE ROTTING GROVE', stalk: 150, windup: 0.84, lunge: 610, lungeMax: 430, recoil: 0.42, shocks: 6, radius: 23, lungeEvery: 7.5, shotEvery: 9.5, shots: 1, shotSpeed: 350, enrage: 1.05, freeze: false },
  { name: 'THE STRANGLING ROOTS', stalk: 158, windup: 0.78, lunge: 650, lungeMax: 455, recoil: 0.38, shocks: 6, radius: 25, lungeEvery: 6.5, shotEvery: 8.5, shots: 2, shotSpeed: 390, enrage: 1.08, freeze: false },
  { name: 'THE ELDER CANOPY', stalk: 174, windup: 0.64, lunge: 760, lungeMax: 520, recoil: 0.3, shocks: 8, radius: 28, lungeEvery: 4.2, shotEvery: 5.5, shots: 3, shotSpeed: 460, enrage: 1.15, freeze: false },
];

export function applyBossLevel(i: number): void {
  const b = BOSS_LEVELS[Math.max(0, Math.min(BOSS_LEVELS.length - 1, i))];
  CFG.creatureStalkSpeed = b.stalk;
  CFG.windup = b.windup;
  CFG.lungeSpeed = b.lunge;
  CFG.lungeMaxDist = b.lungeMax;
  CFG.recoil = b.recoil;
  CFG.shocksToWin = b.shocks;
  CFG.creatureRadius = b.radius;
  CFG.autoLungeEvery = b.lungeEvery;
  CFG.bossShotEvery = b.shotEvery;
  CFG.bossShotCount = b.shots;
  CFG.bossShotSpeed = b.shotSpeed;
  CFG.enrage = b.enrage;
  CFG.freezeOnFire = b.freeze;
}

// Coins from a chest depend on how fast the boss fell. At or under `fast` seconds is the maximum,
// at `fast * slowMul` or longer is the minimum, and it falls off in a straight line between.
export const COINS = {
  max: 100,
  min: 10,
  fast: [30, 40, 55, 65, 80],
  slowMul: 4,
};
