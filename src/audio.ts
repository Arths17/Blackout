export type SoundName = 'relay_click' | 'surge_crack' | 'wall_crack' | 'step_player'
  | 'step_creature' | 'hum_loop' | 'power_return' | 'bounce_launch' | 'bounce_wall' | 'bounce_hit'
  | 'player_hurt' | 'windup' | 'lunge' | 'dead_click' | 'lamp' | 'power_back' | 'fizzle' | 'blackout'
  | 'music_loop' | 'heartbeat' | 'boss_shot' | 'chest_open' | 'coin' | 'dash' | 'vines' | 'parry' | 'parry_swing' | 'super_launch' | 'music_menu' | 'fight_1' | 'fight_2' | 'fight_3';

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
  chest_open: 0.7,
  coin: 0.4,
  dash: 0.45,
  // Music by Eric Skiff (Resistor Anthems), CC BY 4.0; see CREDITS.md. Levels are for the tracks' own loudness.
  music_menu: 0.6,
  fight_1: 0.62,
  fight_2: 0.62,
  fight_3: 0.58,
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
let loaded = false;
let distance = Infinity;
let activated = false;
let resuming: Promise<void> | undefined;
const buffers = new Map<SoundName, AudioBuffer>();

// Recorded tracks are big, so they load only when wanted and the music not in use is dropped.
export type MusicName = 'music_menu' | 'fight_1' | 'fight_2' | 'fight_3';
const MUSIC: SoundName[] = ['music_menu', 'fight_1', 'fight_2', 'fight_3'];
const isMusic = (n: SoundName): boolean => MUSIC.includes(n);
let wantedMusic: MusicName = 'music_menu';
let playing: { name: MusicName | 'music_loop'; node: AudioBufferSourceNode; gain: GainNode } | undefined;
const pending = new Map<MusicName, Promise<void>>();

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
  loading = Promise.all((Object.keys(levels) as SoundName[]).filter((n) => !isMusic(n)).map(async (name) => {
    try {
      const response = await fetch(import.meta.env.BASE_URL + 'audio/' + name + '.wav');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      buffers.set(name, await ctx.decodeAudioData(await response.arrayBuffer()));
    } catch (error) {
      console.warn('Audio unavailable: ' + name, error);
    }
  })).then(() => {
    loaded = true;
    beginAmbience();
  });
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
  if (!beds.hum_loop) {
    const node = source('hum_loop');
    if (node) {
      node.loop = true;
      node.start();
      beds.hum_loop = node;
    }
  }
  applyMusic();
}

function loadMusic(name: MusicName): Promise<void> {
  if (buffers.has(name) || !context) return Promise.resolve();
  let p = pending.get(name);
  if (!p) {
    const ctx = context;
    p = (async () => {
      try {
        const response = await fetch(import.meta.env.BASE_URL + 'audio/' + name + '.m4a');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        buffers.set(name, await ctx.decodeAudioData(await response.arrayBuffer()));
      } catch (error) {
        console.warn('Music unavailable: ' + name, error);
      }
    })();
    pending.set(name, p);
  }
  return p;
}

// Crossfades to the wanted track. If it can't be decoded the synthesized loop covers for it.
function applyMusic(): void {
  if (!wantAmbience || !activated || !context || context.state !== 'running' || !loaded) return;
  const want: MusicName | 'music_loop' = buffers.has(wantedMusic) ? wantedMusic : pending.has(wantedMusic) && !buffers.has(wantedMusic) ? (playing?.name ?? 'music_loop') : 'music_loop';
  if (!buffers.has(wantedMusic) && !pending.has(wantedMusic)) {
    void loadMusic(wantedMusic).then(applyMusic);
  }
  if (playing?.name === want) return;
  const buffer = buffers.get(want);
  if (!buffer) return;
  const now = context.currentTime;
  if (playing) {
    const old = playing;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + 1.2);
    old.node.stop(now + 1.3);
    old.node.onended = () => { old.node.disconnect(); old.gain.disconnect(); };
    if (old.name !== 'music_loop' && old.name !== want) setTimeout(() => buffers.delete(old.name as MusicName), 2000);
  }
  const node = context.createBufferSource();
  node.buffer = buffer;
  node.loop = true;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(levels[want], now + 1.2);
  node.connect(gain).connect(master);
  node.start();
  playing = { name: want, node, gain };
}

export function setMusic(name: MusicName): void {
  wantedMusic = name;
  initAudio();
  void loadMusic(name).then(applyMusic);
  applyMusic();
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
