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

// How far each play of a sound may drift in pitch, so repeats don't sound stamped out.
// Anything not listed gets DRIFT; long one-off stingers stay put.
const DRIFT = 0.05;
const drift: Partial<Record<SoundName, number>> = {
  step_player: 0.1,
  step_creature: 0.12,
  lamp: 0.08,
  wall_crack: 0.1,
  bounce_wall: 0.1,
  coin: 0.07,
  power_return: 0,
  blackout: 0,
  chest_open: 0,
  vines: 0,
};

// Recorded tracks are big, so they load only when wanted and the music not in use is dropped.
export type MusicName = 'music_menu' | 'fight_1' | 'fight_2' | 'fight_3';
const MUSIC: SoundName[] = ['music_menu', 'fight_1', 'fight_2', 'fight_3'];
// music_loop is the synthesized stand-in, fetched only if a recorded track won't decode.
const LAZY: SoundName[] = [...MUSIC, 'music_loop'];

let context: AudioContext | undefined;
let master: GainNode;
let creature: GainNode;
let started = false;
let decoding: Promise<void> | undefined;
let resuming: Promise<void> | undefined;
let hum: AudioBufferSourceNode | undefined;
let wantAmbience = false;
let loaded = false;
let distance = Infinity;
let volume = 0.7;
const files = new Map<SoundName, Promise<ArrayBuffer | undefined>>();
const buffers = new Map<SoundName, AudioBuffer>();
const broken = new Set<SoundName>();
const pending = new Map<SoundName, Promise<void>>();
let wantedMusic: MusicName = 'music_menu';
let playing: { name: SoundName; node: AudioBufferSourceNode; gain: GainNode } | undefined;

function download(name: SoundName): Promise<ArrayBuffer | undefined> {
  let file = files.get(name);
  if (!file) {
    const url = import.meta.env.BASE_URL + 'audio/' + name + (MUSIC.includes(name) ? '.m4a' : '.wav');
    file = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : undefined)).catch(() => undefined);
    files.set(name, file);
  }
  return file;
}

// Fetches the effects right away but makes no AudioContext yet: browsers only allow one after a
// key or click, so it is created inside the first one.
export function initAudio(): void {
  if (started || typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
  started = true;
  for (const name of Object.keys(levels) as SoundName[]) if (!LAZY.includes(name)) void download(name);
  // Capture runs before scene key handlers, so the context exists by the time they play a sound.
  window.addEventListener('keydown', unlock, { capture: true });
  window.addEventListener('pointerdown', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden) void context.suspend();
    else void context.resume();
  });
}

async function decode(name: SoundName): Promise<void> {
  const ctx = context;
  const data = await download(name);
  // decodeAudioData empties the ArrayBuffer, so the cached download can't be reused.
  files.delete(name);
  if (!ctx || !data) { broken.add(name); return; }
  try {
    buffers.set(name, await ctx.decodeAudioData(data));
  } catch {
    broken.add(name);
  }
}

function unlock(): void {
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = volume;
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
    decoding = Promise.all((Object.keys(levels) as SoundName[]).filter((n) => !LAZY.includes(n)).map(decode)).then(() => {
      loaded = true;
      beginAmbience();
    });
    void loadMusic(wantedMusic).then(applyMusic);
  }
  if (context.state !== 'running' && !document.hidden) {
    // Keep the listener so a later key can retry a blocked or interrupted context.
    resuming = context.resume().then(beginAmbience).catch(() => undefined);
  }
}

function source(name: SoundName): AudioBufferSourceNode | undefined {
  const buffer = buffers.get(name);
  if (!context || context.state !== 'running' || !buffer) return;
  const node = context.createBufferSource();
  node.buffer = buffer;
  const gain = context.createGain();
  const d = drift[name] ?? DRIFT;
  node.playbackRate.value = 1 + (Math.random() * 2 - 1) * d;
  gain.gain.value = levels[name] * (d > 0 ? 0.85 + Math.random() * 0.15 : 1);
  node.connect(gain).connect(name === 'step_creature' ? creature : master);
  node.onended = () => { node.disconnect(); gain.disconnect(); };
  return node;
}

export function play(name: SoundName): void {
  if (!context) return;
  const node = source(name);
  if (node) node.start();
  else if (!loaded && name !== 'step_player' && name !== 'step_creature') {
    // Keep the first relay audible if the player beats the initial decode.
    void Promise.all([decoding, resuming]).then(() => { source(name)?.start(); });
  }
}

function beginAmbience(): void {
  if (!wantAmbience || !context || context.state !== 'running') return;
  if (!hum) {
    const buffer = buffers.get('hum_loop');
    if (buffer) {
      hum = context.createBufferSource();
      hum.buffer = buffer;
      hum.loop = true;
      const gain = context.createGain();
      gain.gain.value = levels.hum_loop;
      hum.connect(gain).connect(master);
      hum.start();
    }
  }
  applyMusic();
}

function loadMusic(name: SoundName): Promise<void> {
  if (buffers.has(name) || !context) return Promise.resolve();
  let p = pending.get(name);
  if (!p) {
    p = decode(name).then(() => {
      pending.delete(name);
      if (broken.has(name) && name !== 'music_loop') return loadMusic('music_loop');
    });
    pending.set(name, p);
  }
  return p;
}

// Crossfades to the wanted track. If it can't be decoded the synthesized loop covers for it.
function applyMusic(): void {
  if (!wantAmbience || !context || context.state !== 'running') return;
  const want: SoundName = broken.has(wantedMusic) ? 'music_loop' : wantedMusic;
  if (playing?.name === want) return;
  const buffer = buffers.get(want);
  if (!buffer) {
    void loadMusic(want).then(() => { if (buffers.has(want)) applyMusic(); });
    return;
  }
  const now = context.currentTime;
  if (playing) {
    const old = playing;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + 1.2);
    old.node.stop(now + 1.3);
    old.node.onended = () => { old.node.disconnect(); old.gain.disconnect(); };
    // Drop the decoded track once it has faded, unless it was asked for again in the meantime.
    if (old.name !== 'music_loop') setTimeout(() => { if (playing?.name !== old.name) buffers.delete(old.name); }, 2000);
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
  applyMusic();
}

export function startAmbience(): void {
  wantAmbience = true;
  initAudio();
  beginAmbience();
}

// v is 0..1 from the options screen.
export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (context) master.gain.setTargetAtTime(volume, context.currentTime, 0.02);
}

export function setCreatureDistance(px: number): void {
  distance = Number.isNaN(px) ? Infinity : Math.max(0, px);
  if (!context || !creature) return;
  const near = 1 - Math.min(1, distance / 700);
  creature.gain.setTargetAtTime(0.04 + 0.96 * near * near, context.currentTime, 0.035);
}
