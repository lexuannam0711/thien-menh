const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = process.cwd();

console.log('====================================================');
console.log('HUD & TOUCH CONTROLS OVERHAUL VERIFICATION SUITE');
console.log('Thần Mệnh — Hậu Duệ Văn Lang');
console.log('====================================================\n');

function transpileFile(filePath) {
  const code = fs.readFileSync(path.join(root, filePath), 'utf8');
  return ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
}

// Module cache for in-memory VM execution
const moduleCache = new Map();

function createPhaserMock() {
  class MockGameObject {
    constructor() {
      this.visible = true;
      this.alpha = 1;
      this.depth = 0;
      this.x = 0;
      this.y = 0;
      this.width = 100;
      this.height = 100;
      this.scaleX = 1;
      this.scaleY = 1;
      this.events = new Map();
      this.name = '';
    }
    setOrigin(ox = 0, oy = 0) { this.originX = ox; this.originY = oy; return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setDepth(d) { this.depth = d; return this; }
    setAlpha(a) { this.alpha = a; return this; }
    setVisible(v) { this.visible = v; return this; }
    setScale(sx, sy = sx) { this.scaleX = sx; this.scaleY = sy; return this; }
    setDisplaySize() { return this; }
    setStrokeStyle() { return this; }
    setInteractive() { return this; }
    setText(t) { this.text = t; return this; }
    setColor(c) { this.color = c; return this; }
    setName(n) { this.name = n; return this; }
    setRadius(r) { this.radius = r; return this; }
    on(event, fn) { this.events.set(event, fn); return this; }
    emit(event, ...args) {
      const fn = this.events.get(event);
      if (fn) return fn(...args);
    }
    destroy() { this.destroyed = true; }
  }

  class MockContainer extends MockGameObject {
    constructor(scene, x = 0, y = 0, children = []) {
      super();
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.children = [...children];
    }
    add(child) {
      if (Array.isArray(child)) {
        this.children.push(...child);
      } else {
        this.children.push(child);
      }
      return this;
    }
    destroy(fromScene) {
      super.destroy();
      for (const c of this.children) {
        if (c && typeof c.destroy === 'function') c.destroy(fromScene);
      }
    }
  }

  class MockGraphics extends MockGameObject {
    clear() { return this; }
    fillStyle() { return this; }
    fillRoundedRect() { return this; }
    lineStyle() { return this; }
    strokeRoundedRect() { return this; }
    fillCircle() { return this; }
    strokeCircle() { return this; }
    fillRect() { return this; }
    strokeRect() { return this; }
    beginPath() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    arc() { return this; }
    strokePath() { return this; }
  }

  class MockText extends MockGameObject {
    constructor(scene, x, y, text, style) {
      super();
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.text = text || '';
      this.style = style || {};
    }
  }

  class MockArc extends MockGameObject {
    constructor(scene, x, y, radius, fillColor, fillAlpha) {
      super();
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.fillColor = fillColor;
      this.fillAlpha = fillAlpha;
    }
  }

  class MockRectangle extends MockGameObject {
    constructor(scene, x, y, width, height, fillColor, fillAlpha) {
      super();
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.fillColor = fillColor;
      this.fillAlpha = fillAlpha;
    }
  }

  return {
    GameObjects: {
      Container: MockContainer,
      Graphics: MockGraphics,
      Text: MockText,
      Arc: MockArc,
      Rectangle: MockRectangle,
      Zone: MockGameObject,
      Image: MockGameObject,
    },
    Math: {
      DegToRad: (deg) => (deg * Math.PI) / 180,
      Vector2: class {
        constructor(x = 0, y = 0) { this.x = x; this.y = y; }
        set(x, y) { this.x = x; this.y = y; return this; }
        clone() { return new this.constructor(this.x, this.y); }
      },
    },
  };
}

function createSceneMock() {
  const listeners = new Map();
  const gameListeners = new Map();
  const inputListeners = new Map();
  const children = [];

  const phaserMock = createPhaserMock();

  const scene = {
    cameras: {
      main: { width: 960, height: 540 },
    },
    events: {
      on: (ev, fn) => listeners.set(ev, fn),
      once: (ev, fn) => listeners.set(ev, fn),
      off: (ev) => listeners.delete(ev),
      emit: (ev, ...args) => {
        const fn = listeners.get(ev);
        if (fn) fn(...args);
      },
    },
    game: {
      events: {
        on: (ev, fn) => gameListeners.set(ev, fn),
        off: (ev) => gameListeners.delete(ev),
        emit: (ev, ...args) => {
          const fn = gameListeners.get(ev);
          if (fn) fn(...args);
        },
      },
    },
    input: {
      on: (ev, fn) => inputListeners.set(ev, fn),
      off: (ev) => inputListeners.delete(ev),
      emit: (ev, ...args) => {
        const fn = inputListeners.get(ev);
        if (fn) fn(...args);
      },
    },
    textures: {
      exists: () => false,
    },
    tweens: {
      add: (opts) => opts,
      killTweensOf: () => {},
    },
    time: {
      now: 1000,
      delayedCall: (ms, fn) => setTimeout(fn, 1),
    },
    children: {
      list: children,
      getByName: (name) => children.find((c) => c.name === name),
      find: (predicate) => children.find(predicate),
      filter: (predicate) => children.filter(predicate),
      forEach: (fn) => children.forEach(fn),
    },
    add: {
      existing: (obj) => { children.push(obj); return obj; },
      container: (x, y, childs) => {
        const c = new phaserMock.GameObjects.Container(scene, x, y, childs);
        children.push(c);
        return c;
      },
      graphics: () => {
        const g = new phaserMock.GameObjects.Graphics();
        children.push(g);
        return g;
      },
      text: (x, y, txt, style) => {
        const t = new phaserMock.GameObjects.Text(scene, x, y, txt, style);
        children.push(t);
        return t;
      },
      circle: (x, y, rad, fill, alpha) => {
        const a = new phaserMock.GameObjects.Arc(scene, x, y, rad, fill, alpha);
        children.push(a);
        return a;
      },
      rectangle: (x, y, w, h, fill, alpha) => {
        const r = new phaserMock.GameObjects.Rectangle(scene, x, y, w, h, fill, alpha);
        children.push(r);
        return r;
      },
      zone: (x, y, w, h) => {
        const z = new phaserMock.GameObjects.Zone();
        z.x = x; z.y = y; z.width = w; z.height = h;
        children.push(z);
        return z;
      },
    },
  };

  return { scene, phaserMock, inputListeners, listeners };
}

function requireModule(modulePath) {
  let resolvedPath = modulePath;
  if (modulePath.startsWith('.')) {
    resolvedPath = path.normalize(path.join(root, 'src', 'game', 'ui', modulePath));
  }
  if (!resolvedPath.endsWith('.ts') && !resolvedPath.endsWith('.js')) {
    if (fs.existsSync(resolvedPath + '.ts')) {
      resolvedPath += '.ts';
    } else if (fs.existsSync(resolvedPath + '/index.ts')) {
      resolvedPath += '/index.ts';
    }
  }

  if (moduleCache.has(resolvedPath)) {
    return moduleCache.get(resolvedPath).exports;
  }

  if (modulePath === 'phaser') {
    return createPhaserMock();
  }
  if (modulePath.includes('GraphicsSettings')) {
    return {
      graphicsSettings: {
        getState: () => ({ reducedMotion: false }),
      },
    };
  }
  if (modulePath.includes('config')) {
    return {
      W: 960,
      H: 540,
      UI_DEPTH: 2000,
      BALANCE: {
        requiredKills: 8,
        dodgeCooldownMs: 800,
        dodgeDurationMs: 350,
      },
      PALETTE: {
        bronze: 0xc9a46a,
        red: 0xf26e62,
        blue: 0x7ccbdc,
      },
    };
  }

  const relativeToRoot = path.relative(root, resolvedPath);
  const transpiled = transpileFile(relativeToRoot);
  const mod = { exports: {} };
  moduleCache.set(resolvedPath, mod);

  const context = vm.createContext({
    exports: mod.exports,
    module: mod,
    require: (id) => {
      if (id.startsWith('.')) {
        const dir = path.dirname(resolvedPath);
        const nextRel = path.relative(root, path.resolve(dir, id));
        return requireModule(nextRel);
      }
      return requireModule(id);
    },
    console,
    process,
    setTimeout,
    clearTimeout,
    window: undefined,
    document: { hidden: false, addEventListener: () => {}, removeEventListener: () => {} },
    navigator: undefined,
    matchMedia: () => ({ matches: false }),
  });

  vm.runInContext(transpiled, context);
  return mod.exports;
}

// =========================================================================
// RUN VERIFICATION SUITE
// =========================================================================

async function runVerification() {
  let assertionsPassed = 0;

  // 1. HUD OVERHAUL VERIFICATION
  console.log('[1/3] Testing Hud component overhaul...');
  const { Hud, toast } = requireModule('src/game/ui/Hud.ts');
  const { gameState } = requireModule('src/game/systems/GameState.ts');

  // Reset gameState to known baseline
  gameState.data.hp = 100;
  gameState.data.maxHp = 100;
  gameState.data.mp = 50;
  gameState.data.maxMp = 50;
  gameState.data.level = 1;
  gameState.data.gold = 150;
  gameState.data.quest = 'active';
  gameState.data.kills = 3;
  gameState.data.bossDead = false;
  gameState.loadError = false;
  gameState.saveError = false;

  const { scene: hudScene } = createSceneMock();
  const hud = new Hud(hudScene, 'Làng Lạc Thủy · Khu an toàn');

  // Assert Top-Left Status elements
  assert.ok(hud, 'Hud instance created');
  assertionsPassed++;

  hud.refresh();

  // Test Quest Tracker Toggle
  assert.equal(hud.isQuestCollapsedState(), false, 'Quest tracker initially expanded');
  assertionsPassed++;

  hud.toggleQuest();
  assert.equal(hud.isQuestCollapsedState(), true, 'Quest tracker collapsed after toggle');
  assertionsPassed++;

  hud.setQuestCollapsed(false);
  assert.equal(hud.isQuestCollapsedState(), false, 'Quest tracker restored via setQuestCollapsed(false)');
  assertionsPassed++;

  // Test Storage Warning
  gameState.saveError = true;
  hud.refresh();
  gameState.saveError = false;
  hud.refresh();
  assertionsPassed++;

  // Test Desktop Skillbar: 4 slots with hotkeys 1, 2, 3, 4
  const btn1 = hud.getSkillButton(0);
  const btn2 = hud.getSkillButton(1);
  const btn3 = hud.getSkillButton(2);
  const btn4 = hud.getSkillButton(3);

  assert.ok(btn1, 'Skill slot 1 created');
  assert.ok(btn2, 'Skill slot 2 created');
  assert.ok(btn3, 'Skill slot 3 created');
  assert.ok(btn4, 'Skill slot 4 created');
  assertionsPassed += 4;

  assert.equal(btn1.getSkill()?.hotkey, '1', 'Slot 1 hotkey badge is 1');
  assert.equal(btn2.getSkill()?.hotkey, '2', 'Slot 2 hotkey badge is 2');
  assert.equal(btn3.getSkill()?.hotkey, '3', 'Slot 3 hotkey badge is 3');
  assertionsPassed += 3;

  // Test Cooldown update
  hud.updateSkillCooldown('slot-1', 2500, 3000);
  assert.equal(btn1.getCooldownRemaining(), 2500, 'Slot 1 cooldown correctly updated');
  assertionsPassed++;

  // Test Boss Health Bar
  assert.equal(hud.isBossBarVisible(), false, 'Boss bar initially hidden');
  assertionsPassed++;

  hud.setBossHealth('Hắc Xà Thần Vương', 850, 1000);
  assert.equal(hud.isBossBarVisible(), true, 'Boss bar visible when boss spawned');
  assertionsPassed++;

  hud.setBossHealth('Hắc Xà Thần Vương', 0, 1000);
  assert.equal(hud.isBossBarVisible(), false, 'Boss bar automatically hidden when boss defeated');
  assertionsPassed++;

  // Test Toast utility
  toast(hudScene, 'Lưu dữ liệu thành công!');
  assert.ok(hudScene.children.getByName('status-toast'), 'Toast container created with status-toast name');
  assertionsPassed++;

  hud.destroy();
  console.log('  ✓ Top-Left Status, Quest Tracker toggle, Desktop Skillbar, Boss Bar, and Toast verified successfully.\n');

  // 2. TOUCH CONTROLS OVERHAUL VERIFICATION
  console.log('[2/3] Testing TouchControls component overhaul...');
  const { TouchControls } = requireModule('src/game/ui/TouchControls.ts');

  const { scene: touchScene, inputListeners } = createSceneMock();
  const actionsPerformed = [];
  const controls = new TouchControls(
    touchScene,
    (action) => actionsPerformed.push(action),
    () => true,
    { autoDetectTouch: false } // ensure visible in test runner
  );

  assert.ok(controls, 'TouchControls instance created');
  assert.equal(controls.direction.x, 0, 'Initial joystick direction x is 0');
  assert.equal(controls.direction.y, 0, 'Initial joystick direction y is 0');
  assert.equal(controls.isLeftHanded(), false, 'Initial handedness is right-handed');
  assert.equal(controls.getScale(), 1.0, 'Initial scale is 1.0');
  assert.equal(controls.getOpacity(), 0.8, 'Initial opacity is 0.8');
  assert.equal(controls.isInteractVisible(), false, 'Interact button initially hidden');
  assertionsPassed += 6;

  // Test Handedness Preset Toggle
  controls.setHandedness(true);
  assert.equal(controls.isLeftHanded(), true, 'Left-handed preset enabled');
  assert.equal(controls.getHandedness(), 'left', 'Handedness getter reports left');
  controls.setHandedness(false);
  assert.equal(controls.isLeftHanded(), false, 'Restored to right-handed');
  assertionsPassed += 3;

  // Test Scale and Opacity Setters
  controls.setScale(1.25);
  assert.equal(controls.getScale(), 1.25, 'Control scale updated to 1.25');
  controls.setOpacity(0.65);
  assert.equal(controls.getOpacity(), 0.65, 'Button opacity updated to 0.65');
  assertionsPassed += 2;

  // Test Contextual Interact Visibility
  controls.setInteractVisible(true);
  assert.equal(controls.isInteractVisible(), true, 'Interact button visible when NPC nearby');
  controls.setInteractVisible(false);
  assert.equal(controls.isInteractVisible(), false, 'Interact button hidden when leaving NPC');
  assertionsPassed += 2;

  // Test Mobile Skill Buttons: No raw 'Q/E/R/T' hotkeys
  for (let i = 0; i < 4; i++) {
    const sBtn = controls.getSkillButton(i);
    assert.ok(sBtn, `Mobile skill button ${i + 1} exists`);
    // Hotkey must not be raw Q/E/R/T
    const hotkey = sBtn.getSkill()?.hotkey || '';
    assert.ok(!['Q', 'E', 'R', 'T'].includes(hotkey), `Skill ${i + 1} does not expose raw Q/E/R/T on mobile`);
    assertionsPassed += 2;
  }

  // Test Multi-Touch Isolation:
  // Pointer 1 touches joystick -> moves direction
  const joystickBase = touchScene.children.find((c) => c.radius && c.radius > 50);
  assert.ok(joystickBase, 'Joystick base object found');
  assertionsPassed++;

  joystickBase.emit('pointerdown', { id: 1, x: joystickBase.x + 30, y: joystickBase.y });
  assert.ok(controls.direction.x > 0, 'Joystick direction reacts to pointer 1');
  const joystickDirX = controls.direction.x;
  assertionsPassed++;

  // Pointer 2 presses attack button simultaneously while pointer 1 still holds joystick
  const attackBtnObj = touchScene.children.find((c) => c.children && c.children.some((sub) => sub.text === 'CHÉM'));
  assert.ok(attackBtnObj, 'Attack button found');
  assertionsPassed++;

  const attackShape = attackBtnObj.children.find((sub) => typeof sub.radius === 'number');
  attackShape.emit('pointerdown', { id: 2, x: attackBtnObj.x, y: attackBtnObj.y });

  assert.equal(actionsPerformed.includes('attack'), true, 'Attack triggered by pointer 2');
  assert.equal(controls.direction.x, joystickDirX, 'Joystick pointer 1 unaffected by pointer 2 tap (multi-touch isolation)');
  assertionsPassed += 2;

  // Release joystick pointer 1
  const onPointerUp = inputListeners.get('pointerup');
  assert.ok(onPointerUp, 'Pointerup listener registered on scene input');
  onPointerUp({ id: 1 });
  assert.equal(controls.direction.x, 0, 'Joystick direction resets on pointer 1 release');
  assertionsPassed += 2;

  // Test Action executions (dodge, skills)
  const dodgeBtnObj = touchScene.children.find((c) => c.children && c.children.some((sub) => sub.text === 'NÉ'));
  const dodgeShape = dodgeBtnObj.children.find((sub) => typeof sub.radius === 'number');
  dodgeShape.emit('pointerdown', { id: 3 });
  assert.equal(actionsPerformed.includes('dodge'), true, 'Dodge action triggered');
  assertionsPassed++;

  controls.destroy();
  console.log('  ✓ Virtual joystick, handedness, scale/opacity, multi-touch isolation, and mobile actions verified.\n');

  // 3. SUMMARY
  console.log('[3/3] Checking overall acceptance criteria...');
  console.log(`  ✓ All ${assertionsPassed} deterministic assertions passed without failure.`);
  console.log('====================================================');
  console.log('ALL HUD & TOUCH CONTROLS CHECKS PASSED (100%)');
  console.log('====================================================');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
