const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const cloth = new Set(['40,117,123', '65,162,155', '31,67,83']);
const palettes = {
  'bamboo-armor': ['66,73,39', '113,128,61', '162,171,85', '211,199,116', '94,66,40'],
  'jade-charm': ['28,76,60', '54,131,91', '117,189,137', '197,222,163', '94,66,40'],
};

function crc(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}

function readPng(file) {
  const bytes = fs.readFileSync(file), chunks = [];
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width, height, ended = false;
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    assert.equal(crc(bytes.subarray(offset + 4, offset + 8 + length)), bytes.readUInt32BE(offset + 8 + length), 'CRC');
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.deepEqual([...data.subarray(8)], [8, 6, 0, 0, 0], 'RGBA8');
    } else if (type === 'IDAT') chunks.push(data);
    else if (type === 'IEND') { assert.equal(length, 0); ended = true; }
    else assert.fail('Unexpected chunk ' + type);
    offset += length + 12;
    assert.ok(offset <= bytes.length && (!ended || offset === bytes.length));
  }
  assert.ok(ended && width > 0 && height > 0);
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = width * 4;
  assert.equal(raw.length, height * (stride + 1));
  const pixels = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    assert.equal(raw[row * (stride + 1)], 0, 'Canonical PNG filter');
    raw.copy(pixels, row * stride, row * (stride + 1) + 1, (row + 1) * (stride + 1));
  }
  return { width, height, pixels, bytes };
}

function body(direction, state, frame, count) {
  const facing = direction === 'left' ? -1 : 1, side = ['left', 'right'].includes(direction);
  const phase = frame * Math.PI * 2 / count;
  const crouch = state === 'dodge' ? 4 + frame : state === 'hit' ? 2 : 0;
  const lean = state === 'dodge' ? facing * (frame - 2) : state === 'hit' ? -3 + frame * 2 : state === 'run' ? facing * 2 : state.startsWith('attack') ? Math.round(Math.sin(frame / Math.max(1, count - 1) * Math.PI) * facing * 3) : 0;
  const bob = ['walk', 'run'].includes(state) ? Math.round(Math.sin(phase) * 1.5) : state === 'idle' ? [0, -1, 0, 1][frame] : 0;
  if (state === 'death') return { center: 24, top: 28 + frame * 2, radius: 5 - frame / 3, width: 7 + frame, death: true, charmX: 20, charmY: Math.floor(28 + frame * 2 + (5 - frame / 3) / 2) };
  return { center: 24 + lean, top: 25 + crouch + bob, radius: 8, width: side ? 5 : 7, death: false, charmX: 24 + lean + (direction === 'left' ? 1 : direction === 'up' ? 3 : -4), charmY: 32 + crouch };
}

function eligible(kind, color, horizontal, vertical, anchor) {
  if (kind === 'bamboo-armor') return cloth.has(color) && ((horizontal - anchor.center) / anchor.width) ** 2 + ((vertical - anchor.top) / anchor.radius) ** 2 <= 1 && (anchor.death || vertical <= anchor.top + 4);
  const localX = horizontal - anchor.charmX, localY = vertical - anchor.charmY;
  return localX >= 0 && localX <= 2 && localY >= 0 && localY <= (anchor.death ? 2 : 3) && (cloth.has(color) || !anchor.death && color === '180,60,64');
}

function checkFrame(hero, overlay, sheet, index, anchor, kind, label) {
  const size = sheet.size, columns = sheet.atlasColumns ?? sheet.columns;
  const startX = index % columns * size, startY = Math.floor(index / columns) * size;
  const mask = [], image = [], colors = new Set();
  let covered = 0;
  for (let vertical = 0; vertical < size; vertical++) for (let horizontal = 0; horizontal < size; horizontal++) {
    const offset = ((startY + vertical) * hero.width + startX + horizontal) * 4;
    const base = hero.pixels.subarray(offset, offset + 4), pixel = overlay.pixels.subarray(offset, offset + 4);
    const fit = eligible(kind, [...base.subarray(0, 3)].join(','), horizontal, vertical, anchor);
    assert.equal(pixel[3], fit ? 255 : 0, label + ': fitted mask ' + horizontal + ',' + vertical);
    if (pixel[3]) {
      assert.equal(base[3], 255, label + ': silhouette');
      assert.ok(horizontal > 0 && vertical > 0 && horizontal < size - 1 && vertical < size - 1, label + ': padding');
      const color = [...pixel.subarray(0, 3)].join(',');
      assert.ok(palettes[kind].includes(color), label + ': material palette');
      colors.add(color); covered++;
    } else assert.deepEqual([...pixel], [0, 0, 0, 0], label + ': hidden RGB');
    mask.push(fit ? 1 : 0); image.push(...pixel);
  }
  assert.ok(kind === 'jade-charm' || covered >= 4, label + ': coverage ' + covered);
  if (covered >= 6) assert.ok(colors.size >= 2, label + ': material detail');
  return { mask: hash(Buffer.from(mask)), image: hash(Buffer.from(image)), covered };
}

function checkSheet(kind, name, sheet, DIRECTIONS) {
  let frames = 0, pixels = 0, occluded = 0;
  const hero = readPng(path.join(root, 'public/assets/sprites/' + name + '.png'));
  const file = path.join(root, 'public/assets/equipment/' + kind + '_' + name + '.png'), overlay = readPng(file);
  assert.equal(overlay.width, sheet.size * (sheet.atlasColumns ?? sheet.columns));
  assert.equal(overlay.height, sheet.size * Math.ceil(sheet.columns * DIRECTIONS.length / (sheet.atlasColumns ?? sheet.columns)));
  assert.equal(overlay.width, hero.width); assert.equal(overlay.height, hero.height);
  const masks = new Map(), unique = new Set(), coverage = new Map();
  for (const [directionIndex, direction] of DIRECTIONS.entries()) for (const [state, pose] of Object.entries(sheet.poses)) {
    for (let frame = 0; frame < pose.count; frame++) {
      const index = directionIndex * sheet.columns + pose.start + frame;
      const result = checkFrame(hero, overlay, sheet, index, body(direction, state, frame, pose.count), kind, [kind, name, direction, state, frame].join('/'));
      if (masks.has(result.image)) assert.equal(masks.get(result.image), result.mask, 'Different body masks cannot reuse artwork');
      masks.set(result.image, result.mask); unique.add(result.image); pixels += result.covered; frames++;
      if (result.covered === 0) occluded++;
      const key = direction + '/' + state;
      coverage.set(key, (coverage.get(key) ?? 0) + result.covered);
    }
  }
  for (const [key, count] of coverage) assert.ok(count >= 6, file + '/' + key + ': visible pose coverage ' + count);
  assert.ok(unique.size >= 30, file + ': real pose variety ' + unique.size);
  const columns = sheet.atlasColumns ?? sheet.columns, used = sheet.columns * DIRECTIONS.length;
  for (let index = used; index < columns * overlay.height / sheet.size; index++) {
    for (let row = 0; row < sheet.size; row++) {
      const offset = ((Math.floor(index / columns) * sheet.size + row) * overlay.width + index % columns * sheet.size) * 4;
      assert.ok(overlay.pixels.subarray(offset, offset + sheet.size * 4).every(byte => byte === 0), 'Unused atlas slots');
    }
  }
  console.log('PASS ' + path.basename(file) + ': ' + frames + ' frames, ' + unique.size + ' fitted hashes, ' + occluded + ' fully occluded frames; alpha/padding/body/face/weapon protection');
  return { file, checksum: hash(overlay.bytes), frames, pixels };
}

async function main() {
  const source = fs.readFileSync(path.join(root, 'src/game/assets/spriteManifest.ts'), 'utf8');
  const { SPRITE_MANIFEST, DIRECTIONS } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
  const items = fs.readFileSync(path.join(root, 'src/data/items.ts'), 'utf8'), files = [], hashes = new Set();
  let frames = 0, pixels = 0;
  for (const kind of Object.keys(palettes)) {
    assert.ok(items.includes("id: '" + kind + "'"), 'Canonical item ' + kind);
    for (const name of ['hero', 'hero_axe', 'hero_sword']) {
      const result = checkSheet(kind, name, SPRITE_MANIFEST[name], DIRECTIONS);
      hashes.add(result.checksum); files.push([result.file, result.checksum]);
      frames += result.frames; pixels += result.pixels;
    }
  }
  assert.equal(hashes.size, 6, 'Six distinct sheets');
  const sources = ['src/game/assets/spriteManifest.ts', 'src/data/items.ts', 'scripts/generate-sprites.js', ...['hero', 'hero_axe', 'hero_sword'].map(name => 'public/assets/sprites/' + name + '.png')];
  const before = sources.map(file => hash(fs.readFileSync(path.join(root, file))));
  const generation = spawnSync(process.execPath, ['scripts/generate-equipment.js'], { cwd: root, encoding: 'utf8' });
  assert.equal(generation.status, 0, generation.stderr);
  for (const [file, checksum] of files) assert.equal(hash(fs.readFileSync(file)), checksum, 'Deterministic regeneration ' + file);
  assert.deepEqual(sources.map(file => hash(fs.readFileSync(path.join(root, file)))), before, 'Read-only canonical inputs');
  console.log('PASS equipment: ' + files.length + ' PNGs, ' + frames + ' frames, ' + pixels + ' fitted pixels; deterministic regeneration; canonical inputs unchanged');
  console.log('OPEN: runtime integration, browser/device proof, artist/human premium approval; frozen dist untouched');
}

main().catch(error => { console.error('FAIL equipment: ' + error.message); process.exitCode = 1; });
