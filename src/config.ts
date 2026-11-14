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

// Master palette, mirrored from tools/palette.json (tools/check_palette.py compares them).
// Reds are the emergency strips and breaker lamps, cold white-blue is the surge; warm and warm2 only appear at the win.
export const PALETTE = {
  ink: 0x080b10,
  n1: 0x10161f,
  n2: 0x171f2c,
  n3: 0x202b3b,
  n4: 0x2e3b50,
  n5: 0x43526b,
  n6: 0x5f708b,
  n7: 0x8394ad,
  g1: 0x0f1a13,
  g2: 0x1b2e20,
  g3: 0x2b432c,
  g4: 0x4c7340,
  g5: 0xa6dc3c,
  rust1: 0x241410,
  rust2: 0x3d2217,
  rust3: 0x5e3520,
  rust4: 0x83502c,
  r1: 0x2c0c0d,
  r2: 0x561513,
  r3: 0x8c2620,
  r4: 0xd0402e,
  r5: 0xf08a6a,
  w: 0xeaf3ff,
  c1: 0xb8d4ff,
  c2: 0x6f9be0,
  c3: 0x3c5f9e,
  bone: 0xb4ab92,
  bone2: 0x7d7662,
  warm: 0xffb14a,
  warm2: 0xffd98a,
};

// The game renders at VIEW.w x VIEW.h and is scaled up by a whole number. The sim stays in world units.
export const VIEW = { w: 320, h: 180, s: 3.6 }; // s = world px per screen px (1152 / 320)

export const DARK = {
  cell: 2, // darkness is painted in flat 2 px cells
  alpha: [0, 0.14, 0.36, 0.76], // tier 0 lit ... tier 3 ambient dark; higher = harder to see
  ambient: 3,
  playerR: 12, // small glow around the player; the flashlight cone does the real work
  coneR: 104, // flashlight length in screen px
  coneHalf: 0.6, // flashlight half-angle in radians
  stripR: 14,
  lampR: 34,
  surgeR: 58,
  panelR: 26,
};

export const VIS = {
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
