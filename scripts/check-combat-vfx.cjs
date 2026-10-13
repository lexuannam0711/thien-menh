const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

function load(filename, dependencies = {}) {
  const result = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: result.exports, require: name => dependencies[name] ?? {} });
  return result.exports;
}
const { SKILLS } = load('src/data/skills.ts');
const { getGraphicsBudget } = load('src/game/rendering/GraphicsSettings.ts');
let budget = getGraphicsBudget({ quality: 'medium', reducedMotion: false });
const state = Object.freeze({ hp: 73, mp: 44, attack: 15, level: 3 });
const { CombatSystem } = load('src/game/systems/CombatSystem.ts', {
  '../../data/config': { PALETTE: { gold: 0xf3c66f } },
  './GameState': { gameState: Object.freeze({ data: state }) },
  '../audio/AudioManager': { audioManager: { playCue() {} } },
  '../rendering/GraphicsSettings': { graphicsSettings: { getBudget: () => budget } },
});
function createScene() {
  const objects = [], tweens = new Set(), timers = new Set(), events = new EventEmitter();
  events.setMaxListeners(0);
  function shape(kind, args) {
    const object = { kind, args, calls: [], x: 0, y: 0, destroyed: false,
      destroy() { this.destroyed = true; },
      setPosition(x, y) { this.x = x; this.y = y; return this; } };
    for (const method of ['setDepth', 'setRotation', 'lineStyle', 'fillStyle', 'beginPath',
      'arc', 'strokePath', 'fillPath', 'closePath', 'moveTo', 'lineTo', 'lineBetween',
      'fillTriangle', 'strokeCircle', 'fillCircle', 'strokeRect', 'fillRect', 'setStrokeStyle', 'add']) {
      object[method] = (...values) => { object.calls.push([method, ...values]); return object; };
    }
    objects.push(object);
    return object;
  }
  const scene = { events,
    add: Object.fromEntries(['graphics', 'rectangle', 'circle', 'container'].map(kind =>
      [kind, (...args) => shape(kind, args)])),
    tweens: { add(config) { tweens.add(config); return config; },
      killTweensOf(target) { for (const tween of tweens) if (tween.targets === target) tweens.delete(tween); } },
    time: { delayedCall(delay, callback) { const timer = { delay, callback,
      remove() { timers.delete(timer); } }; timers.add(timer); return timer; } },
    cameras: { main: { shake() { throw Error('Decorative method shook camera'); } } } };
  return { scene, objects, tweens, timers, events,
    finish() {
      for (const timer of [...timers]) { timers.delete(timer); timer.callback(); }
      for (const tween of [...tweens]) { tweens.delete(tween); tween.onComplete?.(); }
    } };
}
const signature = object => JSON.stringify(object.calls.filter(call => !['lineStyle', 'fillStyle', 'setDepth'].includes(call[0])));
const colors = objects => JSON.stringify([...new Set(objects.flatMap(object => object.calls
  .filter(call => ['lineStyle', 'fillStyle'].includes(call[0])).map(call => call[call[0] === 'lineStyle' ? 2 : 1])))].sort());
function cast(skill, reducedMotion = false, quality = 'medium') {
  budget = getGraphicsBudget({ quality, reducedMotion });
  const harness = createScene(), player = Object.freeze({ x: 500, y: 300 });
  const direction = Object.freeze({ x: 0, y: 1 });
  const before = JSON.stringify({ state, player, direction, skill });
  new CombatSystem(harness.scene, () => { throw Error('VFX accessed targets'); }).skill(player, skill, 0, direction);
  assert.equal(JSON.stringify({ state, player, direction, skill }), before, 'VFX mutates gameplay state');
  return harness;
}
const failures = [];
function check(name, run) {
  try { run(); console.log('PASS ' + name); }
  catch (error) { failures.push(name); console.error('FAIL ' + name + ': ' + error.message); }
}
check('VFX helpers stay below 50 lines', () => {
  const source = ts.createSourceFile('CombatSystem.ts', fs.readFileSync('src/game/systems/CombatSystem.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const combat = source.statements.find(ts.isClassDeclaration);
  for (const method of combat.members.filter(ts.isMethodDeclaration)) {
    const first = source.getLineAndCharacterOfPosition(method.getStart(source)).line;
    const last = source.getLineAndCharacterOfPosition(method.end).line;
    assert.ok(last - first + 1 < 50, method.name.getText(source) + ' exceeds small-function limit');
  }
});
check('weapons are not recolored identical arcs', () => {
  budget = getGraphicsBudget({ quality: 'low', reducedMotion: true });
  const geometry = ['spear', 'axe', 'sword'].map(weaponType => {
    const harness = createScene();
    new CombatSystem(harness.scene, () => []).slashEffect(500, 300, { x: 1, y: 0 }, 1, { weaponType, range: 92 });
    return signature(harness.objects[0]);
  });
  assert.equal(new Set(geometry).size, 3, 'Weapons share recolored geometry');
});
check('unique weapon geometry and actual reach/local origin', () => {
  const signatures = new Set();
  for (const weaponType of ['spear', 'axe', 'sword']) {
    for (const combo of [1, 2, 3]) for (const direction of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      budget = getGraphicsBudget({ quality: 'low', reducedMotion: true });
      const harness = createScene();
      new CombatSystem(harness.scene, () => []).slashEffect(500, 300, direction, combo,
        Object.freeze({ weaponType, range: 92 }));
      const graphic = harness.objects[0];
      assert.deepEqual([graphic.x, graphic.y], [500, 300]);
      for (const [method, ...args] of graphic.calls) {
        if (method === 'arc') { assert.deepEqual(args.slice(0, 2), [0, 0]); assert.ok(args[2] <= 92); }
        if (['fillTriangle', 'lineBetween'].includes(method)) {
          for (let index = 0; index < args.length; index += 2) assert.ok(Math.hypot(args[index], args[index + 1]) <= 92.001);
        }
      }
      if (combo === 1 && direction.x === 1) signatures.add(signature(graphic));
      harness.finish();
      assert.ok(harness.objects.every(object => object.destroyed), 'Weapon effect leaks');
    }
  }
  assert.equal(signatures.size, 3, 'Weapons share recolored geometry');
});
check('positive melee damage matches visible authoritative sector', () => {
  const items = load('src/data/items.ts');
  const weapons = load('src/data/weapons.ts', { './items': items });
  budget = getGraphicsBudget({ quality: 'low', reducedMotion: true });
  for (const weaponId of ['bronze-spear', 'battle-axe', 'lac-sword']) for (const combo of [1, 2, 3]) {
    const save = { attack: 15, level: 99, rpg: { equipment: { slots: { weapon: weaponId } } } };
    const RealCombat = load('src/game/systems/CombatSystem.ts', {
      './GameState': { gameState: { data: save } }, '../../data/weapons': weapons,
      '../audio/AudioManager': { audioManager: { playCue() {} } },
      '../rendering/GraphicsSettings': { graphicsSettings: { getBudget: () => budget } },
    }).CombatSystem;
    const harness = createScene();
    const range = weapons.getEquippedWeaponOrDefault(weaponId, 99).range;
    const spread = Math.acos(combo === 3 ? -0.12 : 0.19);
    let hits = 0, bossHits = 0, misses = 0;
    const target = { x: 500 + Math.cos(spread - 0.01) * range, y: 300 + Math.sin(spread - 0.01) * range,
      radius: 10, isAlive: true, damage() { hits++; } };
    const behind = { x: 500 - range, y: 300, radius: 10, isAlive: true, damage() { misses++; } };
    const bossSystem = { boss: target, damageBoss() { bossHits++; } };
    new RealCombat(harness.scene, () => [target, behind], bossSystem).basic({ x: 500, y: 300 }, combo, { x: 1, y: 0 });
    assert.equal(hits, 1); assert.equal(bossHits, 1); assert.equal(misses, 0);
    assert.ok(harness.objects[0].calls.some(call => call[0] === 'arc' && call[3] === range
      && Math.abs(call[4] + spread) < 1e-9 && Math.abs(call[5] - spread) < 1e-9),
      weaponId + ' damaged outside displayed sector');
    harness.finish();
  }
});
check('positive skill damage/status preserves target authority', () => {
  const skillCombat = load('src/game/systems/SkillCombat.ts');
  const RealCombat = load('src/game/systems/CombatSystem.ts', {
    './SkillCombat': skillCombat, './GameState': { gameState: { data: state } },
    '../audio/AudioManager': { audioManager: { playCue() {} } },
    '../rendering/GraphicsSettings': { graphicsSettings: { getBudget: () => budget } },
  }).CombatSystem;
  budget = getGraphicsBudget({ quality: 'low', reducedMotion: true });
  for (const skill of SKILLS.filter(entry => entry.targetType !== 'self')) {
    const harness = createScene(), damage = [], statuses = [], bossDamage = [];
    const target = { x: 525, y: 300, radius: 10, isAlive: true,
      damage(...args) { damage.push(args); }, applyStatus(...args) { statuses.push(args); } };
    const outside = { x: 1500, y: 1500, radius: 10, isAlive: true,
      damage() { throw Error('Damaged outside skill area'); }, applyStatus() { throw Error('Outside status'); } };
    const bossSystem = { boss: target, damageBoss(...args) { bossDamage.push(args); } };
    new RealCombat(harness.scene, () => [target, outside], bossSystem).skill({ x: 500, y: 300 }, skill, 25, { x: 1, y: 0 });
    const knockback = skill.effect.knockback ?? 0;
    assert.deepEqual(damage, [[25, knockback, 0 * knockback]]);
    assert.deepEqual(bossDamage, [[25, knockback, 0 * knockback]]);
    assert.deepEqual(statuses, [[skill.effect.statusEffect, skill.effect.statusDurationMs ?? 0, 25]]);
    harness.finish();
  }
});
check('area element identity', () => {
  const geometry = new Set(), palette = new Set();
  for (const skill of SKILLS.filter(skill => skill.targetType === 'area')) {
    const harness = cast({ ...skill, effect: { ...skill.effect, radius: 100 } }, true);
    geometry.add(signature(harness.objects[0])); palette.add(colors(harness.objects));
    assert.ok(harness.objects.some(object => object.calls.some(call => call[0] === 'strokeCircle' && call[3] === 100)), 'Actual area edge missing');
    harness.finish();
  }
  assert.equal(geometry.size, 4, 'Area motifs identical');
  assert.equal(palette.size, 4, 'Area colors identical');
});
check('12 canonical motifs, budgets, reduced motion, lifetime, shutdown', () => {
  assert.equal(SKILLS.length, 12);
  const signatures = new Set();
  for (const skill of SKILLS) {
    const frozen = Object.freeze({ ...skill, effect: Object.freeze({ ...skill.effect }) });
    for (const quality of ['low', 'medium', 'high']) for (const reduced of [false, true]) {
      const harness = cast(frozen, reduced, quality);
      assert.equal(harness.objects.length, 1 + budget.combatSparks, 'Object budget differs');
      assert.equal(harness.timers.size, harness.objects.length, 'Missing bounded disposal');
      assert.ok(harness.objects[0].calls.some(call => call[0] === 'lineStyle' && call[2] ===
        ({ earth: 0xd4af37, flame: 0xffa04e, water: 0x7ccbdc, physical: 0xe8dcc3 })[skill.element]), 'Element palette missing');
      if (reduced) { assert.equal(harness.tweens.size, 0); assert.equal(harness.objects.length, 1); }
      for (const timer of harness.timers) assert.ok(timer.delay > 0 && timer.delay <= 650);
      for (const tween of harness.tweens) {
        assert.ok(tween.duration > 0 && tween.duration <= 650);
        assert.ok(!('scale' in tween), 'Animated geometry invents reach');
      }
      if (reduced && quality === 'low') signatures.add(signature(harness.objects[0]));
      if (skill.targetType === 'directional') {
        const graphic = harness.objects[0];
        assert.deepEqual([graphic.x, graphic.y], [500, 300]);
        assert.ok(graphic.calls.some(call => call[0] === 'setRotation' && call[1] === Math.PI / 2));
        assert.ok(graphic.calls.some(call => call[0] === 'strokeCircle' && call[1] === skill.effect.range && call[2] === 0), 'Directional endpoint missing');
        assert.ok(graphic.calls.some(call => call[0] === 'strokeRect' && call[1] === 0 && call[2] === -32 && call[3] === skill.effect.range && call[4] === 64), 'Authoritative directional lane missing');
      }
      if (skill.targetType === 'area') assert.ok(harness.objects[0].calls.some(call =>
        call[0] === 'strokeCircle' && call[1] === 0 && call[2] === 0 && call[3] === skill.effect.radius), 'Area reach differs');
      harness.finish();
      assert.ok(harness.objects.every(object => object.destroyed), 'Lifetime leaks');
      assert.equal(harness.events.listenerCount('shutdown'), 0);
      const shutdown = cast(frozen, reduced, quality);
      shutdown.events.emit('shutdown');
      assert.ok(shutdown.objects.every(object => object.destroyed), 'Shutdown leaks');
      assert.equal(shutdown.timers.size, 0); assert.equal(shutdown.tweens.size, 0);
      shutdown.finish();
    }
  }
  assert.equal(signatures.size, 12, 'Canonical skill silhouettes overlap');
});
check('weapon spark budgets and scene cleanup', () => {
  for (const quality of ['low', 'medium', 'high']) for (const reducedMotion of [false, true]) {
    budget = getGraphicsBudget({ quality, reducedMotion });
    const harness = createScene();
    new CombatSystem(harness.scene, () => []).slashEffect(500, 300, { x: 1, y: 0 }, 3, { weaponType: 'axe', range: 92 });
    assert.equal(harness.objects.length, 1 + budget.combatSparks);
    assert.equal(harness.timers.size, harness.objects.length);
    if (reducedMotion) assert.equal(harness.tweens.size, 0);
    for (const tween of harness.tweens) assert.ok(!('scale' in tween));
    harness.events.emit('shutdown');
    assert.ok(harness.objects.every(object => object.destroyed));
    assert.equal(harness.timers.size, 0); assert.equal(harness.tweens.size, 0);
    assert.equal(harness.events.listenerCount('shutdown'), 0);
  }
});
if (failures.length) process.exitCode = 1;
else console.log('Combat VFX VM self-check passed; browser/device/art approval not covered.');
