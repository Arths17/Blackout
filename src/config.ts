// World units: the room is laid out on a 1152 x 648 field and drawn at a third of that (see VIEW).
export const ROOM = { x: 76, y: 44, w: 1000, h: 560 };
export const EXIT = { x: 960, w: 100 }; // door in the top wall

export const PLAYER_START = { x: 190, y: 560 };
// The creature starts in the top-right corner, in front of the exit.
export const BOSS_START = { x: 1000, y: 112 };
// Three creature positions on one row that give three outcomes for breaker 1 (too early, hit, too late).
// Used by the outcome test and the ?lure= dev flag.
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
  grainAlpha: 0.02,
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

// One color and one dash length per breaker: its line on the floor, its number and its panel diagram.
// Cold blue, lamp amber and moss green, all pulled from the room's own palette so nothing reads as neon.
export const PATH_COLORS = [0x8fc3d6, 0xe2a04f, 0xa9c47c];
export const PATH_DASH = [5, 9, 3];

// Presentation timing. None of this changes the rules.
export const VIS = {
  playerStep: 0.32, // seconds between footstep sounds
  creatureStep: 0.47,
  hitStop: 0.07, // seconds the sim freezes on a counted shock
  hurtStop: 0.05, // shorter freeze when the player is hurt
  shockShake: { ms: 220, amp: 0.009 },
  bounceShake: { ms: 70, amp: 0.003 },
  hurtShake: { ms: 160, amp: 0.007 },
  lungeShake: { ms: 90, amp: 0.004 },
  superShake: { ms: 380, amp: 0.014 },
  trailLen: 70, // screen px of jagged trail behind the surge head
  flashMs: 120, // how long a surge flash keeps the whole room lit
  sparkMax: 160, // spark pool size
  sparkLights: 6, // only the newest few sparks light the floor
  cardSeconds: 3.8, // how long the room name card stays up
  heartNear: 450, // px: the heartbeat starts once the creature is closer than this
};

export const CFG = {
  stepHz: 60,
  timerEpsilon: 1e-9, // float slack so a 0.35 s timer ends on tick 21, not 22

  // Player
  playerSpeed: 220, // px/s
  playerRadius: 11,
  healthPips: 5, // fewer = harder
  graceSeconds: 1.0, // no damage for this long after a hit; shorter = harder
  interactRange: 70, // px from a breaker panel for E / Space to throw it
  dashSpeed: 520, // a very small hop: dashSpeed * dashSeconds is about 52 px
  dashSeconds: 0.1,
  dashCooldown: 0.9,

  // Creature. The per-room values in ROOMS overwrite the ones marked "per room".
  creatureStalkSpeed: 120, // per room; must stay under playerSpeed
  creatureRadius: 20, // per room; contact range against the player
  creatureHitBonus: 14, // extra reach for surges and bounces only, so it is easier to shock than to be touched by
  windup: 1.6, // per room; seconds it stands still after a breaker is thrown, before the lunge
  lungeSpeed: 520, // per room
  lungeMaxDist: 380, // per room
  recoil: 0.5, // per room; seconds it is stunned after a shock
  recoilKnock: 150, // px/s it is pushed along the surge while stunned
  shocksToWin: 5, // per room
  autoLungeEvery: 0, // per room; seconds between lunges it starts by itself, 0 = never
  autoLungeWindup: 0.95, // its own lunges wind up slightly quicker than a breaker reaction
  seedEvery: 0, // per room; seconds between seed volleys, 0 = never
  seedCount: 0, // per room
  seedSpeed: 0, // per room
  seedBounces: 4, // wall hits before a seed dies
  seedSpread: 0.3, // radians between seeds in a volley
  seedRadius: 11,
  enrage: 1, // per room; speed multiplier once it is nearly dead
  enrageAt: 0.6, // share of its health that has to be gone first
  introSeconds: 8, // a creature created asleep wakes after this long (tests and the ?lure flag only)

  // Surge
  surgeSpeed: 650, // px/s along the route; faster = harder to read
  surgeHitRadius: 24, // half-width of the live lane, for the creature and for you
  generatorCooldown: 1.5, // seconds with no power after a surge ends
  lampFade: 0.3, // seconds a lamp stays lit after the surge passes it
  revealSeconds: 0.3, // seconds the creature shows through the dark after a lamp or bounce

  // Miss penalty, per miss in a row. A hit clears it.
  missWindupReduction: 0.08, // seconds off the next windup
  windupFloor: 0.35,
  missCooldownAdd: 0.6, // seconds added to the power coming back
  cooldownMax: 3.5,
  missSpeedUp: 0.04, // share added to the stalk speed
  missSpeedUpMax: 0.12,

  // Getting hit and hitting back
  bounceEvery: 2, // every Nth touch from the creature throws the player into a ricochet
  bounceSpeed: 520,
  bounceSeconds: 2.6, // how long the ricochet lasts if it hits nothing
  bounceHitGrace: 1.0, // no damage for this long after a bounce lands, so the player can get away
  parryWindow: 0.34, // seconds after pressing parry that a touch is blocked
  parryCooldown: 0.9, // from the press; a whiff leaves you open for the difference
  parryGrace: 0.35, // no damage for this long after a parry
  parryStreakSeconds: 6, // the second parry has to come within this long
  parriesForSuper: 2,
  parryPush: 360, // px/s the player is shoved away from what they parried
  parryPushSeconds: 0.18,
  superSpeed: 640,
  superSeconds: 4,
  superRadius: 34,
  superShocks: 2, // shocks a super bounce deals
};

// One row per room. Stalk speed stays under playerSpeed so there is always a gap to open.
// windup is the time the creature stands still after a breaker is thrown: 1.6 s lets a surge
// cover a whole short route, so in room 1 a creature standing on a line is as good as hit.
export const ROOMS = [
  { name: 'THE HOLLOW TREE', stalk: 120, windup: 1.6, lunge: 500, lungeMax: 360, recoil: 0.6, shocks: 5, radius: 20, lungeEvery: 0, seedEvery: 0, seeds: 0, seedSpeed: 0, enrage: 1 },
  { name: 'THE GNARLED DEEP', stalk: 135, windup: 1.3, lunge: 540, lungeMax: 400, recoil: 0.5, shocks: 5, radius: 21, lungeEvery: 9, seedEvery: 0, seeds: 0, seedSpeed: 0, enrage: 1 },
  { name: 'THE ROTTING GROVE', stalk: 146, windup: 1.15, lunge: 590, lungeMax: 420, recoil: 0.45, shocks: 6, radius: 23, lungeEvery: 7.5, seedEvery: 9.5, seeds: 1, seedSpeed: 340, enrage: 1.05 },
  { name: 'THE STRANGLING ROOTS', stalk: 152, windup: 1.0, lunge: 620, lungeMax: 440, recoil: 0.4, shocks: 6, radius: 24, lungeEvery: 7, seedEvery: 9, seeds: 2, seedSpeed: 370, enrage: 1.05 },
  { name: 'THE ELDER CANOPY', stalk: 164, windup: 0.85, lunge: 690, lungeMax: 480, recoil: 0.34, shocks: 7, radius: 26, lungeEvery: 5.5, seedEvery: 7, seeds: 3, seedSpeed: 410, enrage: 1.1 },
];

export function applyRoom(i: number): void {
  const r = ROOMS[Math.max(0, Math.min(ROOMS.length - 1, i))];
  CFG.creatureStalkSpeed = r.stalk;
  CFG.windup = r.windup;
  CFG.lungeSpeed = r.lunge;
  CFG.lungeMaxDist = r.lungeMax;
  CFG.recoil = r.recoil;
  CFG.shocksToWin = r.shocks;
  CFG.creatureRadius = r.radius;
  CFG.autoLungeEvery = r.lungeEvery;
  CFG.seedEvery = r.seedEvery;
  CFG.seedCount = r.seeds;
  CFG.seedSpeed = r.seedSpeed;
  CFG.enrage = r.enrage;
}

// Coins from a chest depend on how fast the boss fell. At or under `fast` seconds is the maximum,
// at `fast * slowMul` or longer is the minimum, and it falls off in a straight line between.
export const COINS = {
  max: 100,
  min: 10,
  fast: [30, 40, 55, 65, 80],
  slowMul: 4,
};
