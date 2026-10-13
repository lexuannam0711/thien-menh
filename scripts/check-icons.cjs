const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { inflateSync } = require('node:zlib');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const imagePath = path.join(root, 'public/assets/icons/rpg-icons.png');
assert.ok(fs.existsSync(imagePath), 'Missing icon atlas: public/assets/icons/rpg-icons.png');
function moduleExports(relative) {
  const result = {};
  new Function('exports', ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(result);
  return result;
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const png = fs.readFileSync(imagePath);
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
const chunks = [];
let header, offset = 8, ended = false;
while (offset < png.length) {
  const length = png.readUInt32BE(offset);
  assert.ok(offset + length + 12 <= png.length, 'Truncated PNG chunk');
  const type = png.toString('ascii', offset + 4, offset + 8);
  const data = png.subarray(offset + 8, offset + 8 + length);
  assert.equal(png.readUInt32BE(offset + length + 8), crc32(png.subarray(offset + 4, offset + length + 8)), type + ' CRC');
  if (type === 'IHDR') { assert.ok(!header); header = data; }
  else if (type === 'IDAT') chunks.push(data);
  else if (type === 'IEND') { assert.equal(length, 0); ended = true; }
  else assert.fail('Unexpected PNG chunk: ' + type);
  offset += length + 12;
  if (ended) break;
}
assert.ok(ended && header && chunks.length);
assert.equal(offset, png.length, 'No trailing data');
assert.equal(header.length, 13);
assert.deepEqual([...header.subarray(8)], [8, 6, 0, 0, 0], '8-bit RGBA noninterlaced');
const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
assert.ok(width <= 2048 && height <= 2048 && width > 0 && height > 0);
assert.equal(width % 32, 0); assert.equal(height % 32, 0);
const raw = inflateSync(Buffer.concat(chunks));
assert.equal(raw.length, height * (width * 4 + 1));
const pixels = Buffer.alloc(width * height * 4);
for (let row = 0; row < height; row++) {
  assert.equal(raw[row * (width * 4 + 1)], 0, 'Deterministic unfiltered pixels');
  raw.copy(pixels, row * width * 4, row * (width * 4 + 1) + 1, (row + 1) * (width * 4 + 1));
}
const artwork = moduleExports('src/game/assets/iconArtwork.ts');
const items = moduleExports('src/data/items.ts').ITEMS.map(item => item.id);
const skills = moduleExports('src/data/skills.ts').SKILLS.map(skill => skill.id);
const frames = [...Object.values(artwork.ITEM_ICON_FRAMES), ...Object.values(artwork.SKILL_ICON_FRAMES)];
assert.deepEqual(Object.keys(artwork.ITEM_ICON_FRAMES), items);
assert.deepEqual(Object.keys(artwork.SKILL_ICON_FRAMES), skills);
assert.ok(Object.isFrozen(artwork.ITEM_ICON_FRAMES) && Object.isFrozen(artwork.SKILL_ICON_FRAMES));
assert.equal(artwork.ITEM_ICON_FRAMES['unknown-item'], undefined);
assert.equal(artwork.SKILL_ICON_FRAMES['unknown-skill'], undefined);
assert.equal(artwork.ICON_FRAME_SIZE, 32);
assert.equal(artwork.ICON_FRAME_COUNT, items.length + skills.length);
assert.deepEqual(frames, Array.from({ length: items.length + skills.length }, (_, index) => index));
assert.equal(new Set(frames).size, frames.length);
assert.equal(artwork.ICON_TEXTURE_KEY, 'rpg-icons');
assert.ok(width * height / 1024 >= frames.length && width * height / 1024 < frames.length + width / 32);
const silhouettes = [], hashes = new Set();
for (let frame = 0; frame < width * height / 1024; frame++) {
  const mask = [], rgba = [], colors = new Set();
  let occupied = 0;
  for (let row = 0; row < 32; row++) for (let column = 0; column < 32; column++) {
    const pixelOffset = (((Math.floor(frame / (width / 32)) * 32 + row) * width) + (frame % (width / 32)) * 32 + column) * 4;
    const pixel = pixels.subarray(pixelOffset, pixelOffset + 4);
    assert.ok(pixel[3] === 0 || pixel[3] === 255, 'Binary pixel alpha');
    if (!pixel[3]) assert.equal(pixel.readUInt32BE(0), 0, 'Clean transparent RGB');
    mask.push(pixel[3] ? 1 : 0); rgba.push(...pixel);
    if (pixel[3]) { occupied++; colors.add(pixel.toString('hex')); }
    if (row < 2 || column < 2 || row >= 30 || column >= 30) assert.equal(pixel[3], 0, 'Two-pixel frame gutter');
  }
  if (frame >= frames.length) { assert.equal(occupied, 0, 'Atlas padding invisible'); continue; }
  assert.ok(occupied >= 70 && occupied < 650, 'Object silhouette coverage: frame ' + frame);
  assert.ok(colors.size >= 4, 'Shaded original artwork: frame ' + frame);
  const hash = crypto.createHash('sha256').update(Buffer.from(rgba)).digest('hex');
  assert.ok(!hashes.has(hash), 'Duplicate artwork'); hashes.add(hash);
  for (const previous of silhouettes) {
    const difference = mask.reduce((sum, alpha, index) => sum + (alpha !== previous[index] ? 1 : 0), 0);
    assert.ok(difference >= 25, 'Distinct silhouette, not a palette swap: frame ' + frame);
  }
  silhouettes.push(mask);
}
function loaderScene(cached = false) {
  const calls = [];
  const scene = { textures: { exists: key => cached && key === artwork.ICON_TEXTURE_KEY }, load: {
    list: new Set(), inflight: new Set(), queue: new Set(),
    spritesheet: (...args) => { calls.push(args); scene.load.list.add({ key: args[0] }); },
  } };
  return { scene, calls };
}
const normal = loaderScene();
artwork.loadIconArtwork(normal.scene); artwork.loadIconArtwork(normal.scene);
assert.deepEqual(normal.calls, [['rpg-icons', '/assets/icons/rpg-icons.png', { frameWidth: 32, frameHeight: 32, endFrame: frames.length - 1 }]]);
for (const collection of ['list', 'inflight', 'queue']) {
  const test = loaderScene(); test.scene.load[collection].add({ key: 'rpg-icons' });
  artwork.loadIconArtwork(test.scene); assert.equal(test.calls.length, 0, collection + ' idempotence');
  test.scene.load[collection].clear(); artwork.loadIconArtwork(test.scene);
  assert.equal(test.calls.length, 1, collection + ' retry after failed or reset load');
}
const cached = loaderScene(true); artwork.loadIconArtwork(cached.scene); assert.equal(cached.calls.length, 0);
const unrelated = loaderScene(); unrelated.scene.load.queue.add({ key: 'another-texture' });
artwork.loadIconArtwork(unrelated.scene); assert.equal(unrelated.calls.length, 1);
const program = ts.createProgram([path.join(root, 'src/game/assets/iconArtwork.ts')], {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true, skipLibCheck: true, noEmit: true, esModuleInterop: true,
});
assert.deepEqual(ts.getPreEmitDiagnostics(program).map(issue => ts.flattenDiagnosticMessageText(issue.messageText, '\n')), [], 'Isolated loader typecheck');
const metadataPath = path.join(root, 'src/game/assets/iconArtwork.ts');
const metadataBefore = fs.readFileSync(metadataPath);
execFileSync(process.execPath, [path.join(root, 'scripts/generate-icons.js')], { cwd: root });
assert.deepEqual(fs.readFileSync(imagePath), png, 'Byte-identical regenerated atlas');
assert.deepEqual(fs.readFileSync(metadataPath), metadataBefore, 'Byte-identical regenerated metadata');
console.log(JSON.stringify({ items: artwork.ITEM_ICON_FRAMES, skills: artwork.SKILL_ICON_FRAMES,
  frames: frames.length, width, height, bytes: png.length, sha256: crypto.createHash('sha256').update(png).digest('hex'),
  checks: 'CRC, dimensions, gutter, alpha, unique silhouettes, canonical coverage, frozen metadata, cached/list/inflight/queue loader, retry, isolated TypeScript, deterministic regeneration' }, null, 2));
