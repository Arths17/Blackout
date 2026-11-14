export const WIDTH = 1152;
export const HEIGHT = 648;

export const palette = {
  void: 0x08070b,
  wall: 0x16141b,
  floor: 0x24232b,
  grout: 0x302d35,
  emergency: 0x8e1835,
  surge: 0xfff4d0,
  creature: 0xb7d34b,
  warm: 0xe7a85a,
} as const;

export const tuning = {
  playerSpeed: 220,
  creatureStalkSpeed: 130,
  windupSeconds: 0.7,
  lungeSpeed: 520,
  lungeMaxDistance: 380,
  surgeSpeed: 650,
  surgeHitRadius: 18,
  playerRadius: 12,
  creatureRadius: 17,
  graceSeconds: 1,
  healthPips: 4,
  shocksToWin: 5,
  missWindupReduction: 0.08,
  minimumWindupSeconds: 0.35,
  recoilSeconds: 0.5,
  generatorCooldownSeconds: 1.5,
} as const;

export const room = {
  left: 76,
  top: 52,
  right: 1076,
  bottom: 596,
} as const;
