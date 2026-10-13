'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { launch, cleanup, evaluate, observe, attachObserver, inputs, options, fixture } = require('./check-graphics-stress.cjs');
const { DIRECTIONS, animationFrames } = require('../src/game/assets/spriteManifest.ts');
const heroes = ['hero', 'hero_axe', 'hero_sword'];
const weapons = ['bronze-spear', 'battle-axe', 'lac-sword'];
const items = ['bamboo-armor', 'jade-charm'];
const transforms = ['x', 'y', 'originX', 'originY', 'flipX', 'flipY', 'scaleX', 'scaleY', 'rotation', 'alpha'];
const assetPaths = items.flatMap(item => heroes.map(hero => '/assets/equipment/' + item + '_' + hero + '.png'));
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const hasPose = (entry, expected) => Boolean(entry.hero.animation?.includes('_' + expected + '_'));

function validateAlignment(sample, heroName, equipped) {
  assert.ok(sample && sample.visible && sample.hero?.visible, 'Visible Player.view/hero required');
  const hero = sample.hero;
  assert.equal(hero.key, heroName + '_sprite', 'Canonical hero texture');
  assert.ok(Number.isInteger(hero.order) && hero.order >= 0, 'Hero child order');
  assert.ok(typeof hero.frame === 'string' || Number.isFinite(hero.frame), 'Hero frame');
  for (const field of transforms) assert.ok(typeof hero[field] === (field.startsWith('flip') ? 'boolean' : 'number') && (field.startsWith('flip') || Number.isFinite(hero[field])), 'Missing transform ' + field);
  assert.ok(hero.alpha > 0 && hero.scaleX !== 0 && hero.scaleY !== 0 && Number.isFinite(hero.depth), 'Renderable hero');
  assert.equal(sample.overlays.length, equipped ? 2 : 0, 'Visible overlay count');
  sample.overlays.forEach((overlay, index) => {
    assert.equal(overlay.key, 'equipment_' + items[index] + '_' + heroName, 'Overlay texture');
    assert.equal(overlay.visible, true, 'Overlay visibility');
    assert.equal(overlay.frame, hero.frame, 'Overlay frame');
    for (const field of transforms) assert.equal(overlay[field], hero[field], 'Overlay transform ' + field);
    assert.ok(Number.isInteger(overlay.order) && overlay.order > (index ? sample.overlays[index - 1].order : hero.order), 'Overlay child order');
    assert.ok(Math.abs(overlay.depth - (hero.depth + (index + 1) / 100)) < 1e-9, 'Overlay depth order');
  });
}

function selfcheck() {
  selfcheckFrames();
  for (const name of heroes) {
    const hero = { key: name + '_sprite', frame: 3, x: 0, y: -6, originX: 0.5, originY: 0.5, flipX: false, flipY: false, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, visible: true, order: 1, depth: 0 };
    const overlays = items.map((item, index) => ({ ...hero, key: 'equipment_' + item + '_' + name, order: index + 2, depth: (index + 1) / 100 }));
    const sample = { hero, overlays, visible: true };
    validateAlignment(sample, name, true);
    validateAlignment({ ...sample, overlays: overlays.map(overlay => ({ ...overlay, order: overlay.order + 1 })) }, name, true);
    validateAlignment({ ...sample, overlays: [] }, name, false);
    const transformed = { frame: '17', x: 2, y: -8, originX: 0.2, originY: 0.7, flipX: true, flipY: true, scaleX: 1.2, scaleY: 0.8, rotation: 0.4, alpha: 0.6 };
    validateAlignment({ ...sample, hero: { ...hero, ...transformed }, overlays: overlays.map(overlay => ({ ...overlay, ...transformed })) }, name, true);
    for (const field of ['frame', ...transforms, 'order', 'depth']) {
      const changed = typeof overlays[0][field] === 'boolean' ? !overlays[0][field] : overlays[0][field] + 1;
      assert.throws(() => validateAlignment({ ...sample, overlays: [{ ...overlays[0], [field]: changed }, overlays[1]] }, name, true), undefined, field);
    }
    assert.throws(() => validateAlignment(sample, name, false));
    assert.throws(() => validateAlignment({ ...sample, overlays: overlays.slice(0, 1) }, name, true));
    assert.throws(() => validateAlignment({ ...sample, overlays: [{ ...overlays[0], key: 'wrong' }, overlays[1]] }, name, true));
    assert.throws(() => validateAlignment({ ...sample, visible: false }, name, true));
    assert.throws(() => validateAlignment({ ...sample, overlays: [{ ...overlays[0], visible: false }, overlays[1]] }, name, true));
    const save = equipmentFixture(heroes.indexOf(name), true);
    assert.equal(save.version, 1); assert.equal(save.level, 3);
    assert.equal(save.rpg.equipment.slots.weapon, weapons[heroes.indexOf(name)]);
    assert.deepEqual(save.rpg.inventory.slots.map(slot => slot.itemId), [...weapons, ...items]);
  }
  assert.throws(() => configuration({}), /Explicit STRESS_BUNDLE_SHA256/);
  assert.throws(() => configuration({ STRESS_BUNDLE_SHA256: 'a'.repeat(64), THAN_MENH_URL: 'http://127.0.0.1:4188/' }), /port 4187/);
  assert.ok(hasPose({ hero: { animation: 'hero_sword_attack1_down' } }, 'attack1'));
  assert.ok(!hasPose({ hero: { animation: 'hero_sword_attack2_down' } }, 'attack1'));
  assert.ok(!hasPose({ hero: { animation: 'hero_sword_attack1_down' } }, 'attack'));
  console.log('equipment-browser selfcheck PASS: three heroes, equipped/unequipped, frame/transform/order mismatches; no browser');
}

function assertActionFrames(observations, name, pose) {
  const matching = observations.filter(entry => DIRECTIONS.some(direction => entry.hero.animation === name + '_' + pose + '_' + direction));
  for (const entry of matching) {
    const direction = entry.hero.animation.slice((name + '_' + pose + '_').length);
    assert.ok(animationFrames(name, pose, direction).includes(Number(entry.hero.frame)), 'Actual canonical frame required');
  }
  assert.ok(DIRECTIONS.some(direction => new Set(matching.filter(entry => entry.hero.animation === name + '_' + pose + '_' + direction).map(entry => Number(entry.hero.frame))).size >= 2), 'Actual action frames must advance');
}

function selfcheckFrames() {
  assert.throws(() => assertActionFrames(DIRECTIONS.slice(0, 2).map(direction => ({ hero: { animation: 'hero_run_' + direction, frame: animationFrames('hero', 'run', direction)[0] } })), 'hero', 'run'), /advance/);
  for (const name of heroes) for (const pose of ['run', 'attack1', 'dodge']) for (const direction of DIRECTIONS) {
    const frames = animationFrames(name, pose, direction);
    const observations = frames.slice(0, 2).map(frame => ({ hero: { animation: name + '_' + pose + '_' + direction, frame } }));
    assertActionFrames(observations, name, pose);
    assert.throws(() => assertActionFrames([observations[0], observations[0]], name, pose), /advance/);
    assert.throws(() => assertActionFrames([{ hero: { ...observations[0].hero, frame: 9999 } }, observations[1]], name, pose), /canonical frame/);
    assert.throws(() => assertActionFrames(observations.map(entry => ({ hero: { ...entry.hero, animation: 'wrong_' + pose + '_' + direction } })), name, pose), /advance/);
  }
}

function configuration(env) {
  assert.ok(/^[a-f0-9]{64}$/.test(env.STRESS_BUNDLE_SHA256 || ''), 'Explicit STRESS_BUNDLE_SHA256 required');
  const config = options({ ...env, STRESS_MINUTES: '1', STRESS_MAX_MINUTES: '3', STRESS_OUTPUT: env.STRESS_OUTPUT || 'artifacts/equipment-browser-' + Date.now() });
  assert.equal(new URL(config.url).origin, 'http://127.0.0.1:4187', 'FINAL equipment snapshot must use port 4187');
  return config;
}

async function fetchBytes(url, config) {
  assert.equal(new URL(url).origin, new URL(config.url).origin, 'Cross-origin preview resource');
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, 'Served resource status: ' + url);
  return Buffer.from(await response.arrayBuffer());
}

async function snapshot(config) {
  const html = await fetchBytes(config.url, config);
  const entries = [...html.toString('utf8').matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*>/g)];
  assert.equal(entries.length, 1, 'Exactly one served production entry required');
  const bundleUrl = new URL(entries[0][1], config.url).href;
  assert.ok(/\/assets\/index-[\w-]+\.js$/.test(bundleUrl), 'Production entry path');
  const bytes = await fetchBytes(bundleUrl, config);
  const bundleSha256 = hash(bytes);
  assert.equal(bundleSha256, config.bundleSha256, 'Served FINAL bundle SHA256 mismatch');
  return { htmlSha256: hash(html), bundleSha256, bundleUrl, bundle: bytes.toString('utf8') };
}

function equipmentFixture(index, equipped) {
  const base = fixture();
  return { ...base, level: 3, hp: 100, mp: 100, maxHp: 100, maxMp: 100,
    rpg: { ...base.rpg, inventory: { capacity: 24, slots: [...weapons, ...items].map(itemId => ({ itemId, quantity: 1 })) },
      equipment: { slots: { weapon: weapons[index], ...(equipped ? { armor: items[0], accessory: items[1] } : {}) } } } };
}

const playerReader = function() {
  if (this.length !== 1) throw new Error('Expected one equipment fixture game');
  const scene = this[0].scene.getScenes(true).find(entry => entry.player) || this[0].scene.getScenes(true)[0];
  const player = scene?.player;
  if (!player) return { scene: scene?.sys.settings.key || 'Loading' };
  const children = player.view.list;
  const copy = (child, order) => ({ key: child.texture?.key, frame: child.frame?.name, x: child.x, y: child.y,
    originX: child.originX, originY: child.originY, flipX: child.flipX, flipY: child.flipY,
    scaleX: child.scaleX, scaleY: child.scaleY, rotation: child.rotation, alpha: child.alpha,
    visible: child.visible, depth: child.depth, order, animation: child.anims?.currentAnim?.key || null });
  const sprites = children.map(copy).filter(child => child.key);
  const hero = sprites.filter(child => ['hero_sprite', 'hero_axe_sprite', 'hero_sword_sprite'].includes(child.key));
  if (hero.length !== 1) throw new Error('Expected actual Player.view hero child');
  return { scene: scene.sys.settings.key, time: scene.time.now, visible: player.view.visible && player.view.alpha > 0,
    world: { x: player.x, y: player.y }, hero: hero[0],
    overlays: sprites.filter(child => child.key.startsWith('equipment_') && child.visible),
    lastAttack: player.lastAttack, dodgeReadyAt: player.dodgeReadyAt, dodging: player.isDodging, dead: player.isDead };
}.toString();

function guard(context) {
  assert.ok(!context.stopped && Date.now() < context.deadline, 'Equipment deadline/interruption');
}

async function read(context) {
  guard(context);
  return observe(context.send, context.refs.games, playerReader);
}

async function waitScene(context, name) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await read(context)).scene === name) return;
    await delay(50);
  }
  throw new Error('Equipment scene missing: ' + name);
}

async function seed(context, frozen, index, equipped) {
  guard(context);
  const save = equipmentFixture(index, equipped);
  await evaluate(context.send, 'localStorage.setItem("than-menh-van-lang-mvp-v1",' + JSON.stringify(JSON.stringify(save)) + ')');
  context.pauses.length = 0;
  context.refs = await attachObserver(context.send, context.pauses, frozen.bundle, frozen.bundleUrl);
  const normalized = await observe(context.send, context.refs.state, 'function(){return this.data;}');
  assert.equal(normalized.version, 1, 'Normalized canonical save');
  assert.equal(normalized.level, save.level, 'Canonical weapon eligibility preserved');
  assert.deepEqual(normalized.rpg.equipment.slots, save.rpg.equipment.slots, 'Legitimate equipment save normalization');
  assert.deepEqual(normalized.rpg.inventory.slots, save.rpg.inventory.slots, 'Real canonical inventory');
  context.report.fixtures.push({ hero: heroes[index], equipped, requested: save, normalized });
  await waitScene(context, 'Menu');
  await context.input.click(480, 332);
  await waitScene(context, 'Village');
  await delay(150);
}

async function screenshot(context, label) {
  guard(context);
  const result = await context.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(context.config.output, label + '.png');
  const bytes = Buffer.from(result.data, 'base64');
  fs.writeFileSync(file, bytes);
  context.report.screenshots.push({ file, sha256: hash(bytes), label });
}

async function sample(context, index, equipped, action) {
  const observed = await read(context);
  assert.equal(observed.scene, 'Village', 'Equipment fixture left Village');
  assert.equal(observed.dead, false, 'Player alive');
  validateAlignment(observed, heroes[index], equipped);
  context.report.observed.push({ fixture: heroes[index], equipped, action, ...observed });
  return observed;
}

async function action(context, index, equipped, code, duration, expected) {
  const before = await sample(context, index, equipped, code + '-before');
  const observations = [];
  let captured = false;
  await context.input.key(code, 'keyDown');
  try {
    const until = Date.now() + duration;
    while (Date.now() < until) {
      const entry = await sample(context, index, equipped, code);
      observations.push(entry);
      const distinctFrames = new Set(observations.filter(e => hasPose(e, expected)).map(e => Number(e.hero.frame))).size;
      if (!captured && distinctFrames >= 2) {
        await screenshot(context, heroes[index] + '-' + (equipped ? 'equipped' : 'unequipped') + '-' + code);
        captured = true;
      }
      await delay(20);
    }
  } finally { await context.input.key(code, 'keyUp'); }
  if (!captured) await screenshot(context, heroes[index] + '-' + (equipped ? 'equipped' : 'unequipped') + '-' + code);
  assertActionFrames(observations, heroes[index], expected);
  if (code.startsWith('Key') && code !== 'KeyJ') assert.ok(observations.some(entry => entry.world.x !== before.world.x || entry.world.y !== before.world.y), 'Real WASD movement');
  if (code === 'KeyJ') assert.ok(observations.some(entry => entry.lastAttack > before.lastAttack), 'Real attack timestamp');
  if (code === 'Space') assert.ok(observations.some(entry => entry.dodging && entry.dodgeReadyAt > before.dodgeReadyAt), 'Real dodge evidence');
  context.report.actions.push({ hero: heroes[index], equipped, code, expected, frames: [...new Set(observations.map(entry => entry.hero.frame))], observations: observations.length });
  await delay(600);
}

async function measure(context, index, equipped) {
  await sample(context, index, equipped, 'idle');
  await screenshot(context, heroes[index] + '-' + (equipped ? 'equipped' : 'unequipped') + '-idle');
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await action(context, index, equipped, code, 350, 'run');
  await action(context, index, equipped, 'KeyJ', 380, 'attack1');
  await action(context, index, equipped, 'Space', 250, 'dodge');
}

function recordAssets(context) {
  context.socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method !== 'Network.responseReceived') return;
    const response = message.params.response;
    if (assetPaths.includes(new URL(response.url).pathname)) context.report.assetResponses.push({ url: response.url, status: response.status, mimeType: response.mimeType, fromDiskCache: Boolean(response.fromDiskCache), requestId: message.params.requestId });
  });
}

function interruptible(context) {
  context.deadline = Date.now() + 180000;
  context.stop = () => { context.stopped = true; context.socket.close(); };
  context.watchdog = setTimeout(context.stop, 180000);
  context.interrupt = context.stop;
  process.once('SIGINT', context.interrupt);
  process.once('SIGTERM', context.interrupt);
}

async function finalize(config, report, context, frozen) {
  if (context) { clearTimeout(context.watchdog); process.removeListener('SIGINT', context.interrupt); process.removeListener('SIGTERM', context.interrupt); }
  try {
    const after = await snapshot(config);
    report.after = { htmlSha256: after.htmlSha256, bundleSha256: after.bundleSha256, bundleUrl: after.bundleUrl };
    if (frozen) assert.deepEqual(report.after, report.before, 'Served HTML/bundle changed during equipment fixtures');
  } catch (error) { report.failures.push({ phase: 'after-hash', message: error.message }); }
  if (context) {
    try {
      await cleanup(context);
      report.cleanup = { pid: context.browser.pid, profile: context.profile, exitCode: context.browser.exitCode, profileRemoved: !fs.existsSync(context.profile) };
      assert.ok(context.browser.exitCode !== null && report.cleanup.profileRemoved, 'Exact owned cleanup required');
    } catch (error) { report.failures.push({ phase: 'cleanup', message: error.message }); }
  }
  report.verdict = report.failures.length || report.errors.length || report.assetFailures.length ? 'FAILED' : 'PASS';
  const file = path.join(config.output, 'report.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log('Equipment browser: ' + report.verdict + ' ' + file);
  if (report.verdict !== 'PASS') process.exitCode = 1;
}

async function run(config) {
  const report = { url: config.url, before: null, after: null, errors: [], baselineWarnings: [], assetFailures: [], failures: [], assetResponses: [], fixtures: [], observed: [], actions: [], screenshots: [], cleanup: null,
    limits: 'Headless Chrome only; six legitimate save reload fixtures, not continuous stress; no device/GPU/art approval; missing-art fallback remains source test gate; no live game/frame/stat/clock mutation.' };
  fs.mkdirSync(config.output, { recursive: true });
  let context, frozen;
  try {
    frozen = await snapshot(config);
    report.before = { htmlSha256: frozen.htmlSha256, bundleSha256: frozen.bundleSha256, bundleUrl: frozen.bundleUrl };
    context = await launch(config, report);
    interruptible(context); recordAssets(context);
    context.input = inputs(context.send);
    for (const method of ['Runtime.enable', 'Network.enable', 'Log.enable', 'Page.enable']) await context.send(method);
    await context.send('Network.setCacheDisabled', { cacheDisabled: true });
    report.browserVersion = await context.send('Browser.getVersion');
    for (let index = 0; index < heroes.length; index++) for (const equipped of [true, false]) {
      await seed(context, frozen, index, equipped);
      await measure(context, index, equipped);
    }
    for (const asset of assetPaths) assert.ok(report.assetResponses.some(response => new URL(response.url).pathname === asset && response.status === 200 && response.mimeType === 'image/png'), 'Six real equipment asset responses: ' + asset);
  } catch (error) {
    report.failures.push({ phase: 'equipment', message: error.message, stack: error.stack });
    if (context && !context.stopped) try { await screenshot(context, 'failure'); } catch (captureError) { report.failures.push({ phase: 'screenshot', message: captureError.message }); }
  } finally { await finalize(config, report, context, frozen); }
}

module.exports = { validateAlignment, selfcheck, equipmentFixture, configuration };
if (require.main === module) {
  if (process.argv.includes('--selfcheck')) selfcheck();
  else {
    try { run(configuration(process.env)).catch(error => { console.error(error.stack); process.exitCode = 1; }); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
