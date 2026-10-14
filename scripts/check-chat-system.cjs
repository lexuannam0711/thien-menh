/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * Deterministic Test Suite for Chat System (ChatManager & ChatBox)
 *
 * Kiểm tra 3 tiêu chí nghiệm thu bắt buộc:
 * 1. ChatManager lọc ký tự độc hại, định dạng đúng tin nhắn theo các kênh (local, party, system).
 * 2. ChatManager kích hoạt rate limiting khi spam quá 3 tin trong 5 giây.
 * 3. ChatBox quản lý focus/blur, cách ly phím WASD, render tin nhắn và dọn dẹp DOM sạch sẽ khi destroy.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = process.cwd();

console.log('================================================================');
console.log('THAN MENH: CHAT SYSTEM VERIFICATION (M6 SOCIAL & SOCIAL SAFETY)');
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
    this.type = tagName.toLowerCase() === 'input' ? 'text' : '';
    this._value = '';
    this.maxLength = 200;
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
    this.scrollTop = 0;
    this.scrollHeight = 100;
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._value = String(val);
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
    if (!event.target) {
      event.target = this;
    }
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const fn of listeners) {
        if (event._stopImmediate) break;
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

  focus() {
    this.dispatchEvent({ type: 'focus', target: this });
  }

  blur() {
    this.dispatchEvent({ type: 'blur', target: this });
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
    this.activeElement = null;
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

class MockKeyboardEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.key = init.key || '';
    this.code = init.code || '';
    this.target = init.target || null;
    this.defaultPrevented = false;
    this._propagationStopped = false;
    this._stopImmediate = false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this._propagationStopped = true;
  }

  stopImmediatePropagation() {
    this._propagationStopped = true;
    this._stopImmediate = true;
  }

  get isPropagationStopped() {
    return this._propagationStopped;
  }

  get isImmediatePropagationStopped() {
    return this._stopImmediate;
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
      HTMLInputElement: MockElement,
      KeyboardEvent: MockKeyboardEvent,
      console,
      setTimeout,
      clearTimeout,
    };

    vm.runInNewContext(code, context);
    return mod.exports;
  }

  const chatManagerModule = requireModule(path.join(root, 'src', 'game', 'online', 'chatManager.ts'));
  const chatBoxModule = requireModule(path.join(root, 'src', 'game', 'ui', 'ChatBox.ts'));

  return {
    document: mockDoc,
    window: mockWin,
    ChatManager: chatManagerModule.ChatManager,
    ChatBox: chatBoxModule.ChatBox,
    MockKeyboardEvent,
  };
}

// ============================================================================
// 3. TEST RUNNER
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function runTest(testName, fn) {
  try {
    process.stdout.write(`• ${testName} ... `);
    fn();
    console.log('PASS');
    testsPassed++;
  } catch (err) {
    console.log('FAIL');
    console.error(`  Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    testsFailed++;
  }
}

// ============================================================================
// TEST 1: ChatManager lọc ký tự độc hại, định dạng đúng tin nhắn theo các kênh
// ============================================================================

runTest('Test 1.1: ChatManager loại bỏ thẻ HTML, chặn script injection và inline event handlers', () => {
  const env = createTestEnvironment();
  const manager = new env.ChatManager({ senderId: 'p1', senderName: 'Lạc Long Quân' });

  // 1. Chặn thẻ script và mã script bên trong
  const scriptPayload = '<script>alert("HACK_VĂN_LANG")</script>Hào khí non sông!';
  const cleanScript = manager.sanitizeText(scriptPayload);
  assert.equal(cleanScript.includes('<script>'), false, 'Không được chứa thẻ <script>');
  assert.equal(cleanScript.includes('alert'), false, 'Không được chứa nội dung script');
  assert.equal(cleanScript.includes('Hào khí non sông!'), true, 'Phải giữ lại nội dung văn bản an toàn');

  // 2. Chặn các thẻ HTML thông thường và inline event handler
  const htmlPayload = '<b style="color:red">Tướng quân</b> <img src="x" onerror="stealSecrets()" /> xuất trận';
  const cleanHtml = manager.sanitizeText(htmlPayload);
  assert.equal(cleanHtml.includes('<b>'), false, 'Không được chứa thẻ <b>');
  assert.equal(cleanHtml.includes('<img'), false, 'Không được chứa thẻ <img>');
  assert.equal(cleanHtml.includes('onerror'), false, 'Không được chứa thuộc tính onerror');
  assert.equal(cleanHtml.includes('stealSecrets'), false, 'Không được chứa handler độc hại');
  assert.equal(cleanHtml.includes('Tướng quân xuất trận'), true, 'Văn bản hợp lệ phải được giữ nguyên');

  // 3. Chặn pseudo protocol javascript:
  const jsPayload = '<a href="javascript:doExploit()">Bấm vào đây</a>';
  const cleanJs = manager.sanitizeText(jsPayload);
  assert.equal(cleanJs.includes('javascript:'), false, 'Không được chứa pseudo protocol javascript:');
  assert.equal(cleanJs.includes('Bấm vào đây'), true);
});

runTest('Test 1.2: ChatManager chống lộ PII (ẩn Email và Bearer/JWT access tokens)', () => {
  const env = createTestEnvironment();
  const manager = new env.ChatManager({ senderId: 'p1', senderName: 'Lạc Long Quân' });

  // 1. Ẩn email cá nhân
  const emailMsg = 'Gửi thư cho tôi tại tuong_quan@daiviet.vn hoặc hotro@thienmenh.com nhé!';
  const cleanEmail = manager.sanitizeText(emailMsg);
  assert.equal(cleanEmail.includes('tuong_quan@daiviet.vn'), false, 'Email 1 phải bị ẩn');
  assert.equal(cleanEmail.includes('hotro@thienmenh.com'), false, 'Email 2 phải bị ẩn');
  assert.equal(cleanEmail.includes('[EMAIL ĐÃ ẨN]'), true, 'Email phải được thay bằng [EMAIL ĐÃ ẨN]');

  // 2. Ẩn JWT Token
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  const jwtMsg = `Token đăng nhập của tôi là: ${jwt}`;
  const cleanJwt = manager.sanitizeText(jwtMsg);
  assert.equal(cleanJwt.includes(jwt), false, 'JWT token không được phép xuất hiện');
  assert.equal(cleanJwt.includes('[TOKEN ĐÃ ẨN]'), true, 'JWT token phải được thay thế bằng [TOKEN ĐÃ ẨN]');

  // 3. Ẩn Bearer token
  const bearerMsg = 'Header: Bearer eyJ987654321_secret_token_session';
  const cleanBearer = manager.sanitizeText(bearerMsg);
  assert.equal(cleanBearer.includes('Bearer [TOKEN ĐÃ ẨN]'), true, 'Bearer token phải được mask');

  // 4. Ẩn token dạng key=value
  const paramMsg = 'Truy cập secret=abc123456789 và apiKey: 987654321abcdef';
  const cleanParam = manager.sanitizeText(paramMsg);
  assert.equal(cleanParam.includes('secret=[TOKEN ĐÃ ẨN]'), true, 'Key secret=value phải được mask');
});

runTest('Test 1.3: ChatManager định dạng chuẩn tin nhắn theo các kênh (local, party, system)', () => {
  const env = createTestEnvironment();
  const manager = new env.ChatManager({ senderId: 'hero-1', senderName: 'Âu Cơ' });

  let receivedMessage = null;
  const unsub = manager.onMessage((msg) => {
    receivedMessage = msg;
  });

  // Kênh local
  const okLocal = manager.sendMessage('Chiến binh tập trung tại đền Hùng!', 'local');
  assert.equal(okLocal, true, 'Gửi tin nhắn local phải thành công');
  assert.ok(receivedMessage, 'onMessage phải được kích hoạt');
  assert.equal(receivedMessage.channel, 'local');
  assert.equal(receivedMessage.senderId, 'hero-1');
  assert.equal(receivedMessage.senderName, 'Âu Cơ');
  assert.equal(receivedMessage.text, 'Chiến binh tập trung tại đền Hùng!');
  assert.ok(typeof receivedMessage.timestamp === 'number');
  assert.ok(typeof receivedMessage.id === 'string');

  // Kênh party
  const okParty = manager.sendMessage('Cùng buff Giáp Thần nào!', 'party');
  assert.equal(okParty, true);
  assert.equal(receivedMessage.channel, 'party');
  assert.equal(receivedMessage.text, 'Cùng buff Giáp Thần nào!');

  // Kênh system (thông báo hệ thống)
  const sysMsg = manager.addSystemMessage('Sơn Tinh và Thủy Tinh bắt đầu giao chiến!');
  assert.equal(sysMsg.channel, 'system');
  assert.equal(sysMsg.senderId, 'system');
  assert.equal(sysMsg.senderName, 'Hệ thống');
  assert.equal(sysMsg.text, 'Sơn Tinh và Thủy Tinh bắt đầu giao chiến!');
  assert.equal(receivedMessage.channel, 'system');

  // Kiểm tra lọc danh sách tin nhắn theo kênh
  assert.equal(manager.getMessages('local').length, 1);
  assert.equal(manager.getMessages('party').length, 1);
  assert.equal(manager.getMessages('system').length, 1);
  assert.equal(manager.getMessages().length, 3);

  // Hủy đăng ký listener
  unsub();
  manager.sendMessage('Tin nhắn sau khi unsub', 'local');
  assert.equal(receivedMessage.text, 'Sơn Tinh và Thủy Tinh bắt đầu giao chiến!', 'Listener đã unsub không nhận tin mới');
});

// ============================================================================
// TEST 2: ChatManager kích hoạt rate limiting khi spam quá 3 tin trong 5 giây
// ============================================================================

runTest('Test 2.1: ChatManager kích hoạt rate limiting khi spam quá 3 tin trong 5 giây', () => {
  let virtualTime = 1000000;
  const env = createTestEnvironment();
  const manager = new env.ChatManager({
    senderId: 'spammer-01',
    senderName: 'Spam Bot',
    rateLimitMax: 3,
    rateLimitWindowMs: 5000,
    nowFn: () => virtualTime,
  });

  // Tin nhắn 1 (thời điểm 0s) -> Thành công
  const res1 = manager.sendMessage('Tin nhắn 1');
  assert.equal(res1, true, 'Tin nhắn 1 phải được chấp thuận');

  // Tin nhắn 2 (thời điểm 1s) -> Thành công
  virtualTime += 1000;
  const res2 = manager.sendMessage('Tin nhắn 2');
  assert.equal(res2, true, 'Tin nhắn 2 phải được chấp thuận');

  // Tin nhắn 3 (thời điểm 2s) -> Thành công
  virtualTime += 1000;
  const res3 = manager.sendMessage('Tin nhắn 3');
  assert.equal(res3, true, 'Tin nhắn 3 phải được chấp thuận');

  // Tin nhắn 4 (thời điểm 3s: đã gửi 3 tin trong 3s <= 5s) -> BỊ TỪ CHỐI
  virtualTime += 1000;
  const res4 = manager.sendMessage('Tin nhắn 4 bị spam');
  assert.equal(res4, false, 'Tin nhắn 4 phải bị từ chối do vượt quá rate limit');

  // Kiểm tra tin nhắn cảnh báo hệ thống tự động phát ra
  const lastMsg = manager.getLastMessage();
  assert.ok(lastMsg, 'Phải có tin nhắn cuối cùng');
  assert.equal(lastMsg.channel, 'system', 'Cảnh báo phải thuộc kênh system');
  assert.equal(
    lastMsg.text,
    'Bạn thao tác quá nhanh, vui lòng chờ...',
    'Nội dung cảnh báo rate limit phải chính xác'
  );

  // Tiến thời gian qua khỏi cửa sổ 5 giây (sau 5.5s so với tin 1)
  virtualTime += 5500;

  // Tin nhắn 5 -> Thành công trở lại
  const res5 = manager.sendMessage('Tin nhắn sau khi chờ');
  assert.equal(res5, true, 'Sau khi hết cooldown 5 giây, tin nhắn phải gửi thành công');
});

runTest('Test 2.2: ChatManager giới hạn bộ nhớ đệm (bounded buffer) tối đa 50-100 tin gần nhất', () => {
  const env = createTestEnvironment();
  const manager = new env.ChatManager({
    senderId: 'player-ram',
    senderName: 'Chiến Binh',
    maxMessages: 50,
  });

  // Thêm 70 thông báo hệ thống liên tục (không bị rate limit)
  for (let i = 1; i <= 70; i++) {
    manager.addSystemMessage(`Thông báo thứ ${i}`);
  }

  const messages = manager.getMessages();
  assert.equal(messages.length, 50, 'Số lượng tin nhắn lưu trữ không được vượt quá maxMessages = 50');
  assert.equal(messages[0].text, 'Thông báo thứ 21', 'Tin nhắn cũ nhất phải bị xoay vòng loại bỏ');
  assert.equal(messages[49].text, 'Thông báo thứ 70', 'Tin nhắn mới nhất phải nằm ở cuối danh sách');
});

// ============================================================================
// TEST 3: ChatBox quản lý focus/blur, cách ly phím WASD, render tin nhắn và dọn dẹp DOM
// ============================================================================

runTest('Test 3.1: ChatBox khởi tạo, render khung chat Văn Lang và quản lý focus/blur', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  container.id = 'game-ui-root';
  env.document.body.appendChild(container);

  const manager = new env.ChatManager({ senderId: 'p1', senderName: 'Thánh Gióng' });
  const chatBox = new env.ChatBox({
    container,
    chatManager: manager,
    collapsed: false,
  });

  // Kiểm tra trạng thái ban đầu
  assert.equal(chatBox.isMounted(), true, 'ChatBox phải được mount');
  assert.equal(chatBox.isFocused(), false, 'Ban đầu không được focus');
  assert.equal(chatBox.isInputFocused, false, 'Cờ isInputFocused ban đầu phải là false');

  const rootEl = container.querySelector('.tm-chatbox');
  assert.ok(rootEl, 'Phải có root element .tm-chatbox');
  assert.equal(rootEl.style.color, '#F5EBDD', 'Chữ phải có màu trắng ngà chuẩn Văn Lang');
  assert.ok(rootEl.querySelector('.tm-chatbox-header'), 'Phải có header');
  assert.ok(rootEl.querySelector('.tm-chatbox-messages'), 'Phải có khung messages');
  assert.ok(rootEl.querySelector('.tm-chatbox-input-area'), 'Phải có ô nhập input');

  const inputEl = rootEl.querySelector('.tm-chatbox-input');
  assert.ok(inputEl, 'Phải có input .tm-chatbox-input');

  // Kiểm tra Focus
  chatBox.focusInput();
  assert.equal(chatBox.isFocused(), true, 'isFocused() phải trả về true khi đã focus');
  assert.equal(chatBox.isInputFocused, true, 'isInputFocused phải là true');
  assert.equal(rootEl.getAttribute('data-focused'), 'true');

  // Kiểm tra Blur
  chatBox.blurInput();
  assert.equal(chatBox.isFocused(), false, 'isFocused() phải trả về false khi đã blur');
  assert.equal(chatBox.isInputFocused, false, 'isInputFocused phải là false');
  assert.equal(rootEl.getAttribute('data-focused'), 'false');
});

runTest('Test 3.2: Cách ly phím nhập liệu (WASD và phím kỹ năng 1-4 không bị leak ra ngoài)', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  const manager = new env.ChatManager();
  const chatBox = new env.ChatBox({ container, chatManager: manager });
  const inputEl = container.querySelector('.tm-chatbox-input');

  // Focus vào ô chat
  chatBox.focusInput();
  assert.equal(chatBox.isFocused(), true, 'ChatBox đang được focus');

  // Thử nghiệm các phím di chuyển và kỹ năng thường dùng trong game
  const keysToTest = [
    { key: 'w', code: 'KeyW' },
    { key: 'a', code: 'KeyA' },
    { key: 's', code: 'KeyS' },
    { key: 'd', code: 'KeyD' },
    { key: '1', code: 'Digit1' },
    { key: '2', code: 'Digit2' },
    { key: '3', code: 'Digit3' },
    { key: '4', code: 'Digit4' },
    { key: ' ', code: 'Space' },
  ];

  for (const { key, code } of keysToTest) {
    const keyEvent = new env.MockKeyboardEvent('keydown', { key, code, target: inputEl });
    inputEl.dispatchEvent(keyEvent);

    assert.equal(
      keyEvent.isPropagationStopped,
      true,
      `Phím [${code}] phải được stopPropagation khi gõ trong khung chat`
    );
    assert.equal(
      keyEvent.isImmediatePropagationStopped,
      true,
      `Phím [${code}] phải được stopImmediatePropagation để tránh leak vào Phaser`
    );
  }
});

runTest('Test 3.3: Nhập liệu phím Enter (gửi tin nhắn) và Escape (hủy bỏ / blur)', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  const manager = new env.ChatManager({ senderId: 'p1', senderName: 'An Dương Vương' });
  const chatBox = new env.ChatBox({ container, chatManager: manager });
  const inputEl = container.querySelector('.tm-chatbox-input');

  // 1. Nhập tin nhắn và bấm Enter
  chatBox.focusInput();
  inputEl.value = 'Bắn Nỏ Thần!';

  const enterEvent = new env.MockKeyboardEvent('keydown', { key: 'Enter', target: inputEl });
  inputEl.dispatchEvent(enterEvent);

  // Tin nhắn phải được gửi qua ChatManager
  assert.equal(manager.getLastMessage().text, 'Bắn Nỏ Thần!', 'Tin nhắn phải được gửi thành công');
  assert.equal(inputEl.value, '', 'Ô input phải được làm sạch sau khi gửi');
  assert.equal(chatBox.isFocused(), false, 'Sau khi bấm Enter, input phải tự động blur');

  // 2. Nhập nội dung nhưng bấm Escape để hủy
  chatBox.focusInput();
  inputEl.value = 'Nội dung chưa muốn gửi...';

  const escEvent = new env.MockKeyboardEvent('keydown', { key: 'Escape', target: inputEl });
  inputEl.dispatchEvent(escEvent);

  assert.equal(chatBox.isFocused(), false, 'Sau khi bấm Escape, input phải tự động blur');
  assert.equal(manager.getLastMessage().text, 'Bắn Nỏ Thần!', 'Escape không được phép gửi tin nhắn mới');
});

runTest('Test 3.4: Render tin nhắn trực quan và dọn dẹp DOM sạch sẽ khi destroy', () => {
  const env = createTestEnvironment();
  const container = env.document.createElement('div');
  env.document.body.appendChild(container);

  const manager = new env.ChatManager({ senderId: 'hero', senderName: 'Hai Bà Trưng' });
  const chatBox = new env.ChatBox({ container, chatManager: manager });

  // Phát 3 loại tin nhắn khác nhau
  manager.sendMessage('Tiến về Luy Lâu!', 'local');
  manager.sendMessage('Phù trợ tiền tuyến!', 'party');
  manager.addSystemMessage('Toàn quân đã sẵn sàng xuất kích!');

  const msgContainer = container.querySelector('.tm-chatbox-messages');
  const renderedMsgs = msgContainer.querySelectorAll('.tm-chatbox-msg');
  assert.equal(renderedMsgs.length, 3, 'Phải render đủ 3 dòng tin nhắn');

  // Kiểm tra nội dung render
  assert.equal(renderedMsgs[0].getAttribute('data-channel'), 'local');
  assert.equal(renderedMsgs[0].textContent.includes('[Cục bộ]'), true);
  assert.equal(renderedMsgs[0].textContent.includes('Hai Bà Trưng:'), true);
  assert.equal(renderedMsgs[0].textContent.includes('Tiến về Luy Lâu!'), true);

  assert.equal(renderedMsgs[1].getAttribute('data-channel'), 'party');
  assert.equal(renderedMsgs[1].textContent.includes('[Tổ đội]'), true);

  assert.equal(renderedMsgs[2].getAttribute('data-channel'), 'system');
  assert.equal(renderedMsgs[2].textContent.includes('[Hệ thống]'), true);

  // Đếm số lượng window keydown listener trước khi destroy
  const listenersBefore = env.window.getListenerCount('keydown');
  assert.ok(listenersBefore > 0, 'Phải có ít nhất 1 window keydown listener');

  // Thực thi destroy()
  chatBox.destroy();

  // Kiểm tra sau khi destroy
  assert.equal(container.children.length, 0, 'Phải dọn dẹp sạch toàn bộ DOM elements khỏi container');
  assert.equal(chatBox.isMounted(), false, 'isMounted() phải là false sau destroy');
  assert.equal(chatBox.isFocused(), false, 'isFocused() phải là false sau destroy');
  assert.equal(
    env.window.getListenerCount('keydown'),
    listenersBefore - 1,
    'Window keydown listener phải được gỡ bỏ sạch sẽ'
  );

  // Kiểm tra listener chatManager không còn gửi tin nhắn cho chatBox đã bị destroy
  manager.sendMessage('Tin nhắn sau khi hủy ChatBox', 'local');
  assert.equal(container.children.length, 0, 'Không được phát sinh lỗi hay DOM mồ côi');
});

// ============================================================================
// 4. SUMMARY
// ============================================================================

console.log('\n----------------------------------------------------------------');
console.log(`TOTAL TESTS: ${testsPassed + testsFailed} | PASSED: ${testsPassed} | FAILED: ${testsFailed}`);
console.log('----------------------------------------------------------------\n');

if (testsFailed > 0) {
  console.error('❌ CHAT SYSTEM VERIFICATION FAILED.');
  process.exit(1);
} else {
  console.log('✅ ALL CHAT SYSTEM TESTS PASSED CLEANLY.');
  process.exit(0);
}
