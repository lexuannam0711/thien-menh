const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const Fade = require('../node_modules/phaser/src/cameras/2d/effects/Fade');
const preference = Object.assign(new EventEmitter(), { matches: false });
preference.addEventListener = preference.on;
preference.removeEventListener = preference.off;
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
let subscriptions = 0;
const subscribe = settings.graphicsSettings.subscribe.bind(settings.graphicsSettings);
settings.graphicsSettings.subscribe = listener => {
  subscriptions++;
  const unsubscribe = subscribe(listener);
  return () => { subscriptions--; unsubscribe(); };
};
const presentationPath = 'src/game/rendering/ScenePresentation.ts';
const presentation = fs.existsSync(presentationPath) ? load(presentationPath, { './GraphicsSettings': settings }) : {};
const { loadGameAssets } = load('src/game/assets/assetLoader.ts', {
  phaser: { __esModule: true, default: {} },
  './spriteManifest': load('src/game/assets/spriteManifest.ts'),
  './enemyArtwork': load('src/game/assets/enemyArtwork.ts'),
  './environmentArtwork': load('src/game/assets/environmentArtwork.ts'),
  './equipmentArtwork': load('src/game/assets/equipmentArtwork.ts', { './spriteManifest': load('src/game/assets/spriteManifest.ts') }),
  '../rendering/ScenePresentation': presentation,
});
function harness(cached = false) {
  const events = new EventEmitter(), objects = [], loader = new EventEmitter(), camera = new EventEmitter();
  const forbidden = () => assert.fail('Game authority or timer touched');
  const scene = { events, scale: { width: 960, height: 540 }, cameras: { main: camera },
    load: Object.assign(loader, { list: new Set(), inflight: new Set(), queue: new Set(),
      spritesheet(key) { this.list.add({ key }); } }), textures: { exists: () => cached },
    scene: { start: forbidden, pause: forbidden, stop: forbidden }, input: new Proxy({}, { get: forbidden }),
    time: new Proxy({}, { get: forbidden }), registry: new Proxy({}, { get: forbidden }),
    add: Object.fromEntries(['rectangle', 'text'].map(kind => [kind, (...args) => {
      const object = { kind, args, destroyed: false, width: args[2], text: args[2],
        destroy() { assert.equal(this.destroyed, false, 'Double destroy'); this.destroyed = true; } };
      for (const method of ['setDepth', 'setOrigin', 'setScrollFactor', 'setStrokeStyle']) object[method] = () => object;
      object.setDisplaySize = (width, height) => { object.width = width; object.height = height; return object; };
      object.setText = text => { object.text = text; return object; };
      objects.push(object);
      return object;
    }])),
  };
  camera.scene = scene;
  camera.fadeEffect = new Fade(camera);
  camera.fadeIn = (duration, red, green, blue, callback, context) => {
    camera.duration = duration;
    return camera.fadeEffect.start(false, duration, red, green, blue, true, callback, context);
  };
  events.on('update', (time, delta) => camera.fadeEffect.update(time, delta));
  return { scene, objects, camera, loader, events };
}
function clean(harness) {
  assert.ok(harness.objects.every(object => object.destroyed), 'Overlay survived cleanup');
  for (const event of ['progress', 'complete', 'start']) assert.equal(harness.loader.listenerCount(event), 0, event);
  for (const event of ['create', 'shutdown', 'postupdate']) assert.equal(harness.events.listenerCount(event), 0, event);
  assert.equal(harness.camera.listenerCount('camerafadeincomplete'), 0);
  assert.equal(harness.camera.fadeEffect.isRunning, false);
  assert.equal(preference.listenerCount('change'), 0);
  assert.equal(subscriptions, 0, 'GraphicsSettings subscription leak');
}
const pending = harness();
loadGameAssets(pending.scene);
assert.ok(pending.objects.length > 0, 'loadGameAssets must present pending loader work');
const count = pending.objects.length;
loadGameAssets(pending.scene);
assert.equal(pending.objects.filter(object => !object.destroyed).length, count, 'Duplicate preload overlay');
assert.equal(pending.loader.listenerCount('progress'), 1);
pending.loader.emit('start');
for (const [value, percent] of [[0.4, '40%'], [-1, '0%'], [2, '100%'], [NaN, '0%'], [Infinity, '0%']]) {
  pending.loader.emit('progress', value);
  assert.ok(pending.objects.some(object => !object.destroyed && object.text === percent), percent);
  assert.ok(pending.objects.filter(object => !object.destroyed && object.kind === 'rectangle').every(object => object.width >= 0 && object.width <= 440));
}
pending.loader.emit('complete');
assert.ok(pending.objects.every(object => object.destroyed));
pending.events.emit('create');
assert.equal(pending.camera.duration, 120);
assert.ok(pending.camera.fadeEffect.alpha <= 0.12, 'First create warning obscured');
for (const time of [30, 60, 90, 120]) {
  pending.events.emit('update', time, 30);
  pending.events.emit('postupdate', time, 30);
  assert.ok(pending.camera.fadeEffect.alpha <= 0.12, 'Combat warning obscured after camera update');
}
clean(pending);
loadGameAssets(pending.scene);
pending.events.emit('create');
assert.ok(pending.objects.every(object => object.destroyed), 'Create fallback overlay stuck');
pending.events.emit('shutdown');
clean(pending);
const cached = harness(true);
loadGameAssets(cached.scene);
assert.equal(cached.objects.length, 0, 'Cached/no pending work must not show loading');
cached.events.emit('create');
cached.events.emit('shutdown');
clean(cached);
for (let cycle = 0; cycle < 5; cycle++) {
  loadGameAssets(cached.scene);
  cached.events.emit('create');
  cached.events.emit('update', cycle * 30, 30);
  cached.events.emit('postupdate');
  cached.events.emit('shutdown');
  clean(cached);
}
const existing = harness(true);
existing.camera.fadeEffect.start(true, 400);
loadGameAssets(existing.scene);
existing.events.emit('create');
assert.equal(existing.camera.duration, undefined, 'Replaced pre-existing camera fade');
existing.events.emit('shutdown');
assert.equal(existing.camera.fadeEffect.isRunning, true, 'Cancelled another camera effect');
assert.equal(existing.events.listenerCount('shutdown'), 0);
assert.equal(subscriptions, 0);
const extra = harness(true);
extra.scene.load.queue.add({ key: 'other-pending-file' });
loadGameAssets(extra.scene);
assert.ok(extra.objects.length > 0, 'Other pending work omitted');
extra.events.emit('shutdown');
clean(extra);
const late = harness(true);
loadGameAssets(late.scene);
assert.equal(late.objects.length, 0);
late.scene.load.inflight.add({ key: 'late-npc-or-icon' });
late.loader.emit('start');
assert.ok(late.objects.length > 0, 'Assets queued later in preload omitted');
late.loader.emit('start');
assert.equal(late.objects.length, count, 'Late start duplicated panel');
late.events.emit('shutdown');
clean(late);
for (const mode of ['app', 'os', 'low']) {
  settings.graphicsSettings.setReducedMotion(mode === 'app');
  settings.graphicsSettings.setQuality(mode === 'low' ? 'low' : 'medium');
  preference.matches = mode === 'os';
  const disabled = harness();
  loadGameAssets(disabled.scene);
  disabled.events.emit('create');
  assert.equal(disabled.camera.duration, undefined, mode + ' must suppress fade');
  disabled.events.emit('shutdown');
  clean(disabled);
}
settings.graphicsSettings.setQuality('high');
preference.matches = false;
for (const mode of ['app', 'os']) {
  settings.graphicsSettings.setReducedMotion(false);
  const active = harness(true);
  loadGameAssets(active.scene);
  active.events.emit('create');
  assert.equal(active.camera.fadeEffect.isRunning, true);
  if (mode === 'app') settings.graphicsSettings.setReducedMotion(true);
  else { preference.matches = true; preference.emit('change'); }
  clean(active);
  active.events.emit('shutdown');
  preference.matches = false;
}
for (const name of ['Village', 'Forest', 'Dungeon']) {
  const source = ts.createSourceFile(name, fs.readFileSync('src/game/scenes/' + name + 'Scene.ts', 'utf8'), ts.ScriptTarget.ES2022, true);
  const sceneClass = source.statements.find(ts.isClassDeclaration);
  const preload = sceneClass.members.find(member => ts.isMethodDeclaration(member) && member.name.getText(source) === 'preload');
  assert.ok(preload.body.statements.some(statement => ts.isExpressionStatement(statement)
    && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(source) === 'loadGameAssets'
    && statement.expression.arguments[0].getText(source) === 'this'), name + ' preload integration');
}
for (const name of ['Menu', 'Victory', 'Ending']) assert.doesNotMatch(fs.readFileSync('src/game/scenes/' + name + 'Scene.ts', 'utf8'), /loadGameAssets/);
const failures = [];
function regression(name, check) {
  try { check(); }
  catch (error) { failures.push(name + ': ' + error.message); }
}
for (const mode of ['app', 'os', 'low', 'shutdown']) regression('synchronous native Fade.start: ' + mode, () => {
  settings.graphicsSettings.setReducedMotion(false);
  settings.graphicsSettings.setQuality('high');
  preference.matches = false;
  const reentrant = harness(true);
  reentrant.camera.once('camerafadeinstart', () => {
    if (mode === 'app') settings.graphicsSettings.setReducedMotion(true);
    if (mode === 'os') { preference.matches = true; preference.emit('change'); }
    if (mode === 'low') settings.graphicsSettings.setQuality('low');
    if (mode === 'shutdown') reentrant.events.emit('shutdown');
  });
  loadGameAssets(reentrant.scene);
  reentrant.events.emit('create');
  clean(reentrant);
  reentrant.events.emit('shutdown');
  clean(reentrant);
  reentrant.events.emit('shutdown');
  clean(reentrant);
});
for (const direction of [true, false]) for (const synchronous of [false, true]) for (const postupdate of [false, true]) regression(
  'forced foreign native Fade.start retains ownership: ' + direction + '/' + synchronous + '/' + postupdate, () => {
  settings.graphicsSettings.setReducedMotion(false);
  const replaced = harness(true);
  let calls = 0;
  const callback = () => { calls++; };
  const replace = () => replaced.camera.fadeEffect.start(direction, 400, 17, 34, 51, true, callback);
  if (synchronous) replaced.camera.once('camerafadeinstart', replace);
  loadGameAssets(replaced.scene);
  replaced.events.emit('create');
  if (!synchronous) replace();
  assert.equal(replaced.camera.fadeEffect.alpha, direction ? Number.MIN_VALUE : 1);
  replaced.events.emit('update', 80, 80);
  const snapshot = { ...replaced.camera.fadeEffect };
  if (postupdate) replaced.events.emit('postupdate', 80, 80);
  assert.deepEqual({ ...replaced.camera.fadeEffect }, snapshot, 'Postupdate altered replacement fade');
  replaced.events.emit('shutdown');
  replaced.events.emit('shutdown');
  assert.deepEqual({ ...replaced.camera.fadeEffect }, snapshot, 'Shutdown cancelled replacement fade');
  assert.equal(replaced.events.listenerCount('postupdate'), 0);
  assert.equal(preference.listenerCount('change'), 0);
  assert.equal(subscriptions, 0);
  replaced.events.emit('update', 160, 80);
  assert.equal(replaced.camera.fadeEffect.isRunning, true);
  assert.equal(replaced.camera.fadeEffect.alpha, direction ? 0.4 : 0.6);
  assert.equal(calls, 2, 'Replacement callback stopped');
});
for (const direction of [true, false]) regression('stale cleanup preserves replacement preload cycle: ' + direction, () => {
  settings.graphicsSettings.setReducedMotion(false);
  const replaced = harness(true);
  let calls = 0;
  let snapshot;
  let listeners;
  const owned = () => [
    ...['progress', 'start', 'complete'].map(event => replaced.loader.listeners(event)),
    ...['create', 'shutdown'].map(event => replaced.events.listeners(event)),
  ];
  replaced.camera.once('camerafadeinstart', () => {
    replaced.events.emit('shutdown');
    replaced.scene.load.spritesheet('replacement');
    loadGameAssets(replaced.scene);
    listeners = owned();
    replaced.camera.fadeEffect.start(direction, 400, 17, 34, 51, true, () => { calls++; });
    snapshot = { ...replaced.camera.fadeEffect };
  });
  loadGameAssets(replaced.scene);
  replaced.events.emit('create');
  try {
    assert.deepEqual({ ...replaced.camera.fadeEffect }, snapshot, 'Stale cleanup altered foreign fade');
    assert.deepEqual(owned(), listeners, 'Stale cleanup removed replacement listeners');
    assert.ok(listeners.every(ownedListeners => ownedListeners.length === 1));
    const count = replaced.objects.length;
    loadGameAssets(replaced.scene);
    assert.equal(replaced.objects.length, count, 'Stale cleanup deleted replacement cycle ownership');
    assert.deepEqual(owned(), listeners, 'Duplicate preload changed replacement listeners');
    replaced.loader.emit('progress', 0.4);
    assert.ok(replaced.objects.some(object => !object.destroyed && object.text === '40%'));
    replaced.events.emit('postupdate', 80, 80);
    assert.deepEqual({ ...replaced.camera.fadeEffect }, snapshot, 'Postupdate altered foreign fade');
  } finally {
    replaced.events.emit('shutdown');
    replaced.events.emit('shutdown');
  }
  assert.deepEqual({ ...replaced.camera.fadeEffect }, snapshot, 'Replacement shutdown cancelled foreign fade');
  replaced.events.emit('update', 80, 80);
  assert.equal(replaced.camera.fadeEffect.alpha, direction ? 0.2 : 0.8);
  assert.equal(calls, 1, 'Foreign callback stopped');
  replaced.events.emit('update', 400, 320);
  clean(replaced);
});
for (const direction of [true, false]) regression('completed native Fade: ' + direction, () => {
  const completed = harness(true);
  completed.camera.fadeEffect.start(direction, 400);
  completed.camera.fadeEffect.update(400, 400);
  loadGameAssets(completed.scene);
  completed.events.emit('create');
  if (direction) {
    assert.equal(completed.camera.duration, undefined);
    assert.equal(completed.camera.fadeEffect.isComplete, true);
    assert.equal(completed.camera.fadeEffect.alpha, 1);
  } else {
    assert.equal(completed.camera.duration, 120);
    completed.events.emit('update', 120, 120);
    completed.events.emit('postupdate', 120, 120);
    assert.equal(completed.camera.fadeEffect.alpha, 0);
  }
  completed.events.emit('shutdown');
  clean(completed);
});
assert.deepEqual(failures, [], failures.join('\n'));
console.log('scene presentation checks passed: actual preload integration, bounded progress, native Fade, reduced motion, reuse, cleanup, authority isolation');
