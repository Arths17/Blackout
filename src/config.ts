export const W = 1152;
export const H = 648;

export const ROOM = { x: 76, y: 44, w: 1000, h: 560 };
export const EXIT = { x: 960, w: 100 }; // door in the top wall

export const PLAYER_START = { x: 190, y: 560 };
// Sweep result for Quick bank: pressing at the start from here lands the opening hit on leg 2.
export const FIRST_HIT_SPAWN = { x: 732, y: 324 };
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
export const VIEW = { w: 320, h: 180, s: 3.6 }; // s = world px per screen px

export const DARK = {
  cell: 2, // darkness is painted in flat 2 px cells
  alpha: [0, 0.2, 0.42, 0.7], // tier 0 lit ... tier 3 ambient dark; higher = harder to see
  ambient: 3,
  vignette: [0, 0.04, 0.09, 0.16],
  grainAlpha: 0.035,
  playerR: 52, // light radii in screen px
  playerHalo: 17,
  coneR: 104,
  coneHalf: 0.6,
  coneCos: 0.72,
  stripR: 14,
  lampR: 34,
  surgeR: 58,
  panelR: 26,
};

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

};
