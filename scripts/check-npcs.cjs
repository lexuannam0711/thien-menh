const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'public/assets/npcs');
const catalog = fs.readFileSync(path.join(root, 'src/data/contentCatalog.ts'), 'utf8');
const section = catalog.split('export const NAMED_NPCS:')[1].split(']);')[0];
const ids = [...section.matchAll(/\bid: '([^']+)'/g)].map(match => match[1]);
assert.equal(ids.length, 15);
for (const id of ids) for (const suffix of ['', '-portrait']) {
  assert.ok(fs.existsSync(path.join(directory, id + suffix + '.png')), 'Missing NPC asset: ' + id + suffix);
}

function readPng(filename) {
  const png = fs.readFileSync(filename);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width, height, ended = false;
  const compressed = [];
  for (let offset = 8; offset < png.length;) {
    assert.ok(offset + 12 <= png.length);
    const length = png.readUInt32BE(offset);
    assert.ok(offset + length + 12 <= png.length);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    let crc = 0xffffffff;
    for (const byte of png.subarray(offset + 4, offset + 8 + length)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1;
    }
    assert.equal((crc ^ 0xffffffff) >>> 0, png.readUInt32BE(offset + 8 + length), filename + ': CRC');
    if (type === 'IHDR') {
      assert.equal(offset, 8); assert.equal(length, 13);
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.deepEqual([...data.subarray(8)], [8, 6, 0, 0, 0]);
    } else if (type === 'IDAT') compressed.push(data);
    else if (type === 'IEND') { assert.equal(length, 0); ended = true; assert.equal(offset + 12, png.length); }
    else assert.fail('Unexpected chunk: ' + type);
    offset += length + 12;
  }
  assert.ok(ended && compressed.length);
  assert.ok(width <= 2048 && height <= 2048);
  const raw = zlib.inflateSync(Buffer.concat(compressed));
  assert.equal(raw.length, height * (width * 4 + 1));
  const pixels = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    assert.equal(raw[row * (width * 4 + 1)], 0);
    raw.copy(pixels, row * width * 4, row * (width * 4 + 1) + 1, (row + 1) * (width * 4 + 1));
  }
  return { width, height, pixels, bytes: png.length };
}
function evaluate(filename) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  new Function('exports', 'module', compiled)(result.exports, result);
  return result.exports;
}
const { NPC_ARTWORK_BY_ID, loadNpcArtwork, createNpcAnimations } = evaluate('src/game/assets/npcArtwork.ts');
assert.deepEqual(Object.keys(NPC_ARTWORK_BY_ID).sort(), [...ids].sort());
assert.ok(Object.isFrozen(NPC_ARTWORK_BY_ID));
const sheets = new Set(), portraits = new Set(), silhouettes = new Set();
const palette = new Set(['172a2b', '352c2c', 'c6a66b', 'e8c991', '8a6248', 'cba968', 'e9c36b', 'e8d8b4', 'f5d88a', '497459', '81995d', '203b34', '315e55', '5cb9d5', '654a88', '87918b', '39464a', '684a39', 'f28b45']);
let bytes = 0;
for (const id of ids) {
  const metadata = NPC_ARTWORK_BY_ID[id];
  assert.ok(Object.isFrozen(metadata));
  assert.equal(metadata.frames, 8); assert.equal(metadata.size, 48); assert.equal(metadata.feet, 42);
  assert.equal(metadata.spriteKey, 'npc_' + id); assert.equal(metadata.portraitKey, 'npc_' + id + '_portrait');
  assert.equal(metadata.idleAnimation, 'npc_' + id + '_idle'); assert.equal(metadata.dialogueAnimation, 'npc_' + id + '_dialogue');
  for (const [suffix, width, height, hashes] of [['', 384, 48, sheets], ['-portrait', 96, 96, portraits]]) {
    const image = readPng(path.join(directory, id + suffix + '.png'));
    bytes += image.bytes;
    assert.equal(image.width, width); assert.equal(image.height, height);
    const hash = crypto.createHash('sha256').update(image.pixels).digest('hex');
    assert.ok(!hashes.has(hash), 'Duplicate artwork: ' + id + suffix); hashes.add(hash);
    const frameWidth = suffix ? 96 : 48, frameHashes = new Set();
    for (let frame = 0; frame < width / frameWidth; frame++) {
      const colors = new Set(), alpha = [], rgba = [];
      let opaque = 0, foot = false;
      for (let row = 0; row < height; row++) for (let column = 0; column < frameWidth; column++) {
        const offset = (row * width + frame * frameWidth + column) * 4;
        const pixel = image.pixels.subarray(offset, offset + 4);
        assert.ok(pixel[3] === 0 || pixel[3] === 255);
        alpha.push(pixel[3]); rgba.push(...pixel);
        if (pixel[3]) {
          opaque++; colors.add(pixel.toString('hex'));
          assert.ok(palette.has(pixel.subarray(0, 3).toString('hex')), id + ': art-guide palette');
        }
        if (row < 2 || row >= height - 2 || column < 2 || column >= frameWidth - 2) assert.equal(pixel[3], 0, id + ': padding');
        if (!suffix && row >= metadata.feet) assert.equal(pixel[3], 0, id + ': feet baseline');
        if (!suffix && row === metadata.feet - 1 && pixel[3]) foot = true;
      }
      assert.ok(opaque > (suffix ? 1400 : 230) && opaque < frameWidth * height * 0.85, id + ': coverage');
      assert.ok(colors.size >= 9, id + ': color diversity');
      if (!suffix) assert.ok(foot, id + ': feet contact');
      frameHashes.add(crypto.createHash('sha256').update(Buffer.from(rgba)).digest('hex'));
      if (!suffix && frame === 0) silhouettes.add(crypto.createHash('sha256').update(Buffer.from(alpha)).digest('hex'));
    }
    if (!suffix) assert.equal(frameHashes.size, 8, id + ': animation diversity');
  }
}
assert.equal(silhouettes.size, 15, 'All NPC silhouettes must be distinct');
const queued = new Map(), textures = new Map(), animations = new Map();
const scene = {
  textures: { exists: key => textures.has(key), get: key => textures.get(key) },
  load: {
    list: new Set(), inflight: new Set(),
    spritesheet(key, url, config) { assert.ok(!queued.has(key)); const file = { key, url, config }; queued.set(key, file); this.list.add(file); },
    image(key, url) { assert.ok(!queued.has(key)); const file = { key, url }; queued.set(key, file); this.list.add(file); },
  },
  anims: {
    exists: key => animations.has(key),
    generateFrameNumbers: (key, { start, end }) => Array.from({ length: end - start + 1 }, (_, index) => ({ key, frame: start + index })),
    create(config) { assert.ok(!animations.has(config.key)); animations.set(config.key, config); },
  },
};
createNpcAnimations(scene); assert.equal(animations.size, 0);
loadNpcArtwork(scene); loadNpcArtwork(scene); assert.equal(queued.size, 30);
scene.load.inflight = scene.load.list; scene.load.list = new Set();
loadNpcArtwork(scene); assert.equal(queued.size, 30);
for (const file of queued.values()) {
  assert.ok(fs.existsSync(path.join(root, 'public', file.url)));
  if (file.config) assert.deepEqual(file.config, { frameWidth: 48, frameHeight: 48, endFrame: 7 });
  textures.set(file.key, { has: frame => Number(frame) >= 0 && Number(frame) < 8 });
}
scene.load.inflight = new Set();
loadNpcArtwork(scene); assert.equal(queued.size, 30);
createNpcAnimations(scene); createNpcAnimations(scene); assert.equal(animations.size, 30);
for (const metadata of Object.values(NPC_ARTWORK_BY_ID)) {
  assert.deepEqual(animations.get(metadata.idleAnimation).frames.map(frame => frame.frame), [0, 1, 2, 3]);
  assert.deepEqual(animations.get(metadata.dialogueAnimation).frames.map(frame => frame.frame), [4, 5, 6, 7]);
  assert.equal(animations.get(metadata.idleAnimation).repeat, -1);
  assert.equal(animations.get(metadata.dialogueAnimation).repeat, 0, 'Dialogue must finish and restore idle');
}
const incomplete = { ...scene, textures: { exists: () => true, get: () => ({ has: () => false }) }, anims: { ...scene.anims, exists: () => false, create: () => assert.fail('Incomplete texture registered') } };
createNpcAnimations(incomplete);
assert.equal(NPC_ARTWORK_BY_ID['unknown-npc'], undefined);
console.log('NPC checks PASS: 15 IDs, 120 sprite frames, 15 portraits, ' + bytes + ' PNG bytes; silhouettes/CRC/padding/idempotence verified.');
