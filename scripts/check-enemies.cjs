const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const catalog = fs.readFileSync(path.join(root, "src/data/contentCatalog.ts"), "utf8");
const roster = name => [...catalog.split("export const " + name + ":")[1].split("]);")[0].matchAll(/\bid: '([^']+)'/g)].map(match => match[1]);
const common = roster("COMMON_ENEMIES"), elites = roster("ELITES"), ids = [...common, ...elites];
assert.equal(common.length, 12); assert.equal(elites.length, 4);
for (const id of ids) assert.ok(fs.existsSync(path.join(root, "public/assets/enemies", id + ".png")), "Missing enemy asset: " + id);
const directory = path.join(root, 'public/assets/enemies');
assert.deepEqual(fs.readdirSync(directory).filter(name => name.endsWith('.png')).sort(), ids.map(id => id + '.png').sort());
const zlib = require('node:zlib'), crypto = require('node:crypto'), ts = require('typescript');
function readPng(filename) {
  const png = fs.readFileSync(filename), compressed = [];
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width, height, ended = false;
  for (let offset = 8; offset < png.length;) {
    assert.ok(offset + 12 <= png.length);
    const length = png.readUInt32BE(offset);
    assert.ok(offset + length + 12 <= png.length);
    const type = png.toString('ascii', offset + 4, offset + 8), data = png.subarray(offset + 8, offset + 8 + length);
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
    else assert.fail('Unexpected PNG chunk ' + type);
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
const source = fs.readFileSync(path.join(root, 'src/game/assets/enemyArtwork.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
assert.equal(compiled.diagnostics.length, 0);
const moduleExports = {};
new Function('exports', 'require', compiled.outputText)(moduleExports, () => assert.fail('Runtime imports must remain type-only'));
const { ENEMY_ARTWORK_BY_ID, loadEnemyArtwork, createEnemyAnimations } = moduleExports;
assert.ok(Object.isFrozen(ENEMY_ARTWORK_BY_ID));
assert.equal(ENEMY_ARTWORK_BY_ID['moc-tinh'], ENEMY_ARTWORK_BY_ID['moc-tinh-con']);
assert.equal(ENEMY_ARTWORK_BY_ID['ma-troi'], ENEMY_ARTWORK_BY_ID['ma-troi-u-am']);
assert.equal(ENEMY_ARTWORK_BY_ID['unknown-enemy'], undefined);
assert.equal(Object.keys(ENEMY_ARTWORK_BY_ID).length, 18);
const directions = ['down', 'left', 'right', 'up'];
const actions = [['idle', 0, 4, 5, -1], ['walk', 4, 6, 8, -1], ['attack', 10, 5, 14, 0], ['hit', 15, 3, 14, 0], ['death', 18, 6, 24, 0]];
const silhouettes = new Set();
let bytes = 0;
for (const id of ids) {
  const metadata = ENEMY_ARTWORK_BY_ID[id];
  assert.ok(metadata && Object.isFrozen(metadata), id + ': metadata');
  assert.equal(metadata.size, elites.includes(id) ? 64 : 48);
  assert.equal(metadata.feet, metadata.size * 7 / 8); assert.equal(metadata.frames, 96);
  const image = readPng(path.join(directory, id + '.png')); bytes += image.bytes;
  assert.equal(image.width, metadata.size * 24); assert.equal(image.height, metadata.size * 4);
  const directionHashes = new Set(), directionMasks = new Set();
  for (let direction = 0; direction < 4; direction++) {
    const hashes = [];
    for (let frame = 0; frame < 24; frame++) {
      const rgba = [], alpha = [], colors = new Set();
      let opaque = 0;
      for (let row = 0; row < metadata.size; row++) for (let column = 0; column < metadata.size; column++) {
        const offset = ((direction * metadata.size + row) * image.width + frame * metadata.size + column) * 4;
        const pixel = image.pixels.subarray(offset, offset + 4);
        assert.ok(pixel[3] === 0 || pixel[3] === 255, id + ': binary alpha');
        if (row < 2 || row >= metadata.feet || column < 2 || column >= metadata.size - 2) assert.equal(pixel[3], 0, id + ': padding/feet');
        if (pixel[3]) { opaque++; colors.add(pixel.subarray(0, 3).toString('hex')); }
        rgba.push(...pixel); alpha.push(pixel[3]);
      }
      assert.ok(opaque > 45 && opaque < metadata.size * metadata.size * 0.85, id + ': transparency/coverage');
      assert.ok(colors.size >= 4, id + ': material shading');
      const hash = crypto.createHash('sha256').update(Buffer.from(rgba)).digest('hex'); hashes.push(hash);
      if (!frame) {
        directionHashes.add(hash);
        const mask = crypto.createHash('sha256').update(Buffer.from(alpha)).digest('hex'); directionMasks.add(mask);
        if (!direction) silhouettes.add(mask);
      }
    }
    assert.equal(directionHashes.size, direction + 1, id + ': distinct directional pose');
    for (const [action, start, count] of actions) assert.ok(new Set(hashes.slice(start, start + count)).size >= Math.min(count, 3), id + ': ' + action + ' articulated poses');
    assert.notEqual(hashes[10], hashes[12], id + ': attack anticipation/contact');
    assert.notEqual(hashes[18], hashes[23], id + ': death collapse');
  }
  assert.equal(directionMasks.size, 4, id + ': four facing silhouettes');
}
assert.equal(silhouettes.size, 16, 'Original anatomical silhouettes, not palette swaps');
const queued = new Map(), textures = new Map(), animations = new Map();
const scene = {
  textures: { exists: key => textures.has(key), get: key => textures.get(key) },
  load: { list: new Set(), inflight: new Set(), spritesheet(key, url, config) {
    assert.ok(!queued.has(key), 'Duplicate loader key');
    const file = { key, url, config }; queued.set(key, file); this.list.add(file);
  } },
  anims: { exists: key => animations.has(key),
    generateFrameNumbers: (key, { start, end }) => Array.from({ length: end - start + 1 }, (_, index) => ({ key, frame: start + index })),
    create(config) { assert.ok(!animations.has(config.key)); animations.set(config.key, config); } },
};
createEnemyAnimations(scene); assert.equal(animations.size, 0);
loadEnemyArtwork(scene); loadEnemyArtwork(scene); assert.equal(queued.size, 16);
scene.load.inflight = scene.load.list; scene.load.list = new Set(); loadEnemyArtwork(scene); assert.equal(queued.size, 16);
for (const id of ids) {
  const metadata = ENEMY_ARTWORK_BY_ID[id], file = queued.get(metadata.spriteKey);
  assert.equal(file.url, '/assets/enemies/' + id + '.png');
  assert.deepEqual(file.config, { frameWidth: metadata.size, frameHeight: metadata.size, endFrame: 95 });
  textures.set(metadata.spriteKey, { has: frame => Number(frame) >= 0 && Number(frame) < 96 });
}
scene.load.inflight = new Set(); loadEnemyArtwork(scene); assert.equal(queued.size, 16);
createEnemyAnimations(scene); createEnemyAnimations(scene); assert.equal(animations.size, 320);
for (const id of ids) for (let direction = 0; direction < 4; direction++) for (const [action, start, count, frameRate, repeat] of actions) {
  const metadata = ENEMY_ARTWORK_BY_ID[id];
  const animation = animations.get(metadata.animationPrefix + '_' + action + '_' + directions[direction]);
  assert.ok(animation);
  assert.deepEqual(animation.frames.map(frame => frame.frame), Array.from({ length: count }, (_, index) => direction * 24 + start + index));
  assert.equal(animation.frameRate, frameRate); assert.equal(animation.repeat, repeat);
}
const incomplete = { ...scene, textures: { exists: () => true, get: () => ({ has: () => false }) }, anims: { ...scene.anims, exists: () => false, create: () => assert.fail('Incomplete frames registered') } };
createEnemyAnimations(incomplete);
console.log('Enemy checks PASS: 12 common + 4 elites, 1536 frames, 320 animations, ' + bytes + ' PNG bytes; CRC/atlas/padding/transparency/silhouettes/directions/ranges/idempotence.');
