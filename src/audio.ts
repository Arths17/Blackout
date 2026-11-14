export type SoundName = 'relay_click' | 'surge_crack' | 'wall_crack' | 'step_player'
  | 'step_creature' | 'hum_loop' | 'power_return' | 'bounce_launch' | 'bounce_wall' | 'bounce_hit'
  | 'player_hurt' | 'windup' | 'lunge' | 'dead_click' | 'lamp' | 'power_back' | 'fizzle' | 'blackout'
  | 'music_loop' | 'heartbeat' | 'boss_shot' | 'vines' | 'parry' | 'parry_swing' | 'super_launch';

const levels: Record<SoundName, number> = {
  relay_click: 0.7,
  surge_crack: 0.8,
  wall_crack: 0.65,
  step_player: 0.4,
  step_creature: 0.85,
  hum_loop: 0.18,
  power_return: 0.85,
  bounce_launch: 0.7,
  bounce_wall: 0.5,
  bounce_hit: 0.9,
  player_hurt: 0.75,
  windup: 0.7,
  lunge: 0.6,
  dead_click: 0.5,
  lamp: 0.28,
  power_back: 0.45,
  fizzle: 0.5,
  blackout: 0.85,
  music_loop: 0.34,
  heartbeat: 0.7,
  boss_shot: 0.5,
  vines: 0.55,
  parry: 0.8,
  parry_swing: 0.4,
  super_launch: 0.9,
};

let context: AudioContext | undefined;
let master: GainNode;
let creature: GainNode;
let loading: Promise<void> | undefined;
const beds: Partial<Record<SoundName, AudioBufferSourceNode>> = {};
let wantAmbience = false;
let distance = Infinity;
let activated = false;
let resuming: Promise<void> | undefined;
const buffers = new Map<SoundName, AudioBuffer>();

export function initAudio(): void {
  if (context || typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = 0.65;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 8;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  master.connect(limiter).connect(context.destination);
  creature = context.createGain();
  creature.connect(master);
  setCreatureDistance(distance);

  // Capture runs before scene key handlers, so resume stays inside the first key gesture.
  window.addEventListener('keydown', unlock, { capture: true });
  window.addEventListener('pointerdown', unlock, { capture: true });
  context.addEventListener('statechange', () => {
    if (context?.state === 'running') beginAmbience();
  });
  const ctx = context;
  loading = Promise.all((Object.keys(levels) as SoundName[]).map(async (name) => {
    try {
      const response = await fetch(import.meta.env.BASE_URL + 'audio/' + name + '.wav');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      buffers.set(name, await ctx.decodeAudioData(await response.arrayBuffer()));
    } catch (error) {
      console.warn('Audio unavailable: ' + name, error);
    }
  })).then(() => { beginAmbience(); });
}

function unlock(): void {
  if (!context) return;
  activated = true;
  resuming = context.resume().then(beginAmbience).catch(() => {
    // Keep the listener so a later key can retry a blocked or interrupted context.
  });
}

function source(name: SoundName): AudioBufferSourceNode | undefined {
  const buffer = buffers.get(name);
  if (!activated || !context || context.state !== 'running' || !buffer) return;
  const node = context.createBufferSource();
  node.buffer = buffer;
  const gain = context.createGain();
  gain.gain.value = levels[name];
  node.connect(gain).connect(name === 'step_creature' ? creature : master);
  node.onended = () => { node.disconnect(); gain.disconnect(); };
  return node;
}

// ASSUMPTION: callers use file stems, for example play('relay_click').
export function play(name: SoundName): void {
  initAudio();
  if (name === 'hum_loop') { startAmbience(); return; }
  if (!context || !activated) return;
  const node = source(name);
  if (node) node.start();
  else if (name !== 'step_player' && name !== 'step_creature') {
    // Keep the first relay audible if the player beats the initial asset download.
    void Promise.all([loading, resuming]).then(() => { source(name)?.start(); });
  }
}

function beginAmbience(): void {
  if (!wantAmbience) return;
  for (const name of ['hum_loop', 'music_loop'] as const) {
    if (beds[name]) continue;
    const node = source(name);
    if (!node) continue;
    node.loop = true;
    node.start();
    beds[name] = node;
  }
}

export function startAmbience(): void {
  wantAmbience = true;
  initAudio();
  beginAmbience();
}

export function setCreatureDistance(px: number): void {
  distance = Number.isNaN(px) ? Infinity : Math.max(0, px);
  if (!context || !creature) return;
  const near = 1 - Math.min(1, distance / 700);
  creature.gain.setTargetAtTime(0.04 + 0.96 * near * near, context.currentTime, 0.035);
}
