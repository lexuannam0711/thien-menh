const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const touchModule = { exports: {} };
const touchVM = require('node:vm');
const touchTypescript = require('typescript');
const touchShapes = [], touchTweens = [], touchActions = [];
const touchInputListeners = new Map(), touchGameListeners = new Map(), touchDocumentListeners = new Map();
let touchShutdown;
let touchReducedMotion = false, touchSystemMotion = false, touchEnabled = true;
class TouchVector { constructor(x = 0, y = 0) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; } }
const touchObject = radius => {
  const events = new Map();
  const object = { radius, events, on(name, callback) { events.set(name, callback); return object; },
    setStrokeStyle() { return object; }, setDepth() { return object; }, setInteractive() { return object; },
    setOrigin() { return object; }, setPosition(x, y) { object.x = x; object.y = y; return object; } };
  return object;
};
touchVM.runInNewContext(touchTypescript.transpileModule(fs.readFileSync('src/game/ui/TouchControls.ts', 'utf8'),
  { compilerOptions: { module: touchTypescript.ModuleKind.CommonJS } }).outputText, { exports: touchModule.exports,
  require: name => name === 'phaser' ? { default: { Math: { Vector2: TouchVector } } } :
    name.includes('GraphicsSettings') ? { graphicsSettings: { getState: () => ({ reducedMotion: touchReducedMotion }) } } : { UI_DEPTH: 2000 },
  matchMedia: () => ({ matches: touchSystemMotion }), document: {
    addEventListener: (name, callback) => touchDocumentListeners.set(name, callback),
    removeEventListener: (name, callback) => { if (touchDocumentListeners.get(name) === callback) touchDocumentListeners.delete(name); } } });
const touchScene = { add: { circle(x, y, radius) { const object = touchObject(radius); touchShapes.push(object); return object; },
  text() { return touchObject(); } }, input: { on: (name, callback) => touchInputListeners.set(name, callback),
    off: (name, callback) => { if (touchInputListeners.get(name) === callback) touchInputListeners.delete(name); } },
  game: { events: { on: (name, callback) => touchGameListeners.set(name, callback),
    off: (name, callback) => { if (touchGameListeners.get(name) === callback) touchGameListeners.delete(name); } } },
  events: { once: (name, callback) => { assert.equal(name, 'shutdown'); touchShutdown = callback; } },
  tweens: { add(tween) { touchTweens.push(tween); } } };
const touchControls = new touchModule.exports.TouchControls(touchScene, action => touchActions.push(action), () => touchEnabled);
const touchButtons = touchShapes.slice(2);
for (const button of touchButtons) assert.ok(button.radius * 2 * Math.min(640 / 960, 360 / 540) >= 44, 'Touch target below44CSSpx at640x360: ' + button.radius);
for (const button of touchButtons) button.events.get('pointerdown')();
assert.deepEqual(touchActions, ['attack', 'dodge', 'earth', 'flame', 'water', 'fourth', 'interact']);
assert.equal(touchTweens.length, 7);
assert.ok(touchTweens.every(tween => [tween.targets].flat().every(target => !touchButtons.includes(target))), 'Button feedback must not shrink44CSSpx interactive circles');
for (const preference of [{ app: true, system: false }, { app: false, system: true }, { app: true, system: true }]) {
  touchReducedMotion = preference.app; touchSystemMotion = preference.system;
  const before = touchActions.length;
  for (const button of touchButtons) button.events.get('pointerdown')();
  assert.equal(touchActions.length, before + 7, 'Reduced motion must not suppress actions');
  assert.equal(touchTweens.length, 7, 'Reduced motion must suppress decorative button tweens');
}
touchEnabled = false;
const touchActionCount = touchActions.length;
for (const button of touchButtons) button.events.get('pointerdown')();
assert.equal(touchActions.length, touchActionCount, 'Disabled controls must not perform actions');
touchEnabled = true;
for (const event of ['pointerupoutside', 'pointerup', 'pointercancel']) {
  const pointer = { id: 11, x: 164, y: 421 };
  touchShapes[0].events.get('pointerdown')(pointer);
  assert.equal(touchControls.direction.x, 1);
  touchShapes[0].events.get('pointerdown')({ id: 12, x: 54, y: 421 });
  touchInputListeners.get('pointermove')({ id: 12, x: 54, y: 421 });
  touchInputListeners.get(event)?.({ id: 12 });
  assert.equal(touchControls.direction.x, 1, 'Other pointers must not steal/release joystick');
  touchInputListeners.get(event)?.(pointer);
  assert.equal(touchControls.direction.x, 0, event + ' leaves joystick movement stuck');
  assert.equal(touchControls.direction.y, 0);
  assert.deepEqual([touchShapes[1].x, touchShapes[1].y], [109, 421]);
}
for (const reset of [touchGameListeners.get('blur'), touchDocumentListeners.get('visibilitychange')]) {
  touchShapes[0].events.get('pointerdown')({ id: 21, x: 164, y: 421 }); reset();
  assert.equal(touchControls.direction.x, 0);
}
touchShapes[0].events.get('pointerdown')({ id: 31, x: 164, y: 421 });
touchShutdown();
assert.equal(touchControls.direction.x, 0);
assert.equal(touchInputListeners.size, 0, 'Shutdown leaves pointer listeners');
assert.equal(touchGameListeners.size, 0);
assert.equal(touchDocumentListeners.size, 0);
console.log('Touch controls self-check: PASS (44CSSpx at640x360, live app/OS reduced motion, unchanged actions).');
if (process.argv.includes('--touch-only')) process.exit(0);

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-graphics-'));
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc',
    'src/game/rendering/GraphicsSettings.ts', '--target', 'ES2022', '--module', 'commonjs',
    '--skipLibCheck', '--outDir', output], { stdio: 'inherit' });
  fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');
  const graphics = require(path.join(output, 'GraphicsSettings.js'));
  const { GraphicsSettings, normalizeGraphicsSettings, getGraphicsBudget } = graphics;
  for (const value of [null, undefined, false, 123, [], 'high', {}, { quality: 'ultra' }]) {
    assert.deepEqual(normalizeGraphicsSettings(value), { quality: 'medium', reducedMotion: false });
  }
  assert.deepEqual(normalizeGraphicsSettings({ quality: 'low', reducedMotion: true }),
    { quality: 'low', reducedMotion: true });
  assert.equal(normalizeGraphicsSettings({ quality: 'high', reducedMotion: 'true' }).reducedMotion, false);
  assert.equal(normalizeGraphicsSettings({ quality: 'medium' }).quality, 'medium');
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const settings = new GraphicsSettings(storage);
  const original = settings.getState();
  assert.equal(settings.setQuality('high'), true);
  assert.equal(original.quality, 'medium');
  assert.equal(settings.setReducedMotion(true), true);
  assert.deepEqual(new GraphicsSettings(storage).getState(), { quality: 'high', reducedMotion: true });
  assert.equal(settings.setQuality('ultra'), false);
  assert.equal(settings.getState().quality, 'high');
  assert.equal(settings.setReducedMotion('true'), false);
  assert.equal(Object.isFrozen(settings.getState()), true);
  memory.set(graphics.GRAPHICS_STORAGE_KEY, '{broken');
  assert.equal(new GraphicsSettings(storage).getState().quality, 'medium');
  memory.set(graphics.GRAPHICS_STORAGE_KEY, JSON.stringify({ quality: 'low', reducedMotion: 1 }));
  assert.deepEqual(new GraphicsSettings(storage).getState(), { quality: 'low', reducedMotion: false });
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  const unavailable = new GraphicsSettings(blocked);
  assert.equal(unavailable.setQuality('low'), false);
  assert.equal(unavailable.getState().quality, 'low');
  assert.equal(new GraphicsSettings(null).setReducedMotion(true), false);
  assert.equal(new GraphicsSettings().getState().quality, 'medium');
  global.matchMedia = () => ({ matches: true });
  assert.equal(new GraphicsSettings(storage).getBudget().cameraShake, false);
  assert.equal(new GraphicsSettings(storage).getBudget().ambientParticles, 0);
  global.matchMedia = () => ({ matches: false });
  assert.equal(new GraphicsSettings(null).getBudget().ambientParticles, 10);
  delete global.matchMedia;
  for (const quality of ['low', 'medium', 'high']) {
    const budget = getGraphicsBudget({ quality, reducedMotion: false });
    assert.equal(Object.isFrozen(budget), true);
    assert.ok(budget.ambientParticles <= 24 && budget.combatSparks <= 8);
    const reduced = getGraphicsBudget({ quality, reducedMotion: true });
    assert.equal(reduced.ambientParticles, 0);
    assert.equal(reduced.cameraShake, false);
    assert.equal(reduced.combatSparks, 0);
  }
  assert.equal(getGraphicsBudget({ quality: 'low', reducedMotion: false }).ambientParticles, 0);
  assert.ok(getGraphicsBudget({ quality: 'high', reducedMotion: false }).ambientParticles >
    getGraphicsBudget({ quality: 'medium', reducedMotion: false }).ambientParticles);
  assert.equal(getGraphicsBudget({ quality: 'low', reducedMotion: false }).cameraShake, false);
  const vm = require('node:vm');
  const typescript = require('typescript');
  const module = { exports: {} };
  const listeners = new Set();
  const settingListeners = new Set();
  const preference = { matches: false, addEventListener: (_, callback) => listeners.add(callback),
    removeEventListener: (_, callback) => listeners.delete(callback) };
  const source = typescript.transpileModule(fs.readFileSync('src/game/rendering/Atmosphere.ts', 'utf8'),
    { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { exports: module.exports, matchMedia: () => preference,
    require: name => name === 'phaser' ? { default: { Math: { Between: minimum => minimum } } } :
      name.includes('config') ? { W: 960, H: 540 } : {
        graphicsSettings: { getBudget: () => getGraphicsBudget({ quality: 'medium', reducedMotion: preference.matches }),
          subscribe: callback => { settingListeners.add(callback); return () => settingListeners.delete(callback); } },
      } });
  const objects = [];
  const tweens = new Set();
  let shutdown;
  const scene = {
    add: { rectangle: (x, y) => {
      const rectangle = { x, y, destroyed: false, setDepth() { return this; }, destroy() { this.destroyed = true; } };
      objects.push(rectangle);
      return rectangle;
    } },
    tweens: { add: config => tweens.add(config.targets), killTweensOf: target => tweens.delete(target) },
    events: { once: (_, callback) => { shutdown = callback; }, off() {} },
  };
  module.exports.addAtmosphere(scene, false);
  assert.equal(tweens.size, 10);
  assert.equal(listeners.size, 1);
  assert.equal(settingListeners.size, 1);
  preference.matches = true;
  for (const callback of listeners) callback();
  assert.equal(tweens.size, 0, 'OS reduced motion leaves animated motes');
  assert.ok(objects.every(object => object.destroyed));
  preference.matches = false;
  for (const callback of listeners) callback();
  assert.equal(tweens.size, 10);
  shutdown();
  assert.equal(tweens.size, 0);
  assert.equal(listeners.size, 0, 'Scene shutdown leaks preference listener');
  assert.equal(settingListeners.size, 0, 'Scene shutdown leaks settings listener');
  const combatModule = { exports: {} };
  const combatSource = typescript.transpileModule(fs.readFileSync('src/game/systems/CombatSystem.ts', 'utf8'),
    { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(combatSource, { exports: combatModule.exports, require: name =>
    name.includes('GraphicsSettings') ? { graphicsSettings: { getBudget: () => ({ combatSparks: 0 }) } } : {} });
  const arcs = [];
  const graphic = { x: 0, y: 0, setDepth() { return this; }, setPosition(x, y) { this.x = x; this.y = y; return this; },
    lineStyle() {}, beginPath() {}, moveTo() {}, closePath() {}, strokePath() {}, arc: (x, y, radius) => arcs.push({ x, y, radius }) };
  const combatScene = { add: { graphics: () => graphic }, tweens: { add() {} } };
  const combat = new combatModule.exports.CombatSystem(combatScene, () => []);
  combat.slashEffect(500, 300, { x: 1, y: 0 }, 1);
  assert.deepEqual({ x: graphic.x, y: graphic.y }, { x: 500, y: 300 }, 'Scaled slash drifts from player origin');
  assert.ok(arcs.length === 3 && arcs.every(arc => arc.x === 0 && arc.y === 0), 'Footprint and slash geometry must be local');
  const hudModule = { exports: {} };
  const hudSource = typescript.transpileModule(fs.readFileSync('src/game/ui/Hud.ts', 'utf8'),
    { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  const notices = [];
  const noticesTweens = new Set();
  const shape = () => ({ setStrokeStyle() { return this; }, setDepth() { return this; } });
  vm.runInNewContext(hudSource, { exports: hudModule.exports, require: name => name.includes('config') ?
    { PALETTE: { bronze: 1 }, UI_DEPTH: 2000 } : name === './art' ? { label: shape } : {} });
  const notificationScene = { children: { getByName: name => notices.find(notice => notice.name === name && !notice.destroyed) },
    add: { rectangle: shape, container: () => {
      const notice = { destroyed: false, setName(name) { this.name = name; return this; }, setDepth() { return this; },
        destroy() { this.destroyed = true; } };
      notices.push(notice);
      return notice;
    } }, tweens: { add: config => noticesTweens.add(config.targets), killTweensOf: target => noticesTweens.delete(target) } };
  hudModule.exports.toast(notificationScene, 'Exploration notice');
  hudModule.exports.toast(notificationScene, 'Boss entrance');
  assert.equal(notices.filter(notice => !notice.destroyed).length, 1, 'Concurrent notices overlap');
  assert.equal(noticesTweens.size, 1, 'Superseded notice tween survives');
  const loadActor = (filename, dependencies) => {
    const result = { exports: {} };
    const javascript = typescript.transpileModule(fs.readFileSync(filename, 'utf8'),
      { compilerOptions: { module: typescript.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    vm.runInNewContext(javascript, { exports: result.exports, require: name => {
      assert.ok(Object.hasOwn(dependencies, name), 'Unexpected actor dependency: ' + name);
      return dependencies[name];
    } });
    return result.exports;
  };
  const manifest = loadActor('src/game/assets/spriteManifest.ts', {});
  const gameState = { data: { hp: 10, level: 2 } };
  let weaponType = 'spear';
  let deathDelay;
  const actorSprite = { texture: { key: 'hero_sprite' }, anims: { isPlaying: true },
    setFlipX(value) { assert.equal(value, false); return this; },
    setTexture(key) { this.texture = { key }; return this; },
    play(key) { this.key = key; this.anims.isPlaying = true; return this; } };
  const actorScene = { time: { now: 1000 }, textures: {
    exists: key => ['hero', 'hero_axe', 'hero_sword'].some(name => key === name + '_sprite'),
    get: key => ({ has: frame => Number.isInteger(Number(frame)) && Number(frame) >= 0
      && Number(frame) < manifest.SPRITE_MANIFEST[key.replace(/_sprite$/, '')].columns * manifest.DIRECTIONS.length }),
  }, anims: { exists: () => true }, tweens: { add() {} } };
  const { Player } = loadActor('src/game/entities/Player.ts', {
    phaser: {}, '../../data/config': {}, '../ui/art': { floatText() {} },
    '../systems/GameState': { gameState }, '../ui/TouchControls': {},
    '../assets/assetLoader': { SPRITE_KEYS: { hero: 'hero_sprite', hero_axe: 'hero_axe_sprite', hero_sword: 'hero_sword_sprite' } },
    '../assets/spriteManifest': manifest, '../rendering/GraphicsSettings': { graphicsSettings: { getBudget: () => ({ cameraShake: false }) } },
    '../assets/equipmentArtwork': loadActor('src/game/assets/equipmentArtwork.ts', { './spriteManifest': manifest }),
    '../world/WorldBounds': {}, '../systems/SkillCombat': {},
    '../audio/AudioManager': { audioManager: { playCue() {} } },
    '../../data/weapons': { getEquippedWeaponOrDefault: () => ({ weaponType }) },
  });
  const player = Object.assign(Object.create(Player.prototype), {
    scene: actorScene, sprite: actorSprite, visualState: 'idle', view: { x: 100, y: 200 },
    direction: { x: -1, y: 0 }, locked: () => false, skillInvulnerabilityMs: 0,
    invulnerableUntil: 0, shieldRemainingMs: 0, actions: { dead: delay => { deathDelay = delay; } },
  });
  for (const [type, name] of [['spear', 'hero'], ['axe', 'hero_axe'], ['sword', 'hero_sword']]) {
    weaponType = type;
    player.playPose('attack1', 300);
    assert.equal(actorSprite.texture.key, name + '_sprite', 'Equipped weapon remains visually a spear');
    assert.equal(actorSprite.key, name + '_attack1_left');
  }
  player.hit(100);
  assert.equal(actorSprite.key, 'hero_sword_death_left');
  assert.equal(deathDelay, manifest.SPRITE_MANIFEST.hero.poses.death.count * 1000 / manifest.SPRITE_MANIFEST.hero.poses.death.frameRate,
    'Death callback must save immediately but defer scene transition until the last frame');
  actorScene.time.now += 10000;
  assert.equal(player.canBeHit, false, 'Dead player can be damaged again');
  assert.equal(player.isLocked, true, 'Death leaves movement/attacks enabled');
  player.attack(); player.dodge(); player.useSkill('slot-1'); player.update(16);
  assert.equal(actorSprite.key, 'hero_sword_death_left');
  for (const name of ['Forest', 'Village', 'Dungeon']) {
    const filename = 'src/game/scenes/' + name + 'Scene.ts';
    const dependencies = Object.fromEntries([...fs.readFileSync(filename, 'utf8').matchAll(/from ['"]([^'"]+)['"]/g)].map(match => [match[1], {}]));
    const lifecycle = [];
    dependencies.phaser = { Scene: class {} };
    dependencies['../ui/Hud'] = { toast() { lifecycle.push('world-input'); } };
    dependencies['../systems/GameState'] = { gameState: { data: { hp: 0, mp: 0, gold: 100 },
      tickPlaytime() {},
      save() { lifecycle.push('save'); } }, getPlayerStats: () => ({ maxHp: 100, maxMp: 80 }) };
    const Scenes = loadActor(filename, dependencies);
    let resume;
    const world = Object.assign(Object.create(Scenes[name + 'Scene'].prototype), {
      scene: { start() { lifecycle.push('exit'); }, restart() { lifecycle.push('exit'); } },
      time: { delayedCall(duration, callback) { assert.equal(duration, deathDelay); lifecycle.push('delay'); resume = callback; } },
    });
    world.onDeath(deathDelay);
    assert.deepEqual(lifecycle, ['save', 'delay'], name + ' saves/scene transitions in the wrong order');
    assert.equal(dependencies['../systems/GameState'].gameState.data.hp, 100);
    resume();
    assert.deepEqual(lifecycle, ['save', 'delay', 'exit']);
    world.player = { isDead: true, update() { throw new Error('World tick survived death'); } };
    world.pause = { isOpen: () => false };
    world.questMarkers = [];
    if (name === 'Village') assert.doesNotThrow(() => world.openRpgMenu(), 'Dead player can enter RPG menu');
    assert.doesNotThrow(() => world.update(0, 16), name + ' death animation can be interrupted by world portals');
    for (const method of name === 'Forest' ? ['enterDungeon', 'interactQuestObject'] : ['interact']) {
      const before = [...lifecycle];
      assert.doesNotThrow(() => world[method](), name + ' world pointer input bypasses death lock');
      assert.deepEqual(lifecycle, before, name + ' dead world pointer input still executes');
    }
    if (name !== 'Village') {
      world.player = { isDead: false, update() {} };
      world.interactionLabels = [];
      world.enemies = [{ update() { world.player.isDead = true; } }];
      world.projectiles = [];
      world.bossSystem = { update() {} };
      world.hud = { refresh() { throw new Error('Lethal combat tick continued into portal handling'); } };
      assert.doesNotThrow(() => world.update(0, 16), name + ' portal executes in the lethal tick');
    }
  }
  const bosses = loadActor('src/data/bosses.ts', {});
  const environmentArtwork = { terrainKey: 'village_terrain', propKey: 'village_props', tileSize: 32, propSize: 128, feet: 112 };
  const { paintEnvironment } = loadActor('src/game/rendering/Environment.ts', {
    '../../data/config': { W: 960, H: 540 },
    '../assets/environmentArtwork': { ENVIRONMENT_ARTWORK: { village: environmentArtwork } },
    './EnvironmentAtmosphere': { ENVIRONMENT_PALETTES: { village: { ambient: 0xffedcc } }, paintEnvironmentAtmosphere() {} },
  });
  const environmentalObjects = [];
  const environmentScene = { events: { once() {}, off() {} }, textures: { exists: () => true }, add: {
    tileSprite(...args) { const view = { args, setDepth(depth) { this.depth = depth; return this; }, setTint(tint) { this.tint = tint; return this; } }; environmentalObjects.push(view); return view; },
    image(...args) { const view = { args, setDepth(depth) { this.depth = depth; return this; }, setScale(scale) { this.scale = scale; return this; } }; environmentalObjects.push(view); return view; },
    ellipse() { return { setDepth() { return this; } }; },
  } };
  const barrier = Object.freeze({ x: 120, y: 140, width: 136, height: 64 });
  assert.equal(paintEnvironment(environmentScene, 'village', Object.freeze([barrier])), true);
  assert.equal(environmentalObjects[0].args[4], environmentArtwork.terrainKey);
  assert.equal(environmentalObjects[0].tint, 0xffedcc, 'Authored terrain lacks regional ambient tint');
  const landmark = environmentalObjects.find(view => view.args[2] === environmentArtwork.propKey && view.args[3] === 0);
  assert.ok(landmark, 'Barrier landmark has no authored prop');
  assert.equal(landmark.args[0], 188, 'Prop moved collision footprint');
  assert.equal(landmark.depth, 30 + 204 / 10, 'Prop occlusion disagrees with actor ground depth');
  environmentScene.textures.exists = () => false;
  assert.equal(paintEnvironment(environmentScene, 'village', [barrier]), false, 'Missing environment cannot use fallback');
  const dungeonSource = fs.readFileSync('src/game/scenes/DungeonScene.ts', 'utf8');
  const dungeonDependencies = Object.fromEntries([...dungeonSource.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => [match[1], {}]));
  const navigationLabels = [];
  dungeonDependencies.phaser = { Scene: class {} };
  dungeonDependencies['../../data/config'] = { ENEMIES: { test: { name: 'Elite' } } };
  dungeonDependencies['../../data/contentCatalog'] = { getDungeon: () => ({ id: 'test', name: 'Test Dungeon', eliteId: 'test' }) };
  dungeonDependencies['../systems/GameState'] = { gameState: { data: { chapter: 1 } } };
  dungeonDependencies['../rpg/DungeonSystem'] = { dungeonEntryError: () => null };
  dungeonDependencies['../assets/assetLoader'] = { createGameAnimations() {} };
  dungeonDependencies['../audio/AudioManager'] = { audioManager: { startMusic() {} } };
  for (const [dependency, symbol] of [['../entities/Player', 'Player'], ['../systems/CombatSystem', 'CombatSystem'], ['../ui/PauseOverlay', 'PauseOverlay']]) {
    dungeonDependencies[dependency] = { [symbol]: class {} };
  }
  dungeonDependencies['../ui/Hud'] = { Hud: class {}, toast() {} };
  dungeonDependencies['../rendering/Environment'] = { paintEnvironment() {} };
  dungeonDependencies['../ui/art'] = { label() { const view = { depth: 0, setDepth(depth) { this.depth = depth; return this; } }; navigationLabels.push(view); return view; } };
  const { DungeonScene } = loadActor('src/game/scenes/DungeonScene.ts', dungeonDependencies);
  const dungeonDecoration = { setDepth() { return this; }, setStrokeStyle() { return this; }, setInteractive() { return this; }, on() { return this; } };
  const dungeonScene = Object.assign(Object.create(DungeonScene.prototype), {
    add: { rectangle: () => dungeonDecoration, circle: () => dungeonDecoration }, events: { once() {} }, startFloor() {},
  });
  dungeonScene.create({ dungeonId: 'test', chapter: 1 });
  assert.equal(navigationLabels.length, 3);
  assert.ok(navigationLabels.every(view => view.depth > 2), 'Authored dungeon terrain hides navigation labels');
  const villageSource = fs.readFileSync('src/game/scenes/VillageScene.ts', 'utf8');
  const villageDependencies = Object.fromEntries([...villageSource.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => [match[1], {}]));
  villageDependencies.phaser = { Scene: class {} };
  let fallbackNpcs = 0;
  villageDependencies['../ui/art'] = { label: () => ({ setWordWrapWidth() { return this; } }), button: () => shapeObject,
    actor() { fallbackNpcs++; } };
  const npcArtwork = { spriteKey: 'npc_chief', portraitKey: 'portrait_chief', idleAnimation: 'npc_chief_idle', dialogueAnimation: 'npc_chief_dialogue', size: 48, feet: 42 };
  villageDependencies['../assets/npcArtwork'] = { NPC_ARTWORK_BY_ID: { 'village-chief': npcArtwork } };
  villageDependencies['../assets/iconArtwork'] = { ICON_TEXTURE_KEY: 'rpg_icons', ITEM_ICON_FRAMES: { 'bronze-spear': 2 }, SKILL_ICON_FRAMES: { 'earth-shockwave': 3 } };
  villageDependencies['../rendering/GraphicsSettings'] = { graphicsSettings: { getState: () => ({ reducedMotion: false }) } };
  villageDependencies['../../data/config'] = { W: 960, H: 540, UI_DEPTH: 1000, PALETTE: { bronze: 0x8c653d } };
  const { VillageScene } = loadActor('src/game/scenes/VillageScene.ts', villageDependencies);
  let dialogueFinished;
  const npcSprite = { play(key) { this.key = key; return this; }, on(_, callback) { dialogueFinished = callback; return this; } };
  let portraitKey;
  const shapeObject = { setScale() { return this; }, setInteractive() { return this; }, setStrokeStyle() { return this; }, setDepth() { return this; }, destroy() {} };
  const village = Object.assign(Object.create(VillageScene.prototype), {
    npcs: [{ id: 'village-chief', name: 'Trưởng làng', x: 100, y: 200 }], npcSprites: new Map(),
    textures: { exists: () => true }, add: { ellipse: () => shapeObject, rectangle: () => shapeObject,
      sprite: () => npcSprite, container: () => shapeObject,
      image: (_, __, key) => { portraitKey = key; return shapeObject; } },
  });
  assert.equal(typeof village.drawNpc, 'function', 'NPC sprites have no runtime rendering path');
  village.drawNpc(village.npcs[0]);
  assert.equal(npcSprite.key, npcArtwork.idleAnimation);
  assert.equal(fallbackNpcs, 0, 'Available NPC sprite fell back to procedural circles');
  assert.equal(village.npcSprites.get('village-chief'), npcSprite);
  const portrait = village.npcPortrait('village-chief');
  assert.equal(portraitKey, npcArtwork.portraitKey);
  assert.equal(npcSprite.key, npcArtwork.dialogueAnimation);
  assert.equal(portrait, shapeObject);
  assert.equal(village.npcPortrait('Unknown NPC'), null);
  dialogueFinished();
  assert.equal(npcSprite.key, npcArtwork.idleAnimation, 'Dialogue pose never resumes idle');
  portraitKey = null;
  village.modal('TRƯỞNG LÀNG LẠC', 'Service dialogue', [], 'village-chief');
  assert.equal(portraitKey, npcArtwork.portraitKey, 'Service display title drops stable-ID portrait');
  village.closeModal();
  assert.equal(village.rpgIcon(100, 100, 'bronze-spear'), shapeObject, 'Inventory lacks canonical item icon');
  assert.equal(portraitKey, 'rpg_icons');
  assert.equal(village.rpgIcon(100, 100, 'earth-shockwave'), shapeObject, 'Skills lack canonical icons');
  assert.equal(village.rpgIcon(100, 100, 'unknown'), null, 'Unknown icon lacks fallback');
  village.textures.exists = () => false;
  assert.equal(village.rpgIcon(100, 100, 'bronze-spear'), null, 'Missing icon texture lacks fallback');
  village.drawNpc(village.npcs[0]);
  assert.equal(fallbackNpcs, 1, 'Missing NPC texture has no fallback');
  assert.equal(village.npcPortrait('village-chief'), null, 'Missing portrait renders an invalid texture');
  const { Boss } = loadActor('src/game/entities/Boss.ts', {
    '../../data/bosses': bosses, '../assets/spriteManifest': manifest,
    '../assets/assetLoader': { SPRITE_KEYS: { hoyer: 'hoyer_sprite', thuongluong: 'thuongluong_sprite', thachtuong: 'thachtuong_sprite', hacan: 'hacan_sprite' } },
    '../rendering/GraphicsSettings': { graphicsSettings: { getBudget: () => ({ cameraShake: false }) } },
  });
  const boss = new Boss(null, 'ho-yeu', 500, 300);
  boss.sprite = actorSprite;
  boss.facingX = 0; boss.facingY = -1;
  boss.state = 'chasing'; boss.syncPose();
  assert.equal(actorSprite.key, 'hoyer_walk_up');
  boss.applyHitFeedback(0, 0);
  assert.equal(actorSprite.key, 'hoyer_hit_up', 'Boss damage has no hit pose');
  boss.syncPose();
  assert.equal(actorSprite.key, 'hoyer_hit_up', 'Boss chase overwrites damage feedback');
  actorSprite.anims.isPlaying = false;
  boss.state = 'windup'; boss.syncPose();
  assert.equal(actorSprite.key, 'hoyer_attack_up');
  boss.state = 'staggered'; boss.syncPose();
  assert.equal(actorSprite.key, 'hoyer_hit_up');
  boss.state = 'idle'; boss.syncPose();
  assert.equal(actorSprite.key, 'hoyer_hit_up', 'Boss idle overwrites unfinished stagger');
  actorSprite.anims.isPlaying = false; boss.syncPose();
  assert.equal(actorSprite.key, 'hoyer_idle_up');
  boss.damage(100000);
  assert.equal(actorSprite.key, 'hoyer_death_up');
  boss.syncPose();
  assert.equal(actorSprite.key, 'hoyer_death_up');
  for (const [id, name] of [['thuong-luong', 'thuongluong'], ['thach-tuong', 'thachtuong'], ['hac-an', 'hacan']]) {
    const opponent = new Boss(null, id, 500, 300);
    assert.equal(opponent.spriteName, name, id + ' still uses procedural placeholders');
    opponent.sprite = { ...actorSprite, anims: { isPlaying: false } };
    opponent.state = 'transitioning'; opponent.syncPose();
    assert.equal(opponent.sprite.key, name + '_transition_right');
    opponent.activeTelegraphState = { directionX: 0, directionY: -1 };
    opponent.state = 'windup'; opponent.syncPose();
    assert.equal(opponent.sprite.key, name + '_windup_up', 'Boss pose does not face the locked telegraph');
    opponent.state = 'idle'; opponent.activeTelegraphState = null; opponent.damage(100000);
    assert.equal(opponent.sprite.key, name + '_death_right');
  }
  for (const id of ['ho-yeu', 'thuong-luong', 'thach-tuong', 'hac-an']) {
    const opponent = new Boss(null, id, 500, 300);
    opponent.sprite = { ...actorSprite, anims: { isPlaying: false } };
    const attack = opponent.currentPhase.attacks.find(entry => ['cone', 'line', 'rect'].includes(entry.telegraph.shape));
    assert.ok(attack, id + ' has no directional attack fixture');
    let damage = 0;
    const target = { x: 560, y: 300, hit(amount) { damage += amount; } };
    opponent.startAttack(attack, 1000, target);
    target.x = 440;
    opponent.update(opponent.windupEndAt, 16, target);
    assert.equal(damage, 0, id + ' damages outside the locked telegraph');
    assert.ok(opponent.sprite.key.endsWith('_right'), id + ' impact faces outside the warning');
    assert.equal(opponent.activeTelegraph, null, 'Resolved warning remains active');
    const warnedOpponent = new Boss(null, id, 500, 300);
    target.x = 560; damage = 0;
    warnedOpponent.startAttack(attack, 1000, target);
    warnedOpponent.update(warnedOpponent.windupEndAt, 16, target);
    assert.ok(damage > 0, id + ' never damages inside the warned area');
  }
  const dashPositions = [];
  for (const moved of [false, true]) {
    const opponent = new Boss(null, 'ho-yeu', 500, 300);
    const attack = opponent.currentPhase.attacks.find(entry => entry.kind === 'dash');
    const target = { x: 700, y: 300 };
    opponent.startAttack(attack, 1000, target);
    if (moved) target.x = 500;
    opponent.update(opponent.windupEndAt, 16, target);
    dashPositions.push(opponent.x);
  }
  assert.equal(dashPositions[1], dashPositions[0], 'Dash destination follows live target instead of warning');
  assert.ok(dashPositions[0] > 500, 'Warned dash has no displacement');
  const ranged = new Boss(null, 'thuong-luong', 500, 300);
  const shots = [];
  ranged.scene = {};
  ranged.spawnProjectile = (_, x, y, target) => shots.push({ x, y, target });
  ranged.activeTelegraphState = { directionX: 1, directionY: 0 };
  ranged.fireProjectiles(ranged.currentPhase.attacks.find(entry => entry.kind === 'ranged'), { x: 440, y: 300 });
  assert.ok(shots.length > 0, 'Projectile callback not exercised');
  assert.ok(shots.every(shot => shot.target.x > shot.x), 'Projectile barrage aims behind its warning');
  console.log('Graphics settings, weapon selection, player death and boss animation self-check: PASS');
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
