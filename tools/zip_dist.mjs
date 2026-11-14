import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';

const dist = new URL('../dist/', import.meta.url);
const output = new URL('../blackout-html5.zip', import.meta.url);
await access(new URL('index.html', dist));

async function files(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await files(new URL(entry.name + '/', dir), name + '/'));
    else if (entry.isFile()) result.push(name);
    else throw new Error('Cannot package ' + name);
  }
  return result.sort();
}

const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const chunks = [];
const directory = [];
let offset = 0;
const names = await files(dist);
if (names.length >= 65535) throw new Error('Too many files for a standard ZIP');
for (const name of names) {
  const path = Buffer.from(name);
  const data = await readFile(new URL(name, dist));
  const packed = deflateRawSync(data);
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6);
  header.writeUInt16LE(8, 8);
  // A fixed DOS date keeps repeat packages identical; no filesystem timestamps leak in.
  header.writeUInt16LE(((2026 - 1980) << 9) | 33, 12);
  header.writeUInt32LE((crc ^ 0xffffffff) >>> 0, 14);
  header.writeUInt32LE(packed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(path.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  header.copy(central, 6, 4, 30);
  central.writeUInt32LE(offset, 42);
  directory.push(central, path);
  chunks.push(header, path, packed);
  offset += header.length + path.length + packed.length;
}
const central = Buffer.concat(directory);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(names.length, 8);
end.writeUInt16LE(names.length, 10);
end.writeUInt32LE(central.length, 12);
end.writeUInt32LE(offset, 16);
await writeFile(output, Buffer.concat([...chunks, central, end]));
console.log('blackout-html5.zip: ' + names.length + ' files, index.html at the root');
