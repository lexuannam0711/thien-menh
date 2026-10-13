const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

const preferenceListeners = new Set();
const preference = { matches: false, addEventListener: (_, callback) => preferenceListeners.add(callback),
  removeEventListener: (_, callback) => preferenceListeners.delete(callback) };
function load(filename, dependencies = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(output, { exports, matchMedia: () => preference, require: name => {
    assert.ok(name in dependencies, 'Unexpected dependency ' + name);
    return dependencies[name];
  } });
  return exports;
}
const settings = load('src/game/rendering/GraphicsSettings.ts');
const artwork = load('src/game/assets/environmentArtwork.ts');
const atmosphere = load('src/game/rendering/EnvironmentAtmosphere.ts', {
  './GraphicsSettings': settings,
});
const { addAtmosphere } = load('src/game/rendering/Atmosphere.ts', {
  phaser: { __esModule: true, default: { Math: { Between: minimum => minimum } } },
  '../../data/config': { W: 960, H: 540 }, './GraphicsSettings': settings,
});
const { paintEnvironment } = load('src/game/rendering/Environment.ts', {
  '../../data/config': { W: 960, H: 540 },
  '../assets/environmentArtwork': artwork, './EnvironmentAtmosphere': atmosphere,
});

function harness(exists = true) {
  const objects = [], tweens = new Set(), events = new EventEmitter();
  function shape(kind, args) {
    const object = { kind, args, x: args[0], y: args[1], depth: 0, destroyed: false,
      destroy() { assert.equal(this.destroyed, false, 'Double destroy'); this.destroyed = true; } };
    for (const method of ['setDepth', 'setTint', 'setScale', 'setStrokeStyle']) {
      object[method] = (...values) => {
        object[method + 'Values'] = values;
        if (method === 'setDepth') object.depth = values[0];
        return object;
      };
    }
    objects.push(object);
    return object;
  }
  return { objects, tweens, events, scene: { events, textures: { exists: () => exists },
    add: Object.fromEntries(['tileSprite', 'image', 'ellipse', 'rectangle'].map(kind => [kind, (...args) => shape(kind, args)])),
    tweens: { add(config) { tweens.add(config); return config; },
      killTweensOf(target) { for (const tween of tweens) if (tween.targets === target) tweens.delete(tween); } },
    time: { addEvent() { assert.fail('Perpetual timer'); }, delayedCall() { assert.fail('Timer'); } },
  } };
}
const barriers = Object.freeze([Object.freeze({ x: 50, y: 90, width: 100, height: 70 })]);
const arena = Object.freeze({ x: 480, y: 300, radius: 110 });
const regions = ['village', 'forest', 'swamp', 'mountain', 'citadel'];
const paletteSignatures = new Set();
if (!process.argv.includes('--repaint-only')) {
  const live = harness();
  settings.graphicsSettings.setQuality('high');
  settings.graphicsSettings.setReducedMotion(false);
  paintEnvironment(live.scene, 'forest', barriers, arena);
  addAtmosphere(live.scene, false);
  assert.equal(live.tweens.size, 28);
  const animated = [...live.tweens].map(tween => tween.targets);
  assert.equal(settings.graphicsSettings.setQuality('low'), false, 'No storage must report failure');
  assert.equal(settings.graphicsSettings.getState().quality, 'low');
  assert.equal(live.tweens.size, 0, 'Application low quality leaves generic/local decorative tweens');
  assert.ok(animated.every(object => object.destroyed));
  settings.graphicsSettings.setQuality('high');
  assert.equal(live.tweens.size, 28);
  settings.graphicsSettings.setReducedMotion(true);
  assert.equal(live.tweens.size, 0, 'Application reduced-motion leaves generic/local decorative tweens');
  settings.graphicsSettings.setReducedMotion(false);
  const unchanged = [...live.tweens];
  assert.equal(settings.graphicsSettings.setQuality('invalid'), false);
  assert.equal(settings.graphicsSettings.setReducedMotion('true'), false);
  assert.deepEqual([...live.tweens], unchanged, 'Invalid setters notify subscribers');
  preference.matches = true;
  for (const listener of preferenceListeners) listener();
  assert.equal(live.tweens.size, 0, 'Native preference leaves decorative tweens');
  preference.matches = false;
  for (const listener of preferenceListeners) listener();
  assert.equal(live.tweens.size, 28);
  const firstMotes = live.objects.filter(object => object.kind === 'rectangle' && !object.destroyed);
  addAtmosphere(live.scene, true);
  assert.ok(firstMotes.every(object => object.destroyed), 'Generic atmosphere repaint leak');
  assert.equal(live.tweens.size, 28);
  assert.equal(preferenceListeners.size, 2);
  assert.equal(live.events.listenerCount('shutdown'), 3, 'Generic repaint shutdown listener leak');
  live.events.emit('shutdown');
  assert.equal(live.tweens.size, 0);
  assert.equal(preferenceListeners.size, 0);
  assert.equal(live.events.listenerCount('shutdown'), 0);
  assert.ok(live.objects.every(object => object.destroyed), 'Shutdown object leak');
  live.events.emit('shutdown');
  const afterShutdown = live.objects.length;
  settings.graphicsSettings.setQuality('medium');
  assert.equal(live.objects.length, afterShutdown, 'Shutdown settings subscription leak');
  const failing = new settings.GraphicsSettings({ getItem: () => null, setItem() { throw Error('Unavailable'); } });
  let notifications = 0;
  const unsubscribe = failing.subscribe(() => notifications++);
  assert.equal(failing.setQuality('high'), false);
  assert.equal(failing.getState().quality, 'high');
  assert.equal(notifications, 1, 'Storage failure suppresses notification');
  failing.setQuality(null);
  failing.setReducedMotion(1);
  assert.equal(notifications, 1);
  unsubscribe();
  unsubscribe();
  failing.setReducedMotion(true);
  assert.equal(notifications, 1, 'Unsubscribe leak');
  console.log('PASS real application setters, failed storage, invalid inputs, native preference, generic repaint');
}
for (const region of regions) {
  for (const quality of ['low', 'medium', 'high']) for (const reducedMotion of [false, true]) {
    settings.graphicsSettings.setQuality(quality);
    settings.graphicsSettings.setReducedMotion(reducedMotion);
    const budget = settings.graphicsSettings.getBudget();
    const expected = reducedMotion || quality === 'low' ? 0 : quality === 'high' ? 24 : 10;
    assert.equal(budget.ambientParticles, expected);
    const test = harness(), before = JSON.stringify({ barriers, arena });
    assert.equal(paintEnvironment(test.scene, region, barriers, arena), true);
    assert.equal(JSON.stringify({ barriers, arena }), before, 'Gameplay geometry mutated');
    assert.equal(test.tweens.size, Math.floor(expected / 5), region + ' exact local-detail budget');
    assert.ok(test.objects.filter(object => object.kind === 'tileSprite').every(object =>
      object.setTintValues?.[0] === atmosphere.ENVIRONMENT_PALETTES[region].ambient));
    paletteSignatures.add(atmosphere.ENVIRONMENT_PALETTES[region].ambient);
    const effects = test.objects.filter(object => object.kind === 'ellipse' && object.depth === 2);
    assert.ok(effects.length >= 1, region + ' lacks local light');
    assert.ok(effects.every(object => object.args[2] <= 70 && object.args[3] <= 24), 'Fullscreen overlay');
    for (const tween of test.tweens) {
      const [x, y] = tween.targets.args;
      assert.ok(y < 220 || y > 390, 'Decorative effect obstructs combat lane');
      assert.ok(Math.hypot(x - arena.x, y - arena.y) > arena.radius + 64, 'Arena obscured');
      assert.ok(test.objects.some(object => object.kind === 'image' && object.args[2].endsWith('_props')
        && Math.abs(object.args[0] - x) <= 24 && Math.abs(object.args[1] - y) <= 100), 'Detached effect');
    }
    const props = test.objects.filter(object => object.kind === 'image' && object.args[2].endsWith('_props'));
    assert.equal(props.length, region === 'village' ? 8 : 7);
    assert.equal(props[0].depth, 46, 'Prop depth changed');
    assert.equal(test.events.listenerCount('shutdown'), 2);
    assert.equal(preferenceListeners.size, 1);
    if (region === 'swamp' && expected) assert.ok(effects.some(object => object.setStrokeStyleValues), 'No actual water ripple');
    if ((region === 'forest' || region === 'village') && expected) {
      assert.ok([...test.tweens].some(tween => tween.angle === 8), 'No authored foliage animation');
    }
    test.events.emit('shutdown');
    assert.equal(test.tweens.size, 0, 'Tween leak');
    assert.ok(test.objects.every(object => object.destroyed), 'Environment object leak');
    assert.equal(test.events.listenerCount('shutdown'), 0);
    assert.equal(preferenceListeners.size, 0, 'Preference listener leak');
    test.events.emit('shutdown');
    console.log('PASS ' + region + ' ' + quality + ' reducedMotion=' + reducedMotion);
  }
}
assert.equal(paletteSignatures.size, 5, 'Region palettes indistinguishable');
settings.graphicsSettings.setQuality('high');
settings.graphicsSettings.setReducedMotion(false);
const repeat = harness();
const unrelated = repeat.scene.add.image(10, 10, 'player');
repeat.scene.tweens.add({ targets: unrelated });
paintEnvironment(repeat.scene, 'forest', barriers, arena);
const firstPaint = repeat.objects.filter(object => object !== unrelated);
paintEnvironment(repeat.scene, 'swamp', barriers, arena);
assert.ok(firstPaint.every(object => object.destroyed), 'Repaint leaves previous tiles, props, shadows, arena or effects');
assert.ok(!repeat.objects.some(object => !object.destroyed && typeof object.args[2] === 'string'
  && object.args[2].includes('forest')), 'Old region assets remain');
assert.equal(unrelated.destroyed, false);
assert.equal(repeat.tweens.size, 5);
assert.equal(repeat.events.listenerCount('shutdown'), 2);
assert.equal(preferenceListeners.size, 1);
preference.matches = true;
for (const listener of preferenceListeners) listener();
assert.equal(repeat.tweens.size, 1, 'Live reduced-motion leaves decorative tweens');
preference.matches = false;
settings.graphicsSettings.setQuality('medium');
for (const listener of preferenceListeners) listener();
assert.equal(repeat.tweens.size, 3, 'Live preference budget refresh');
repeat.events.emit('shutdown');
assert.equal(repeat.tweens.size, 1);
assert.ok(repeat.objects.filter(object => object !== unrelated).every(object => object.destroyed));
assert.equal(unrelated.destroyed, false);
const afterShutdown = repeat.objects.length;
settings.graphicsSettings.setQuality('high');
assert.equal(repeat.objects.length, afterShutdown, 'Local settings subscription leak');
assert.equal(preferenceListeners.size, 0);
assert.equal(repeat.events.listenerCount('shutdown'), 0);
repeat.events.emit('shutdown');
const missing = harness(false);
assert.equal(paintEnvironment(missing.scene, 'village', barriers), false);
assert.equal(missing.objects.length, 0);
assert.equal(missing.events.listenerCount('shutdown'), 0);
for (const filename of ['src/game/rendering/Environment.ts', 'src/game/rendering/EnvironmentAtmosphere.ts',
  'src/game/rendering/Atmosphere.ts', 'src/game/rendering/GraphicsSettings.ts']) {
  const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
      const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
      const end = source.getLineAndCharacterOfPosition(node.end).line;
      assert.ok(end - start + 1 < 50, filename + ' function exceeds 49 lines');
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
console.log('PASS palettes, invocation, budgets, depth, clarity, repaint, teardown, missing assets, function limits');
