const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const result = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports: result.exports, require: name => dependencies[name] ?? {}, ...globals });
  return result.exports;
}
class Vector {
  constructor(x, y) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  clone() { return new Vector(this.x, this.y); }
}
function harness({ sprite = true, quality = 'medium', reducedMotion = false, osReduced = false, slots = {} } = {}) {
  const objects = [], events = new EventEmitter(), timers = [], tweens = [], saves = [];
  const missingTextures = new Set(), missingFrames = new Set(), missingAnimations = new Set();
  const shape = kind => {
    const result = Object.assign(new EventEmitter(), { kind, x: 0, y: 0, depth: 0, calls: [], destroyed: false,
      anims: { isPlaying: false }, texture: { key: 'hero_sprite' }, frame: { name: 0, cutWidth: 48, cutHeight: 48 },
      originX: 0.5, originY: 0.5, flipX: false, flipY: false, alpha: 1, scaleX: 1, scaleY: 1, rotation: 0, visible: true, list: [],
      destroy() { if (this.destroyed) return; this.destroyed = true; this.emit('destroy'); for (const child of this.list) child.destroy(); },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setTexture(key, frame = 0) { this.texture = { key }; this.frame = { name: frame, cutWidth: 48, cutHeight: 48 }; return this; },
      setFrame(frame) { this.frame = { name: frame, cutWidth: 48, cutHeight: 48 }; return this; },
      setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
      setFlip(x, y) { this.flipX = x; this.flipY = y; return this; },
      setFlipX(value) { this.flipX = value; return this; },
      setAlpha(value) { this.alpha = value; return this; },
      setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; },
      setRotation(value) { this.rotation = value; return this; },
      setVisible(value) { this.visible = value; return this; },
      add(child) { this.list.push(child); child.parentContainer = this; return this; },
      moveAbove(child, sibling) { this.list = this.list.filter(value => value !== child); this.list.splice(this.list.indexOf(sibling) + 1, 0, child); return this; },
      setDepth(depth) { this.depth = depth; return this; } });
    for (const method of ['lineStyle', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'strokePath',
      'strokeCircle', 'play']) {
      result[method] = (...values) => { result.calls.push([method, ...values]); return result; };
    }
    objects.push(result);
    return result;
  };
  const scene = { events, anims: { exists: key => !missingAnimations.has(key) }, textures: { exists: key => sprite && !missingTextures.has(key),
    get: key => ({ has: frame => !missingFrames.has(key + ':' + frame), get: () => ({ cutWidth: 48, cutHeight: 48 }) }) }, input: {}, time: { now: 1000,
    delayedCall(...args) { timers.push(args); } },
    tweens: { add(value) { tweens.push(value); } }, cameras: { main: { shake() {} } },
    add: Object.fromEntries(['graphics', 'ellipse', 'sprite', 'container'].map(kind => [kind,
      (x = 0, y = 0, texture, frame) => {
        const object = shape(kind).setPosition(x, y);
        if (kind === 'sprite') object.setTexture(texture, frame);
        if (kind === 'container') for (const child of texture ?? []) object.add(child);
        return object;
      }])) };
  const { GraphicsSettings } = load('src/game/rendering/GraphicsSettings.ts', {}, {
    matchMedia: () => ({ matches: osReduced }),
  });
  const settings = new GraphicsSettings(null);
  settings.setQuality(quality); settings.setReducedMotion(reducedMotion);
  const gameState = { data: { hp: 100, mp: 50, level: 1, attack: 20, gold: 0,
    rpg: { skills: {}, equipment: { slots } } }, save() { saves.push(true); } };
  const stats = { maxHp: 100, maxMp: 100, speed: 120 };
  let effect = {}, locked = false, casts = 0, deaths = 0;
  const { Player } = load('src/game/entities/Player.ts', {
    phaser: { default: { Math: { Vector2: Vector }, Input: { Keyboard: { JustDown: () => false } } } },
    '../../data/config': { BALANCE: { dodgeCooldownMs: 900, dodgeDurationMs: 180 }, W: 960, H: 540 },
    '../ui/art': { actor: (scene, x, y) => shape('actor').setPosition(x, y), label: () => shape('label'), floatText() {} },
    '../systems/GameState': { gameState, getPlayerStats: () => stats },
    '../ui/TouchControls': { TouchControls: class { direction = { x: 0, y: 0 }; } },
    '../assets/assetLoader': { SPRITE_KEYS: { hero: 'hero_sprite', hero_axe: 'hero_axe_sprite', hero_sword: 'hero_sword_sprite' } },
    '../assets/equipmentArtwork': fs.existsSync('src/game/assets/equipmentArtwork.ts') ? load('src/game/assets/equipmentArtwork.ts', {
      './spriteManifest': load('src/game/assets/spriteManifest.ts'),
    }) : {},
    '../assets/spriteManifest': { ...load('src/game/assets/spriteManifest.ts'), canPlayLocomotion: () => true },
    '../rendering/GraphicsSettings': { graphicsSettings: settings },
    '../world/WorldBounds': { moveInWorld: (position, next) => next },
    '../systems/SkillCombat': { castEquippedSkill: (progress, caster) => ({ success: true, caster,
      progress, skill: { effect, element: 'earth', vietnameseName: 'Test' }, damageDealt: 0 }) },
    '../audio/AudioManager': { audioManager: { playCue() {} } },
    '../../data/weapons': { getEquippedWeaponOrDefault: id => ({ weaponType: id === 'axe' ? 'axe' : id === 'sword' ? 'sword' : 'spear' }), calculateWeaponAttackTiming: () => 200 },
  });
  const player = new Player(scene, 200, 300, { basic() {}, interact() {},
    skill() { casts++; }, dead() { deaths++; } }, () => locked);
  return { player, scene, events, timers, tweens, saves, gameState, stats,
    objects, missingTextures, missingFrames, missingAnimations,
    overlays: () => objects.filter(value => value.kind === 'sprite' && value !== player.sprite && value.visible && !value.destroyed),
    equip(slots) { gameState.data = { ...gameState.data, rpg: { ...gameState.data.rpg, equipment: { slots: { ...slots } } } }; },
    active: () => objects.filter(value => value.kind === 'graphics' && !value.destroyed),
    cast(statusEffect, duration = 1000) { effect = { statusEffect, statusDurationMs: duration }; player.useSkill('slot-1'); },
    heal() { effect = { healHp: 45, durationMs: 5000 }; player.useSkill('slot-3'); },
    lock(value) { locked = value; }, counts: () => ({ casts, deaths }) };
}
const failures = [];
function check(name, run) {
  try { run(); console.log('PASS ' + name); }
  catch (error) { failures.push(name); console.error('FAIL ' + name + ': ' + error.message); }
}
check('cast/countdown/exact expiry/position/recast/distinct geometry', () => {
  const test = harness(); assert.equal(test.active().length, 0);
  test.cast('shield'); assert.equal(test.active().length, 1, 'shield cast must create persistent cue');
  const shield = test.active()[0];
  test.cast('shield', 800); assert.equal(test.active()[0], shield); assert.equal(test.active().length, 1);
  test.cast('invulnerable', 400); assert.equal(test.active().length, 2);
  const ring = test.active()[1];
  const geometry = cue => JSON.stringify(cue.calls.filter(call => call[0] !== 'lineStyle'));
  assert.notEqual(geometry(shield), geometry(ring), 'meaning must not depend on color');
  test.player.controls.direction.x = 1; test.player.update(399);
  assert.equal(test.player.x, 200 + 120 * 0.399);
  for (const cue of test.active()) assert.deepEqual([cue.x, cue.y], [test.player.x, test.player.y]);
  assert.equal(test.player.skillInvulnerabilityMs, 1); assert.equal(test.player.shieldRemainingMs, 401);
  test.player.update(1); assert.ok(ring.destroyed); assert.equal(test.active().length, 1);
  test.player.update(399); assert.equal(test.active().length, 1);
  test.player.update(1); assert.equal(test.active().length, 0);
  test.cast('shield', 0); test.cast('invulnerable', 0); assert.equal(test.active().length, 0);
  test.heal(); assert.equal(test.active().length, 0, 'instant heal has no persistent status');
});
check('locked/paused timers retain authority; dodge creates no skill cue', () => {
  const test = harness(); test.cast('shield'); test.cast('invulnerable');
  test.lock(true); test.scene.time.now += 5000; test.player.update(5000);
  assert.equal(test.player.shieldRemainingMs, 1000); assert.equal(test.player.skillInvulnerabilityMs, 1000);
  assert.equal(test.active().length, 2);
  test.player.useSkill('slot-1'); assert.equal(test.counts().casts, 2);
  test.lock(false); test.player.update(1000); assert.equal(test.active().length, 0);
  test.player.dodge(); assert.equal(test.active().length, 0);
});
check('canonical stone armor lasts exactly 6s; dash/heal do not invent buffs', () => {
  const { SKILLS } = load('src/data/skills.ts');
  assert.ok(!SKILLS.some(skill => skill.effect?.statusEffect === 'invulnerable'));
  const armor = SKILLS.find(skill => skill.id === 'stone-armor');
  const dash = SKILLS.find(skill => skill.id === 'blazing-dash');
  const test = harness();
  test.cast(armor.effect.statusEffect, armor.effect.statusDurationMs);
  assert.equal(test.player.shieldRemainingMs, 6000); assert.equal(test.active().length, 1);
  test.player.update(5999); assert.equal(test.active().length, 1);
  test.player.update(1); assert.equal(test.active().length, 0);
  test.cast(dash.effect.statusEffect, dash.effect.statusDurationMs);
  assert.equal(test.active().length, 0); assert.equal(test.player.skillInvulnerabilityMs, 0);
  test.heal(); assert.equal(test.active().length, 0);
  test.cast('shield'); const cue = test.active()[0];
  test.player.view.setPosition(320, 420); test.lock(true); test.player.update(1000);
  assert.deepEqual([cue.x, cue.y], [320, 420]);
  assert.equal(test.player.shieldRemainingMs, 1000);
});
check('presentation helpers below 50 lines; no gameplay/clock/settings dependencies', () => {
  const source = ts.createSourceFile('Player.ts', fs.readFileSync('src/game/entities/Player.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const helper = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'PlayerStatusPresentation');
  assert.ok(helper);
  for (const member of helper.members.filter(member => member.body || member.initializer)) {
    const first = source.getLineAndCharacterOfPosition(member.getStart(source)).line;
    const last = source.getLineAndCharacterOfPosition(member.end).line;
    assert.ok(last - first + 1 < 50, member.name?.getText(source));
  }
  assert.ok(!/gameState|Date|time\.|tweens|graphicsSettings|setAlpha|setScale/.test(helper.getText(source)));
});
check('hit/canBeHit/stats/movement/save invariance', () => {
  const test = harness(); const initialStats = JSON.stringify(test.stats);
  test.cast('shield'); test.player.hit(21); assert.equal(test.gameState.data.hp, 89);
  assert.equal(test.player.shieldRemainingMs, 1000); assert.equal(test.player.canBeHit, false);
  test.scene.time.now += 550; assert.equal(test.player.canBeHit, true);
  test.cast('invulnerable'); test.player.hit(80); assert.equal(test.gameState.data.hp, 89);
  test.player.controls.direction.y = 1; test.player.update(1000);
  assert.equal(test.player.y, 420); assert.equal(test.player.x, 200);
  assert.equal(test.gameState.data.mp, 57.5); assert.equal(test.player.canBeHit, true);
  assert.equal(JSON.stringify(test.stats), initialStats); assert.equal(test.saves.length, 2);
});
check('death/shutdown/container destroy remove graphics/listeners', () => {
  for (const sprite of [true, false]) {
    const test = harness({ sprite }); test.cast('shield');
    const cue = test.active()[0]; assert.ok(cue);
    test.player.hit(1000); assert.equal(test.active().length, 0); assert.ok(cue.destroyed);
    assert.equal(test.counts().deaths, 1);
    test.events.emit('shutdown'); assert.equal(test.events.listenerCount('shutdown'), 0);
  }
  for (const ending of ['shutdown', 'destroy']) {
    const test = harness(); test.cast('shield'); test.cast('invulnerable');
    ending === 'shutdown' ? test.events.emit('shutdown') : test.player.view.destroy();
    assert.equal(test.active().length, 0); assert.equal(test.events.listenerCount('shutdown'), 0);
    assert.equal(test.player.view.listenerCount('destroy'), 0);
    test.cast('shield'); test.player.update(100); assert.equal(test.active().length, 0);
  }
});
check('buffered attack clears while scene clock is paused, on skills and actor cleanup', () => {
  const test = harness();
  test.player.attackBufferedUntil = 150;
  test.lock(true); test.events.emit('preupdate');
  assert.equal(test.player.attackBufferedUntil, 0, 'Pause clears buffer even when scene skips Player.update');
  test.lock(false); test.player.attackBufferedUntil = 150;
  test.cast('shield');
  assert.equal(test.player.attackBufferedUntil, 0, 'Successful skill cancels queued basic attack');
  test.player.attackBufferedUntil = 150;
  test.player.attackAt = 1200;
  test.player.dodge();
  assert.equal(test.player.attackBufferedUntil, 0, 'Dodge cancels queued basic attack');
  assert.equal(test.player.attackAt, 0, 'Dodge resets attack timer');
  const castsBefore = test.counts().casts;
  test.cast('shield');
  assert.equal(test.counts().casts, castsBefore, 'Cannot cast skill while dodging');
  test.scene.time.now += 1000;
  test.player.attackBufferedUntil = 150;
  test.player.hit(10);
  assert.equal(test.player.attackBufferedUntil, 0, 'Damage cancels queued basic attack');
  test.player.attackBufferedUntil = 150;
  test.player.view.destroy();
  assert.equal(test.player.attackBufferedUntil, 0);
  assert.equal(test.events.listenerCount('preupdate'), 0);
  assert.equal(test.events.listenerCount('shutdown'), 0);
});
check('low/app/OS reduced motion static; no status tweens/timers/listener accumulation', () => {
  for (const mode of [{ quality: 'low' }, { reducedMotion: true }, { osReduced: true }, {}]) {
    const test = harness(mode);
    const shutdownListeners = test.events.listenerCount('shutdown');
    assert.equal(test.events.listenerCount('preupdate'), 1);
    for (let index = 0; index < 20; index++) { test.cast('shield'); test.cast('invulnerable'); }
    assert.equal(test.active().length, 2);
    const geometry = test.active().map(cue => JSON.stringify(cue.calls));
    for (let index = 0; index < 10; index++) test.player.update(10);
    assert.deepEqual(test.active().map(cue => JSON.stringify(cue.calls)), geometry);
    assert.equal(test.tweens.length, 0); assert.equal(test.timers.length, 0);
    assert.equal(test.events.listenerCount('shutdown'), shutdownListeners);
    test.events.emit('shutdown'); assert.equal(test.events.listenerCount('shutdown'), 0);
  }
});
for (const unavailable of ['animation', 'frame', 'texture']) {
  check('real playPose falls back from missing variant ' + unavailable, () => {
    const { animationFrames } = load('src/game/assets/spriteManifest.ts');
    for (const weapon of ['axe', 'sword']) {
      for (const [direction, horizontal, vertical] of [['down', 0, 1], ['left', -1, 0], ['right', 1, 0], ['up', 0, -1]]) {
        const test = harness({ slots: { weapon, armor: 'bamboo-armor', accessory: 'jade-charm' } });
        test.player.direction.set(horizontal, vertical);
        const variant = 'hero_' + weapon, key = variant + '_attack1_' + direction;
        const frame = animationFrames(variant, 'attack1', direction).at(-1);
        const before = JSON.stringify(test.gameState.data), stats = JSON.stringify(test.stats);
        test.player.playPose('attack1', 200);
        assert.equal(test.player.sprite.texture.key, variant + '_sprite');
        assert.equal(test.player.sprite.calls.at(-1)[1], key);
        if (unavailable === 'animation') test.missingAnimations.add(key);
        if (unavailable === 'frame') test.missingFrames.add(variant + '_sprite:' + frame);
        if (unavailable === 'texture') test.missingTextures.add(variant + '_sprite');
        test.player.playPose('attack1', 200);
        assert.equal(test.player.sprite.texture.key, 'hero_sprite');
        assert.equal(test.player.sprite.calls.at(-1)[1], 'hero_attack1_' + direction);
        assert.deepEqual(test.overlays().map(overlay => overlay.texture.key), ['equipment_bamboo-armor_hero', 'equipment_jade-charm_hero']);
        assert.equal(JSON.stringify(test.gameState.data), before); assert.equal(JSON.stringify(test.stats), stats);
        assert.equal(test.saves.length + test.timers.length + test.tweens.length, 0);
      }
    }
  });
}
check('real playPose omits unavailable variant and base without presentation writes', () => {
  const { animationFrames } = load('src/game/assets/spriteManifest.ts');
  for (const unavailable of ['animation', 'frame', 'texture']) {
    const test = harness({ slots: { weapon: 'axe' } });
    test.player.direction.set(0, 1);
    for (const variant of ['hero_axe', 'hero']) {
      if (unavailable === 'animation') test.missingAnimations.add(variant + '_attack1_down');
      if (unavailable === 'frame') test.missingFrames.add(variant + '_sprite:' + animationFrames(variant, 'attack1', 'down').at(-1));
      if (unavailable === 'texture') test.missingTextures.add(variant + '_sprite');
    }
    const before = test.player.sprite.calls.length, texture = test.player.sprite.texture.key;
    const state = test.player.visualState, timeScale = test.player.sprite.anims.timeScale;
    test.player.playPose('attack1', 200);
    assert.equal(test.player.sprite.calls.length, before);
    assert.equal(test.player.sprite.texture.key, texture);
    assert.equal(test.player.visualState, state); assert.equal(test.player.sprite.anims.timeScale, timeScale);
  }
});
check('equipment exact frame/weapon binding, transforms, ordering and immutable save', () => {
  for (const [weapon, variant] of [['spear', 'hero'], ['axe', 'hero_axe'], ['sword', 'hero_sword']]) {
    const test = harness({ slots: { weapon, armor: 'bamboo-armor', accessory: 'jade-charm' } });
    test.player.update(0); test.lock(true);
    const hero = test.player.sprite;
    hero.setFrame(271).setPosition(9, -13).setOrigin(0.2, 0.8).setFlip(true, true).setAlpha(0.4).setScale(2, 3).setRotation(0.7).setDepth(4);
    test.player.view.setPosition(450, 250).setScale(0.7, 1.2).setAlpha(0.5).setRotation(0.2);
    const before = JSON.stringify(test.gameState.data), stats = JSON.stringify(test.stats);
    test.player.update(1000);
    assert.equal(test.overlays().length, 2);
    for (const [index, overlay] of test.overlays().entries()) {
      assert.equal(overlay.texture.key, 'equipment_' + (index ? 'jade-charm' : 'bamboo-armor') + '_' + variant);
      assert.equal(overlay.frame.name, 271);
      for (const field of ['x', 'y', 'originX', 'originY', 'flipX', 'flipY', 'alpha', 'scaleX', 'scaleY', 'rotation']) assert.equal(overlay[field], hero[field], field);
      assert.equal(overlay.parentContainer, test.player.view);
      assert.ok(overlay.depth > hero.depth);
    }
    const [armor, charm] = test.overlays();
    assert.ok(armor.depth < charm.depth);
    assert.equal(test.player.view.list.indexOf(armor), test.player.view.list.indexOf(hero) + 1);
    assert.equal(test.player.view.list.indexOf(charm), test.player.view.list.indexOf(armor) + 1);
    assert.equal(JSON.stringify(test.gameState.data), before); assert.equal(JSON.stringify(test.stats), stats); assert.equal(test.saves.length, 0);
    const created = test.objects.length;
    for (let index = 0; index < 40; index++) test.player.update(10);
    assert.equal(test.objects.length, created); assert.equal(test.timers.length, 0); assert.equal(test.tweens.length, 0);
    assert.equal(armor.calls.filter(call => call[0] === 'play').length, 0);
    test.equip({}); test.player.update(0); assert.equal(test.overlays().length, 0);
    test.equip({ weapon, armor: 'bamboo-armor', accessory: 'jade-charm' }); test.player.update(0);
    assert.equal(test.overlays()[0], armor); assert.equal(test.overlays()[1], charm);
    test.lock(false); test.cast('shield'); test.cast('shield'); assert.equal(test.overlays()[0], armor);
    test.lock(true);
    for (let frame = 0; frame < 272; frame++) {
      hero.setFrame(frame); test.player.update(0);
      assert.equal(armor.frame.name, frame); assert.equal(charm.frame.name, frame);
    }
    hero.setVisible(false); test.player.update(0); assert.equal(test.overlays().length, 0);
    hero.setVisible(true); test.player.update(0); assert.equal(test.overlays()[0], armor);
  }
});
check('equipment unknown/wrong slots, missing textures/frames, fallback and weapon changes', () => {
  const test = harness(); test.lock(true);
  for (const slots of [{ armor: 'jade-charm', accessory: 'bamboo-armor' }, { armor: 'prototype', accessory: 'unknown' }]) {
    test.equip(slots); test.player.update(0); assert.equal(test.overlays().length, 0);
  }
  test.equip({ armor: 'bamboo-armor', accessory: 'jade-charm' }); test.player.update(0);
  const [armor, charm] = test.overlays(); assert.ok(armor && charm);
  test.missingTextures.add(armor.texture.key); test.player.update(0); assert.deepEqual(test.overlays(), [charm]);
  test.missingTextures.clear(); test.missingFrames.add(charm.texture.key + ':0'); test.player.update(0); assert.deepEqual(test.overlays(), [armor]);
  test.missingFrames.clear(); test.player.sprite.setTexture('unknown'); test.player.update(0); assert.equal(test.overlays().length, 0);
  for (const variant of ['hero', 'hero_axe', 'hero_sword']) {
    test.player.sprite.setTexture(variant + '_sprite', 42); test.player.update(0);
    assert.equal(test.overlays()[0], armor); assert.equal(armor.texture.key, 'equipment_bamboo-armor_' + variant); assert.equal(armor.frame.name, 42);
  }
  test.missingTextures.add('hero_sword_sprite'); test.player.update(0); assert.equal(test.overlays().length, 0);
  test.missingTextures.clear(); test.missingFrames.add('hero_sword_sprite:42'); test.player.update(0); assert.equal(test.overlays().length, 0);
  test.missingFrames.clear();
  test.player.sprite.frame.cutWidth = 32; test.player.update(0); assert.equal(test.overlays().length, 0);
  const fallback = harness({ sprite: false, slots: { armor: 'bamboo-armor', accessory: 'jade-charm' } }); fallback.player.update(0); assert.equal(fallback.overlays().length, 0);
});
check('equipment death frame persists; cleanup idempotent without recreation', () => {
  for (const ending of ['shutdown', 'destroy']) {
    const test = harness({ slots: { armor: 'bamboo-armor', accessory: 'jade-charm' } });
    test.player.hit(1000); test.player.sprite.setFrame(260); test.player.update(10);
    assert.equal(test.overlays().length, 2); assert.equal(test.overlays()[0].frame.name, 260);
    const overlays = test.overlays();
    ending === 'shutdown' ? test.events.emit('shutdown') : test.player.view.destroy();
    test.events.emit('shutdown'); test.player.view.destroy(); test.player.update(10);
    assert.equal(test.overlays().length, 0); assert.ok(overlays.every(value => value.destroyed));
    assert.equal(test.events.listenerCount('shutdown'), 0); assert.equal(test.player.view.listenerCount('destroy'), 0);
  }
});
check('equipment world loader queues six aligned sheets idempotently', () => {
  const manifest = load('src/game/assets/spriteManifest.ts'), queued = new Set(), calls = [];
  const dependencies = { './spriteManifest': manifest,
    './enemyArtwork': { loadEnemyArtwork() {} }, './environmentArtwork': { loadEnvironmentArtwork() {} },
    '../rendering/ScenePresentation': { presentScenePreload() {} },
    './equipmentArtwork': fs.existsSync('src/game/assets/equipmentArtwork.ts') ? load('src/game/assets/equipmentArtwork.ts', { './spriteManifest': manifest }) : {},
  };
  const { loadGameAssets } = load('src/game/assets/assetLoader.ts', dependencies);
  const scene = { textures: { exists: () => false }, load: {
    list: { exists: value => queued.has(value.key) }, inflight: { exists: value => queued.has(value.key) },
    spritesheet(key, path, config) { if (queued.has(key)) return; calls.push({ key, path, config }); queued.add(key); },
  } };
  loadGameAssets(scene); loadGameAssets(scene);
  const equipment = calls.filter(value => value.path.includes('/equipment/'));
  assert.equal(equipment.length, 6);
  for (const call of equipment) {
    assert.deepEqual(JSON.parse(JSON.stringify(call.config)), { frameWidth: 48, frameHeight: 48, endFrame: 271 });
    assert.ok(fs.existsSync('public' + call.path));
  }
});
check('equipment helpers below 50 lines; presentation has no clocks or gameplay writes', () => {
  for (const file of ['src/game/entities/Player.ts', 'src/game/assets/equipmentArtwork.ts']) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const helper = source.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'PlayerEquipmentPresentation');
    const members = helper ? helper.members.filter(member => member.body || member.initializer)
      : source.statements.filter(node => ts.isFunctionDeclaration(node));
    for (const member of members) {
      const first = source.getLineAndCharacterOfPosition(member.getStart(source)).line;
      const last = source.getLineAndCharacterOfPosition(member.end).line;
      assert.ok(last - first + 1 < 50, member.name?.getText(source));
    }
    if (helper) assert.ok(!/gameState|Date|time\.|tweens|graphicsSettings|\.play\(|anims/.test(helper.getText(source)));
  }
});
assert.equal(failures.length, 0, failures.join(', '));
console.log('Player status presentation self-check passed.');
