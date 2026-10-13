import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/game/assets/spriteManifest.ts'), 'utf8');
const { SPRITE_MANIFEST, DIRECTIONS } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
const cloth = new Set(['40,117,123', '65,162,155', '31,67,83']);
const materials = {
  'bamboo-armor': [[66, 73, 39, 255], [113, 128, 61, 255], [162, 171, 85, 255], [211, 199, 116, 255], [94, 66, 40, 255]],
  'jade-charm': [[28, 76, 60, 255], [54, 131, 91, 255], [117, 189, 137, 255], [197, 222, 163, 255], [94, 66, 40, 255]],
};
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value;
});

function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8;
  return (value ^ 0xffffffff) >>> 0;
}

function readHero(name, sheet) {
  const bytes = fs.readFileSync(path.join(root, 'public/assets/sprites/' + name + '.png')), chunks = [];
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width, height, ended = false;
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    assert.equal(crc(bytes.subarray(offset + 4, offset + 8 + length)), bytes.readUInt32BE(offset + 8 + length));
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.deepEqual([...data.subarray(8)], [8, 6, 0, 0, 0]);
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') { assert.equal(length, 0); ended = true; }
    else throw Error('Unexpected PNG chunk ' + type);
    offset += length + 12;
    assert.ok(offset <= bytes.length && (!ended || offset === bytes.length));
  }
  assert.ok(ended);
  assert.equal(sheet.size, 48);
  assert.equal(width, sheet.size * (sheet.atlasColumns ?? sheet.columns));
  assert.equal(height, sheet.size * Math.ceil(sheet.columns * DIRECTIONS.length / (sheet.atlasColumns ?? sheet.columns)));
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = width * 4;
  assert.equal(raw.length, height * (stride + 1));
  const pixels = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    assert.equal(raw[row * (stride + 1)], 0, 'Only canonical filter-0 sheets supported');
    raw.copy(pixels, row * stride, row * (stride + 1) + 1, (row + 1) * (stride + 1));
  }
  return { width, height, pixels };
}

function chunk(type, data) {
  const name = Buffer.from(type), length = Buffer.alloc(4), checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length); checksum.writeUInt32BE(crc(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function png(hero, pixels) {
  const header = Buffer.alloc(13), stride = hero.width * 4;
  header.writeUInt32BE(hero.width); header.writeUInt32BE(hero.height, 4); header[8] = 8; header[9] = 6;
  const raw = Buffer.alloc(hero.height * (stride + 1));
  for (let row = 0; row < hero.height; row++) pixels.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function anchor(direction, state, frame, count) {
  const facing = direction === 'left' ? -1 : 1, side = ['left', 'right'].includes(direction);
  const phase = frame * Math.PI * 2 / count;
  const crouch = state === 'dodge' ? 4 + frame : state === 'hit' ? 2 : 0;
  const lean = state === 'dodge' ? facing * (frame - 2) : state === 'hit' ? -3 + frame * 2 : state === 'run' ? facing * 2 : state.startsWith('attack') ? Math.round(Math.sin(frame / Math.max(1, count - 1) * Math.PI) * facing * 3) : 0;
  const bob = ['walk', 'run'].includes(state) ? Math.round(Math.sin(phase) * 1.5) : state === 'idle' ? [0, -1, 0, 1][frame] : 0;
  if (state === 'death') return { center: 24, top: 28 + frame * 2, radius: 5 - frame / 3, width: 7 + frame, death: true, charmX: 20, charmY: Math.floor(28 + frame * 2 + (5 - frame / 3) / 2), direction };
  return { center: 24 + lean, top: 25 + crouch + bob, radius: 8, width: side ? 5 : 7, death: false, charmX: 24 + lean + (direction === 'left' ? 1 : direction === 'up' ? 3 : -4), charmY: 32 + crouch, direction };
}

function material(kind, color, horizontal, vertical, body) {
  if (kind === 'jade-charm') {
    const localX = horizontal - body.charmX, localY = vertical - body.charmY;
    if (localX < 0 || localX > 2 || localY < 0 || localY > (body.death ? 2 : 3)) return null;
    if (!cloth.has(color) && (body.death || color !== '180,60,64')) return null;
    const shade = localY === 0 ? 4 : localX === 0 ? 0 : localX === 1 ? localY === 1 ? 3 : 2 : 1;
    return materials[kind][shade];
  }
  if (!cloth.has(color) || ((horizontal - body.center) / body.width) ** 2 + ((vertical - body.top) / body.radius) ** 2 > 1 || !body.death && vertical > body.top + 4) return null;
  const localX = horizontal - body.center + Math.ceil(body.width), localY = vertical - Math.ceil(body.top - body.radius);
  const rear = body.direction === 'up', side = ['left', 'right'].includes(body.direction);
  const seam = localY % (body.death ? 3 : 4) === 0;
  const slat = ((body.direction === 'left' ? -localX : localX) % 3 + 3) % 3;
  const shade = seam ? 4 : slat === 0 ? 0 : slat === 1 ? rear || side ? 1 : 2 : rear ? 2 : 3;
  return materials[kind][shade];
}

function paintFrame(hero, output, sheet, index, body, kind) {
  const size = sheet.size, columns = sheet.atlasColumns ?? sheet.columns;
  const startX = index % columns * size, startY = Math.floor(index / columns) * size;
  let covered = 0;
  for (let vertical = 1; vertical < size - 1; vertical++) for (let horizontal = 1; horizontal < size - 1; horizontal++) {
    const offset = ((startY + vertical) * hero.width + startX + horizontal) * 4;
    const base = hero.pixels.subarray(offset, offset + 4);
    const color = material(kind, [...base.subarray(0, 3)].join(','), horizontal, vertical, body);
    if (color && base[3] === 255) { output.set(color, offset); covered++; }
  }
  assert.ok(kind === 'jade-charm' || covered >= 4, kind + ': cannot fit frame ' + index + ' (' + covered + ' pixels)');
}

const items = fs.readFileSync(path.join(root, 'src/data/items.ts'), 'utf8');
const directory = path.join(root, 'public/assets/equipment'), generated = [];
for (const name of ['hero', 'hero_axe', 'hero_sword']) {
  const sheet = SPRITE_MANIFEST[name], hero = readHero(name, sheet);
  assert.equal(Object.values(sheet.poses).reduce((total, pose) => total + pose.count, 0), sheet.columns);
  for (const kind of Object.keys(materials)) {
    assert.ok(items.includes("id: '" + kind + "'"), 'Unknown canonical equipment ' + kind);
    const output = Buffer.alloc(hero.pixels.length);
    for (const [directionIndex, direction] of DIRECTIONS.entries()) for (const [state, pose] of Object.entries(sheet.poses)) {
      for (let frame = 0; frame < pose.count; frame++) paintFrame(hero, output, sheet, directionIndex * sheet.columns + pose.start + frame, anchor(direction, state, frame, pose.count), kind);
    }
    generated.push({ name: kind + '_' + name + '.png', bytes: png(hero, output), width: hero.width, height: hero.height, frames: sheet.columns * DIRECTIONS.length });
  }
}
fs.mkdirSync(directory, { recursive: true });
for (const asset of generated) {
  fs.writeFileSync(path.join(directory, asset.name), asset.bytes);
  console.log(asset.name + ': ' + asset.width + 'x' + asset.height + ', ' + asset.frames + ' fitted frames, ' + asset.bytes.length + ' bytes');
}
