import { mkdir, writeFile } from 'node:fs/promises';

const rate = 44100;
const out = new URL('../public/audio/', import.meta.url);
let seed = 0x42ac031;
const noise = () => {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0x80000000 - 1;
};
const sat = (x) => Math.tanh(x);
const lowpass = (hz) => {
  const a = 1 - Math.exp(-2 * Math.PI * hz / rate);
  let z = 0;
  return (x) => (z += a * (x - z));
};
const ring = (t, hz, decay) => Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * decay);
const burst = (t, at, decay) => t < at ? 0 : Math.exp(-(t - at) * decay);

function shot(seconds, sample) {
  const data = new Float64Array(Math.round(seconds * rate));
  for (let i = 0; i < data.length; i++) {
    const t = i / rate;
    const fade = Math.min(1, t / 0.0007, (seconds - t) / 0.012);
    data[i] = sample(t) * fade;
  }
  return data;
}

function relay() {
  const metal = lowpass(6200);
  return shot(0.16, (t) => {
    const snap = noise() * (burst(t, 0, 230) + 0.65 * burst(t, 0.027, 310));
    return sat(3 * metal(snap)) + 0.3 * ring(t, 1130, 60) + 0.2 * ring(t, 2430, 85);
  });
}

function crack(wall) {
  const body = lowpass(wall ? 180 : 95);
  const fizz = lowpass(wall ? 5800 : 3700);
  return shot(wall ? 0.38 : 0.65, (t) => {
    const n = noise();
    const snaps = burst(t, 0, 140) + 0.7 * burst(t, 0.013, 180) + 0.4 * burst(t, 0.038, 230);
    const arc = sat(5 * fizz(n)) * (0.55 * snaps + 0.22 * Math.exp(-t * 12));
    const thud = sat(9 * body(n)) * Math.exp(-t * (wall ? 20 : 9));
    return arc + thud * 0.65 + 0.25 * ring(t, wall ? 173 : 61, wall ? 18 : 7);
  });
}

function foot(creature) {
  const weight = lowpass(creature ? 130 : 240);
  const grit = lowpass(creature ? 1500 : 3200);
  return shot(creature ? 0.38 : 0.2, (t) => {
    const n = noise();
    const scuff = burst(t, creature ? 0.055 : 0.018, creature ? 16 : 44);
    return sat(10 * weight(n)) * Math.exp(-t * (creature ? 17 : 32))
      + 0.27 * grit(n) * scuff
      + 0.3 * ring(t, creature ? 43 : 108, creature ? 16 : 35);
  });
}

function hum() {
  const data = new Float64Array(rate * 4);
  const a = Math.exp(-2 * Math.PI * 110 / rate);
  const raw = Float64Array.from(data, noise);
  let z = 0;
  for (const n of raw) z = a * z + (1 - a) * n;
  // The steady-state filter value makes the noise periodic across the WAV boundary.
  z /= 1 - a ** data.length;
  for (let i = 0; i < data.length; i++) {
    z = a * z + (1 - a) * raw[i];
    const t = i / rate;
    const motor = Math.sin(2 * Math.PI * 50 * t) + 0.28 * Math.sin(2 * Math.PI * 100 * t)
      + 0.13 * Math.sin(2 * Math.PI * 150 * t);
    const wobble = 0.82 + 0.18 * Math.cos(2 * Math.PI * 0.5 * t);
    data[i] = 0.6 * sat(motor * 1.7) * wobble + 2.8 * z;
  }
  return data;
}

function power() {
  const rumble = lowpass(160);
  const contact = lowpass(4400);
  return shot(1.8, (t) => {
    const n = noise();
    const engage = burst(t, 0, 90) + 0.6 * burst(t, 0.12, 110);
    const rise = Math.min(1, t / 0.5) * Math.exp(-t * 1.6);
    const motor = sat(2 * (Math.sin(2 * Math.PI * 50 * t) + 0.25 * Math.sin(2 * Math.PI * 150 * t)));
    return 0.6 * sat(contact(n) * 4) * engage + rise * (motor * 0.5 + sat(rumble(n) * 8) * 0.7);
  });
}


// Phase of an exponential pitch sweep from f0 to f1 over d seconds.
function sweep(t, f0, f1, d) {
  const k = Math.log(f1 / f0);
  const x = Math.min(t, d);
  const phase = (f0 * d / k) * (Math.exp(k * x / d) - 1) + (t > d ? f1 * (t - d) : 0);
  return Math.sin(2 * Math.PI * phase);
}

// Rubbery launch: pitch jumps up and wobbles as it fades.
function boing(low, high, seconds, decay, wobble) {
  const thump = lowpass(260);
  return shot(seconds, (t) => {
    const body = sweep(t, low, high, seconds * 0.45) * Math.exp(-t * decay);
    const vib = 1 + wobble * Math.sin(2 * Math.PI * 24 * t);
    return body * vib + 0.45 * sat(6 * thump(noise())) * Math.exp(-t * 45);
  });
}

function bounceHit() {
  const body = lowpass(150);
  const arc = lowpass(4200);
  return shot(0.75, (t) => {
    const thud = sat(10 * body(noise())) * Math.exp(-t * 11);
    const zap = sat(5 * arc(noise())) * (burst(t, 0, 120) + 0.5 * burst(t, 0.02, 160)) * 0.5;
    const back = 0.55 * sweep(t, 180, 760, 0.28) * Math.exp(-t * 5.5);
    return thud * 0.8 + zap + back + 0.3 * ring(t, 58, 8);
  });
}

function hurt() {
  const body = lowpass(420);
  return shot(0.38, (t) => {
    const hit = sat(8 * body(noise())) * Math.exp(-t * 20);
    const groan = sat(2 * sweep(t, 190, 80, 0.3)) * Math.exp(-t * 8);
    return hit * 0.7 + groan * 0.6;
  });
}

// Creature growl that builds to the lunge: low saw-like tone with a fast amplitude chop.
function windup() {
  const grit = lowpass(900);
  return shot(0.9, (t) => {
    const rise = Math.pow(Math.min(1, t / 0.75), 1.6) * (t < 0.75 ? 1 : Math.exp(-(t - 0.75) * 18));
    const f = 52 + 70 * Math.min(1, t / 0.75);
    const saw = 2 * ((f * t) % 1) - 1;
    const chop = 0.65 + 0.35 * Math.sin(2 * Math.PI * (14 + 18 * t) * t);
    return rise * chop * (0.7 * sat(2.2 * saw) + 0.5 * sat(5 * grit(noise())));
  });
}

function lunge() {
  let z = 0;
  return shot(0.34, (t) => {
    const hz = 250 + 2600 * Math.sin(Math.PI * Math.min(1, t / 0.3));
    z += (1 - Math.exp(-2 * Math.PI * hz / rate)) * (noise() - z);
    return sat(3 * z) * Math.sin(Math.PI * Math.min(1, t / 0.3)) + 0.5 * ring(t, 70, 14);
  });
}

function dead() {
  const dull = lowpass(900);
  return shot(0.14, (t) => sat(5 * dull(noise())) * Math.exp(-t * 55) + 0.5 * ring(t, 140, 50));
}

function lamp() {
  return shot(0.22, (t) => 0.8 * ring(t, 1760, 28) + 0.25 * ring(t, 2640, 45) + 0.2 * noise() * burst(t, 0, 600));
}

function powerBack() {
  const click = lowpass(3000);
  return shot(0.55, (t) => {
    const rise = sweep(t, 55, 120, 0.4) * Math.min(1, t / 0.2) * Math.exp(-t * 4);
    return 0.5 * sat(3 * click(noise())) * burst(t, 0, 160) + 0.6 * rise + 0.25 * ring(t, 880, 14);
  });
}

function fizzle() {
  let z = 0;
  return shot(0.5, (t) => {
    const hz = 3200 * Math.exp(-t * 5) + 150;
    z += (1 - Math.exp(-2 * Math.PI * hz / rate)) * (noise() - z);
    return sat(4 * z) * Math.exp(-t * 5.5) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 38 * t));
  });
}

// Lights dying: the motor spins down and the pitch falls away.
function blackout() {
  const rumble = lowpass(300);
  return shot(1.5, (t) => {
    const down = sweep(t, 130, 24, 1.2) * Math.exp(-t * 2.4);
    const thump = sat(8 * rumble(noise())) * Math.exp(-t * 6);
    return 0.8 * sat(2 * down) + 0.6 * thump + 0.25 * ring(t, 2200, 40) * burst(t, 0, 80);
  });
}

// Seamless dark ambient bed. Every tone has a whole number of cycles in the loop and the
// ringing hits wrap around the end, so the seam can't click.
function music() {
  const secs = 24;
  const data = new Float64Array(rate * secs);
  const snap = (hz) => Math.round(hz * secs) / secs;
  const add = (i, x) => { data[((i % data.length) + data.length) % data.length] += x; };
  const chords = [
    [55, 82.5, 130.8],
    [55, 82.5, 123.5],
    [49, 73.4, 110],
    [55, 82.5, 155.6],
  ];
  for (let i = 0; i < data.length; i++) {
    const t = i / rate;
    const part = (t / (secs / chords.length)) % chords.length;
    const a = Math.floor(part);
    const b = (a + 1) % chords.length;
    const mix = Math.pow(Math.max(0, Math.min(1, (part - a - 0.7) / 0.3)), 2);
    let v = 0;
    for (let k = 0; k < 3; k++) {
      const hz = chords[a][k] * (1 - mix) + chords[b][k] * mix;
      const f = snap(hz);
      const swell = 0.7 + 0.3 * Math.sin(2 * Math.PI * (1 / 12) * t + k * 2);
      for (const [h, amp] of [[1, 1], [2, 0.42], [3, 0.2], [4, 0.1]]) {
        v += amp * swell * 0.16 * Math.sin(2 * Math.PI * f * h * t + k) * (k === 0 ? 1.3 : 0.8);
        v += amp * swell * 0.1 * Math.sin(2 * Math.PI * (f + 0.25) * h * t + k * 1.7);
      }
    }
    const pulse = Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * (1 / 3) * t), 3);
    v += 0.38 * pulse * Math.sin(2 * Math.PI * snap(36) * t);
    data[i] = v;
  }
  const pings = [[2.5, 698.5], [7, 493.9], [10.5, 740], [15.5, 466.2], [19, 659.3], [21.5, 392]];
  for (const [at, hz] of pings) {
    const start = Math.round(at * rate);
    for (let n = 0; n < rate * 3; n++) {
      const t = n / rate;
      const env = Math.exp(-t * 2.2) * Math.min(1, t / 0.004);
      add(start + n, 0.09 * env * (Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(2 * Math.PI * hz * 2.76 * t) + 0.25 * Math.sin(2 * Math.PI * hz * 5.4 * t)));
    }
  }
  return data;
}

// Two soft thuds, the second one lighter.
function heartbeat() {
  const body = lowpass(140);
  return shot(0.55, (t) => {
    const thud = (at, amp) => t < at ? 0 : amp * (Math.sin(2 * Math.PI * 52 * (t - at)) + 0.5 * sat(6 * body(noise()))) * Math.exp(-(t - at) * 26);
    return thud(0, 1) + thud(0.21, 0.7);
  });
}

// The boss spitting seeds: a short wet thump with a falling pitch.
function bossSpit() {
  const body = lowpass(500);
  return shot(0.3, (t) => sat(5 * body(noise())) * Math.exp(-t * 22) * 0.8 + 0.8 * sweep(t, 520, 130, 0.22) * Math.exp(-t * 11) + 0.2 * ring(t, 95, 20));
}

// Vines creeping over the door: a papery rustle with creaks and sparse crackles.
function vineGrow() {
  const hi = lowpass(2600);
  const lo = lowpass(450);
  return shot(1.9, (t) => {
    const n = noise();
    const env = Math.min(1, t / 0.25) * Math.exp(-Math.max(0, t - 1.1) * 3);
    const rustle = (hi(n) - lo(n)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 7 * t));
    const creak = sweep(t, 150, 85, 1.6) * 0.3 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 9 * t));
    const crackle = noise() > 0.992 ? noise() * 0.8 : 0;
    return env * (1.6 * rustle + creak) + crackle * env;
  });
}

// Metallic clang when a parry lands.
function parryClang() {
  const bite = lowpass(7000);
  return shot(0.5, (t) => {
    const hit = sat(4 * bite(noise())) * burst(t, 0, 260);
    return 0.5 * hit + 0.7 * ring(t, 1180, 11) + 0.45 * ring(t, 1870, 16) + 0.3 * ring(t, 3100, 24) + 0.25 * ring(t, 310, 18);
  });
}

// Quick air swish when Shift is pressed.
function parrySwing() {
  let z = 0;
  return shot(0.16, (t) => {
    const hz = 1200 + 2600 * Math.sin(Math.PI * Math.min(1, t / 0.14));
    z += (1 - Math.exp(-2 * Math.PI * hz / rate)) * (noise() - z);
    return sat(2.5 * z) * Math.sin(Math.PI * Math.min(1, t / 0.14)) * 0.8;
  });
}

// Big charged launch for the super bounce: a rising roar over a deep thump.
function superLaunch() {
  const low = lowpass(220);
  return shot(0.9, (t) => {
    const rise = sweep(t, 70, 980, 0.55) * Math.exp(-t * 3.2);
    const thump = sat(9 * low(noise())) * Math.exp(-t * 7);
    const zap = sat(4 * lowpass(5000)(noise())) * burst(t, 0, 90);
    return 0.7 * rise + 0.8 * thump + 0.35 * zap + 0.35 * ring(t, 48, 5);
  });
}

async function wav(name, data, peak) {
  const mean = data.reduce((sum, x) => sum + x, 0) / data.length;
  let max = 0;
  for (const x of data) max = Math.max(max, Math.abs(x - mean));
  const bytes = Buffer.alloc(44 + data.length * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) {
    const x = (data[i] - mean) * peak / max;
    if (!Number.isFinite(x) || Math.abs(x) >= 1) throw new Error(name + ': invalid sample');
    bytes.writeInt16LE(Math.round(x * 32767), 44 + i * 2);
  }
  await writeFile(new URL(name + '.wav', out), bytes);
  console.log(name + '.wav: ' + (data.length / rate).toFixed(2) + 's, peak ' + (20 * Math.log10(peak)).toFixed(1) + ' dBFS');
}

await mkdir(out, { recursive: true });
await wav('relay_click', relay(), 0.72);
await wav('surge_crack', crack(false), 0.82);
await wav('wall_crack', crack(true), 0.76);
await wav('step_player', foot(false), 0.55);
await wav('step_creature', foot(true), 0.7);
await wav('hum_loop', hum(), 0.55);
await wav('power_return', power(), 0.8);
await wav('bounce_launch', boing(150, 560, 0.5, 6, 0.08), 0.75);
await wav('bounce_wall', boing(420, 240, 0.24, 14, 0.05), 0.7);
await wav('bounce_hit', bounceHit(), 0.85);
await wav('player_hurt', hurt(), 0.8);
await wav('windup', windup(), 0.75);
await wav('lunge', lunge(), 0.75);
await wav('dead_click', dead(), 0.6);
await wav('lamp', lamp(), 0.6);
await wav('power_back', powerBack(), 0.7);
await wav('fizzle', fizzle(), 0.7);
await wav('blackout', blackout(), 0.85);
await wav('boss_shot', bossSpit(), 0.7);
await wav('vines', vineGrow(), 0.6);
await wav('parry', parryClang(), 0.85);
await wav('parry_swing', parrySwing(), 0.6);
await wav('super_launch', superLaunch(), 0.9);
await wav('music_loop', music(), 0.6);
await wav('heartbeat', heartbeat(), 0.8);
