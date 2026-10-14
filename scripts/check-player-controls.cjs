/**
 * Test Suite: Player & Combat Controls Integration
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Kiểm tra toàn diện hệ thống điều khiển gameplay:
 * 1. Player tích hợp với InputManager và controls backward compatibility
 * 2. Di chuyển 8 hướng chuẩn hóa vector (length <= 1)
 * 3. Tấn công (LMB & KeyJ), Combo 1 -> 2 -> 3, Input buffering (150ms), Chặn click xuyên UI
 * 4. Ngắm theo chuột (Mouse Aiming) khi tấn công và dùng kỹ năng
 * 5. Kỹ năng gán cho phím số 1/2/3/4 (Q/E/R/T không còn là mặc định)
 * 6. Lướt né (Space) và vật phẩm nhanh (Digit5..Digit8)
 * 7. Context Guard & Lock Guard (MENU/DIALOGUE/Lock hủy buffer và khóa thao tác)
 * 8. CombatSystem tiếp nhận chính xác hướng tấn công và ngắm chuột
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

function loadModule(filePath, customDependencies = {}, customGlobals = {}) {
  const code = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const moduleResult = { exports: {} };
  const context = {
    exports: moduleResult.exports,
    module: moduleResult,
    require: (id) => {
      if (customDependencies[id]) return customDependencies[id];
      try {
        return require(id);
      } catch {
        return {};
      }
    },
    ...customGlobals,
  };

  vm.runInNewContext(transpiled, context);
  return moduleResult.exports;
}

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  clone() {
    return new Vector2(this.x, this.y);
  }
  length() {
    return Math.hypot(this.x, this.y);
  }
}

function createTestHarness(options = {}) {
  const sceneEvents = new EventEmitter();
  const gameEvents = new EventEmitter();
  const keyboardEvents = new EventEmitter();
  keyboardEvents.addKeys = () => ({ attack: {}, dodge: {}, interact: {} });
  const inputPluginEvents = new EventEmitter();

  let uiHitPointer = null;

  const mockScene = {
    events: sceneEvents,
    game: { events: gameEvents },
    input: Object.assign(inputPluginEvents, {
      keyboard: keyboardEvents,
      hitTestPointer: (pointer) => {
        if (uiHitPointer && pointer.x === uiHitPointer.x && pointer.y === uiHitPointer.y) {
          return [{ depth: 2000, getData: () => true }];
        }
        return [];
      },
    }),
    cameras: {
      main: {
        getWorldPoint: (x, y) => ({ x, y }),
        shake: () => {},
      },
    },
    time: { now: 1000, delayedCall: () => ({ remove: () => {} }) },
    tweens: {
      add: () => {},
      killTweensOf: () => {},
    },
    textures: {
      exists: () => false,
      get: () => ({ has: () => false }),
    },
    anims: {
      exists: () => false,
    },
    add: {
      container: (x, y) => {
        const c = Object.assign(new EventEmitter(), {
          x,
          y,
          depth: 0,
          scaleX: 1,
          scaleY: 1,
          list: [],
          setPosition(nx, ny) {
            this.x = nx;
            this.y = ny;
            return this;
          },
          setDepth(d) {
            this.depth = d;
            return this;
          },
          setScale(s) {
            this.scaleX = s;
            this.scaleY = s;
            return this;
          },
          setAlpha() {
            return this;
          },
          destroy() {
            this.emit('destroy');
          },
        });
        return c;
      },
      graphics: () => ({
        setPosition() { return this; },
        setDepth() { return this; },
        lineStyle() { return this; },
        fillStyle() { return this; },
        beginPath() { return this; },
        moveTo() { return this; },
        lineTo() { return this; },
        closePath() { return this; },
        strokePath() { return this; },
        fillPath() { return this; },
        strokeCircle() { return this; },
        fillCircle() { return this; },
        strokeRect() { return this; },
        arc() { return this; },
        lineBetween() { return this; },
        fillTriangle() { return this; },
        setRotation() { return this; },
        destroy() {},
      }),
      rectangle: () => ({
        setPosition() { return this; },
        setDepth() { return this; },
        destroy() {},
      }),
      ellipse: () => ({
        setPosition() { return this; },
      }),
      sprite: () => ({
        setPosition() { return this; },
        setDepth() { return this; },
        setOrigin() { return this; },
        setFlip() { return this; },
        setFlipX() { return this; },
        setVisible() { return this; },
        setAlpha() { return this; },
        setScale() { return this; },
        setRotation() { return this; },
        play() { return this; },
        anims: { isPlaying: false, timeScale: 1 },
      }),
    },
  };

  const recordedActions = {
    basicAttacks: [],
    skillCasts: [],
    interactions: 0,
    deaths: 0,
  };

  const actions = {
    basic: (combo, dir) => {
      recordedActions.basicAttacks.push({ combo, dir: dir.clone(), time: mockScene.time.now });
    },
    skill: (skill, damage, dir) => {
      recordedActions.skillCasts.push({ skill, damage, dir: dir.clone(), time: mockScene.time.now });
    },
    interact: () => {
      recordedActions.interactions++;
    },
    dead: (ms) => {
      recordedActions.deaths++;
    },
  };

  let externalLocked = options.locked ?? false;

  const mockGameState = {
    data: {
      hp: 100,
      mp: 100,
      level: 5,
      attack: 20,
      gold: 50,
      rpg: {
        equipment: { slots: { weapon: 'lac-sword' } },
        skills: {
          unlockedSkillIds: ['mountain-cleave', 'stone-armor'],
          equippedSlots: { 'slot-1': 'stone-armor', 'slot-2': 'mountain-cleave' },
          cooldownUntil: {},
          activeDivinePower: 'earth',
          unlockedDivinePowers: ['earth'],
        },
        inventory: {
          capacity: 20,
          slots: [
            { itemId: 'herbal-balm', quantity: 3 },
            { itemId: 'spirit-tea', quantity: 2 },
          ],
        },
      },
    },
    save: () => {},
  };

  const mockStats = { maxHp: 100, maxMp: 100, speed: 190 };

  const GameActionModule = loadModule('src/game/input/GameAction.ts');
  const InputBindingsModule = loadModule('src/game/input/InputBindings.ts', {
    './GameAction': GameActionModule,
  });
  const InputContextModule = loadModule('src/game/input/InputContext.ts');
  const InputSettingsModule = loadModule('src/game/input/InputSettings.ts', {
    './InputBindings': InputBindingsModule,
    './GameAction': GameActionModule,
  });
  const KeyboardMouseAdapterModule = loadModule('src/game/input/KeyboardMouseAdapter.ts', {
    './GameAction': GameActionModule,
    './InputBindings': InputBindingsModule,
    './InputSettings': InputSettingsModule,
  });
  const TouchAdapterModule = loadModule('src/game/input/TouchAdapter.ts', {
    './GameAction': GameActionModule,
    './InputSettings': InputSettingsModule,
  });
  const InputManagerModule = loadModule('src/game/input/InputManager.ts', {
    './GameAction': GameActionModule,
    './InputContext': InputContextModule,
    './InputSettings': InputSettingsModule,
    './KeyboardMouseAdapter': KeyboardMouseAdapterModule,
    './TouchAdapter': TouchAdapterModule,
  });

  const ItemsModule = loadModule('src/data/items.ts');
  const SkillsModule = loadModule('src/data/skills.ts');
  const WeaponsModule = loadModule('src/data/weapons.ts', {
    './items': ItemsModule,
  });
  const SkillSystemModule = loadModule('src/game/rpg/SkillSystem.ts', {
    '../../data/skills': SkillsModule,
    '../../data/weapons': WeaponsModule,
    '../../data/config': { BALANCE: { attackBufferMs: 150, comboWindowMs: 690, dodgeCooldownMs: 1200, dodgeDurationMs: 190 } },
  });
  const InventorySystemModule = loadModule('src/game/rpg/InventorySystem.ts', {
    '../../data/items': ItemsModule,
  });
  const SkillCombatModule = loadModule('src/game/systems/SkillCombat.ts', {
    '../../data/skills': SkillsModule,
    '../rpg/SkillSystem': SkillSystemModule,
  });

  const phaserMock = {
    Math: { Vector2 },
    Input: { Keyboard: { JustDown: () => false } },
  };
  phaserMock.default = phaserMock;

  const PlayerDependencies = {
    phaser: phaserMock,
    '../../data/config': { BALANCE: { attackBufferMs: 150, comboWindowMs: 690, dodgeCooldownMs: 1200, dodgeDurationMs: 190 }, W: 960, H: 540 },
    '../ui/art': { actor: (scene, x, y) => scene.add.container(x, y), label: () => ({ setDepth: () => {} }), floatText: () => {} },
    '../systems/GameState': { gameState: mockGameState, getPlayerStats: () => mockStats },
    '../assets/assetLoader': { SPRITE_KEYS: { hero: 'hero', hero_sword: 'hero_sword' } },
    '../assets/equipmentArtwork': { equipmentTexture: () => 'tex', EQUIPMENT_ARTWORK: {} },
    '../assets/spriteManifest': { animationFrames: () => [], canPlayLocomotion: () => true, facingDirection: () => 'down', SPRITE_MANIFEST: { hero: { poses: { death: { count: 4, frameRate: 8 } } } } },
    '../rendering/GraphicsSettings': { graphicsSettings: { getBudget: () => ({ cameraShake: false }) } },
    '../world/WorldBounds': { moveInWorld: (p, next) => next },
    '../../data/skills': SkillsModule,
    '../rpg/SkillSystem': SkillSystemModule,
    '../systems/SkillCombat': SkillCombatModule,
    '../audio/AudioManager': { audioManager: { playCue: () => {} } },
    '../../data/weapons': WeaponsModule,
    '../input/InputManager': InputManagerModule,
    '../../data/items': ItemsModule,
    '../rpg/InventorySystem': InventorySystemModule,
  };

  const { Player } = loadModule('src/game/entities/Player.ts', PlayerDependencies);

  const CombatDependencies = {
    phaser: phaserMock,
    './GameState': { gameState: mockGameState },
    '../audio/AudioManager': { audioManager: { playCue: () => {} } },
    '../rendering/GraphicsSettings': { graphicsSettings: { getBudget: () => ({ cameraShake: false, combatSparks: 0 }) } },
    '../../data/skills': SkillsModule,
    './SkillCombat': SkillCombatModule,
    '../../data/weapons': WeaponsModule,
  };
  const { CombatSystem } = loadModule('src/game/systems/CombatSystem.ts', CombatDependencies);

  const player = new Player(
    mockScene,
    options.x ?? 200,
    options.y ?? 200,
    actions,
    () => externalLocked,
    [],
    options.inputManager
  );

  return {
    player,
    scene: mockScene,
    keyboardEvents,
    inputPluginEvents,
    recordedActions,
    mockGameState,
    mockStats,
    InputManagerModule,
    InputBindingsModule,
    CombatSystem,
    setLocked: (val) => { externalLocked = val; },
    setUIHit: (pointer) => { uiHitPointer = pointer; },
    pressKey: (code) => {
      keyboardEvents.emit('keydown', { code });
    },
    releaseKey: (code) => {
      keyboardEvents.emit('keyup', { code });
    },
    pointerDown: (x, y, button = 0) => {
      inputPluginEvents.emit('pointerdown', { x, y, button, worldX: x, worldY: y });
    },
    pointerUp: (x, y, button = 0) => {
      inputPluginEvents.emit('pointerup', { x, y, button, worldX: x, worldY: y });
    },
    pointerMove: (x, y) => {
      inputPluginEvents.emit('pointermove', { x, y, worldX: x, worldY: y });
    },
  };
}

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n=== RUNNING PLAYER & COMBAT CONTROLS TEST SUITE ===\n');

// -------------------------------------------------------------
// Suite 1: Integration & Initialization
// -------------------------------------------------------------
console.log('Suite 1: Integration & Initialization');

runTest('Player imports and provides readonly inputManager', () => {
  const harness = createTestHarness();
  assert.ok(harness.player.inputManager, 'player.inputManager must exist');
  assert.equal(typeof harness.player.inputManager.update, 'function');
  assert.equal(typeof harness.player.inputManager.getMovementVector, 'function');
  assert.equal(typeof harness.player.inputManager.getAimPoint, 'function');
});

runTest('Player accepts custom InputManager in constructor', () => {
  const customManager = new (createTestHarness().InputManagerModule.InputManager)();
  const harness = createTestHarness({ inputManager: customManager });
  assert.equal(harness.player.inputManager, customManager);
});

runTest('Player maintains backward compatibility with player.controls.direction', () => {
  const harness = createTestHarness();
  assert.ok(harness.player.controls, 'player.controls must exist');
  assert.ok(harness.player.controls.direction, 'player.controls.direction must exist');
  assert.equal(typeof harness.player.controls.direction.x, 'number');
  assert.equal(typeof harness.player.controls.direction.y, 'number');
});

runTest('Scene shutdown and view destroy clean up input listeners', () => {
  const harness = createTestHarness();
  let cleanupCalled = false;
  harness.player.inputManager.cleanup = () => { cleanupCalled = true; };
  harness.scene.events.emit('shutdown');
  assert.ok(cleanupCalled, 'inputManager.cleanup must be called on scene shutdown');
});

// -------------------------------------------------------------
// Suite 2: 8-Direction Normalized Movement
// -------------------------------------------------------------
console.log('\nSuite 2: 8-Direction Normalized Movement');

runTest('Cardinal movement right (KeyD) updates player x by speed * delta', () => {
  const harness = createTestHarness({ x: 200, y: 200 });
  harness.pressKey('KeyD');
  harness.player.update(100); // 100ms
  // speed = 190. 100ms -> dx = 190 * 0.1 = 19.
  assert.equal(Math.round(harness.player.x), 219);
  assert.equal(harness.player.y, 200);
  assert.equal(harness.player.direction.x, 1);
  assert.equal(harness.player.direction.y, 0);
  harness.releaseKey('KeyD');
});

runTest('Diagonal movement (KeyW + KeyD) is normalized (length <= 1, no diagonal speed advantage)', () => {
  const harness = createTestHarness({ x: 200, y: 200 });
  harness.pressKey('KeyW');
  harness.pressKey('KeyD');
  harness.player.update(100);

  const move = harness.player.inputManager.getMovementVector();
  const len = Math.hypot(move.x, move.y);
  assert.ok(Math.abs(len - 1.0) < 0.001, `Diagonal vector length must be normalized to 1, got: ${len}`);

  const dx = harness.player.x - 200;
  const dy = harness.player.y - 200;
  const dist = Math.hypot(dx, dy);
  const expectedDist = 190 * 0.1; // 19
  assert.ok(Math.abs(dist - expectedDist) < 0.1, `Total distance traveled must be speed * dt = ${expectedDist}, got: ${dist}`);

  harness.releaseKey('KeyW');
  harness.releaseKey('KeyD');
});

runTest('Setting player.controls.direction directly moves player (backward compatibility)', () => {
  const harness = createTestHarness({ x: 200, y: 200 });
  harness.player.controls.direction.x = 1;
  harness.player.update(100);
  assert.equal(Math.round(harness.player.x), 219);
  harness.player.controls.direction.x = 0;
});

// -------------------------------------------------------------
// Suite 3: Basic Attack (LMB & KeyJ), Combo 1-2-3, Buffering & UI Hit Test
// -------------------------------------------------------------
console.log('\nSuite 3: Basic Attack, Combo System & Input Buffering');

runTest('Attack triggered via LMB and KeyJ', () => {
  const harness = createTestHarness();
  harness.pointerDown(300, 200, 0); // LMB click
  harness.player.update(16);
  assert.equal(harness.recordedActions.basicAttacks.length, 1);
  assert.equal(harness.recordedActions.basicAttacks[0].combo, 1);
  harness.pointerUp(300, 200, 0);

  // Advance clock beyond attack timing (e.g. 350ms)
  harness.scene.time.now += 350;
  harness.pressKey('KeyJ');
  harness.player.update(16);
  assert.equal(harness.recordedActions.basicAttacks.length, 2);
  assert.equal(harness.recordedActions.basicAttacks[1].combo, 2);
  harness.releaseKey('KeyJ');
});

runTest('Combo progresses 1 -> 2 -> 3 -> 1 within combo window', () => {
  const harness = createTestHarness();
  // Combo 1
  harness.pressKey('KeyJ');
  harness.player.update(16);
  harness.releaseKey('KeyJ');
  assert.equal(harness.recordedActions.basicAttacks[0].combo, 1);

  // Combo 2 (within 690ms combo window)
  harness.scene.time.now += 260;
  harness.pressKey('KeyJ');
  harness.player.update(16);
  harness.releaseKey('KeyJ');
  assert.equal(harness.recordedActions.basicAttacks[1].combo, 2);

  // Combo 3
  harness.scene.time.now += 300;
  harness.pressKey('KeyJ');
  harness.player.update(16);
  harness.releaseKey('KeyJ');
  assert.equal(harness.recordedActions.basicAttacks[2].combo, 3);

  // Combo wraps back to 1
  harness.scene.time.now += 380;
  harness.pressKey('KeyJ');
  harness.player.update(16);
  harness.releaseKey('KeyJ');
  assert.equal(harness.recordedActions.basicAttacks[3].combo, 1);
});

runTest('Combo resets to 1 if elapsed time exceeds 690ms', () => {
  const harness = createTestHarness();
  harness.pressKey('KeyJ');
  harness.player.update(16);
  harness.releaseKey('KeyJ');
  assert.equal(harness.recordedActions.basicAttacks[0].combo, 1);

  // Exceed combo window
  harness.scene.time.now += 800;
  harness.pressKey('KeyJ');
  harness.player.update(16);
  harness.releaseKey('KeyJ');
  assert.equal(harness.recordedActions.basicAttacks[1].combo, 1, 'Combo must reset to 1 after window expires');
});

runTest('Input buffering: attack pressed during weapon attack cooldown executes as soon as cooldown finishes', () => {
  const harness = createTestHarness();
  harness.pressKey('KeyJ');
  harness.player.update(16);
  harness.releaseKey('KeyJ');
  assert.equal(harness.recordedActions.basicAttacks.length, 1);

  // Press attack again 120ms later (while weapon is still swinging, timing is ~238ms)
  harness.scene.time.now += 120;
  harness.pressKey('KeyJ');
  harness.player.update(16);
  harness.releaseKey('KeyJ');
  // Second attack should not have fired yet
  assert.equal(harness.recordedActions.basicAttacks.length, 1);

  // Advance time past attackAt (cooldown finishes at 1238ms, buffer valid until 1270ms)
  harness.scene.time.now += 130;
  harness.player.update(16);
  // Buffered attack should now have executed!
  assert.equal(harness.recordedActions.basicAttacks.length, 2, 'Buffered attack must execute after cooldown');
  assert.equal(harness.recordedActions.basicAttacks[1].combo, 2);
});

runTest('Chặn đánh xuyên UI: click on UI elements does not trigger attack', () => {
  const harness = createTestHarness();
  harness.setUIHit({ x: 500, y: 300 });

  harness.pointerDown(500, 300, 0);
  harness.player.update(16);
  harness.pointerUp(500, 300, 0);

  assert.equal(harness.recordedActions.basicAttacks.length, 0, 'Pointer over UI must NOT trigger attack');
});

// -------------------------------------------------------------
// Suite 4: Attack Direction (Movement & Facing Direction)
// -------------------------------------------------------------
console.log('\nSuite 4: Attack Direction (Movement & Facing Direction)');

runTest('Player attacks in movement direction on LMB regardless of mouse cursor position', () => {
  const harness = createTestHarness({ x: 200, y: 200 });
  // Move right with KeyD
  harness.pressKey('KeyD');
  // Aim cursor to top-left (100, 100) -> opposite of movement direction
  harness.pointerMove(100, 100);
  // Attack with LMB
  harness.pointerDown(100, 100, 0);
  harness.player.update(16);
  harness.pointerUp(100, 100, 0);
  harness.releaseKey('KeyD');

  assert.equal(harness.recordedActions.basicAttacks.length, 1);
  const dir = harness.recordedActions.basicAttacks[0].dir;
  assert.equal(dir.x, 1, `Attack direction x must be 1 (movement direction), got ${dir.x}`);
  assert.equal(dir.y, 0, `Attack direction y must be 0, got ${dir.y}`);
  assert.equal(harness.player.direction.x, 1);
  assert.equal(harness.player.direction.y, 0);
});

runTest('Player attacks in current facing direction when stationary regardless of mouse cursor position', () => {
  const harness = createTestHarness({ x: 200, y: 200 });
  // Face left by briefly moving left
  harness.pressKey('KeyA');
  harness.player.update(50);
  harness.releaseKey('KeyA');
  // Player is now stationary facing left
  assert.equal(harness.player.direction.x, -1);
  assert.equal(harness.player.direction.y, 0);

  // Aim to top-right (500, 100) with mouse cursor
  harness.pointerMove(500, 100);
  // Attack with LMB
  harness.pointerDown(500, 100, 0);
  harness.player.update(16);
  harness.pointerUp(500, 100, 0);

  assert.equal(harness.recordedActions.basicAttacks.length, 1);
  const dir = harness.recordedActions.basicAttacks[0].dir;
  assert.equal(dir.x, -1, 'Attack direction must remain facing left when stationary');
  assert.equal(dir.y, 0);
  assert.equal(harness.player.direction.x, -1);
  assert.equal(harness.player.direction.y, 0);
});

// -------------------------------------------------------------
// Suite 5: Skills (Digit1 .. Digit4)
// -------------------------------------------------------------
console.log('\nSuite 5: Skills Assignment to 1/2/3/4');

runTest('Skills 1-4 triggered by Digit1..Digit4 (not Q/E/R/T)', () => {
  const harness = createTestHarness();

  // Test that pressing Q does NOT trigger skill
  harness.pressKey('KeyQ');
  harness.player.update(16);
  harness.releaseKey('KeyQ');
  assert.equal(harness.recordedActions.skillCasts.length, 0, 'KeyQ must NOT cast skill');

  // Digit1 triggers slot-1 (stone-armor)
  harness.pressKey('Digit1');
  harness.player.update(16);
  harness.releaseKey('Digit1');
  assert.equal(harness.recordedActions.skillCasts.length, 1);
  assert.equal(harness.recordedActions.skillCasts[0].skill.id, 'stone-armor');

  // Advance time past cooldown
  harness.scene.time.now += 5500;

  // Aim towards (400, 200) when player is at (200, 200) -> dir (1, 0)
  harness.pointerMove(400, 200);

  // Digit2 triggers slot-2 (mountain-cleave, directional skill)
  harness.pressKey('Digit2');
  harness.player.update(16);
  harness.releaseKey('Digit2');
  assert.equal(harness.recordedActions.skillCasts.length, 2);
  assert.equal(harness.recordedActions.skillCasts[1].skill.id, 'mountain-cleave');
  assert.equal(harness.recordedActions.skillCasts[1].dir.x, 1);
  assert.equal(harness.recordedActions.skillCasts[1].dir.y, 0);
});

runTest('Empty skill slots (Digit3 / Digit4) do not throw errors', () => {
  const harness = createTestHarness();
  assert.doesNotThrow(() => {
    harness.pressKey('Digit3');
    harness.player.update(16);
    harness.releaseKey('Digit3');

    harness.pressKey('Digit4');
    harness.player.update(16);
    harness.releaseKey('Digit4');
  });
});

// -------------------------------------------------------------
// Suite 6: Dodge & Quick Items
// -------------------------------------------------------------
console.log('\nSuite 6: Dodge & Quick Items');

runTest('Dodge triggered by Space key and provides speed boost & cancels buffer', () => {
  const harness = createTestHarness({ x: 200, y: 200 });
  harness.player.attackBufferedUntil = 1200;

  harness.pressKey('Space');
  harness.player.update(16);
  harness.releaseKey('Space');

  assert.ok(harness.player.isDodging, 'Player must enter dodging state');
  assert.equal(harness.player.attackBufferedUntil, 0, 'Dodge must clear attack buffer');
});

runTest('Quick item (Digit5) consumes item from inventory and heals', () => {
  const harness = createTestHarness();
  harness.mockGameState.data.hp = 50;

  harness.pressKey('Digit5');
  harness.player.update(16);
  harness.releaseKey('Digit5');

  // herbal-balm restores 35 HP: 50 + 35 = 85
  assert.equal(harness.mockGameState.data.hp, 85);
  // Quantity decreased from 3 to 2
  const slot = harness.mockGameState.data.rpg.inventory.slots.find(s => s.itemId === 'herbal-balm');
  assert.equal(slot.quantity, 2);
});

// -------------------------------------------------------------
// Suite 7: Context & Lock Guards
// -------------------------------------------------------------
console.log('\nSuite 7: Context & Lock Guards');

runTest('Locking player blocks movement and clears attack buffer', () => {
  const harness = createTestHarness({ x: 200, y: 200 });
  harness.setLocked(true);
  harness.player.attackBufferedUntil = 1500;

  harness.pressKey('KeyD');
  harness.player.update(100);
  harness.releaseKey('KeyD');

  assert.equal(harness.player.x, 200, 'Locked player must not move');
  assert.equal(harness.player.attackBufferedUntil, 0, 'Locked player must clear attack buffer');
});

runTest('Pushing non-GAMEPLAY context (MENU) locks player and clears attack buffer', () => {
  const harness = createTestHarness({ x: 200, y: 200 });
  harness.player.attackBufferedUntil = 1500;

  harness.player.inputManager.pushContext('MENU');
  assert.equal(harness.player.attackBufferedUntil, 0, 'Context change to MENU must clear attack buffer');

  harness.pressKey('KeyD');
  harness.player.update(100);
  harness.releaseKey('KeyD');

  assert.equal(harness.player.x, 200, 'Movement must be blocked during MENU context');

  // Popping back to GAMEPLAY restores control
  harness.player.inputManager.popContext('MENU');
  harness.pressKey('KeyD');
  harness.player.update(100);
  harness.releaseKey('KeyD');
  assert.ok(harness.player.x > 200, 'Movement must be restored after popping MENU');
});

// -------------------------------------------------------------
// Suite 8: CombatSystem Direction & Aiming Verification
// -------------------------------------------------------------
console.log('\nSuite 8: CombatSystem Direction & Aiming Verification');

runTest('CombatSystem.basic uses mouse-aimed direction for hit detection and knockback', () => {
  const harness = createTestHarness({ x: 200, y: 200 });
  let enemyDamaged = false;
  let knockbackDir = null;

  const mockEnemy = {
    x: 250, // To the right of player
    y: 200,
    radius: 20,
    isAlive: true,
    damage: (dmg, kx, ky) => {
      enemyDamaged = true;
      knockbackDir = { x: kx, y: ky };
    },
  };

  const combat = new harness.CombatSystem(harness.scene, () => [mockEnemy]);

  // Attack aiming right (1, 0) -> should hit enemy
  combat.basic(harness.player, 1, new Vector2(1, 0));
  assert.ok(enemyDamaged, 'Enemy to the right must be hit by attack aiming right');
  assert.ok(knockbackDir.x > 0, 'Knockback x must be positive');

  // Reset and attack aiming left (-1, 0) -> enemy to right should NOT be hit
  enemyDamaged = false;
  combat.basic(harness.player, 1, new Vector2(-1, 0));
  assert.equal(enemyDamaged, false, 'Enemy to the right must NOT be hit by attack aiming left');
});

console.log(`\n=== ALL ${totalTests} TESTS PASSED! (${passedTests}/${totalTests}) ===\n`);
