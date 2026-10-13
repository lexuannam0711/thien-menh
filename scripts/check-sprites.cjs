const assert = require('node:assert/strict');
const fs = require('node:fs');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const ts = require('typescript');

function readPng(filename) {
  const png = fs.readFileSync(filename);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  let width, height;
  const compressed = [];
  let ended = false;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    let crc = 0xffffffff;
    for (const byte of png.subarray(offset + 4, offset + 8 + length)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1;
    }
    assert.equal((crc ^ 0xffffffff) >>> 0, png.readUInt32BE(offset + 8 + length), filename + ': CRC');
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.deepEqual([...data.subarray(8)], [8, 6, 0, 0, 0]);
    }
    if (type === 'IDAT') compressed.push(data);
    offset += length + 12;
    if (type === 'IEND') { ended = true; assert.equal(offset, png.length); }
  }
  assert.ok(ended);
  const pixels = zlib.inflateSync(Buffer.concat(compressed));
  assert.equal(pixels.length, height * (width * 4 + 1));
  for (let row = 0; row < height; row++) assert.equal(pixels[row * (width * 4 + 1)], 0);
  return { width, height, pixels };
}

const moduleResult = { exports: {} };
const source = fs.readFileSync('src/game/assets/spriteManifest.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('exports', 'module', compiled)(moduleResult.exports, moduleResult);
const { SPRITE_MANIFEST, DIRECTIONS, animationFrames, facingDirection, canPlayLocomotion } = moduleResult.exports;
const heroes = ['hero', 'hero_axe', 'hero_sword'];
const bosses = ['thuongluong', 'thachtuong', 'hacan'];
assert.deepEqual(Object.keys(SPRITE_MANIFEST), ['hero', 'hero_axe', 'hero_sword', 'moctinh', 'matroi', 'hoyer', 'wolf', 'spider', ...bosses]);
for (const name of bosses) {
  const sheet = SPRITE_MANIFEST[name];
  assert.equal(sheet.size, 96, name + ': boss frame size');
  assert.equal(sheet.columns, 33, name + ': logical direction stride');
  assert.equal(sheet.atlasColumns, 21, name + ': physical atlas columns');
  assert.deepEqual(Object.entries(sheet.poses).map(([state, pose]) => [state, pose.count]), [
    ['idle', 4], ['walk', 6], ['windup', 4], ['attack', 6], ['hit', 3], ['death', 6], ['transition', 4],
  ]);
}
assert.equal(SPRITE_MANIFEST.hoyer.atlasColumns, 21, 'Tiger repacked without changing logical poses');
for (const [name, size, columns] of [['hero', 48, 68], ['moctinh', 48, 24], ['matroi', 32, 24], ['hoyer', 96, 24], ['wolf', 48, 24], ['spider', 48, 24]]) {
  assert.equal(SPRITE_MANIFEST[name].size, size, name + ': original frame size');
  assert.equal(SPRITE_MANIFEST[name].columns, columns, name + ': original direction stride');
}
assert.deepEqual(Object.entries(SPRITE_MANIFEST.hero.poses).map(([state, pose]) => [state, pose.count]), [
  ['idle', 4], ['walk', 6], ['run', 6], ['attack1', 5], ['attack2', 5], ['attack3', 6],
  ['dodge', 4], ['hit', 3], ['death', 6], ['earth', 5], ['fire', 5], ['water', 5], ['victory', 4], ['interaction', 4],
]);
for (const name of heroes) {
  assert.ok(SPRITE_MANIFEST[name], name + ': required weapon sheet');
  assert.equal(SPRITE_MANIFEST[name].columns, 68, name + ': logical direction stride');
  assert.deepEqual(SPRITE_MANIFEST[name].poses, SPRITE_MANIFEST.hero.poses, name + ': unchanged hero poses');
}
const sheetHashes = {};
const frameHashes = {};
const preservedArtwork = {
  hero: '3f6d84e12e3f929b14748d5b8fd29969eeaff9afead9c611f6fb71c1a49ae63e',
  hero_axe: '0e6f5b5e13884c10550c749e6219638f8b623e9fdd021a49451213966d9af4c5',
  hero_sword: 'b4c0dcbaaafda3dd93a2b23d9fc8a4ccd1163c6e7e7ee0ed8c5c2da29f1e0f2e',
  moctinh: 'fba3a2a3b6335865577f44f8736ac49a3ad5369390146f9ec70bf90d3715ad69',
  matroi: '6cadfcfe84f4eb80d6a1dd2654f99f02d200fe45a102208c3bef394c6910526c',
  hoyer: '642e1ea704b85bb8f6e392be3ff5d441211ed0e9317decd0dd1cea9cde69f045',
  wolf: '63c94b5ff8294d4e30bdf7d8c443c46b652951657ad3be1d9e18a9a2aea281c3',
  spider: 'ed2c4c6437d7f9fa49c6518fd6f3320031dfdcbce18cbc87419d0ae52850ed87',
};
for (const [name, sheet] of Object.entries(SPRITE_MANIFEST)) {
  const { size, columns } = sheet;
  const atlasColumns = sheet.atlasColumns ?? columns;
  const frameCount = columns * DIRECTIONS.length;
  const png = readPng('public/assets/sprites/' + name + '.png');
  assert.equal(png.width, size * atlasColumns, name + ': physical columns');
  assert.equal(png.height, size * Math.ceil(frameCount / atlasColumns), name + ': row-major rows');
  assert.ok(png.width <= 2048 && png.height <= 2048, name + ': physical dimension ceiling');
  if (bosses.includes(name)) assert.equal(frameCount, 132, name + ': exact boss frame count');
  if (heroes.includes(name)) {
    assert.equal(frameCount, 272, name + ': exact hero frame count');
    assert.ok(png.width <= 2048 && png.height <= 2048, name + ': physical dimension ceiling');
  }
  const hashes = [];
  for (let frame = 0; frame < atlasColumns * Math.ceil(frameCount / atlasColumns); frame++) {
      const pixels = Buffer.concat(Array.from({ length: size }, (_, row) => {
        const offset = (Math.floor(frame / atlasColumns) * size + row) * (png.width * 4 + 1) + 1 + frame % atlasColumns * size * 4;
        return png.pixels.subarray(offset, offset + size * 4);
      }));
      if (frame >= frameCount) {
        assert.ok(pixels.every(value => value === 0), name + ': transparent unused atlas cells');
        continue;
      }
      const alpha = [...pixels].filter((_, index) => index % 4 === 3);
      assert.ok(alpha.some(value => value === 0), name + ': transparency');
      assert.ok(alpha.filter(value => value > 0).length > size * size * 0.02, name + ': visible artwork');
      assert.equal(alpha[0], 0, name + ': padding');
      if (heroes.includes(name) || bosses.includes(name)) for (let edge = 0; edge < size; edge++) {
        for (const index of [edge, (size - 1) * size + edge, edge * size, edge * size + size - 1]) {
          assert.equal(alpha[index], 0, name + ': transparent frame border');
        }
      }
      hashes.push(crypto.createHash('sha256').update(pixels).digest('hex'));
  }
  assert.equal(hashes.length, frameCount, name + ': exact artwork count');
  assert.equal(new Set(hashes).size, hashes.length, name + ': duplicate poses/directions');
  frameHashes[name] = hashes;
  if (Object.hasOwn(preservedArtwork, name)) assert.equal(crypto.createHash('sha256').update(hashes.join('')).digest('hex'), preservedArtwork[name], name + ': preserved logical artwork');
  sheetHashes[name] = crypto.createHash('sha256').update(fs.readFileSync('public/assets/sprites/' + name + '.png')).digest('hex');
}
assert.equal(new Set(heroes.map(name => sheetHashes[name])).size, 3, 'Three distinct weapon sheet bytes');
assert.equal(new Set(bosses.flatMap(name => frameHashes[name])).size, 396, 'Three anatomically distinct bosses across every pose/direction');
for (let frame = 0; frame < 272; frame++) {
  assert.equal(new Set(heroes.map(name => frameHashes[name][frame])).size, 3, 'Distinct weapons at frame ' + frame);
}
assert.deepEqual(DIRECTIONS, ['down', 'left', 'right', 'up']);
for (const [name, manifest] of Object.entries(SPRITE_MANIFEST)) {
  const covered = [];
  for (const direction of DIRECTIONS) {
    for (const [state, pose] of Object.entries(manifest.poses)) {
      const frames = animationFrames(name, state, direction);
      assert.equal(frames.length, pose.count);
      assert.equal(frames[0], DIRECTIONS.indexOf(direction) * manifest.columns + pose.start);
      assert.ok(frames.every(frame => frame >= 0 && frame < manifest.columns * 4));
      covered.push(...frames);
    }
  }
  assert.equal(covered.length, manifest.columns * 4);
  assert.equal(new Set(covered).size, covered.length, name + ': nonoverlapping ranges');
}
assert.equal(facingDirection(0, -1), 'up');
assert.equal(facingDirection(-1, 0), 'left');
assert.equal(facingDirection(1, 0), 'right');
assert.equal(facingDirection(0, 1), 'down');
for (const state of ['attack1', 'attack2', 'attack3', 'attack', 'hit', 'death', 'earth', 'fire', 'water', 'dodge']) assert.equal(canPlayLocomotion(state, true), false);
assert.equal(canPlayLocomotion('walk', true), true);
assert.equal(canPlayLocomotion('hit', false), true);
assert.equal(canPlayLocomotion('death', false), false);
function loadActor(filename, mocks) {
  const result = { exports: {} };
  const javascript = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', javascript)(name => {
    assert.ok(Object.hasOwn(mocks, name), 'Unexpected dependency: ' + name);
    return mocks[name];
  }, result, result.exports);
  return result.exports;
}
const state = { data: { hp: 100, mp: 10, maxMp: 20 }, save() {} };
const sprite = () => ({
  key: '', texture: { key: 'hero_sprite' }, anims: { isPlaying: true }, setFlipX() { return this; },
  setTexture(key) { this.texture = { key }; return this; },
  play(key) { this.key = key; this.anims.isPlaying = true; return this; },
});
const view = () => ({ x: 100, y: 200, setPosition(horizontal, vertical) { this.x = horizontal; this.y = vertical; return this; },
  setDepth() { return this; }, setScale() { return this; }, setAlpha() { return this; } });
const stats = { hp: 100, radius: 22, range: 32, speed: 80, role: 'melee', attack: 10, scale: 1 };
const config = { BALANCE: { comboWindowMs: 1000, attackBufferMs: 150, dodgeCooldownMs: 1200, dodgeDurationMs: 190 }, ENEMIES: {
  test: stats, charge: { ...stats, role: 'charge' }, ambush: { ...stats, role: 'ambush' },
} };
const scene = { time: { now: 1000 }, tweens: { add() {} }, cameras: { main: { shake() { throw new Error('Reduced motion shake'); } } },
  textures: { exists: key => heroes.some(name => key === name + '_sprite'), get: key => ({
    has: frame => Number.isInteger(Number(frame)) && Number(frame) >= 0
      && Number(frame) < SPRITE_MANIFEST[key.replace(/_sprite$/, '')].columns * DIRECTIONS.length,
  }) }, anims: { exists: () => true } };
const shared = {
  phaser: { Math: { Clamp: (value, min, max) => Math.min(max, Math.max(min, value)) } },
  '../../data/config': config,
  '../ui/art': { floatText() {} },
  '../assets/assetLoader': { SPRITE_KEYS: Object.fromEntries(heroes.map(name => [name, name + '_sprite'])) },
  '../assets/spriteManifest': moduleResult.exports,
  '../assets/equipmentArtwork': loadActor('src/game/assets/equipmentArtwork.ts', { './spriteManifest': moduleResult.exports }),
  '../rendering/GraphicsSettings': { graphicsSettings: { getBudget: () => ({ cameraShake: false }) } },
  '../../data/weapons': { calculateWeaponAttackTiming: () => 300, getEquippedWeaponOrDefault: () => ({}) },
};
const { Player } = loadActor('src/game/entities/Player.ts', {
  ...shared, '../systems/GameState': { gameState: state, getPlayerStats: () => ({ speed: 100, maxMp: 20 }) },
  '../ui/TouchControls': {}, '../world/WorldBounds': { moveInWorld: (_, next) => next },
  '../systems/SkillCombat': {}, '../audio/AudioManager': { audioManager: { playCue() {} } },
});
const player = Object.assign(Object.create(Player.prototype), {
  scene, view: view(), sprite: sprite(), locked: () => false, keys: null,
  controls: { direction: { x: 0, y: 0 } }, direction: { x: 0, y: -1, clone() { return this; } },
  shieldRemainingMs: 0, skillInvulnerabilityMs: 0, attackAt: 0, dodgeEndAt: 0, invulnerableUntil: 0,
  visualState: 'idle', lastAttack: -3000, combo: 0, barriers: [], actions: { basic() {}, dead() {} },
});
for (let combo = 1; combo <= 3; combo++) {
  scene.time.now += 400;
  player.attack();
  assert.equal(player.sprite.key, 'hero_attack' + combo + '_up');
  scene.time.now += 301;
  player.update(16);
  assert.equal(player.sprite.key, 'hero_attack' + combo + '_up', 'Player update preserves unfinished combo');
  player.sprite.anims.isPlaying = false;
  player.update(16);
  assert.equal(player.sprite.key, 'hero_idle_up');
}
let basicHits = 0;
player.actions.basic = () => basicHits++;
scene.time.now += 1000;
player.attack();
assert.equal(basicHits, 1);
scene.time.now += 250;
player.attack(); player.attack();
assert.equal(basicHits, 1, 'Recovery buffers without immediate damage');
scene.time.now += 50;
player.update(16);
assert.equal(basicHits, 2, 'Buffered input fires once when recovery ends');
player.update(16);
assert.equal(basicHits, 2, 'Consumed buffer cannot repeat');
scene.time.now += 10;
player.attack();
scene.time.now += 301;
player.update(16);
assert.equal(basicHits, 2, 'Expired early input cannot fire');
player.attack();
scene.time.now += 250;
player.attack();
player.locked = () => true;
player.update(16);
player.locked = () => false;
scene.time.now += 50;
player.update(16);
assert.equal(basicHits, 3, 'Control lock clears buffered input');
player.attack();
scene.time.now += 250;
player.attack();
player.dodgeReadyAt = 0;
player.dodge();
scene.time.now += 261;
player.update(16);
assert.equal(basicHits, 4, 'Dodge cancels pending combo input');
player.attack();
scene.time.now += 250;
player.attack();
player.hit(10);
scene.time.now += 50;
player.update(16);
assert.equal(basicHits, 5, 'Taking damage clears pending combo input');
assert.equal(player.sprite.key, 'hero_hit_up', 'Player update preserves hit');
player.invulnerableUntil = 0;
player.hit(1000); player.sprite.anims.isPlaying = false; player.update(16);
assert.equal(player.sprite.key, 'hero_death_up', 'Player death never returns to idle');
const testArtwork = { spriteKey: 'enemy_test', animationPrefix: 'enemy_test', size: 48, feet: 42 };
const { Enemy } = loadActor('src/game/entities/Enemy.ts', { ...shared, './Player': { Player }, './Projectile': {},
  '../ui/art': { ...shared['../ui/art'], label: () => view() },
  '../assets/enemyArtwork': { ENEMY_ARTWORK_BY_ID: { test: testArtwork } } });
const renderedSprite = { ...sprite(), setScale(value) { this.scale = value; return this; }, setY(value) { this.y = value; return this; } };
const renderedView = { ...view(), addAt() {}, add() {} };
const decoration = () => ({ setOrigin() { return this; }, setStrokeStyle() { return this; }, setVisible() { return this; } });
const renderedEnemy = new Enemy({ textures: { exists: key => key === 'enemy_test' }, add: {
  ellipse: decoration, rectangle: decoration, circle: decoration, sprite: (_, __, key) => { assert.equal(key, testArtwork.spriteKey); return renderedSprite; },
  container: () => renderedView,
} }, 'test', 100, 200, () => {});
assert.equal(renderedEnemy.spritePrefix, testArtwork.animationPrefix);
assert.equal(renderedSprite.key, 'enemy_test_idle_down');
assert.equal(renderedSprite.y, stats.radius * 0.85 - 18 * stats.scale, 'Enemy feet do not align with its shadow');
const enemy = Object.assign(Object.create(Enemy.prototype), {
  scene, kind: 'test', view: view(), sprite: sprite(), alive: true, hp: 100, maxHp: 100,
  activeTime: 0, stunRemainingMs: 0, slowRemainingMs: 0, burnRemainingMs: 0,
  chargeRemainingMs: 0, windup: false, rangedWindup: false, readyAt: 10000, visualState: 'hit',
  facing: 'left', hpFill: { setScale() {} }, warning: { setVisible() {} }, onDeath() {},
});
enemy.sprite.key = 'moctinh_hit_left';
enemy.update(0, 16, { x: 300, y: 200 });
assert.equal(enemy.sprite.key, 'moctinh_hit_left', 'Enemy movement preserves hit');
enemy.sprite.anims.isPlaying = false;
enemy.update(0, 16, { x: 300, y: 200 });
assert.equal(enemy.sprite.key, 'moctinh_walk_right');
enemy.damage(1000);
const deathKey = enemy.sprite.key;
enemy.update(0, 16, { x: 300, y: 200 });
assert.equal(enemy.sprite.key, deathKey);
assert.equal(deathKey, 'moctinh_death_right');
for (const [kind, prefix] of [['charge', 'wolf'], ['ambush', 'spider']]) {
  const actor = Object.assign(Object.create(Enemy.prototype), { ...enemy, kind, alive: true, hp: 100, visualState: 'idle', sprite: sprite() });
  actor.damage(1);
  assert.equal(actor.sprite.key, prefix + '_hit_right', kind + ': real directional hit');
}
const animations = new Map();
const bespokeEnemy = Object.assign(Object.create(Enemy.prototype), { ...enemy, visualState: 'idle', sprite: sprite(), spritePrefix: 'enemy_soi-rung-hac-am' });
bespokeEnemy.playPose('attack');
assert.equal(bespokeEnemy.sprite.key, 'enemy_soi-rung-hac-am_attack_right', 'Canonical enemy artwork still uses role-family animation');
const textureNames = { hero_sprite: 'hero', hero_axe_sprite: 'hero_axe', hero_sword_sprite: 'hero_sword', moctinh_sprite: 'moctinh', matroi_sprite: 'matroi', hoyer_sprite: 'hoyer', wolf_sprite: 'wolf', spider_sprite: 'spider' };
for (const name of bosses) textureNames[name + '_sprite'] = name;
const animationScene = {
  textures: { exists: key => Object.hasOwn(textureNames, key), get: key => ({
    has: frame => Number(frame) >= 0 && Number(frame) < SPRITE_MANIFEST[textureNames[key]].columns * 4,
  }) },
  anims: { exists: key => animations.has(key), generateFrameNumbers: (_, options) => options.frames,
    create: animation => animations.set(animation.key, animation) },
};
const { createGameAnimations, loadGameAssets, SPRITE_KEYS } = loadActor('src/game/assets/assetLoader.ts', { './spriteManifest': moduleResult.exports, './enemyArtwork': { loadEnemyArtwork() {}, createEnemyAnimations() {} }, './environmentArtwork': { loadEnvironmentArtwork() {} }, './equipmentArtwork': { loadEquipmentArtwork() {} }, '../rendering/ScenePresentation': { presentScenePreload() {} } });
const loadedSheets = [];
loadGameAssets({ textures: { exists: () => false }, load: { spritesheet: (key, url, options) => loadedSheets.push({ key, url, options }) } });
assert.equal(loadedSheets.length, Object.keys(SPRITE_MANIFEST).length);
loadGameAssets({ textures: { exists: () => true }, load: { spritesheet() { assert.fail('Cached sprite loaded again'); } } });
for (const [name, sheet] of Object.entries(SPRITE_MANIFEST)) {
  assert.equal(SPRITE_KEYS[name], name + '_sprite', name + ': exact texture key');
  const loaded = loadedSheets.find(entry => entry.key === SPRITE_KEYS[name]);
  assert.equal(loaded.url, '/assets/sprites/' + name + '.png');
  assert.deepEqual(loaded.options, { frameWidth: sheet.size, frameHeight: sheet.size, endFrame: sheet.columns * 4 - 1 });
}
for (const name of heroes) {
  assert.equal(SPRITE_KEYS[name], name + '_sprite');
  const loaded = loadedSheets.find(sheet => sheet.key === SPRITE_KEYS[name]);
  assert.equal(loaded.url, '/assets/sprites/' + name + '.png');
  assert.deepEqual(loaded.options, { frameWidth: 48, frameHeight: 48, endFrame: 271 });
}
createGameAnimations(animationScene);
for (const [name, sheet] of Object.entries(SPRITE_MANIFEST)) for (const [pose, definition] of Object.entries(sheet.poses)) {
  for (const direction of DIRECTIONS) {
    const registered = animations.get(name + '_' + pose + '_' + direction);
    assert.ok(registered, name + ': missing animation');
    assert.deepEqual(registered.frames, animationFrames(name, pose, direction));
    assert.equal(registered.repeat, definition.repeat);
  }
}
for (const legacy of ['hero_attack', 'hero_axe_attack', 'hero_sword_attack', 'hoyer_stalk', 'hoyer_pounce', 'matroi_float', 'moctinh_attack']) assert.ok(animations.has(legacy), legacy + ': compatibility');
const registeredCount = animations.size;
createGameAnimations(animationScene);
assert.equal(animations.size, registeredCount, 'Registration is idempotent');
console.log('Sprite PNG integrity, distinct poses/directions, manifest ranges, Player/Enemy animation priority: PASS');
