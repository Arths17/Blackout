const WIDTH = 1152;
const HEIGHT = 648;
const PLAYER_SPEED = 220;
const SURGE_SPEED = 650;
const PLAYER_RADIUS = 16;
const ROOM_TOP = 90;
const BOSS_TOUCH_RADIUS = 82;
const bossSprite = new Image();
bossSprite.src = "/tree-root-monster.png";
const roomBackground = new Image();
roomBackground.src = "/background-fight.png";
const heroSprites: Record<string, HTMLImageElement> = {};
for (const direction of ["up", "down", "left", "right"]) {
  const sprite = new Image();
  sprite.src = `/hero/walk_${direction}.png`;
  heroSprites[direction] = sprite;
}

type Vec = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

const obstacles: Rect[] = [
  { x: 110, y: 150, width: 130, height: 62 },
  { x: 570, y: 115, width: 130, height: 62 },
  { x: 120, y: 500, width: 130, height: 62 },
  { x: 1010, y: 470, width: 130, height: 62 },
  { x: 980, y: 220, width: 130, height: 62 },
  { x: 330, y: 530, width: 130, height: 62 },
  { x: 760, y: 500, width: 130, height: 62 },
];
const pits: Vec[] = [
  { x: 420, y: 220 },
  { x: 600, y: 520 },
  { x: 770, y: 170 },
  { x: 930, y: 500 },
];

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const subtract = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a: Vec, amount: number): Vec => ({ x: a.x * amount, y: a.y * amount });
const vectorLength = (a: Vec): number => Math.hypot(a.x, a.y);
const distance = (a: Vec, b: Vec): number => vectorLength(subtract(a, b));
const normalize = (a: Vec): Vec => {
  const magnitude = vectorLength(a);
  return magnitude > 0.001 ? scale(a, 1 / magnitude) : { x: 0, y: 0 };
};
const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

function segmentDistance(point: Vec, start: Vec, end: Vec): number {
  const segment = subtract(end, start);
  const denominator = segment.x * segment.x + segment.y * segment.y;
  if (denominator === 0) return distance(point, start);
  const amount = clamp(
    ((point.x - start.x) * segment.x + (point.y - start.y) * segment.y) / denominator,
    0,
    1,
  );
  return distance(point, add(start, scale(segment, amount)));
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

function playerHitsObstacle(position: Vec): boolean {
  const playerRect: Rect = {
    x: position.x - PLAYER_RADIUS,
    y: position.y - PLAYER_RADIUS,
    width: PLAYER_RADIUS * 2,
    height: PLAYER_RADIUS * 2,
  };
  return obstacles.some((obstacle) => overlaps(playerRect, obstacle));
}

function lineIntersectsRect(start: Vec, end: Vec, rect: Rect): boolean {
  const expanded = {
    x: rect.x - 9,
    y: rect.y - 9,
    width: rect.width + 18,
    height: rect.height + 18,
  };
  const steps = Math.ceil(distance(start, end) / 8);
  for (let index = 0; index <= steps; index += 1) {
    const point = {
      x: start.x + (end.x - start.x) * (index / Math.max(steps, 1)),
      y: start.y + (end.y - start.y) * (index / Math.max(steps, 1)),
    };
    if (point.x >= expanded.x && point.x <= expanded.x + expanded.width &&
        point.y >= expanded.y && point.y <= expanded.y + expanded.height) {
      return true;
    }
  }
  return false;
}

function obstacleBlocksWave(origin: Vec, player: Vec): boolean {
  return obstacles.some((obstacle) =>
    !(
      player.x >= obstacle.x && player.x <= obstacle.x + obstacle.width &&
      player.y >= obstacle.y && player.y <= obstacle.y + obstacle.height
    ) && lineIntersectsRect(origin, player, obstacle));
}

type Surge = {
  direction: Vec;
  origin: Vec;
  distance: number;
  length: number;
  creatureHit: boolean;
};

type Shockwave = {
  origin: Vec;
  radius: number;
  speed: number;
  maxRadius: number;
  playerHit: boolean;
};

type Boss = {
  position: Vec;
  direction: Vec;
  state: "STALK" | "WINDUP" | "LUNGE" | "RECOIL";
  stateTimer: number;
  pulse: number;
  health: number;
  validHits: number;
  lastScoringDirection: number;
};

type Game = {
  player: Vec;
  playerVelocity: Vec;
  targetVelocity: Vec;
  bounceDirection: Vec;
  boss: Boss;
  cooldown: number[];
  misses: number[];
  health: number;
  invulnerable: number;
  elapsed: number;
  flash: number;
  message: string;
  messageTimer: number;
  surge: Surge | null;
  shockwave: Shockwave | null;
  won: boolean;
  dead: boolean;
};

const newGame = (): Game => ({
  player: { x: 260, y: 360 },
  playerVelocity: scale(normalize({ x: 190, y: 145 }), PLAYER_SPEED),
  targetVelocity: scale(normalize({ x: 190, y: 145 }), PLAYER_SPEED),
  bounceDirection: { x: 0, y: 0 },
  boss: {
    position: { x: 820, y: 350 },
    direction: { x: 0, y: 0 },
    state: "STALK",
    stateTimer: 0,
    pulse: 0,
    health: 5,
    validHits: 0,
    lastScoringDirection: -1,
  },
  cooldown: [0, 0, 0, 0],
  misses: [0, 0, 0, 0],
  health: 4,
  invulnerable: 0,
  elapsed: 0,
  flash: 0,
  message: "FIND THE ANGLE. BOUNCE IT BACK.",
  messageTimer: 2,
  surge: null,
  shockwave: null,
  won: false,
  dead: false,
});

function setMessage(game: Game, message: string, seconds = 2): void {
  game.message = message;
  game.messageTimer = seconds;
}

function damagePlayer(game: Game, reason: string): void {
  if (game.invulnerable > 0 || game.dead) return;
  game.health -= 1;
  game.invulnerable = 1;
  game.flash = 0.25;
  setMessage(game, reason, 1.3);
  if (game.health <= 0) {
    game.dead = true;
    setMessage(game, "THE ROOM HAS CLAIMED YOU. PRESS R.", 999);
  }
}

function applyWallBounce(game: Game): void {
  const requested = game.bounceDirection;
  if (vectorLength(requested) === 0) return;
  if (game.player.x <= 32) {
    const direction = requested.x < 0 ? { x: 1, y: requested.y } : requested;
    game.targetVelocity = scale(normalize(direction), PLAYER_SPEED);
  } else if (game.player.x >= WIDTH - 32) {
    const direction = requested.x > 0 ? { x: -1, y: requested.y } : requested;
    game.targetVelocity = scale(normalize(direction), PLAYER_SPEED);
  }
  if (game.player.y <= ROOM_TOP) {
    const direction = requested.y < 0 ? { x: requested.x, y: 1 } : requested;
    game.targetVelocity = scale(normalize(direction), PLAYER_SPEED);
  } else if (game.player.y >= HEIGHT - 32) {
    const direction = requested.y > 0 ? { x: requested.x, y: -1 } : requested;
    game.targetVelocity = scale(normalize(direction), PLAYER_SPEED);
  }
}

function activateShock(game: Game, directionIndex: number): void {
  if (game.dead || game.won || game.surge || game.boss.state !== "STALK") return;
  if (game.cooldown[directionIndex] > 0) {
    setMessage(game, "RELAY RECHARGING.", 0.8);
    return;
  }
  const directions: Vec[] = [
    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
  ];
  const direction = directions[directionIndex];
  const wallDistance = direction.x < 0 ? game.player.x - 32 :
    direction.x > 0 ? WIDTH - 32 - game.player.x :
    direction.y < 0 ? game.player.y - ROOM_TOP : HEIGHT - 32 - game.player.y;
  game.surge = {
    direction,
    origin: { ...game.player },
    distance: 0,
    length: wallDistance,
    creatureHit: false,
  };
  game.boss.state = "WINDUP";
  game.boss.stateTimer = Math.max(0.35, 0.7 - game.misses[directionIndex] * 0.08);
  game.flash = 0.12;
  setMessage(game, `SHOCK ${["LEFT", "RIGHT", "UP", "DOWN"][directionIndex]} // HOLD YOUR NERVE.`, 1);
}

function updateGame(game: Game, dt: number, keys: Set<string>): void {
  game.elapsed += dt;
  game.flash = Math.max(0, game.flash - dt);
  game.invulnerable = Math.max(0, game.invulnerable - dt);
  game.messageTimer = Math.max(0, game.messageTimer - dt);
  game.cooldown = game.cooldown.map((value) => Math.max(0, value - dt));
  if (game.dead || game.won) return;

  const movement = {
    x: Number(keys.has("d") || keys.has("arrowright")) -
      Number(keys.has("a") || keys.has("arrowleft")),
    y: Number(keys.has("s") || keys.has("arrowdown")) -
      Number(keys.has("w") || keys.has("arrowup")),
  };
  if (vectorLength(movement) > 0) game.bounceDirection = normalize(movement);
  applyWallBounce(game);
  const smoothing = 1 - Math.exp(-dt * 12);
  game.playerVelocity = add(game.playerVelocity,
    scale(subtract(game.targetVelocity, game.playerVelocity), smoothing));
  const atLeft = game.player.x <= 32 && game.playerVelocity.x < 0;
  const atRight = game.player.x >= WIDTH - 32 && game.playerVelocity.x > 0;
  const atTop = game.player.y <= ROOM_TOP && game.playerVelocity.y < 0;
  const atBottom = game.player.y >= HEIGHT - 32 && game.playerVelocity.y > 0;
  const nextX = { x: game.player.x + game.playerVelocity.x * dt, y: game.player.y };
  if (playerHitsObstacle(nextX)) {
    if (vectorLength(game.bounceDirection) > 0 &&
        !((atLeft && game.bounceDirection.x < 0) || (atRight && game.bounceDirection.x > 0))) {
      game.targetVelocity = scale(game.bounceDirection, PLAYER_SPEED);
    } else {
      game.playerVelocity.x *= -1;
      game.targetVelocity = { ...game.playerVelocity };
    }
  } else game.player.x = nextX.x;
  const nextY = { x: game.player.x, y: game.player.y + game.playerVelocity.y * dt };
  if (playerHitsObstacle(nextY)) {
    if (vectorLength(game.bounceDirection) > 0 &&
        !((atTop && game.bounceDirection.y < 0) || (atBottom && game.bounceDirection.y > 0))) {
      game.targetVelocity = scale(game.bounceDirection, PLAYER_SPEED);
    } else {
      game.playerVelocity.y *= -1;
      game.targetVelocity = { ...game.playerVelocity };
    }
  } else game.player.y = nextY.y;
  if (game.player.x < 32 || game.player.x > WIDTH - 32) {
    game.player.x = clamp(game.player.x, 32, WIDTH - 32);
    if (vectorLength(game.bounceDirection) > 0 &&
        !((atLeft && game.bounceDirection.x < 0) || (atRight && game.bounceDirection.x > 0))) {
      game.targetVelocity = scale(game.bounceDirection, PLAYER_SPEED);
    } else {
      game.playerVelocity.x *= -1;
      game.targetVelocity = { ...game.playerVelocity };
    }
  }
  if (game.player.y < ROOM_TOP || game.player.y > HEIGHT - 32) {
    game.player.y = clamp(game.player.y, ROOM_TOP, HEIGHT - 32);
    if (vectorLength(game.bounceDirection) > 0 &&
        !((atTop && game.bounceDirection.y < 0) || (atBottom && game.bounceDirection.y > 0))) {
      game.targetVelocity = scale(game.bounceDirection, PLAYER_SPEED);
    } else {
      game.playerVelocity.y *= -1;
      game.targetVelocity = { ...game.playerVelocity };
    }
  }

  if (game.boss.validHits >= 5 && distance(game.player, { x: 990, y: 210 }) < 120) {
    game.won = true;
    setMessage(game, "THE ELEVATOR AWAKES. YOU ESCAPED.", 999);
    return;
  }

  game.boss.pulse += dt;
  if (game.boss.state === "STALK") {
    game.boss.position = add(game.boss.position, scale(normalize(subtract(game.player, game.boss.position)), 105 * dt));
    game.boss.position.x = clamp(game.boss.position.x, 90, WIDTH - 90);
    game.boss.position.y = clamp(game.boss.position.y, 125, HEIGHT - 60);
  } else if (game.boss.state === "WINDUP") {
    game.boss.stateTimer -= dt;
    if (game.boss.stateTimer <= 0) {
      game.boss.state = "LUNGE";
      game.boss.stateTimer = 0.8;
      game.boss.direction = normalize(subtract(game.player, game.boss.position));
    }
  } else if (game.boss.state === "LUNGE") {
    game.boss.position = add(game.boss.position, scale(game.boss.direction, 520 * dt));
    game.boss.stateTimer -= dt;
    if (game.boss.stateTimer <= 0) game.boss.state = "STALK";
  } else {
    game.boss.stateTimer -= dt;
    if (game.boss.stateTimer <= 0) game.boss.state = "STALK";
  }
  if (distance(game.boss.position, game.player) < BOSS_TOUCH_RADIUS) {
    damagePlayer(game, "THE ROOTED HORROR TOUCHES YOU. -1 HEALTH");
  }

  if (pits.some((pit) => distance(game.player, pit) < 43)) {
    damagePlayer(game, "YOU FELL INTO A PIT.");
  }

  if (game.surge) {
    const surge = game.surge;
    const oldDistance = surge.distance;
    surge.distance += SURGE_SPEED * dt;
    const oldBolt = add(surge.origin, scale(surge.direction, Math.min(oldDistance, surge.length)));
    const newBolt = add(surge.origin, scale(surge.direction, Math.min(surge.distance, surge.length)));
    const directionIndex = surge.direction.x < 0 ? 0 : surge.direction.x > 0 ? 1 :
      surge.direction.y < 0 ? 2 : 3;
    if (!surge.creatureHit && segmentDistance(game.boss.position, oldBolt, newBolt) < 52) {
      surge.creatureHit = true;
      game.boss.state = "RECOIL";
      game.boss.stateTimer = 0.5;
      game.boss.position = subtract(game.boss.position, scale(game.boss.direction, 25));
      if (game.boss.lastScoringDirection !== directionIndex) {
        game.boss.validHits += 1;
        game.boss.health = Math.max(0, game.boss.health - 1);
        game.boss.lastScoringDirection = directionIndex;
        setMessage(game, `VALID BOUNCE // ${game.boss.validHits}/5`, 1.5);
      } else {
        setMessage(game, "RECOIL // USE A DIFFERENT DIRECTION.", 1.2);
      }
      game.flash = 0.45;
      game.shockwave = { origin: { ...game.boss.position }, radius: 0, speed: 430, maxRadius: 760, playerHit: false };
    }
    if (surge.distance >= surge.length) {
      if (surge.creatureHit) game.cooldown[directionIndex] = 1.5;
      else {
        game.misses[directionIndex] += 1;
        game.cooldown[directionIndex] = 1.5 + game.misses[directionIndex] * 0.6;
        setMessage(game, "MISS // THE ROOM GROWS QUIETER.", 1.2);
      }
      game.surge = null;
    }
  }

  if (game.shockwave) {
    const wave = game.shockwave;
    const previousRadius = wave.radius;
    wave.radius += wave.speed * dt;
    const playerDistance = distance(wave.origin, game.player);
    if (!wave.playerHit && previousRadius - 24 <= playerDistance && playerDistance <= wave.radius + 24) {
      wave.playerHit = true;
      if (obstacleBlocksWave(wave.origin, game.player)) {
        setMessage(game, "MACHINERY BLOCKS THE SHOCKWAVE.", 0.8);
      } else {
        damagePlayer(game, "THE BOSS SHOCKWAVE HITS.");
      }
    }
    if (wave.radius >= wave.maxRadius) game.shockwave = null;
  }
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
              color: string, size = 14): void {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px Consolas, monospace`;
  ctx.fillText(value, x, y);
}

function drawBoss(ctx: CanvasRenderingContext2D, game: Game): void {
  const boss = game.boss.position;
  if (bossSprite.complete && bossSprite.naturalWidth > 0) {
    const frame = Math.floor(game.boss.pulse * 8) % 6;
    const row = game.boss.state === "LUNGE" ? 3 :
      game.boss.state === "WINDUP" ? 2 :
      game.boss.state === "RECOIL" ? 1 : 0;
    ctx.save();
    ctx.filter = game.flash > 0 || game.surge !== null
      ? "brightness(0.9) contrast(1.35)"
      : "brightness(0.52) contrast(1.3) saturate(0.8)";
    ctx.drawImage(bossSprite, frame * 256, row * 256, 256, 256,
      boss.x - 100, boss.y - 100, 200, 200);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#351821";
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, 58, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx: CanvasRenderingContext2D, game: Game): void {
  const horizontal = Math.abs(game.playerVelocity.x) > Math.abs(game.playerVelocity.y);
  const direction = horizontal
    ? (game.playerVelocity.x < 0 ? "left" : "right")
    : (game.playerVelocity.y < 0 ? "up" : "down");
  const sprite = heroSprites[direction];
  if (sprite.complete && sprite.naturalWidth > 0) {
    const frame = Math.floor(game.elapsed * 10) % 8;
    ctx.save();
    ctx.filter = game.invulnerable > 0 ? "brightness(1.7)" : "brightness(0.8)";
    ctx.drawImage(sprite, frame * 32, 0, 32, 48,
      game.player.x - 32, game.player.y - 80, 64, 96);
    ctx.restore();
    return;
  }
  ctx.fillStyle = "#09090e";
  ctx.beginPath();
  ctx.arc(game.player.x, game.player.y + 8, 15, 0, Math.PI * 2);
  ctx.fill();
}

function drawElectricBolt(ctx: CanvasRenderingContext2D, game: Game): void {
  const surge = game.surge;
  if (!surge) return;
  const endDistance = Math.min(surge.distance, surge.length);
  const startDistance = Math.max(0, endDistance - 230);
  const perpendicular = { x: -surge.direction.y, y: surge.direction.x };
  const pointAt = (distanceAlong: number, phase: number): Vec => {
    const base = add(surge.origin, scale(surge.direction, distanceAlong));
    const amount = Math.sin(distanceAlong * 0.11 + game.elapsed * 24 + phase) *
      Math.min(13, distanceAlong / 10);
    return add(base, scale(perpendicular, amount));
  };
  const drawPath = (color: string, width: number, alpha: number, phase: number): void => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    const steps = Math.max(2, Math.ceil((endDistance - startDistance) / 18));
    for (let index = 0; index <= steps; index += 1) {
      const point = pointAt(startDistance + (endDistance - startDistance) * index / steps, phase);
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
    ctx.restore();
  };
  drawPath("#7ff3df", 26, 0.13, 0);
  drawPath("#9effe8", 13, 0.3, 1.4);
  drawPath("#f4fff0", 4, 1, 2.8);

  const head = pointAt(endDistance, 2.8);
  const pulse = 14 + Math.sin(game.elapsed * 30) * 4;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#b8ffe8";
  ctx.beginPath();
  ctx.arc(head.x, head.y, pulse * 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#ffffef";
  ctx.beginPath();
  ctx.arc(head.x, head.y, pulse * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#dbfff0";
  ctx.lineWidth = 2;
  for (let index = 0; index < 6; index += 1) {
    const angle = game.elapsed * 8 + index * Math.PI / 3;
    const length = 12 + (index % 2) * 8;
    ctx.beginPath();
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(head.x + Math.cos(angle) * length, head.y + Math.sin(angle) * length);
    ctx.stroke();
  }
}

function draw(game: Game, ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#010103";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (roomBackground.complete && roomBackground.naturalWidth > 0) {
    ctx.save();
    ctx.filter = "brightness(0.38) contrast(1.25) saturate(0.75)";
    ctx.drawImage(roomBackground, 0, 0, roomBackground.naturalWidth,
      roomBackground.naturalHeight, 0, 0, WIDTH, HEIGHT);
    ctx.restore();
  } else {
    for (let x = 0; x < WIDTH; x += 64) {
      for (let y = ROOM_TOP; y < HEIGHT; y += 64) {
        const variation = ((x / 64) * 13 + (y / 64) * 7) % 8;
        ctx.fillStyle = `rgb(${5 + variation},${5 + Math.floor(variation / 2)},${7 + variation})`;
        ctx.fillRect(x, y, 62, 62);
        ctx.strokeStyle = "#020204";
        ctx.strokeRect(x, y, 62, 62);
      }
    }
  }
  for (const obstacle of obstacles) {
    ctx.fillStyle = "#101014";
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.strokeStyle = "#321b22";
    ctx.lineWidth = 3;
    ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.fillStyle = "#701421";
    ctx.fillRect(obstacle.x + 20, obstacle.y + 32, 12, 8);
    ctx.fillStyle = "#260b12";
    ctx.fillRect(obstacle.x + 50, obstacle.y + 32, 12, 8);
  }
  for (const pit of pits) {
    ctx.fillStyle = "#470b18";
    ctx.beginPath();
    ctx.arc(pit.x, pit.y, 43, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#010103";
    ctx.beginPath();
    ctx.arc(pit.x, pit.y, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b52b38";
    ctx.lineWidth = 3;
    for (let index = 0; index < 5; index += 1) {
      ctx.beginPath();
      ctx.moveTo(pit.x - 26 + index * 13, pit.y + 20);
      ctx.lineTo(pit.x - 19 + index * 13, pit.y - 20);
      ctx.stroke();
    }
  }
  ctx.fillStyle = game.boss.health > 0 ? "#11171a" : "#244333";
  ctx.fillRect(900, 100, 190, 230);
  ctx.strokeStyle = "#5b3b40";
  ctx.lineWidth = 7;
  ctx.strokeRect(900, 100, 190, 230);
  ctx.fillStyle = game.boss.health === 0 ? "#6ec58a" : "#8e1c2b";
  ctx.fillRect(1098, 172, 18, 45);

  drawElectricBolt(ctx, game);
  if (game.shockwave) {
    ctx.strokeStyle = "#b12a43";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(game.shockwave.origin.x, game.shockwave.origin.y, game.shockwave.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "#672037";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(game.shockwave.origin.x, game.shockwave.origin.y, game.shockwave.radius + 9, 0, Math.PI * 2); ctx.stroke();
  }

  drawBoss(ctx, game);

  if (!(game.invulnerable > 0 && Math.floor(game.elapsed * 16) % 2 === 0)) {
    drawPlayer(ctx, game);
  }

  ctx.fillStyle = "#08080c";
  ctx.fillRect(0, 0, WIDTH, 72);
  text(ctx, "BLACKOUT // ROOT-TREE CONTAINMENT", 24, 24, "#a94a5b", 17);
  text(ctx, "HEALTH", 24, 52, "#7f6f79", 12);
  for (let index = 0; index < 4; index += 1) {
    ctx.fillStyle = index < game.health ? "#b52333" : "#30171f";
    ctx.fillRect(84 + index * 19, 50, 13, 10);
  }
  text(ctx, "BOSS HP", 185, 52, "#7f6f79", 12);
  text(ctx, `${game.boss.health} / 5`, 245, 51, "#dcb8a4", 13);
  text(ctx, "1 LEFT  2 RIGHT  3 UP  4 DOWN", 420, 51, "#8f3344", 12);
  if (game.messageTimer > 0) text(ctx, game.message, 24, HEIGHT - 27, "#d9b7a6", 15);
  if (game.dead || game.won) {
    ctx.fillStyle = "#0b080e";
    ctx.fillRect(250, 245, 652, 128);
    text(ctx, game.won ? "CONTAINMENT BROKEN" : "BLACKOUT", 430, 280, game.won ? "#a5ddaF" : "#d33447", 24);
    text(ctx, game.won ? "THE ELEVATOR CARRIES YOU INTO THE LIGHT." : "PRESS R TO RETURN TO THE ROOM.", 345, 325, "#cdb2a9", 14);
  }
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(150,150,150,${Math.min(0.12, game.flash / 4)})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("Game canvas was not found.");
const contextResult = canvas.getContext("2d");
if (contextResult === null) throw new Error("Canvas 2D context is unavailable.");
const context: CanvasRenderingContext2D = contextResult;
const keys = new Set<string>();
let game = newGame();

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if (key === "r") game = newGame();
  if (["1", "2", "3", "4"].includes(key)) activateShock(game, Number(key) - 1);
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
});
window.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));

let previousTime = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - previousTime) / 1000);
  previousTime = now;
  updateGame(game, dt, keys);
  draw(game, context);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
