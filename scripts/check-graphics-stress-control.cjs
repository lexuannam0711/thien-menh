'use strict';
const assert = require('node:assert/strict');
const { options, account, verdict, classify, sceneReader, fixture, histogram } = require('./check-graphics-stress.cjs');
assert.equal(options({}).url, 'http://127.0.0.1:4187/');
assert.equal(options({}).minutes, 30);
assert.equal(options({}).maxMinutes, 90);
assert.equal(options({ STRESS_BUNDLE_SHA256: 'b'.repeat(64) }).bundleSha256, 'b'.repeat(64));
for (const bundleSha256 of ['changed', 'a'.repeat(63), 'A'.repeat(64)]) assert.throws(() => options({ STRESS_BUNDLE_SHA256: bundleSha256 }), /bundle SHA256/);
for (const url of ['http://localhost:6239/', 'https://example.com/', 'http://127.0.0.2/', 'file:///tmp/game', 'http://user:pass@127.0.0.1/', 'http://2130706433/']) assert.throws(() => options({ THAN_MENH_URL: url }), /URL/);
for (const minutes of ['0', '-1', 'NaN', 'Infinity', '31', '1.5']) assert.throws(() => options({ STRESS_MINUTES: minutes }), /duration/);
assert.throws(() => options({ STRESS_MAX_MINUTES: '29' }), /deadline/);
const point = (time, extra = {}) => ({ time, sceneTime: time, preset: 'low', key: 'Forest', hp: 100, enemies: 2, nearest: 30, paused: false, overlay: false, visible: true, frameCount: 60, heap: 1000, dom: 10, display: 100, combat: true, ...extra });
assert.equal(account(point(0), point(1000)), 1000);
for (const extra of [{ key: 'Village' }, { key: 'Menu' }, { enemies: 0 }, { paused: true }, { overlay: true }, { visible: false }, { nearest: 400 }, { hp: 0 }, { combat: false }, { preset: 'medium' }, { sceneTime: 0 }, { frameCount: 0 }]) assert.equal(account(point(0), point(1000, extra)), 0, JSON.stringify(extra));
assert.equal(account(point(0, { paused: true }), point(1000)), 0);
assert.equal(account(point(0), point(4000)), 0);
assert.throws(() => account(point(1000), point(999)), /clock/);
assert.throws(() => account(point(1000), point(2000, { sceneTime: 999 })), /clock/);
for (const metric of ['time', 'sceneTime', 'hp', 'enemies', 'heap', 'dom', 'display', 'frameCount', 'nearest']) assert.throws(() => account(point(0), point(1000, { [metric]: undefined })), /metric/);
const preset = () => ({ activeMs: 600000, combatWindows: 20, skills: 3, basics: 3, dodges: 3, hits: 20, incomingDamage: 1, transitions: ['Village>Forest', 'Forest>Village', 'Village>Forest', 'Forest>Village'], frames: 1000 });
const report = () => ({ minutes: 30, continuous: true, elapsedMs: 1900000, presets: Object.fromEntries(['low', 'medium', 'high'].map(name => [name, preset()])), errors: [], assetFailures: [], failures: [], bundleBefore: 'a'.repeat(64), bundleAfter: 'a'.repeat(64), browserBundleSha256: 'a'.repeat(64) });
assert.equal(verdict(report()), 'PASS');
for (const browserBundleSha256 of [undefined, 'b'.repeat(64)]) assert.equal(verdict({ ...report(), browserBundleSha256 }), 'FAILED', 'browserBundleSha256=' + String(browserBundleSha256));
for (const incomingDamage of [undefined, 0, -1, NaN, Infinity]) { const candidate = report(); candidate.presets.high.incomingDamage = incomingDamage; assert.equal(verdict(candidate), 'INCOMPLETE', String(incomingDamage)); }
for (const metric of ['activeMs', 'combatWindows', 'skills', 'basics', 'dodges', 'hits', 'frames']) { const candidate = report(); candidate.presets.high[metric] = 0; assert.equal(verdict(candidate), 'INCOMPLETE', metric); }
const missingScene = report(); missingScene.presets.low.transitions = ['Village>Forest']; assert.equal(verdict(missingScene), 'INCOMPLETE');
const fewTransitions = report(); for (const preset of Object.values(fewTransitions.presets)) preset.transitions = ['Village>Forest', 'Forest>Village']; assert.equal(verdict(fewTransitions), 'INCOMPLETE');
for (const name of ['low', 'medium', 'high']) { const candidate = report(); candidate.presets[name].activeMs = 599999; assert.equal(verdict(candidate), 'INCOMPLETE'); }
assert.equal(verdict({ ...report(), minutes: 1 }), 'SMOKE');
assert.equal(verdict({ ...report(), continuous: false }), 'FAILED');
for (const continuous of [1, 'true', undefined]) assert.equal(verdict({ ...report(), continuous }), 'FAILED');
for (const minutes of [0, NaN, Infinity, undefined, 31, 1.5]) assert.equal(verdict({ ...report(), minutes }), 'FAILED');
for (const field of ['errors', 'assetFailures', 'failures', 'presets']) assert.equal(verdict({ ...report(), [field]: undefined }), 'FAILED');
assert.equal(verdict({ ...report(), errors: ['exception'] }), 'FAILED');
assert.equal(verdict({ ...report(), assetFailures: ['404'] }), 'FAILED');
assert.equal(verdict({ ...report(), bundleAfter: 'changed' }), 'FAILED');
assert.equal(verdict({ ...report(), failures: ['deadline'] }), 'FAILED');
for (const elapsedMs of [NaN, Infinity, undefined, -1]) assert.equal(verdict({ ...report(), elapsedMs }), 'FAILED');
const infinitePreset = report(); infinitePreset.presets.low.activeMs = Infinity; assert.equal(verdict(infinitePreset), 'INCOMPLETE');
assert.equal(verdict({ ...report(), bundleBefore: undefined }), 'FAILED');
assert.equal(classify(new Error('deadline exceeded')), 'deadline');
assert.equal(classify(new Error('missing metric heap')), 'missing-metrics');
assert.equal(classify(new Error('clock reversed')), 'clock');
assert.equal(classify(new Error('no-route')), 'navigation');
assert.equal(classify(new Error('unexpected issue')), 'harness');
const observer = { ids: new WeakMap(), sequence: 0 };
const reader = require('node:vm').runInNewContext('(' + sceneReader + ')', { window: { __graphicsStressObserver: observer } });
const first = Object.freeze({ x: 20, y: 20, hp: 50, isAlive: true });
const second = Object.freeze({ x: 30, y: 30, hp: 60, isAlive: true });
const game = enemies => [{ scene: { getScenes: () => [{ sys: { settings: { key: 'Forest' } }, time: { now: 10, paused: false }, enemies, children: { list: [{ list: [{}, {}] }] } }] } }];
const initial = reader.call(game([first, second]));
const compacted = reader.call(game([second]));
assert.equal(initial.enemies[1].id, compacted.enemies[0].id);
assert.equal(initial.display, 3);
assert.equal(compacted.enemies.length, 1);
assert.throws(() => reader.call([]), /one continuous/);
const loading = reader.call([{ scene: { getScenes: () => [] } }]);
assert.equal(loading.key, 'Loading');
assert.equal(loading.enemies.length, 0);
const seed = fixture();
assert.equal(seed.version, 1);
assert.equal(seed.attack, 12); assert.equal(seed.maxHp, 10000); assert.equal(seed.quest, 'active'); assert.equal(seed.bossDead, true);
assert.equal(seed.rpg.skills, undefined);
assert.equal(seed.rpg.quests['hunt-ho-yeu'].stage, 'active');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const coverageLoop = fs.readFileSync(require.resolve('./check-graphics-stress.cjs'), 'utf8').match(/while \((preset\.activeMs[^\n]+)\) \{/)[1];
for (const incomingDamage of [undefined, 0, -1, NaN, Infinity, 1]) assert.equal(require('node:vm').runInNewContext(coverageLoop, { preset: { ...preset(), incomingDamage }, required: 600000 }), !Number.isFinite(incomingDamage) || incomingDamage <= 0, String(incomingDamage));
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-stress-control-'));
try {
  require('node:child_process').execFileSync(process.execPath, [path.resolve('node_modules/typescript/bin/tsc'), 'src/game/systems/GameState.ts', '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--skipLibCheck', '--outDir', output], { stdio: 'inherit' });
  fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');
  const { normalizeSave } = require(path.join(output, 'game/systems/GameState.js'));
  const normalized = normalizeSave(seed);
  for (const field of ['hp', 'mp', 'maxHp', 'maxMp', 'attack', 'quest', 'bossDead']) assert.equal(normalized[field], seed[field], field);
  assert.deepEqual(normalized.rpg.skills.unlockedSkillIds, ['earth-shockwave', 'flame-beam', 'tidal-surge']);
  assert.equal(normalizeSave({ ...seed, version: undefined }).hp, 100);
} finally { fs.rmSync(output, { recursive: true, force: true }); }
assert.equal(histogram([8, 10, 17, 30, 45, 60, 150]).reduce((count, bucket) => count + bucket.count, 0), 7);
const { validateIntervals, isBaselineFavicon } = require('./check-graphics-stress.cjs');
assert.doesNotThrow(() => validateIntervals([8, 16.7, 100]));
for (const intervals of [[NaN], [Infinity], [-1], [undefined], [0], null]) assert.throws(() => validateIntervals(intervals), /metric/);
assert.equal(isBaselineFavicon({ url: 'http://127.0.0.1:4187/favicon.ico', status: 404, type: 'Other', initiator: { type: 'other' } }, 'http://127.0.0.1:4187/'), true);
for (const type of ['Fetch', 'XHR', undefined]) assert.equal(isBaselineFavicon({ url: 'http://127.0.0.1:4187/favicon.ico', status: 404, type, initiator: { type: 'other' } }, 'http://127.0.0.1:4187/'), false);
assert.equal(isBaselineFavicon({ url: 'http://127.0.0.1:4187/favicon.ico', status: 404, type: 'Other', initiator: { type: 'script' } }, 'http://127.0.0.1:4187/'), false);
const { connect } = require('./check-graphics-stress.cjs');
for (const type of ['Other', 'Fetch', 'XHR']) {
  const candidate = { ...report(), url: 'http://127.0.0.1:4187/', baselineWarnings: [] };
  const listeners = {};
  connect({ addEventListener: (event, listener) => { listeners[event] = listener; } }, candidate);
  const event = (method, params) => listeners.message({ data: JSON.stringify({ method, params }) });
  event('Network.requestWillBeSent', { requestId: 'favicon', initiator: { type: 'other' } });
  event('Network.responseReceived', { requestId: 'favicon', type, response: { url: candidate.url + 'favicon.ico', status: 404 } });
  event('Log.entryAdded', { entry: { networkRequestId: 'favicon', source: 'network', level: 'error', text: 'Failed status of 404' } });
  assert.equal(candidate.baselineWarnings.length, type === 'Other' ? 2 : 0);
  assert.equal(candidate.assetFailures.length, type === 'Other' ? 0 : 1);
  assert.equal(verdict(candidate), type === 'Other' ? 'PASS' : 'FAILED');
}
const { movementSegments } = require('./check-graphics-stress.cjs');
const segments = movementSegments(120, 30, 100);
assert.deepEqual(segments.map(segment => segment.codes), [['KeyD', 'KeyS'], ['KeyD']]);
const movedX = segments[0].duration / Math.SQRT2 + segments[1].duration;
const movedY = segments[0].duration / Math.SQRT2;
assert.ok(Math.abs(movedX / movedY - 4) < 1e-10);
assert.deepEqual(movementSegments(0, 0, 100), []);
const { damageEvidence } = require('./check-graphics-stress.cjs');
const previousCombat = { key: 'Forest', sceneTime: 100, hp: 100, enemyDetails: [{ id: 1, hp: 20 }] };
const currentCombat = { key: 'Forest', sceneTime: 101, enemies: [{ id: 1, hp: 15 }] };
assert.deepEqual(damageEvidence(previousCombat, currentCombat, { hp: 90 }), { hits: 1, incoming: 10 });
assert.deepEqual(damageEvidence(previousCombat, { ...currentCombat, key: 'Village' }, { hp: 90 }), { hits: 0, incoming: 0 });
assert.deepEqual(damageEvidence(previousCombat, { ...currentCombat, sceneTime: 100 }, { hp: 90 }), { hits: 0, incoming: 0 });
assert.deepEqual(damageEvidence(previousCombat, currentCombat, { hp: 120 }), { hits: 1, incoming: 0 });
for (const entry of [{ url: 'http://127.0.0.1:4187/assets/hero.png', status: 404 }, { url: 'http://127.0.0.1:4187/favicon.ico', status: 500 }, { url: 'http://example.com/favicon.ico', status: 404 }, { url: 'http://127.0.0.1:4187/favicon.ico?x', status: 404 }]) assert.equal(isBaselineFavicon(entry, 'http://127.0.0.1:4187/'), false);
async function checkCombatInputs() {
  const { combatStep } = require('./check-graphics-stress.cjs');
  const actions = [];
  const context = { input: { key: async (code, type) => actions.push([code, type]), press: async code => actions.push([code, 'press']) }, sample: async () => ({ combat: true }) };
  const scene = { player: { x: 200, y: 200, barriers: [] }, enemies: [{ x: 400, y: 200 }] };
  await combatStep(context, scene, 0);
  assert.deepEqual(actions[0], ['KeyD', 'keyDown']);
  assert.deepEqual(actions.at(-1), ['KeyD', 'keyUp']);
  assert.ok(actions.some(([code]) => code === 'KeyJ'));
  assert.ok(!actions.some(([code]) => code === 'KeyQ'));
  actions.length = 0;
  await combatStep(context, { ...scene, enemies: [{ x: 300, y: 200 }] }, 0);
  assert.ok(actions.some(([code]) => code === 'KeyQ'));
  assert.ok(actions.some(([code]) => code === 'Space'));
  actions.length = 0;
  await combatStep(context, scene, 12);
  assert.ok(actions.some(([code]) => code === 'KeyJ'), 'cadence attacks at iteration 12');
  actions.length = 0;
  await combatStep(context, { ...scene, enemies: [{ x: 300, y: 200 }] }, 32);
  assert.ok(actions.some(([code]) => code === 'KeyE'));
  assert.ok(actions.some(([code]) => code === 'Space'));
  actions.length = 0;
  const obstacle = { x: 208, y: 170, width: 10, height: 90 };
  const target = { x: 400, y: 300 };
  let closeWaypoint;
  for (let x = 34; x <= 36 && !closeWaypoint; x += 0.5) {
    for (let y = 264; y <= 266 && !closeWaypoint; y += 0.5) {
      const player = { x, y, barriers: [obstacle] };
      const waypoint = require('./campaign-navigation.cjs')(player, target, player.barriers, 65);
      if (Math.abs(waypoint.x - x) <= 5 && Math.abs(waypoint.y - y) <= 5
        && Math.hypot(waypoint.x - x, waypoint.y - y) > 1) closeWaypoint = { player, enemies: [target] };
    }
  }
  assert.ok(closeWaypoint, 'Fixture finds a reachable waypoint inside old input dead zone');
  await combatStep(context, closeWaypoint, 1);
  assert.ok(actions.some(([, type]) => type === 'keyDown'), 'Small waypoint still advances physical movement');
  assert.ok(actions.some(([, type]) => type === 'keyUp'), 'Small movement input is released');
  context.sample = async () => { throw Error('sample failed'); };
  await assert.rejects(combatStep(context, scene, 1), /sample failed/);
  assert.deepEqual(actions.at(-1), ['KeyD', 'keyUp']);
}
async function checkObserverSource() {
  const { attachObserver } = require('./check-graphics-stress.cjs');
  const bundle = 'save.load();settings.getState().quality;new Phaser.Game(config);';
  const bundleUrl = 'http://127.0.0.1:4187/assets/game.js';
  const expectedHash = require('node:crypto').createHash('sha256').update(bundle).digest('hex');
  const pauses = [{ callFrames: [{ callFrameId: 'first-frame', location: { scriptId: 'first-script' } }, { callFrameId: 'other-frame', location: { scriptId: 'other-script' } }] }];
  for (const scriptSource of [bundle, bundle + '\n']) {
    const calls = [];
    const send = async (method, params) => {
      calls.push(method);
      if (method === 'Debugger.getScriptSource') {
        assert.deepEqual(params, { scriptId: pauses[0].callFrames[0].location.scriptId });
        return { scriptSource };
      }
      if (['Debugger.evaluateOnCallFrame', 'Runtime.queryObjects', 'Runtime.callFunctionOn', 'Debugger.resume'].includes(method)) assert.ok(calls.includes('Debugger.getScriptSource'), 'Observer accessed before verification');
      if (method === 'Debugger.evaluateOnCallFrame') {
        assert.equal(params.callFrameId, pauses[0].callFrames[0].callFrameId);
        return { result: { objectId: params.expression } };
      }
      if (method === 'Runtime.queryObjects') return { objects: { objectId: 'games' } };
      if (method === 'Runtime.callFunctionOn') return { result: { value: true } };
      return {};
    };
    if (scriptSource === bundle) {
      const refs = await attachObserver(send, pauses, bundle, bundleUrl);
      assert.equal(refs.browserBundleSha256, expectedHash);
      assert.equal(calls.filter(method => method === 'Debugger.getScriptSource').length, 1);
      assert.deepEqual([refs.games, refs.state, refs.settings], ['games', 'save', 'settings']);
    } else {
      await assert.rejects(attachObserver(send, pauses, bundle, bundleUrl), /SHA256|hash|source/i);
      assert.ok(calls.includes('Debugger.getScriptSource'));
      assert.ok(!calls.some(method => ['Debugger.evaluateOnCallFrame', 'Runtime.queryObjects', 'Runtime.callFunctionOn', 'Debugger.resume'].includes(method)));
    }
  }
}
async function checkSignaledCleanup() {
  const filename = require.resolve('./check-graphics-stress.cjs');
  const isolated = { exports: {} };
  let terminationAttempts = 0;
  const terminate = () => { terminationAttempts++; throw new Error('Unexpected process termination'); };
  require('node:vm').runInNewContext(fs.readFileSync(filename, 'utf8'), {
    require: name => name === 'node:child_process' ? { spawn: terminate, spawnSync: terminate } : require(name),
    __filename: filename, __dirname: path.dirname(filename), process, setTimeout, clearTimeout,
    module: isolated, exports: isolated.exports, console,
  }, { filename });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-graphics-stress-'));
  try {
    await assert.doesNotReject(isolated.exports.cleanup({ browser: { exitCode: null, signalCode: 'SIGTERM', pid: 123456, kill: terminate }, profile, report: {} }));
    assert.equal(fs.existsSync(profile), false);
    assert.equal(terminationAttempts, 0);
  } finally { fs.rmSync(profile, { recursive: true, force: true }); }
}
checkCombatInputs().then(checkObserverSource).then(checkSignaledCleanup).then(() => console.log('Graphics stress controls: PASS (fixture, metrics, active elapsed, scene coverage, actual input cleanup).')).catch(error => { console.error(error); process.exitCode = 1; });
