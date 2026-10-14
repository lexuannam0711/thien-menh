/**
 * Deterministic Test Suite for PartyHUD & NetworkBadge UI Components
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Kiểm tra 4 tiêu chí nghiệm thu bắt buộc:
 * 1. NetworkBadge render đúng với các trạng thái khác nhau (online, offline, reconnecting) và unmount sạch sẽ.
 * 2. PartyHUD cập nhật danh sách thành viên khi có snapshot party mới (1 leader, 3 members, thanh máu).
 * 3. PartyHUD hiển thị modal mời tổ đội, xử lý click Đồng ý/Từ chối đúng contract.
 * 4. PartyHUD dọn dẹp đầy đủ không để lại rò rỉ listener hoặc DOM node mồ côi.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = process.cwd();

console.log('================================================================');
console.log('THAN MENH: PARTY HUD & NETWORK STATUS BADGE VERIFICATION');
console.log('================================================================\n');

// ============================================================================
// 1. LIGHTWEIGHT DETERMINISTIC DOM MOCK FOR NODE.JS TEST RUNNER
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
      } else if (el.tagName.toLowerCase() === selector.toLowerCase()) {
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
// 2. TRANSPILER & MODULE LOADER
// ============================================================================

const transpiledCodeCache = new Map();

function transpileCode(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  if (transpiledCodeCache.has(fullPath)) {
    return transpiledCodeCache.get(fullPath);
  }
  const code = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  transpiledCodeCache.set(fullPath, transpiled);
  return transpiled;
}

function createTestEnvironment() {
  const mockDoc = new MockDocument();
  const mockWin = new MockWindow();
  const localModuleCache = new Map();

  function requireModule(modPath, callerDir = path.join(root, 'src', 'game', 'ui')) {
    let resolved = modPath;
    if (modPath.startsWith('.')) {
      resolved = path.normalize(path.join(callerDir, modPath));
    }
    if (!resolved.endsWith('.ts') && !resolved.endsWith('.js')) {
      if (fs.existsSync(resolved + '.ts')) resolved += '.ts';
      else if (fs.existsSync(resolved + '.js')) resolved += '.js';
    }

    if (localModuleCache.has(resolved)) {
      return localModuleCache.get(resolved).exports;
    }

    if (modPath.includes('multiplayer') || modPath.includes('partyAdapter')) {
      return {};
    }

    const code = transpileCode(resolved);
    const mod = { exports: {} };
    localModuleCache.set(resolved, mod);

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
    };

    vm.runInNewContext(code, context);
    return mod.exports;
  }

  const networkBadgeModule = requireModule(path.join(root, 'src', 'game', 'ui', 'NetworkBadge.ts'));
  const partyHUDModule = requireModule(path.join(root, 'src', 'game', 'ui', 'PartyHUD.ts'));

  return {
    document: mockDoc,
    window: mockWin,
    NetworkBadge: networkBadgeModule.NetworkBadge,
    PartyHUD: partyHUDModule.PartyHUD,
  };
}

// ============================================================================
// 3. TEST SUITE
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function runTest(testName, fn) {
  try {
    process.stdout.write(`• ${testName} ... `);
    fn();
    console.log('PASS ✅');
    testsPassed++;
  } catch (err) {
    console.log('FAIL ❌');
    console.error(err);
    testsFailed++;
  }
}

console.log('--- BẮT ĐẦU CHẠY KIỂM THỬ ---');

// ----------------------------------------------------------------------------
// TEST 1: NetworkBadge render đúng với các trạng thái khác nhau và unmount sạch sẽ
// ----------------------------------------------------------------------------
runTest('Test 1: NetworkBadge render đúng với các trạng thái (online, offline, reconnecting) và unmount sạch sẽ', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  // 1. Tạo mock multiplayer adapter
  let stateListener = null;
  const mockMultiplayer = {
    onStateChange: (listener) => {
      stateListener = listener;
      return () => {
        stateListener = null;
      };
    },
  };

  const badge = new env.NetworkBadge({
    container,
    multiplayer: mockMultiplayer,
  });

  // Kiểm tra mount ban đầu (mặc định offline)
  assert.ok(badge.isMounted(), 'NetworkBadge phải ở trạng thái mounted');
  assert.equal(container.children.length, 1, 'Container phải chứa 1 element');

  let badgeEl = badge.getElement();
  assert.ok(badgeEl, 'Phải có DOM element');
  assert.ok(badgeEl.textContent.includes('⚪ Ngoại tuyến'), `Mặc định phải hiển thị '⚪ Ngoại tuyến', nhận được: ${badgeEl.textContent}`);

  // 2. Chuyển sang connected/online với latency 42ms
  stateListener({ status: 'connected', latencyMs: 42, configured: true });
  assert.ok(badgeEl.textContent.includes('🟢'), 'Phải có biểu tượng 🟢 khi online');
  assert.ok(badgeEl.textContent.includes('Trực tuyến'), 'Phải có chữ Trực tuyến');
  assert.ok(badgeEl.textContent.includes('42ms'), 'Phải hiển thị latency 42ms');
  assert.equal(badge.getStatus(), 'connected', 'Status phải là connected');
  assert.equal(badge.getLatency(), 42, 'Latency phải là 42');

  // 3. Chuyển sang connecting / reconnecting
  stateListener({ status: 'reconnecting', latencyMs: 0 });
  assert.ok(badgeEl.textContent.includes('🟡 Đang kết nối lại...'), `Phải hiển thị '🟡 Đang kết nối lại...', nhận được: ${badgeEl.textContent}`);
  assert.equal(badge.getStatus(), 'reconnecting');

  // 4. Chuyển về offline / disconnected
  stateListener({ status: 'disconnected', latencyMs: 0 });
  assert.ok(badgeEl.textContent.includes('⚪ Ngoại tuyến'), `Phải hiển thị '⚪ Ngoại tuyến' khi disconnected`);

  // 5. Kiểm tra unmount
  badge.unmount();
  assert.equal(badge.isMounted(), false, 'Phải là false sau khi unmount');
  assert.equal(container.children.length, 0, 'Container không còn chứa badge');

  // 6. Kiểm tra remount
  badge.mount(container);
  assert.equal(badge.isMounted(), true);
  assert.equal(container.children.length, 1);

  // 7. Kiểm tra destroy dọn dẹp listener
  badge.destroy();
  assert.equal(stateListener, null, 'multiplayer.onStateChange listener phải được dọn dẹp (unsubscribed)');
  assert.equal(container.children.length, 0, 'DOM element phải được gỡ bỏ khỏi container');
});

// ----------------------------------------------------------------------------
// TEST 2: PartyHUD cập nhật danh sách thành viên khi có snapshot party mới
// ----------------------------------------------------------------------------
runTest('Test 2: PartyHUD cập nhật danh sách thành viên khi có snapshot party mới (1 leader, 3 members, thanh máu)', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  let partyStateListener = null;
  const mockPartyAdapter = {
    onStateChange: (listener) => {
      partyStateListener = listener;
      return () => {
        partyStateListener = null;
      };
    },
  };

  let leaveCalled = false;
  const mockMultiplayer = {
    partyAdapter: mockPartyAdapter,
    sendPartyLeave: () => {
      leaveCalled = true;
    },
  };

  const hud = new env.PartyHUD({
    container,
    multiplayer: mockMultiplayer,
    partyAdapter: mockPartyAdapter,
  });

  assert.ok(hud.isMounted(), 'PartyHUD phải được mounted vào container');

  // Ban đầu chưa có party
  const hudEl = hud.getElement();
  assert.ok(hudEl.textContent.includes('⚔️ TỔ ĐỘI (0/4)'), 'Tiêu đề ban đầu phải là (0/4)');
  assert.ok(hudEl.textContent.includes('Chưa vào tổ đội'), 'Phải có thông báo chưa vào tổ đội');

  // Bắn snapshot tổ đội 4 thành viên (1 leader + 3 members)
  const partySnapshot = {
    partyId: 'van-lang-party-01',
    leaderId: 'player-leader',
    members: [
      { id: 'player-leader', name: 'Lạc Long Quân', hp: 1000, maxHp: 1000, isLeader: true, isOnline: true },
      { id: 'player-member-1', name: 'Âu Cơ', hp: 750, maxHp: 800, isLeader: false, isOnline: true },
      { id: 'player-member-2', name: 'Sơn Tinh', hp: 150, maxHp: 800, isLeader: false, isOnline: true }, // Máu thấp 18.75%
      { id: 'player-member-3', name: 'Thủy Tinh', hp: 600, maxHp: 600, isLeader: false, isOnline: false }, // Ngoại tuyến
    ],
  };

  partyStateListener(partySnapshot);

  // 1. Kiểm tra tiêu đề cập nhật
  assert.ok(hudEl.textContent.includes('⚔️ TỔ ĐỘI (4/4)'), 'Tiêu đề phải cập nhật thành (4/4)');

  // 2. Kiểm tra danh sách thẻ thành viên
  const memberCards = hudEl.querySelectorAll('.tm-party-member-card');
  assert.equal(memberCards.length, 4, 'Phải render đúng 4 thẻ thành viên');

  // 3. Kiểm tra Leader có vương miện 👑
  const leaderCard = memberCards[0];
  const crown = leaderCard.querySelector('.tm-party-leader-crown');
  assert.ok(crown, 'Leader phải có biểu tượng vương miện 👑');
  assert.equal(crown.textContent, '👑');
  assert.ok(leaderCard.textContent.includes('Lạc Long Quân'));

  // 4. Các thành viên khác không có vương miện
  assert.equal(memberCards[1].querySelector('.tm-party-leader-crown'), null, 'Member 1 không được có vương miện');
  assert.equal(memberCards[2].querySelector('.tm-party-leader-crown'), null, 'Member 2 không được có vương miện');
  assert.equal(memberCards[3].querySelector('.tm-party-leader-crown'), null, 'Member 3 không được có vương miện');

  // 5. Kiểm tra thanh máu và cảnh báo máu thấp
  const sonTinhCard = memberCards[2]; // 150 / 800 <= 30% -> danger đỏ
  const sonTinhHpFill = sonTinhCard.querySelector('.tm-party-hp-fill');
  assert.ok(sonTinhHpFill, 'Phải có thanh máu');
  assert.equal(sonTinhHpFill.style.background, '#E86D63', 'Sơn Tinh máu dưới 30% phải có màu đỏ danger');

  const auCoCard = memberCards[1]; // 750 / 800 = 93.75% -> success xanh
  const auCoHpFill = auCoCard.querySelector('.tm-party-hp-fill');
  assert.equal(auCoHpFill.style.background, '#8BC49B', 'Âu Cơ máu cao phải có màu xanh success');

  // 6. Kiểm tra trạng thái kết nối
  const thuyTinhCard = memberCards[3]; // Offline
  const thuyTinhNet = thuyTinhCard.querySelector('.tm-party-member-net');
  assert.equal(thuyTinhNet.textContent, '⚪', 'Thủy Tinh offline phải có icon ⚪');

  const auCoNet = auCoCard.querySelector('.tm-party-member-net');
  assert.equal(auCoNet.textContent, '🟢', 'Âu Cơ online phải có icon 🟢');

  // 7. Kiểm tra nút [RỜI ĐỘI]
  const leaveBtn = hudEl.querySelector('.tm-party-leave-btn');
  assert.ok(leaveBtn, 'Phải có nút [RỜI ĐỘI]');
  assert.equal(leaveBtn.style.display, 'block', 'Nút rời đội phải hiển thị');

  leaveBtn.click();
  assert.equal(leaveCalled, true, 'Click nút rời đội phải gọi multiplayer.sendPartyLeave()');

  hud.destroy();
});

// ----------------------------------------------------------------------------
// TEST 3: PartyHUD hiển thị modal mời tổ đội, xử lý click Đồng ý/Từ chối đúng contract
// ----------------------------------------------------------------------------
runTest('Test 3: PartyHUD hiển thị modal mời tổ đội, xử lý click Đồng ý/Từ chối đúng contract', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  let inviteListener = null;
  let acceptedInviteId = null;
  let declinedInviteId = null;

  const mockPartyAdapter = {
    onInviteReceived: (listener) => {
      inviteListener = listener;
      return () => {
        inviteListener = null;
      };
    },
  };

  const mockMultiplayer = {
    partyAdapter: mockPartyAdapter,
    sendPartyAccept: (id) => {
      acceptedInviteId = id;
    },
    sendPartyDecline: (id) => {
      declinedInviteId = id;
    },
  };

  const hud = new env.PartyHUD({
    container,
    multiplayer: mockMultiplayer,
    partyAdapter: mockPartyAdapter,
  });

  // 1. Nhận lời mời tổ đội từ 'An Dương Vương'
  const inviteData = {
    inviteId: 'inv-vualac-001',
    partyId: 'party-coloa',
    senderName: 'An Dương Vương',
  };

  inviteListener(inviteData);

  // Kiểm tra popup modal xuất hiện trong DOM
  let modal = container.querySelector('.tm-party-invite-modal') || env.document.body.querySelector('.tm-party-invite-modal');
  assert.ok(modal, 'Modal lời mời tổ đội phải xuất hiện trong DOM');
  assert.ok(
    modal.textContent.includes('Người chơi An Dương Vương mời bạn tham gia tổ đội.'),
    `Thông điệp mời phải đúng cú pháp, nhận được: ${modal.textContent}`
  );

  // 2. Click nút [ĐỒNG Ý]
  const acceptBtn = modal.querySelector('.tm-party-accept-btn');
  assert.ok(acceptBtn, 'Phải có nút [ĐỒNG Ý]');
  assert.equal(acceptBtn.textContent, 'ĐỒNG Ý');

  acceptBtn.click();
  assert.equal(acceptedInviteId, 'inv-vualac-001', 'Phải gọi multiplayer.sendPartyAccept đúng inviteId');
  assert.equal(container.querySelector('.tm-party-invite-modal'), null, 'Modal phải tự đóng sau khi click Đồng ý');

  // 3. Nhận lời mời thứ hai từ 'Trọng Thủy'
  const inviteData2 = {
    inviteId: 'inv-trieu-002',
    partyId: 'party-namhai',
    senderName: 'Trọng Thủy',
  };

  inviteListener(inviteData2);

  modal = container.querySelector('.tm-party-invite-modal') || env.document.body.querySelector('.tm-party-invite-modal');
  assert.ok(modal, 'Modal thứ hai phải xuất hiện trong DOM');
  assert.ok(modal.textContent.includes('Người chơi Trọng Thủy mời bạn tham gia tổ đội.'));

  // 4. Click nút [TỪ CHỐI]
  const declineBtn = modal.querySelector('.tm-party-decline-btn');
  assert.ok(declineBtn, 'Phải có nút [TỪ CHỐI]');
  assert.equal(declineBtn.textContent, 'TỪ CHỐI');

  declineBtn.click();
  assert.equal(declinedInviteId, 'inv-trieu-002', 'Phải gọi multiplayer.sendPartyDecline đúng inviteId');
  assert.equal(container.querySelector('.tm-party-invite-modal'), null, 'Modal phải tự đóng sau khi click Từ chối');

  hud.destroy();
});

// ----------------------------------------------------------------------------
// TEST 4: PartyHUD dọn dẹp đầy đủ không để lại rò rỉ listener hoặc DOM node mồ côi
// ----------------------------------------------------------------------------
runTest('Test 4: PartyHUD dọn dẹp đầy đủ không để lại rò rỉ listener hoặc DOM node mồ côi', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  let stateSubscribed = false;
  let inviteSubscribed = false;
  let eventSubscribed = false;

  const mockPartyAdapter = {
    onStateChange: () => {
      stateSubscribed = true;
      return () => {
        stateSubscribed = false;
      };
    },
    onInviteReceived: () => {
      inviteSubscribed = true;
      return () => {
        inviteSubscribed = false;
      };
    },
    onEvent: () => {
      eventSubscribed = true;
      return () => {
        eventSubscribed = false;
      };
    },
  };

  const hud = new env.PartyHUD({
    container,
    partyAdapter: mockPartyAdapter,
  });

  // Kiểm tra phím tắt 'P' để toggle
  assert.equal(hud.isCollapsed(), false, 'Mặc định HUD mở rộng');
  assert.equal(env.window.getListenerCount('keydown'), 1, 'Phải đăng ký keydown listener trên window');

  // Bấm phím 'P'
  env.window.dispatchEvent({ type: 'keydown', key: 'p', preventDefault: () => {} });
  assert.equal(hud.isCollapsed(), true, 'Phím P phải thu nhỏ HUD');

  // Bấm phím 'P' lần nữa
  env.window.dispatchEvent({ type: 'keydown', key: 'P', preventDefault: () => {} });
  assert.equal(hud.isCollapsed(), false, 'Phím P lần 2 phải mở rộng HUD');

  // Mở modal lời mời
  hud.showInviteModal({ inviteId: 'inv-leak-check', senderName: 'Tản Viên Sơn Thánh' });
  assert.ok(container.querySelector('.tm-party-invite-modal') || env.document.body.querySelector('.tm-party-invite-modal'), 'Modal phải đang tồn tại trong DOM');

  // Kiểm tra các adapter listeners đã được đăng ký
  assert.equal(stateSubscribed, true, 'State listener phải đang active');
  assert.equal(inviteSubscribed, true, 'Invite listener phải đang active');
  assert.equal(eventSubscribed, true, 'Event listener phải đang active');

  // Gọi destroy()
  hud.destroy();

  // 1. Kiểm tra listeners từ adapter đã được gỡ bỏ sạch sẽ
  assert.equal(stateSubscribed, false, 'State listener phải được hủy đăng ký (unsubscribed)');
  assert.equal(inviteSubscribed, false, 'Invite listener phải được hủy đăng ký');
  assert.equal(eventSubscribed, false, 'Event listener phải được hủy đăng ký');

  // 2. Kiểm tra window keydown listener đã được gỡ bỏ
  assert.equal(env.window.getListenerCount('keydown'), 0, 'Window keydown listener phải được dọn dẹp sạch sẽ (0 listeners)');

  // 3. Kiểm tra DOM nodes không bị rò rỉ mồ côi
  assert.equal(container.children.length, 0, 'Container phải hoàn toàn trống sau khi destroy');
  assert.equal(container.querySelector('.tm-party-hud'), null, 'PartyHUD element phải bị gỡ khỏi DOM');
  assert.equal(env.document.body.querySelector('.tm-party-invite-modal'), null, 'Modal element phải bị gỡ khỏi DOM');

  // 4. Instance state an toàn
  assert.equal(hud.getElement(), null, 'HUD element reference phải được null hóa');
  assert.equal(hud.getInviteModalElement(), null, 'Modal element reference phải được null hóa');
  assert.equal(hud.isMounted(), false, 'HUD phải ở trạng thái unmounted');
});

console.log('\n================================================================');
console.log(`KẾT QUẢ KIỂM THỬ: ${testsPassed} ĐẠT, ${testsFailed} THẤT BẠI`);
console.log('================================================================\n');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('TẤT CẢ CÁC BÀI KIỂM THỬ ĐÃ PASS THÀNH CÔNG! ✨');
  process.exit(0);
}
