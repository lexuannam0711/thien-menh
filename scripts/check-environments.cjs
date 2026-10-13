const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const regions = ["village", "forest", "swamp", "mountain", "citadel"];
for (const region of regions) for (const kind of ["terrain", "props"]) assert.ok(fs.existsSync(path.join(root, "public/assets/environments", region + "-" + kind + ".png")), "Missing environment asset: " + region + "-" + kind);
const { inflateSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const ts = require('typescript');
function readPng(filename) {
  const png = fs.readFileSync(filename);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const compressed = [];
  let width, height, ended = false;
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
    else assert.fail('Unexpected PNG chunk: ' + type);
    offset += length + 12;
  }
  assert.ok(ended);
  const raw = inflateSync(Buffer.concat(compressed));
  assert.equal(raw.length, height * (width * 4 + 1));
  const pixels = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row++) {
    assert.equal(raw[row * (width * 4 + 1)], 0);
    raw.copy(pixels, row * width * 4, row * (width * 4 + 1) + 1, (row + 1) * (width * 4 + 1));
  }
  return { width, height, pixels, bytes: png.length };
}
const silhouettes = Array.from({ length: 8 }, () => new Set());
const hashes = new Set();
let totalBytes = 0;
for (const region of regions) for (const kind of ['terrain', 'props']) {
  const image = readPng(path.join(root, 'public/assets/environments', region + '-' + kind + '.png'));
  const size = kind === 'terrain' ? 32 : 128;
  assert.equal(image.width, size * 8); assert.equal(image.height, size);
  totalBytes += image.bytes;
  for (let frame = 0; frame < 8; frame++) {
    const rgba = Buffer.alloc(size * size * 4), mask = Buffer.alloc(size * size), colors = new Set();
    let coverage = 0, foot = false;
    for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
      const index = (row * image.width + frame * size + column) * 4;
      const pixel = image.pixels.subarray(index, index + 4);
      pixel.copy(rgba, (row * size + column) * 4);
      const alpha = pixel[3];
      assert.ok(alpha === 0 || alpha === 255, 'No antialiasing');
      if (alpha) { coverage++; colors.add(pixel.toString('hex')); mask[row * size + column] = 1; if (row === 112) foot = true; }
      if (kind === 'props' && (column < 8 || column >= 120 || row < 8 || row > 112)) assert.equal(alpha, 0, region + ' frame ' + frame + ': padding/feet');
      if (kind === 'terrain') assert.equal(alpha, 255, 'Terrain opaque');
      if (kind === 'terrain' && frame <= 1) {
        const base = image.pixels.subarray(0, 3);
        assert.ok([...pixel.subarray(0, 3)].every((value, channel) => Math.abs(value - base[channel]) <= 24),
          region + ' combat floor texture overwhelms actors and warnings');
      }
    }
    assert.ok(colors.size >= 5, region + ' ' + kind + ' ' + frame + ': material colors');
    const hash = createHash('sha256').update(rgba).digest('hex');
    assert.ok(!hashes.has(hash), 'Unique authored frames'); hashes.add(hash);
    if (kind === 'props') {
      assert.ok(coverage >= 120 && coverage < size * size * 0.75, 'Readable prop coverage');
      assert.ok(foot, region + ' frame ' + frame + ': feet at y112');
      const silhouette = createHash('sha256').update(mask).digest('hex');
      assert.ok(!silhouettes[frame].has(silhouette), 'Distinct regional silhouette: frame ' + frame);
      silhouettes[frame].add(silhouette);
    } else {
      const at = (column, row) => rgba.subarray((row * size + column) * 4, (row * size + column + 1) * 4);
      for (let edge = 0; edge < size; edge++) {
        assert.deepEqual(at(0, edge), at(31, edge), 'Horizontal repeating seam');
        assert.deepEqual(at(edge, 0), at(edge, 31), 'Vertical repeating seam');
        assert.deepEqual(at(0, edge), image.pixels.subarray(edge * image.width * 4, edge * image.width * 4 + 4), 'Shared region tile border');
        assert.deepEqual(at(edge, 0), image.pixels.subarray(edge * 4, edge * 4 + 4), 'Shared region row border');
      }
    }
  }
  console.log(region + '-' + kind + '.png ' + image.width + 'x' + image.height + ' ' + image.bytes + ' bytes');
}
const filename = path.join(root, 'src/game/assets/environmentArtwork.ts');
const source = fs.readFileSync(filename, 'utf8');
const program = ts.createProgram([filename], { noEmit: true, skipLibCheck: true, strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, esModuleInterop: true });
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(compiled, sandbox, { filename });
const { ENVIRONMENT_ARTWORK, loadEnvironmentArtwork } = sandbox.exports;
assert.deepEqual(Object.keys(ENVIRONMENT_ARTWORK), regions);
assert.ok(Object.isFrozen(ENVIRONMENT_ARTWORK));
const calls = [];
const scene = { textures: { exists: () => false }, load: { list: new Set(), inflight: new Set(), queue: new Set(), spritesheet(key, url, config) { calls.push({ key, url, config }); this.list.add({ key }); } } };
loadEnvironmentArtwork(scene); loadEnvironmentArtwork(scene);
assert.equal(calls.length, 10, 'Idempotent pending registration');
for (const region of regions) {
  const metadata = ENVIRONMENT_ARTWORK[region];
  assert.ok(Object.isFrozen(metadata));
  assert.equal(metadata.tileSize, 32); assert.equal(metadata.propSize, 128); assert.equal(metadata.feet, 112);
  for (const [kind, key, size] of [['terrain', metadata.terrainKey, 32], ['props', metadata.propKey, 128]]) {
    const call = calls.find(item => item.key === key);
    assert.equal(call.url, '/assets/environments/' + region + '-' + kind + '.png');
    assert.equal(call.config.frameWidth, size); assert.equal(call.config.frameHeight, size);
    assert.equal(call.config.startFrame, 0); assert.equal(call.config.endFrame, 7);
  }
}
for (const stage of ['inflight', 'queue']) {
  for (const file of scene.load.list) scene.load[stage].add(file);
  scene.load.list.clear(); loadEnvironmentArtwork(scene);
  assert.equal(calls.length, 10, 'Idempotent ' + stage + ' registration');
  scene.load[stage].clear();
  if (stage === 'inflight') for (const call of calls) scene.load.list.add({ key: call.key });
}
scene.textures.exists = () => true; loadEnvironmentArtwork(scene);
assert.equal(calls.length, 10, 'Idempotent cached registration');
scene.textures.exists = key => key !== ENVIRONMENT_ARTWORK.forest.propKey;
loadEnvironmentArtwork(scene); assert.equal(calls.length, 11, 'Retry missing texture only');
execFileSync(process.execPath, ['scripts/generate-environments.js', '--check'], { cwd: root, stdio: 'pipe' });
console.log('PASS: 10 PNGs, 80 distinct frames, ' + totalBytes + ' bytes; CRC, deterministic bytes, seams, padding, 40 regional silhouettes, feet, isolated typecheck, loader Sets/idempotence.');
