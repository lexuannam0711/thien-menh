/**
 * Master QA Matrix Verification Suite: Controls, Settings & Menus
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Kiểm tra toàn diện 8 ma trận chất lượng:
 * 1. Migration & Persistence (Đọc/ghi controls v2, fallback lỗi, di chuyển Q/E/R/T -> 1/2/3/4)
 * 2. Remapping & Conflict Resolution (Gán phím, phát hiện xung đột, hoán đổi, khôi phục mặc định)
 * 3. Input Action Mapping (Digit1..4 cho skills, LMB cho attack, Space cho dodge, F cho interact)
 * 4. UI Pointer Isolation (Click UI không kích hoạt đánh xuyên gameplay)
 * 5. Multi-touch Isolation (Không ghost tap khi vừa giữ joystick vừa bấm tấn công)
 * 6. Responsive HUD & Controls (Không vỡ layout ở 1920x1080, 1366x768, 1024x768, 844x390, 740x360)
 * 7. Vietnamese Text & Unicode (Đúng dấu thanh, không lỗi mojibake, đầy đủ thuật ngữ chuẩn)
 * 8. ControlsSettings & PauseOverlay Integration (Đóng mở an toàn, ưu tiên phím Escape)
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = process.cwd();

console.log('================================================================');
console.log('THAN MENH: CONTROLS, SETTINGS & MENUS MASTER QA MATRIX');
console.log('================================================================\n');

function transpileCode(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  return ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
}

function loadModule(filePath, customDependencies = {}, customGlobals = {}) {
  const transpiled = transpileCode(filePath);
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

// -------------------------------------------------------------
// SUITE 1: Migration & Persistence
// -------------------------------------------------------------
console.log('--- Suite 1: Migration & Persistence ---');
{
  const inputSettingsMod = loadModule('src/game/input/InputSettings.ts', {
    './GameAction': loadModule('src/game/input/GameAction.ts'),
    './InputBindings': loadModule('src/game/input/InputBindings.ts'),
  });

  const {
    CONTROLS_STORAGE_KEY,
    getDefaultInputSettings,
    migrateAndNormalizeInputSettings,
    InputSettingsManager,
  } = inputSettingsMod;

  assert.equal(CONTROLS_STORAGE_KEY, 'than-menh-controls-v2', 'Storage key must be than-menh-controls-v2');

  const defaults = getDefaultInputSettings();
  assert.equal(defaults.version, 2, 'Default version must be 2');
  assert.deepEqual(Array.from(defaults.bindings.SKILL_1), ['Digit1', 'Numpad1'], 'Skill 1 default is Digit1');
  assert.deepEqual(Array.from(defaults.bindings.SKILL_2), ['Digit2', 'Numpad2'], 'Skill 2 default is Digit2');
  assert.deepEqual(Array.from(defaults.bindings.SKILL_3), ['Digit3', 'Numpad3'], 'Skill 3 default is Digit3');
  assert.deepEqual(Array.from(defaults.bindings.SKILL_4), ['Digit4', 'Numpad4'], 'Skill 4 default is Digit4');
  assert.equal(defaults.pc.mouseAiming, true, 'PC mouse aiming default true');
  assert.equal(defaults.pc.rightClickDodge, false, 'PC right click dodge default false');
  assert.equal(defaults.mobile.handedness, 'right', 'Mobile default right-handed');
  assert.equal(defaults.mobile.controlScale, 1.0, 'Mobile control scale default 1.0');
  assert.equal(defaults.mobile.buttonOpacity, 0.8, 'Mobile button opacity default 0.8');

  // Null & invalid input fallback
  assert.equal(migrateAndNormalizeInputSettings(null).version, 2, 'Null input falls back to default');
  assert.equal(migrateAndNormalizeInputSettings(undefined).version, 2, 'Undefined falls back to default');
  assert.equal(migrateAndNormalizeInputSettings('invalid').version, 2, 'String falls back to default');

  // Corrupted JSON in storage
  const memoryStore = new Map();
  const mockStorage = {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, val) => memoryStore.set(key, val),
    removeItem: (key) => memoryStore.delete(key),
  };

  memoryStore.set(CONTROLS_STORAGE_KEY, '{invalid json malformed!!!');
  const managerCorrupt = new InputSettingsManager(mockStorage);
  assert.equal(managerCorrupt.getSettings().version, 2, 'Corrupted JSON in storage gracefully recovers to default');

  // Throwing storage (quota exceeded or cookies blocked)
  const throwingStorage = {
    getItem: () => { throw new Error('SecurityError: localStorage blocked'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
  };
  const managerThrow = new InputSettingsManager(throwingStorage);
  assert.equal(managerThrow.getSettings().version, 2, 'Throwing storage load gracefully recovers');
  assert.equal(managerThrow.save(throwingStorage), false, 'Throwing storage save returns false without crash');

  // Schema migration from legacy v1 (Q/E/R/T skills)
  const legacyData = {
    version: 1,
    bindings: {
      ATTACK: ['KeyJ'],
      DODGE: ['Space'],
      SKILL_1: ['KeyQ'],
      SKILL_2: ['KeyE'],
      SKILL_3: ['KeyR'],
      SKILL_4: ['KeyT'],
      INTERACT: ['KeyF'],
    },
    mobile: {
      controlScale: 2.5, // Out of bounds -> clamp to 1.4
      buttonOpacity: 0.1, // Out of bounds -> clamp to 0.4
      handedness: 'left',
    },
  };
  memoryStore.clear();
  memoryStore.set('than-menh-controls-v1', JSON.stringify(legacyData));

  const managerMigrate = new InputSettingsManager(mockStorage);
  const migrated = managerMigrate.getSettings();
  assert.equal(migrated.version, 2, 'Migrated version is 2');
  assert.deepEqual(Array.from(migrated.bindings.SKILL_1), ['Digit1', 'Numpad1'], 'Legacy KeyQ successfully migrated to Digit1');
  assert.deepEqual(Array.from(migrated.bindings.SKILL_2), ['Digit2', 'Numpad2'], 'Legacy KeyE successfully migrated to Digit2');
  assert.deepEqual(Array.from(migrated.bindings.SKILL_3), ['Digit3', 'Numpad3'], 'Legacy KeyR successfully migrated to Digit3');
  assert.deepEqual(Array.from(migrated.bindings.SKILL_4), ['Digit4', 'Numpad4'], 'Legacy KeyT successfully migrated to Digit4');
  assert.equal(migrated.mobile.controlScale, 1.4, 'Out-of-range controlScale clamped to 1.4');
  assert.equal(migrated.mobile.buttonOpacity, 0.4, 'Out-of-range buttonOpacity clamped to 0.4');
  assert.equal(migrated.mobile.handedness, 'left', 'Handedness left preserved');
  assert.ok(memoryStore.has(CONTROLS_STORAGE_KEY), 'Upgraded settings persisted to new storage key');

  console.log('✓ Suite 1: Migration & Persistence Passed');
}

// -------------------------------------------------------------
// SUITE 2: Remapping & Conflict Resolution
// -------------------------------------------------------------
console.log('--- Suite 2: Remapping & Conflict Resolution ---');
{
  const bindingsMod = loadModule('src/game/input/InputBindings.ts');
  const {
    DEFAULT_KEY_BINDINGS,
    cloneBindings,
    normalizeKeyCode,
    findConflictingActions,
    detectBindingConflicts,
    rebindAction,
    swapBindings,
  } = bindingsMod;

  // Key normalization
  assert.equal(normalizeKeyCode('lmb'), 'MouseLeft');
  assert.equal(normalizeKeyCode('rmb'), 'MouseRight');
  assert.equal(normalizeKeyCode('space'), 'Space');
  assert.equal(normalizeKeyCode('j'), 'KeyJ');
  assert.equal(normalizeKeyCode('Digit1'), 'Digit1');

  // Conflict detection
  const testBindings = cloneBindings(DEFAULT_KEY_BINDINGS);
  assert.equal(detectBindingConflicts(testBindings).length, 0, 'Default bindings have zero conflict');

  // Test conflicting key assignment: assigning KeyF to ATTACK while INTERACT is KeyF
  const conflictsF = findConflictingActions(testBindings, 'ATTACK', 'KeyF');
  assert.ok(conflictsF.includes('INTERACT'), 'Finds INTERACT has KeyF');

  // Rebind action with conflict detection
  const rebindResult = rebindAction(testBindings, 'ATTACK', 'KeyF', 0);
  assert.ok(rebindResult.conflicts.includes('INTERACT'), 'Rebind reports conflict with INTERACT');
  assert.equal(rebindResult.bindings.ATTACK[0], 'KeyF', 'ATTACK updated to KeyF');

  // Swap bindings
  const swapped = swapBindings(DEFAULT_KEY_BINDINGS, 'ATTACK', 'INTERACT');
  assert.deepEqual(Array.from(swapped.ATTACK), Array.from(DEFAULT_KEY_BINDINGS.INTERACT), 'ATTACK has INTERACT keys');
  assert.deepEqual(Array.from(swapped.INTERACT), Array.from(DEFAULT_KEY_BINDINGS.ATTACK), 'INTERACT has ATTACK keys');

  // Re-swap returns to original
  const reSwapped = swapBindings(swapped, 'ATTACK', 'INTERACT');
  assert.deepEqual(Array.from(reSwapped.ATTACK), Array.from(DEFAULT_KEY_BINDINGS.ATTACK), 'Re-swapped matches default');

  console.log('✓ Suite 2: Remapping & Conflict Resolution Passed');
}

// -------------------------------------------------------------
// SUITE 3: Input Action Mapping (Strict Validation)
// -------------------------------------------------------------
console.log('--- Suite 3: Input Action Mapping ---');
{
  const { DEFAULT_KEY_BINDINGS } = loadModule('src/game/input/InputBindings.ts');
  const settingsModel = loadModule('src/game/ui/SettingsModel.ts');
  const { CONTROLS_GUIDE } = settingsModel;

  // Verify DEFAULT_KEY_BINDINGS strictly
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.ATTACK), ['MouseLeft', 'KeyJ'], 'Attack bound to MouseLeft and KeyJ');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.DODGE), ['Space'], 'Dodge bound to Space');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.INTERACT), ['KeyF'], 'Interact bound to KeyF');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.SKILL_1), ['Digit1', 'Numpad1'], 'Skill 1 bound to Digit1/Numpad1');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.SKILL_2), ['Digit2', 'Numpad2'], 'Skill 2 bound to Digit2/Numpad2');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.SKILL_3), ['Digit3', 'Numpad3'], 'Skill 3 bound to Digit3/Numpad3');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.SKILL_4), ['Digit4', 'Numpad4'], 'Skill 4 bound to Digit4/Numpad4');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.QUICK_ITEM_1), ['Digit5', 'Numpad5'], 'Item 1 bound to Digit5');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.QUICK_ITEM_2), ['Digit6', 'Numpad6'], 'Item 2 bound to Digit6');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.QUICK_ITEM_3), ['Digit7', 'Numpad7'], 'Item 3 bound to Digit7');
  assert.deepEqual(Array.from(DEFAULT_KEY_BINDINGS.QUICK_ITEM_4), ['Digit8', 'Numpad8'], 'Item 4 bound to Digit8');

  // Absolute rule: Q/E/R/T must NOT be default for skills
  for (let i = 1; i <= 4; i++) {
    const keys = DEFAULT_KEY_BINDINGS[`SKILL_${i}`];
    assert.ok(!keys.includes('KeyQ'), `Skill ${i} must not bind KeyQ`);
    assert.ok(!keys.includes('KeyE'), `Skill ${i} must not bind KeyE`);
    assert.ok(!keys.includes('KeyR'), `Skill ${i} must not bind KeyR`);
    assert.ok(!keys.includes('KeyT'), `Skill ${i} must not bind KeyT`);
  }

  // Verify CONTROLS_GUIDE
  const skillGuide = CONTROLS_GUIDE.keyboard.find(k => k.id === 'skills');
  assert.ok(skillGuide, 'Skills guide entry exists');
  assert.match(skillGuide.binding, /1 \/ 2 \/ 3 \/ 4/, 'Skills guide mentions 1 / 2 / 3 / 4');

  const attackGuide = CONTROLS_GUIDE.keyboard.find(k => k.id === 'attack');
  assert.ok(attackGuide, 'Attack guide entry exists');
  assert.match(attackGuide.binding, /LMB|Chuột trái/i, 'Attack guide mentions LMB/Chuột trái');

  const dodgeGuide = CONTROLS_GUIDE.keyboard.find(k => k.id === 'dodge');
  assert.ok(dodgeGuide, 'Dodge guide entry exists');
  assert.match(dodgeGuide.binding, /Space/i, 'Dodge guide mentions Space');

  console.log('✓ Suite 3: Input Action Mapping Passed');
}

// -------------------------------------------------------------
// SUITE 4: UI Pointer Isolation
// -------------------------------------------------------------
console.log('--- Suite 4: UI Pointer Isolation ---');
{
  const kbAdapterMod = loadModule('src/game/input/KeyboardMouseAdapter.ts', {
    './GameAction': loadModule('src/game/input/GameAction.ts'),
    './InputBindings': loadModule('src/game/input/InputBindings.ts'),
    './InputSettings': loadModule('src/game/input/InputSettings.ts'),
  });

  const { KeyboardMouseAdapter } = kbAdapterMod;
  const { DEFAULT_KEY_BINDINGS } = loadModule('src/game/input/InputBindings.ts');
  const { DEFAULT_PC_SETTINGS } = loadModule('src/game/input/InputSettings.ts');

  let uiHit = false;
  const mockUIHitTest = (x, y) => uiHit;

  const mockScene = {
    events: {
      once: () => {},
      on: () => {},
      off: () => {},
    },
    input: {
      on: () => {},
      off: () => {},
    },
    cameras: {
      main: {
        getWorldPoint: (x, y) => ({ x, y }),
      },
    },
  };

  const adapter = new KeyboardMouseAdapter(mockScene, DEFAULT_KEY_BINDINGS, DEFAULT_PC_SETTINGS);
  adapter.setCustomUIHitTest(mockUIHitTest);

  // Simulation 1: Click outside UI (World click)
  uiHit = false;
  adapter.simulatePointerDown(0, 300, 200); // Left click in gameplay world
  let frame = adapter.update();
  assert.ok(frame.pressed.has('ATTACK'), 'World click emits ATTACK');
  assert.ok(frame.held.has('ATTACK'), 'World click holds ATTACK');

  adapter.simulatePointerUp(0, 300, 200);
  frame = adapter.update();
  assert.ok(frame.released.has('ATTACK'), 'Pointer release emits ATTACK release');

  // Simulation 2: Click on interactive UI element
  uiHit = true; // Pointer is over button / modal
  adapter.simulatePointerDown(0, 500, 400);
  frame = adapter.update();
  assert.ok(!frame.pressed.has('ATTACK'), 'UI click MUST NOT emit ATTACK action (No click-through)');
  assert.ok(!frame.held.has('ATTACK'), 'UI click MUST NOT hold ATTACK');

  adapter.simulatePointerUp(0, 500, 400);
  frame = adapter.update();
  assert.ok(!frame.released.has('ATTACK'), 'UI click release does not emit ATTACK release');

  adapter.destroy();
  console.log('✓ Suite 4: UI Pointer Isolation Passed');
}

// -------------------------------------------------------------
// SUITE 5: Multi-Touch Isolation
// -------------------------------------------------------------
console.log('--- Suite 5: Multi-Touch Isolation ---');
{
  const touchAdapterMod = loadModule('src/game/input/TouchAdapter.ts', {
    './GameAction': loadModule('src/game/input/GameAction.ts'),
    './InputSettings': loadModule('src/game/input/InputSettings.ts'),
  });

  const { TouchAdapter } = touchAdapterMod;
  const { DEFAULT_MOBILE_SETTINGS } = loadModule('src/game/input/InputSettings.ts');

  const mockScene = {
    events: {
      once: () => {},
      on: () => {},
      off: () => {},
    },
    input: {
      on: () => {},
      off: () => {},
    },
  };

  const touchAdapter = new TouchAdapter(mockScene, DEFAULT_MOBILE_SETTINGS);

  // 1. Ngón tay 1 đặt vào Virtual Joystick (pointerId = 1, kéo sang phải-lên)
  touchAdapter.onTouchStart(1, 150, 380);
  let frame = touchAdapter.update();
  assert.ok(frame.moveVector.x > 0, 'Joystick moveX is positive');
  assert.ok(frame.moveVector.y < 0, 'Joystick moveY is negative (upwards)');
  assert.equal(frame.pressed.size, 0, 'No buttons pressed yet');

  // 2. Ngón tay 2 bấm nút Tấn công (pointerId = 2 tại 847, 430) trong khi Joystick vẫn đang giữ
  touchAdapter.onTouchStart(2, 847, 430);
  frame = touchAdapter.update();
  assert.ok(frame.moveVector.x > 0, 'Joystick move maintained while attacking');
  assert.ok(frame.pressed.has('ATTACK'), 'ATTACK pressed on pointer 2');
  assert.ok(frame.held.has('ATTACK'), 'ATTACK held on pointer 2');

  // 3. Ngón tay 2 nhấc lên (pointerId = 2 released), Joystick vẫn giữ
  touchAdapter.onTouchEnd(2);
  frame = touchAdapter.update();
  assert.ok(!frame.held.has('ATTACK'), 'ATTACK released');
  assert.ok(frame.released.has('ATTACK'), 'ATTACK release detected');
  assert.ok(frame.moveVector.x > 0, 'Joystick still actively moving after button release (No touch interruption)');

  // 4. Ngón tay 1 nhấc lên (pointerId = 1 released)
  touchAdapter.onTouchEnd(1);
  frame = touchAdapter.update();
  assert.equal(frame.moveVector.x, 0, 'Movement stops when joystick released');
  assert.equal(frame.moveVector.y, 0, 'Movement stops when joystick released');

  touchAdapter.destroy();
  console.log('✓ Suite 5: Multi-Touch Isolation Passed');
}

// -------------------------------------------------------------
// SUITE 6: Responsive Layout QA Matrix (1920x1080 .. 740x360)
// -------------------------------------------------------------
console.log('--- Suite 6: Responsive Layout QA Matrix ---');
{
  const responsiveMod = loadModule('src/game/ui/ResponsiveLayout.ts', {
    './SafeArea': loadModule('src/game/ui/SafeArea.ts'),
  });
  const { ResponsiveLayout } = responsiveMod;

  const testResolutions = [
    { name: 'Desktop Full HD', width: 1920, height: 1080, expectedDevice: 'desktop' },
    { name: 'Laptop HD', width: 1366, height: 768, expectedDevice: 'desktop' },
    { name: 'Standard Desktop', width: 1024, height: 768, expectedDevice: 'desktop' },
    { name: 'Modern Mobile (iPhone 14/15)', width: 844, height: 390, expectedDevice: 'mobile' },
    { name: 'Compact Mobile Landscape', width: 740, height: 360, expectedDevice: 'mobile' },
  ];

  for (const res of testResolutions) {
    const layout = new ResponsiveLayout(res.width, res.height);
    const bounds = layout.getBounds();

    // Bounds checking
    assert.equal(bounds.width, res.width, `${res.name}: Bounds width matches`);
    assert.equal(bounds.height, res.height, `${res.name}: Bounds height matches`);
    assert.equal(layout.getMode(), res.expectedDevice, `${res.name}: Resolved expected device mode`);

    // Anchor points within screen bounds
    const topLeft = layout.getAnchor('TOP_LEFT');
    assert.ok(topLeft.x >= 0 && topLeft.x < res.width / 2, `${res.name}: TOP_LEFT x valid`);
    assert.ok(topLeft.y >= 0 && topLeft.y < res.height / 2, `${res.name}: TOP_LEFT y valid`);

    const bottomLeft = layout.getAnchor('BOTTOM_LEFT');
    assert.ok(bottomLeft.x >= 0 && bottomLeft.x < res.width / 2, `${res.name}: BOTTOM_LEFT x valid`);
    assert.ok(bottomLeft.y > res.height / 2 && bottomLeft.y <= res.height, `${res.name}: BOTTOM_LEFT y valid`);

    const bottomRight = layout.getAnchor('BOTTOM_RIGHT');
    assert.ok(bottomRight.x > res.width / 2 && bottomRight.x <= res.width, `${res.name}: BOTTOM_RIGHT x valid`);
    assert.ok(bottomRight.y > res.height / 2 && bottomRight.y <= res.height, `${res.name}: BOTTOM_RIGHT y valid`);

    // Combat safe zone must be inside bounds
    const safeZone = layout.getCombatSafeZone();
    assert.ok(safeZone.width > 0 && safeZone.width <= res.width, `${res.name}: Combat safe zone width valid`);
    assert.ok(safeZone.height > 0 && safeZone.height <= res.height, `${res.name}: Combat safe zone height valid`);

    // Scale factor within reasonable boundary
    const scale = layout.getScale();
    assert.ok(scale >= 0.7 && scale <= 1.5, `${res.name}: UI scale factor reasonable: ${scale}`);
  }

  console.log('✓ Suite 6: Responsive Layout QA Matrix Passed');
}

// -------------------------------------------------------------
// SUITE 7: Vietnamese Text & Unicode Integrity
// -------------------------------------------------------------
console.log('--- Suite 7: Vietnamese Text & Unicode Integrity ---');
{
  const filesToCheck = [
    'src/game/ui/screens/ControlsSettings.ts',
    'src/game/ui/PauseOverlay.ts',
    'src/game/ui/SettingsModel.ts',
    'src/game/scenes/MenuScene.ts',
    'src/game/scenes/ForestScene.ts',
  ];

  const requiredTerms = [
    'CÀI ĐẶT ĐIỀU KHIỂN',
    'Tấn công',
    'Lướt né',
    'Kỹ năng',
    'Tương tác',
    'Chuột trái đánh · Phím 1-4 kỹ năng · Space né · F tương tác',
    'TIẾP TỤC',
    'TẠM DỪNG',
    'VỀ MENU',
    'TAY PHẢI',
    'TAY TRÁI',
  ];

  for (const filePath of filesToCheck) {
    const content = fs.readFileSync(path.join(root, filePath), 'utf8');

    // Check for common UTF-8 mojibake patterns
    assert.ok(!content.includes('Ã¡'), `${filePath} contains corrupted character Ã¡`);
    assert.ok(!content.includes('Ãª'), `${filePath} contains corrupted character Ãª`);
    assert.ok(!content.includes('Ã´'), `${filePath} contains corrupted character Ã´`);
    assert.ok(!content.includes('\uFFFD'), `${filePath} contains replacement character`);
  }

  // Check that terms exist across the files
  const combinedContent = filesToCheck.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
  for (const term of requiredTerms) {
    assert.ok(combinedContent.includes(term), `Required term "${term}" found in codebase`);
  }

  console.log('✓ Suite 7: Vietnamese Text & Unicode Integrity Passed');
}

// -------------------------------------------------------------
// SUITE 8: ControlsSettings & PauseOverlay Integration
// -------------------------------------------------------------
console.log('--- Suite 8: ControlsSettings & PauseOverlay Integration ---');
{
  // Mock Phaser components for Container testing
  class MockGraphics {
    clear() { return this; }
    fillStyle() { return this; }
    lineStyle() { return this; }
    fillRoundedRect() { return this; }
    strokeRoundedRect() { return this; }
    fillCircle() { return this; }
    strokeCircle() { return this; }
    beginPath() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    strokePath() { return this; }
  }

  class MockText {
    constructor(scene, x, y, text) { this.text = text; }
    setOrigin() { return this; }
    setText(t) { this.text = t; return this; }
    setColor() { return this; }
  }

  class MockRect {
    constructor() { this.handlers = new Map(); }
    setInteractive() { return this; }
    on(event, fn) { this.handlers.set(event, fn); return this; }
  }

  class MockContainer {
    constructor(scene) {
      this.scene = scene;
      this.list = [];
      this.visible = true;
      this.alpha = 1;
      this.depth = 0;
    }
    add(obj) { this.list.push(obj); return this; }
    removeAll() { this.list = []; return this; }
    setDepth(d) { this.depth = d; return this; }
    setVisible(v) { this.visible = v; return this; }
    setAlpha(a) { this.alpha = a; return this; }
    destroy() { this.list = []; }
  }

  const mockPhaser = {
    Scene: class {},
    GameObjects: {
      Container: MockContainer,
      Graphics: MockGraphics,
      Text: MockText,
      Rectangle: MockRect,
    },
    Math: {
      Vector2: class { constructor(x = 0, y = 0) { this.x = x; this.y = y; } },
    },
  };

  const mockScene = {
    add: {
      graphics: () => new MockGraphics(),
      text: (x, y, t) => new MockText(mockScene, x, y, t),
      rectangle: () => new MockRect(),
      container: (x, y, children) => new MockContainer(mockScene),
      existing: (obj) => obj,
    },
    tweens: {
      killTweensOf: () => {},
      add: (cfg) => { cfg.onComplete?.(); },
      pauseAll: () => {},
      resumeAll: () => {},
    },
    time: { paused: false },
    scene: { start: () => {} },
  };

  // Load ControlsSettings
  const controlsMod = loadModule('src/game/ui/screens/ControlsSettings.ts', {
    phaser: mockPhaser,
    '../../../data/config': { UI_DEPTH: 2000, W: 960, H: 540 },
    '../design-tokens': loadModule('src/game/ui/design-tokens.ts'),
    '../../input/InputSettings': loadModule('src/game/input/InputSettings.ts', {
      './GameAction': loadModule('src/game/input/GameAction.ts'),
      './InputBindings': loadModule('src/game/input/InputBindings.ts'),
    }),
    '../components/KeyCapture': {
      formatKeyDisplayName: (c) => c,
      KeyCapture: class extends MockContainer {
        isOpen() { return this._open; }
        open() { this._open = true; }
        close() { this._open = false; }
      },
    },
    '../../input/InputBindings': loadModule('src/game/input/InputBindings.ts'),
    '../../rendering/GraphicsSettings': {
      graphicsSettings: { getState: () => ({ reducedMotion: true }) },
    },
  });

  const { ControlsSettings } = controlsMod;
  let closedCalled = false;
  const controlsInstance = new ControlsSettings(mockScene, () => { closedCalled = true; });

  assert.equal(controlsInstance.isOpen(), false, 'ControlsSettings initially closed');
  controlsInstance.open();
  assert.equal(controlsInstance.isOpen(), true, 'ControlsSettings opened');
  controlsInstance.close();
  assert.equal(controlsInstance.isOpen(), false, 'ControlsSettings closed');
  assert.equal(closedCalled, true, 'onClose callback executed');

  // Load PauseOverlay
  const pauseMod = loadModule('src/game/ui/PauseOverlay.ts', {
    phaser: mockPhaser,
    '../../data/config': { UI_DEPTH: 2000, W: 960, H: 540 },
    '../audio/AudioManager': {
      audioManager: {
        pauseMusic: () => {},
        resumeMusic: () => {},
        playCue: () => {},
      },
    },
    './design-tokens': loadModule('src/game/ui/design-tokens.ts'),
    './screens/ControlsSettings': { ControlsSettings },
  });

  const { PauseOverlay } = pauseMod;
  const pauseOverlay = new PauseOverlay(mockScene);

  assert.equal(pauseOverlay.isOpen(), false, 'PauseOverlay initially closed');
  pauseOverlay.open();
  assert.equal(pauseOverlay.isOpen(), true, 'PauseOverlay open sets isOpen true');
  assert.equal(mockScene.time.paused, true, 'Scene time is paused');

  pauseOverlay.close();
  assert.equal(pauseOverlay.isOpen(), false, 'PauseOverlay close sets isOpen false');
  assert.equal(mockScene.time.paused, false, 'Scene time resumed');

  pauseOverlay.destroy();
  controlsInstance.destroy();

  console.log('✓ Suite 8: ControlsSettings & PauseOverlay Integration Passed');
}

console.log('\n================================================================');
console.log('ALL 8 TEST SUITES IN CONTROLS MASTER MATRIX PASSED SUCCESSFULLY!');
console.log('================================================================');
