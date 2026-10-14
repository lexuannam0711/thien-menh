#!/usr/bin/env node
/**
 * scripts/check-combat-multiplayer.cjs
 *
 * Deterministic Test Suite for Authoritative Combat Intent Wiring & Offline Fallback:
 *
 * Test 1: Offline Mode (multiplayer.isConnected = false)
 *   - basic() and skill() deal direct damage to enemies and boss as normal.
 *   - Visual slash and skill effects trigger properly (client-side feedback).
 *
 * Test 2: Online Mode (multiplayer.isConnected = true)
 *   - basic() and skill() dispatch attack and cast_skill intents to multiplayer adapter.
 *   - Visual effects and cues still trigger (client-side prediction).
 *   - Enemies and boss receive NO direct damage on client (authoritative server domain).
 *   - Dispatched intents contain valid parameters and ZERO forbidden fields (damage, gold, hp, etc.).
 *
 * Test 3: Fail-Safe Handling
 *   - When multiplayer is undefined/null -> gracefully falls back to offline combat without crashing.
 *   - When multiplayer.sendAttack/sendCastSkill throws an unhandled error -> caught and falls back to offline.
 *   - When multiplayer has malformed methods -> no crash, safe offline fallback.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

console.log('================================================================');
console.log('THẦN MỆNH: COMBAT SYSTEM MULTIPLAYER & OFFLINE QA TEST SUITE');
console.log('================================================================\n');

const root = process.cwd();

// Helper to compile and run TypeScript module in CommonJS sandbox
function loadTs(filename, dependencies = {}) {
  const code = fs.readFileSync(path.resolve(root, filename), 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;

  const result = { exports: {} };
  const customRequire = (id) => {
    if (dependencies[id]) return dependencies[id];
    for (const key of Object.keys(dependencies)) {
      if (id.endsWith(key) || key.endsWith(id)) return dependencies[key];
    }
    return {};
  };

  vm.runInNewContext(transpiled, {
    exports: result.exports,
    module: result,
    require: customRequire,
    console,
    Math,
    Date,
    Object,
    Array,
    Set,
    Map,
  });

  return result.exports;
}

// Mock Scene Factory
function createMockScene() {
  const objects = [];
  const events = new EventEmitter();
  events.setMaxListeners(0);

  function createMockGraphics() {
    const obj = {
      calls: [],
      x: 0,
      y: 0,
      destroyed: false,
      destroy() { this.destroyed = true; },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setDepth() { return this; },
      setRotation() { return this; },
      lineStyle() { return this; },
      fillStyle() { return this; },
      beginPath() { return this; },
      arc() { return this; },
      strokePath() { return this; },
      fillPath() { return this; },
      closePath() { return this; },
      moveTo() { return this; },
      lineTo() { return this; },
      lineBetween() { return this; },
      fillTriangle() { return this; },
      strokeCircle() { return this; },
      fillCircle() { return this; },
      strokeRect() { return this; },
      fillRect() { return this; },
    };
    objects.push(obj);
    return obj;
  }

  const scene = {
    events,
    add: {
      graphics: () => createMockGraphics(),
      rectangle: () => createMockGraphics(),
    },
    tweens: {
      add: (cfg) => cfg,
      killTweensOf: () => {},
    },
    time: {
      delayedCall: (delay, cb) => ({ remove: () => {} }),
    },
    cameras: {
      main: {
        shake: () => {},
      },
    },
  };

  return { scene, objects };
}

// Forbidden fields from network contract
const FORBIDDEN_FIELDS = [
  'damage',
  'amount',
  'kill',
  'hp',
  'heal',
  'score',
  'gold',
  'level',
  'exp',
  'stats',
  'isDead',
  'godMode',
  'authority',
  'serverTick',
  'grantGold',
  'grantXp',
  'grantItem',
];

// Load dependencies
const skillsModule = loadTs('src/data/skills.ts');
const weaponsModule = loadTs('src/data/weapons.ts', {
  './items': loadTs('src/data/items.ts'),
});
const skillCombatModule = loadTs('src/game/systems/SkillCombat.ts');

const stateData = {
  attack: 25,
  level: 10,
  rpg: { equipment: { slots: { weapon: 'lac-sword' } } },
};

let audioCuesPlayed = [];
const mockAudioManager = {
  audioManager: {
    playCue: (cue, opts) => {
      audioCuesPlayed.push({ cue, opts });
    },
  },
};

const mockGraphicsSettings = {
  graphicsSettings: {
    getBudget: () => ({ cameraShake: true, combatSparks: 4 }),
  },
};

const mockGameState = {
  gameState: {
    data: stateData,
  },
};

// CommonJS dependencies for CombatSystem
const combatDependencies = {
  './GameState': mockGameState,
  '../../data/weapons': weaponsModule,
  './SkillCombat': skillCombatModule,
  '../audio/AudioManager': mockAudioManager,
  '../rendering/GraphicsSettings': mockGraphicsSettings,
};

const { CombatSystem } = loadTs('src/game/systems/CombatSystem.ts', combatDependencies);

assert.ok(CombatSystem, 'CombatSystem must be exported');

// Mock player definition
const player = {
  x: 500,
  y: 300,
  direction: { x: 1, y: 0, length: () => 1 },
};

// Mock directional skill
const testSkill = {
  id: 'mountain-cleave',
  name: 'Sơn Hà Đoạn',
  element: 'earth',
  targetType: 'directional',
  effect: { range: 120, knockback: 20, statusEffect: 'stun', statusDurationMs: 1000 },
};

// ============================================================================
// TEST 1: OFFLINE COMBAT (multiplayer.isConnected = false)
// ============================================================================
console.log('--- Test 1: Offline Combat Mode (Direct Damage) ---');

let enemyHits = 0;
let enemyStatusApplied = null;
const offlineEnemy = {
  x: 530,
  y: 300,
  radius: 16,
  isAlive: true,
  damage(amount, kx, ky) {
    enemyHits += amount;
  },
  applyStatus(status, duration, dmg) {
    enemyStatusApplied = { status, duration, dmg };
  },
};

let bossHits = 0;
const offlineBoss = {
  x: 540,
  y: 300,
  radius: 24,
  isAlive: true,
};
const offlineBossSystem = {
  boss: offlineBoss,
  damageBoss(amount, kx, ky) {
    bossHits += amount;
  },
};

const offlineAdapter = {
  isConnected: false,
  sendAttack: () => { throw new Error('Offline mode must NOT dispatch online attack intent'); },
  sendCastSkill: () => { throw new Error('Offline mode must NOT dispatch online skill intent'); },
};

const { scene: offlineScene, objects: offlineObjects } = createMockScene();
const offlineCombat = new CombatSystem(
  offlineScene,
  () => [offlineEnemy],
  offlineBossSystem,
  offlineAdapter
);

// 1.1 basic() offline
audioCuesPlayed = [];
offlineCombat.basic(player, 1, { x: 1, y: 0 });

assert.ok(enemyHits > 0, `Enemy must receive direct damage in offline mode (got ${enemyHits})`);
assert.ok(bossHits > 0, `Boss must receive direct damage in offline mode (got ${bossHits})`);
assert.ok(offlineObjects.length > 0, 'Visual slash effect must be created in offline mode');
assert.ok(audioCuesPlayed.some(c => c.cue === 'sword_slash'), 'Audio sword_slash must play in offline mode');
console.log(`  -> [PASS] basic() dealt offline damage to enemy (${enemyHits}) and boss (${bossHits}) with visual effects.`);

// 1.2 skill() offline
enemyHits = 0;
bossHits = 0;
enemyStatusApplied = null;
audioCuesPlayed = [];
offlineCombat.skill(player, testSkill, 60, { x: 1, y: 0 });

assert.equal(enemyHits, 60, `Enemy must receive 60 skill damage offline (got ${enemyHits})`);
assert.equal(bossHits, 60, `Boss must receive 60 skill damage offline (got ${bossHits})`);
assert.ok(enemyStatusApplied, 'Enemy status effect must be applied in offline mode');
assert.equal(enemyStatusApplied.status, 'stun');
assert.ok(audioCuesPlayed.some(c => c.cue === 'skill_earth'), 'Audio skill cue must play in offline mode');
console.log('  -> [PASS] skill() dealt offline damage and applied status effect with visual cues.');


// ============================================================================
// TEST 2: ONLINE COMBAT (multiplayer.isConnected = true, Authoritative Intent)
// ============================================================================
console.log('\n--- Test 2: Online Authoritative Intent Dispatch (No Direct Damage) ---');

let onlineEnemyHits = 0;
const onlineEnemy = {
  x: 530,
  y: 300,
  radius: 16,
  isAlive: true,
  damage(amount) {
    onlineEnemyHits += amount;
  },
  applyStatus() {
    onlineEnemyHits += 1;
  },
};

let onlineBossHits = 0;
const onlineBoss = {
  x: 540,
  y: 300,
  radius: 24,
  isAlive: true,
};
const onlineBossSystem = {
  boss: onlineBoss,
  damageBoss(amount) {
    onlineBossHits += amount;
  },
};

const capturedIntents = [];
const onlineAdapter = {
  isConnected: true,
  sendAttack(combo, dirX, dirY) {
    const payload = { type: 'attack', combo, dirX, dirY };
    capturedIntents.push(payload);
    return true;
  },
  sendCastSkill(skillId, dirX, dirY) {
    const payload = { type: 'cast_skill', skillId, dirX, dirY };
    capturedIntents.push(payload);
    return true;
  },
};

const { scene: onlineScene, objects: onlineObjects } = createMockScene();
const onlineCombat = new CombatSystem(
  onlineScene,
  () => [onlineEnemy],
  onlineBossSystem,
  onlineAdapter
);

// 2.1 basic() online
audioCuesPlayed = [];
onlineCombat.basic(player, 2, { x: 1, y: 0 });

// CRITICAL ASSERTION: Client MUST NOT deal direct damage in online authoritative combat
assert.equal(onlineEnemyHits, 0, 'Enemy must NOT take direct client damage in authoritative online mode');
assert.equal(onlineBossHits, 0, 'Boss must NOT take direct client damage in authoritative online mode');

// CRITICAL ASSERTION: Visual feedback must still trigger for responsive gameplay
assert.ok(onlineObjects.length > 0, 'Visual slash effect must still render online (client prediction)');
assert.ok(audioCuesPlayed.some(c => c.cue === 'sword_slash'), 'Audio sword_slash must play online');

// CRITICAL ASSERTION: Intent was dispatched correctly
assert.equal(capturedIntents.length, 1, 'Exactly 1 attack intent must be dispatched');
const attackIntent = capturedIntents[0];
assert.equal(attackIntent.type, 'attack');
assert.equal(attackIntent.combo, 2);
assert.equal(attackIntent.dirX, 1);
assert.equal(attackIntent.dirY, 0);

// CRITICAL ASSERTION: ZERO forbidden fields (damage, hp, gold, etc.)
for (const forbidden of FORBIDDEN_FIELDS) {
  assert.equal(forbidden in attackIntent, false, `Attack intent MUST NOT contain forbidden field "${forbidden}"`);
}
console.log('  -> [PASS] basic() dispatched valid attack intent online without dealing local damage or sending forbidden fields.');

// 2.2 skill() online
onlineEnemyHits = 0;
onlineBossHits = 0;
audioCuesPlayed = [];
onlineCombat.skill(player, testSkill, 80, { x: 0, y: 1 });

assert.equal(onlineEnemyHits, 0, 'Enemy must NOT take direct skill damage in authoritative online mode');
assert.equal(onlineBossHits, 0, 'Boss must NOT take direct skill damage in authoritative online mode');
assert.ok(audioCuesPlayed.some(c => c.cue === 'skill_earth'), 'Audio skill cue must play online');

assert.equal(capturedIntents.length, 2, 'Exactly 2 intents must be dispatched in total');
const skillIntent = capturedIntents[1];
assert.equal(skillIntent.type, 'cast_skill');
assert.equal(skillIntent.skillId, 'mountain-cleave');
assert.equal(skillIntent.dirX, 0);
assert.equal(skillIntent.dirY, 1);

for (const forbidden of FORBIDDEN_FIELDS) {
  assert.equal(forbidden in skillIntent, false, `Skill intent MUST NOT contain forbidden field "${forbidden}"`);
}
console.log('  -> [PASS] skill() dispatched valid cast_skill intent online without dealing local damage or sending forbidden fields.');


// ============================================================================
// TEST 3: FAIL-SAFE RECOVERY (No Crashes, Safe Offline Fallback)
// ============================================================================
console.log('\n--- Test 3: Fail-Safe Handling & Error Resilience ---');

// 3.1 Undefined adapter fallback
let failSafeHits = 0;
const dummyEnemy = {
  x: 520,
  y: 300,
  radius: 16,
  isAlive: true,
  damage(amount) { failSafeHits += amount; },
  applyStatus() {},
};
const { scene: fsScene1 } = createMockScene();
const undefinedCombat = new CombatSystem(fsScene1, () => [dummyEnemy], undefined, undefined);

assert.doesNotThrow(() => {
  undefinedCombat.basic(player, 1, { x: 1, y: 0 });
}, 'CombatSystem.basic must not crash when adapter is undefined');
assert.ok(failSafeHits > 0, 'Must fall back to offline combat when adapter is undefined');
console.log('  -> [PASS] Handled undefined adapter gracefully with offline fallback.');

// 3.2 Throwing adapter fallback (socket error / network exception)
failSafeHits = 0;
const throwingAdapter = {
  isConnected: true,
  sendAttack: () => { throw new Error('Colyseus WebSocket connection lost abruptly'); },
  sendCastSkill: () => { throw new Error('Intent encoding failed'); },
};
const { scene: fsScene2 } = createMockScene();
const errorCombat = new CombatSystem(fsScene2, () => [dummyEnemy], undefined, throwingAdapter);

assert.doesNotThrow(() => {
  errorCombat.basic(player, 1, { x: 1, y: 0 });
}, 'CombatSystem.basic must not crash when sendAttack throws an unhandled error');
assert.ok(failSafeHits > 0, 'Must fall back to offline combat when sendAttack throws');

failSafeHits = 0;
assert.doesNotThrow(() => {
  errorCombat.skill(player, testSkill, 35, { x: 1, y: 0 });
}, 'CombatSystem.skill must not crash when sendCastSkill throws an unhandled error');
assert.equal(failSafeHits, 35, 'Must fall back to offline combat when sendCastSkill throws');
console.log('  -> [PASS] Caught throwing adapter errors and safely recovered to offline combat.');

// 3.3 Adapter missing sendAttack / sendCastSkill methods
failSafeHits = 0;
const incompleteAdapter = { isConnected: true };
const { scene: fsScene3 } = createMockScene();
const incompleteCombat = new CombatSystem(fsScene3, () => [dummyEnemy], undefined, incompleteAdapter);

assert.doesNotThrow(() => {
  incompleteCombat.basic(player, 1, { x: 1, y: 0 });
}, 'CombatSystem.basic must not crash when adapter lacks sendAttack');
assert.ok(failSafeHits > 0, 'Must fall back to offline combat when adapter lacks sendAttack');
console.log('  -> [PASS] Handled incomplete adapter without crashing.');


// ============================================================================
// TEST SUMMARY
// ============================================================================
console.log('\n================================================================');
console.log('ALL COMBAT MULTIPLAYER TESTS PASSED (0 FAILURES)');
console.log('================================================================');
process.exit(0);
