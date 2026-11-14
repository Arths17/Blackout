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
