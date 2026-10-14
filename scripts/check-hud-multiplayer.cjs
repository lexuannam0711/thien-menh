#!/usr/bin/env node
/**
 * Deterministic Test Suite for Hud Multiplayer & Network Badge Integration
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Kiểm tra 3 tiêu chí nghiệm thu bắt buộc theo Master Prompt:
 * - Test 1: Kiểm tra Hud khởi tạo thành công cả NetworkBadge và PartyHUD.
 * - Test 2: Kiểm tra khi destroy() được gọi (hoặc scene shutdown/destroy),
 *           cả NetworkBadge và PartyHUD đều được unmount và giải phóng hoàn toàn,
 *           không có rò rỉ listener hay DOM node mồ côi.
 * - Test 3: Kiểm tra hoạt động an toàn ở môi trường offline / headless không có DOM thật (mock environment).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = process.cwd();

console.log('================================================================');
console.log('THẦN MỆNH: HUD MULTIPLAYER & NETWORK BADGE INTEGRATION QA SUITE');
console.log('================================================================\n');

// ============================================================================
// 1. LIGHTWEIGHT DETERMINISTIC DOM MOCK FOR TESTING
// ============================================================================

class MockStyle {
  constructor() {
    this._props = new Map();
  }
  setProperty(prop, val) {
    this._props.set(prop, String(val));
    this[prop] = String(val);
  }
  getPropertyValue(prop) {
    return this._props.get(prop) || '';
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.id = '';
    this.style = new Proxy(new MockStyle(), {
      set(target, prop, val) {
        target.setProperty(prop, val);
        return true;
      },
      get(target, prop) {
        if (prop in target) return target[prop];
        return target.getPropertyValue(prop);
      },
    });
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.eventListeners = new Map();
    this._textContent = '';
    this.onclick = null;
  }

  get firstChild() {
    return this.children[0] || null;
  }

  get textContent() {
    if (this.children.length === 0) {
      return this._textContent;
    }
    return this.children.map((c) => c.textContent).join('');
  }

  set textContent(val) {
    this._textContent = String(val);
    this.children = [];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
    if (name === 'id') this.id = String(value);
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  appendChild(child) {
    if (!child) return child;
    if (child.parentElement) {
      child.parentElement.removeChild(child);
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.removeChild(this);
    }
  }

  addEventListener(type, listener) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    if (this.eventListeners.has(type)) {
      this.eventListeners.get(type).delete(listener);
    }
  }

  dispatchEvent(event) {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const fn of listeners) {
        fn(event);
      }
    }
    if (event.type === 'click' && typeof this.onclick === 'function') {
      this.onclick(event);
    }
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results[0] || null;
  }

  querySelectorAll(selector) {
    const matched = [];
    const checkMatch = (el) => {
      if (!el) return false;
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        if (el.className && el.className.split(/\s+/).includes(cls)) return true;
      } else if (selector.startsWith('#')) {
        const id = selector.slice(1);
        if (el.id === id) return true;
      } else if (selector.startsWith('[')) {
        const attrMatch = selector.match(/\[([a-zA-Z0-9_-]+)(?:="?([^"\]]*)"?)?\]/);
        if (attrMatch) {
          const [, attrName, attrVal] = attrMatch;
          if (attrVal === undefined) {
            return el.attributes.has(attrName);
          }
          return el.getAttribute(attrName) === attrVal;
        }
      } else if (el.tagName && el.tagName.toLowerCase() === selector.toLowerCase()) {
        return true;
      }
      return false;
    };

    const traverse = (node) => {
      for (const child of node.children) {
        if (checkMatch(child)) {
          matched.push(child);
        }
        traverse(child);
      }
    };

    traverse(this);
    return matched;
  }
}

class MockDocument {
  constructor() {
    this.body = new MockElement('body');
    this.app = new MockElement('div');
    this.app.id = 'app';
    this.body.appendChild(this.app);
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  getElementById(id) {
    if (id === 'app') return this.app;
    return this.body.querySelector(`#${id}`);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
}

class MockWindow {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(listener);
    }
  }

  dispatchEvent(event) {
    const set = this.listeners.get(event.type);
    if (set) {
      for (const fn of set) {
        fn(event);
      }
    }
  }

  getListenerCount(type) {
    return this.listeners.get(type)?.size || 0;
  }
}

// ============================================================================
// 2. PHASER SCENE & OBJECTS MOCK
// ============================================================================

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
      this.destroyed = false;
      this.name = '';
    }
    setOrigin(ox = 0, oy = 0) { this.originX = ox; this.originY = oy; return this; }
    setPosition(x, y) { this.x = x; this.y = y; return this; }
    setDepth(d) { this.depth = d; return this; }
    setAlpha(a) { this.alpha = a; return this; }
    setVisible(v) { this.visible = v; return this; }
    setScale(sx, sy = sx) { this.scaleX = sx; this.scaleY = sy; return this; }
    setInteractive() { return this; }
    setText(t) { this.text = t; return this; }
    setColor(c) { this.color = c; return this; }
    setName(n) { this.name = n; return this; }
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
  }

  class MockText extends MockGameObject {
    constructor(scene, x, y, text, style) {
      super();
      this.text = text;
      this.style = style;
    }
  }

  class MockRectangle extends MockGameObject {
    constructor(scene, x, y, width, height, fillColor, fillAlpha) {
      super();
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.fillColor = fillColor;
      this.fillAlpha = fillAlpha;
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

  return {
    GameObjects: {
      Container: MockContainer,
      Graphics: MockGraphics,
      Text: MockText,
      Rectangle: MockRectangle,
      Arc: MockArc,
      Zone: MockGameObject,
    },
    Math: {
      DegToRad: (deg) => (deg * Math.PI) / 180,
    },
  };
}

function createSceneMock() {
  const listeners = new Map();
  const children = [];
  const phaserMock = createPhaserMock();

  const scene = {
    cameras: {
      main: { width: 960, height: 540 },
    },
    events: {
      on: (ev, fn) => {
        if (!listeners.has(ev)) listeners.set(ev, new Set());
        listeners.get(ev).add(fn);
      },
      once: (ev, fn) => {
        const wrapped = (...args) => {
          scene.events.off(ev, wrapped);
          fn(...args);
        };
        scene.events.on(ev, wrapped);
      },
      off: (ev, fn) => {
        if (listeners.has(ev)) {
          if (fn) listeners.get(ev).delete(fn);
          else listeners.delete(ev);
        }
      },
      emit: (ev, ...args) => {
        const set = listeners.get(ev);
        if (set) {
          for (const fn of Array.from(set)) {
            fn(...args);
          }
        }
      },
    },
    tweens: {
      add: (opts) => opts,
      killTweensOf: () => {},
    },
    time: {
      delayedCall: (ms, fn) => setTimeout(fn, 1),
    },
    textures: {
      exists: () => false,
    },
    children: {
      list: children,
      getByName: (name) => children.find((c) => c.name === name),
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
      rectangle: (x, y, w, h, fill, alpha) => {
        const r = new phaserMock.GameObjects.Rectangle(scene, x, y, w, h, fill, alpha);
        children.push(r);
        return r;
      },
      circle: (x, y, rad, fill, alpha) => {
        const a = new phaserMock.GameObjects.Arc(scene, x, y, rad, fill, alpha);
        children.push(a);
        return a;
      },
      zone: (x, y, w, h) => {
        const z = new phaserMock.GameObjects.Zone();
        z.x = x; z.y = y; z.width = w; z.height = h;
        children.push(z);
        return z;
      },
    },
  };

  return { scene, listeners, children };
}

// ============================================================================
// 3. CODE TRANSPILER & ENVIRONMENT BUILDERS
// ============================================================================

const codeCache = new Map();

function transpileCode(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  if (codeCache.has(fullPath)) {
    return codeCache.get(fullPath);
  }
  const code = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  codeCache.set(fullPath, transpiled);
  return transpiled;
}

function createDomEnvironment() {
  const mockDoc = new MockDocument();
  const mockWin = new MockWindow();
  const phaserMock = createPhaserMock();
  const moduleCache = new Map();

  function requireModule(modPath, callerDir = path.join(root, 'src', 'game', 'ui')) {
    let resolved = modPath;
    if (modPath.startsWith('.')) {
      resolved = path.normalize(path.join(callerDir, modPath));
    }
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
      if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
      else if (fs.existsSync(resolved + '.js')) resolved += '.js';
    }

    if (moduleCache.has(resolved)) {
      return moduleCache.get(resolved).exports;
    }

    if (modPath === 'phaser') {
      return phaserMock;
    }
    if (modPath.includes('config')) {
      return {
        UI_DEPTH: 2000,
        BALANCE: { requiredKills: 8 },
      };
    }
    if (modPath.includes('GameState')) {
      return {
        gameState: {
          data: {
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
            level: 1,
            gold: 100,
            quest: 'new',
            kills: 0,
            bossDead: false,
          },
          loadError: null,
          saveError: null,
        },
        getPlayerStats: () => ({ maxHp: 100, maxMp: 50 }),
      };
    }
    if (modPath.includes('ChapterWorld')) {
      return {
        getChapterWorldConfig: () => ({ bossName: 'Thủ Lĩnh Quái' }),
      };
    }
    if (modPath.includes('skills')) {
      return {
        getSkill: () => undefined,
      };
    }
    if (modPath.includes('GraphicsSettings')) {
      return {
        graphicsSettings: {
          getState: () => ({ reducedMotion: false }),
        },
      };
    }
    if (modPath.includes('multiplayer') || modPath.includes('partyAdapter')) {
      return {};
    }

    const code = transpileCode(resolved);
    const mod = { exports: {} };
    moduleCache.set(resolved, mod);

    const context = {
      exports: mod.exports,
      module: mod,
      require: (p) => requireModule(p, path.dirname(resolved)),
      document: mockDoc,
      window: mockWin,
      HTMLElement: MockElement,
      KeyboardEvent: class MockKeyboardEvent {
        constructor(type, init = {}) {
          this.type = type;
          this.key = init.key;
          this.code = init.code;
          this.target = init.target;
        }
        preventDefault() {}
      },
      console,
      setTimeout,
      clearTimeout,
      process,
    };

    vm.runInNewContext(code, context);
    return mod.exports;
  }

  const hudModule = requireModule(path.join(root, 'src', 'game', 'ui', 'Hud.ts'));
  const networkBadgeModule = requireModule(path.join(root, 'src', 'game', 'ui', 'NetworkBadge.ts'));
  const partyHUDModule = requireModule(path.join(root, 'src', 'game', 'ui', 'PartyHUD.ts'));

  return {
    document: mockDoc,
    window: mockWin,
    Hud: hudModule.Hud,
    NetworkBadge: networkBadgeModule.NetworkBadge,
    PartyHUD: partyHUDModule.PartyHUD,
  };
}

function createHeadlessEnvironment() {
  const phaserMock = createPhaserMock();
  const moduleCache = new Map();

  function requireModule(modPath, callerDir = path.join(root, 'src', 'game', 'ui')) {
    let resolved = modPath;
    if (modPath.startsWith('.')) {
      resolved = path.normalize(path.join(callerDir, modPath));
    }
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
      if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
      else if (fs.existsSync(resolved + '.js')) resolved += '.js';
    }

    if (moduleCache.has(resolved)) {
      return moduleCache.get(resolved).exports;
    }

    if (modPath === 'phaser') return phaserMock;
    if (modPath.includes('config')) return { UI_DEPTH: 2000, BALANCE: { requiredKills: 8 } };
    if (modPath.includes('GameState')) {
      return {
        gameState: {
          data: {
            hp: 100,
            maxHp: 100,
            mp: 50,
            maxMp: 50,
            level: 1,
            gold: 0,
            quest: 'new',
            kills: 0,
            bossDead: false,
          },
        },
        getPlayerStats: () => ({ maxHp: 100, maxMp: 50 }),
      };
    }
    if (modPath.includes('ChapterWorld')) return { getChapterWorldConfig: () => ({ bossName: 'Boss' }) };
    if (modPath.includes('skills')) return { getSkill: () => undefined };
    if (modPath.includes('GraphicsSettings')) return { graphicsSettings: { getState: () => ({ reducedMotion: false }) } };
    if (modPath.includes('multiplayer') || modPath.includes('partyAdapter')) return {};

    const code = transpileCode(resolved);
    const mod = { exports: {} };
    moduleCache.set(resolved, mod);

    const context = {
      exports: mod.exports,
      module: mod,
      require: (p) => requireModule(p, path.dirname(resolved)),
      document: undefined,
      window: undefined,
      console,
      setTimeout,
      clearTimeout,
      process,
    };

    vm.runInNewContext(code, context);
    return mod.exports;
  }

  const hudModule = requireModule(path.join(root, 'src', 'game', 'ui', 'Hud.ts'));
  return { Hud: hudModule.Hud };
}

// ============================================================================
// RUN VERIFICATION SUITE
// ============================================================================

let passedTests = 0;
let totalTests = 3;

// ----------------------------------------------------------------------------
// TEST 1: HUD KHỞI TẠO THÀNH CÔNG NETWORKBADGE & PARTYHUD
// ----------------------------------------------------------------------------
console.log('--- Test 1: Khởi tạo NetworkBadge & PartyHUD trong Hud ---');
{
  const env = createDomEnvironment();
  const { scene } = createSceneMock();

  const hud = new env.Hud(scene, 'Làng Lạc Thủy · Khu an toàn');

  // 1.1 Kiểm tra thuộc tính & instance
  const badge = hud.getNetworkBadge();
  const party = hud.getPartyHud();

  assert.ok(badge, 'Hud phải khởi tạo networkBadge');
  assert.ok(badge instanceof env.NetworkBadge, 'networkBadge phải là instance của NetworkBadge');
  assert.ok(party, 'Hud phải khởi tạo partyHud');
  assert.ok(party instanceof env.PartyHUD, 'partyHud phải là instance của PartyHUD');

  // 1.2 Kiểm tra mount vào DOM
  assert.equal(badge.isMounted(), true, 'networkBadge phải được mount vào DOM');
  assert.equal(party.isMounted(), true, 'partyHud phải được mount vào DOM');

  const badgeEl = env.document.getElementById('tm-network-badge');
  const partyEl = env.document.getElementById('tm-party-hud');

  assert.ok(badgeEl, 'DOM element #tm-network-badge phải tồn tại trong document');
  assert.ok(partyEl, 'DOM element #tm-party-hud phải tồn tại trong document');

  // 1.3 Kiểm tra trạng thái ban đầu mặc định (offline)
  assert.equal(badge.getStatus(), 'offline', 'NetworkBadge mặc định ở trạng thái offline');
  assert.ok(badgeEl.textContent.includes('Ngoại tuyến'), 'NetworkBadge phải hiển thị "Ngoại tuyến" khi offline');
  assert.ok(badgeEl.textContent.includes('⚪'), 'NetworkBadge phải có biểu tượng ⚪ khi offline');

  // 1.4 PartyHUD ban đầu gọn gàng (0 thành viên)
  assert.equal(party.getMembers().length, 0, 'PartyHUD ban đầu có 0 thành viên');
  assert.ok(partyEl.textContent.includes('TỔ ĐỘI (0/4)'), 'PartyHUD phải hiển thị tiêu đề TỔ ĐỘI (0/4)');

  console.log('✓ Test 1: Hud khởi tạo thành công cả NetworkBadge và PartyHUD với DOM mount đầy đủ.');
  passedTests++;
}

// ----------------------------------------------------------------------------
// TEST 2: LIFECYCLE DỌN DẸP SẠCH SẼ KHI DESTROY HOẶC SCENE SHUTDOWN
// ----------------------------------------------------------------------------
console.log('\n--- Test 2: Lifecycle dọn dẹp sạch sẽ, không rò rỉ listener hay DOM node ---');
{
  const env = createDomEnvironment();
  const { scene } = createSceneMock();

  const hud = new env.Hud(scene, 'Làng Lạc Thủy');

  const badgeEl = env.document.getElementById('tm-network-badge');
  const partyEl = env.document.getElementById('tm-party-hud');
  assert.ok(badgeEl && partyEl, 'Các phần tử DOM phải tồn tại trước khi destroy');

  // PartyHUD đăng ký keydown listener trên window
  assert.ok(env.window.getListenerCount('keydown') > 0, 'Window phải có listener keydown của PartyHUD');

  // 2.1 Gọi destroy() trực tiếp
  hud.destroy();

  // 2.2 Kiểm tra giải phóng thuộc tính
  assert.equal(hud.getNetworkBadge(), undefined, 'networkBadge phải được gán undefined sau destroy');
  assert.equal(hud.getPartyHud(), undefined, 'partyHud phải được gán undefined sau destroy');

  // 2.3 Kiểm tra unmount khỏi DOM
  assert.equal(badgeEl.parentElement, null, 'badgeEl phải được gỡ bỏ khỏi DOM cha');
  assert.equal(partyEl.parentElement, null, 'partyEl phải được gỡ bỏ khỏi DOM cha');
  assert.equal(env.document.getElementById('tm-network-badge'), null, '#tm-network-badge không còn trong DOM');
  assert.equal(env.document.getElementById('tm-party-hud'), null, '#tm-party-hud không còn trong DOM');

  // 2.4 Kiểm tra giải phóng event listener
  assert.equal(env.window.getListenerCount('keydown'), 0, 'Không được để lại listener keydown trên window');

  // 2.5 Kiểm tra tính idempotent (gọi destroy lần 2 không văng lỗi)
  assert.doesNotThrow(() => hud.destroy(), 'Gọi destroy() nhiều lần không được phát sinh lỗi');

  // 2.6 Kiểm tra Scene shutdown tự động kích hoạt destroy()
  const { scene: scene2 } = createSceneMock();
  const hud2 = new env.Hud(scene2, 'Chiến Trường Sơn Tinh');
  assert.ok(env.document.getElementById('tm-network-badge'), 'Instance 2 phải được mount');

  scene2.events.emit('shutdown');
  assert.equal(hud2.getNetworkBadge(), undefined, 'Scene shutdown phải tự động dọn dẹp networkBadge');
  assert.equal(hud2.getPartyHud(), undefined, 'Scene shutdown phải tự động dọn dẹp partyHud');
  assert.equal(env.document.getElementById('tm-network-badge'), null, 'Scene shutdown phải unmount DOM node');

  // 2.7 Kiểm tra Scene destroy event tự động kích hoạt
  const { scene: scene3 } = createSceneMock();
  const hud3 = new env.Hud(scene3, 'Hang Quỷ');
  assert.ok(env.document.getElementById('tm-network-badge'), 'Instance 3 phải được mount');

  scene3.events.emit('destroy');
  assert.equal(hud3.getNetworkBadge(), undefined, 'Scene destroy event phải tự động dọn dẹp networkBadge');
  assert.equal(env.document.getElementById('tm-network-badge'), null, 'Scene destroy event phải unmount DOM node');

  console.log('✓ Test 2: destroy() và scene shutdown/destroy giải phóng toàn bộ DOM node, listeners và containers.');
  passedTests++;
}

// ----------------------------------------------------------------------------
// TEST 3: HOẠT ĐỘNG AN TOÀN TRONG MÔI TRƯỜNG HEADLESS / OFFLINE (KHÔNG CÓ DOM THẬT)
// ----------------------------------------------------------------------------
console.log('\n--- Test 3: Hoạt động an toàn trong môi trường Headless / Offline ---');
{
  const headlessEnv = createHeadlessEnvironment();
  const { scene } = createSceneMock();

  let headlessHud;
  assert.doesNotThrow(() => {
    headlessHud = new headlessEnv.Hud(scene, 'Môi Trường Thử Nghiệm Tách Biệt');
  }, 'Khởi tạo Hud trong môi trường headless không có DOM thật không được văng lỗi');

  assert.ok(headlessHud, 'Hud phải được khởi tạo thành công trong headless');

  // 3.1 Kiểm tra trạng thái offline & an toàn
  const badge = headlessHud.getNetworkBadge();
  const party = headlessHud.getPartyHud();

  assert.ok(badge, 'NetworkBadge vẫn được khởi tạo an toàn ở headless');
  assert.equal(badge.getStatus(), 'offline', 'NetworkBadge phải ở trạng thái offline');

  assert.ok(party, 'PartyHUD vẫn được khởi tạo an toàn ở headless');
  assert.equal(party.getMembers().length, 0, 'PartyHUD rỗng khi offline');

  // 3.2 Refresh cycle an toàn
  assert.doesNotThrow(() => {
    headlessHud.refresh();
  }, 'Hud.refresh() phải an toàn trong môi trường headless');

  // 3.3 Boss bar & quest toggle an toàn
  assert.doesNotThrow(() => {
    headlessHud.toggleQuest();
    headlessHud.setBossHealth('Trâu Điên Văn Lang', 50, 100);
    headlessHud.setBossHealth(null);
  }, 'Các phương thức Hud UI phải chạy mượt mà không có DOM thật');

  // 3.4 Destroy trong headless
  assert.doesNotThrow(() => {
    headlessHud.destroy();
  }, 'destroy() trong môi trường headless không được phát sinh lỗi');

  assert.equal(headlessHud.getNetworkBadge(), undefined, 'networkBadge được reset thành công');
  assert.equal(headlessHud.getPartyHud(), undefined, 'partyHud được reset thành công');

  console.log('✓ Test 3: Hoạt động bền vững, an toàn 100% trong môi trường headless/offline không có DOM thật.');
  passedTests++;
}

// ============================================================================
// TỔNG KẾT
// ============================================================================
console.log('\n================================================================');
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TIÊU CHÍ ĐẠT YÊU CẦU`);
console.log('TẤT CẢ KIỂM THỬ HUD MULTIPLAYER INTEGRATION ĐÃ PASS THÀNH CÔNG! ✨');
console.log('================================================================');
process.exit(0);
