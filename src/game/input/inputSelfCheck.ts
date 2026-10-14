/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * inputSelfCheck: Bộ kiểm thử tất định (deterministic self-check) cho hệ thống Input Abstraction.
 */

import { ALL_GAME_ACTIONS, type GameAction } from './GameAction';
import {
  DEFAULT_KEY_BINDINGS,
  detectBindingConflicts,
  rebindAction,
  swapBindings,
  normalizeKeyCode,
} from './InputBindings';
import { InputContext, InputContextManager } from './InputContext';
import {
  getDefaultInputSettings,
  migrateAndNormalizeInputSettings,
  InputSettingsManager,
  type StorageLike,
} from './InputSettings';
import { KeyboardMouseAdapter } from './KeyboardMouseAdapter';
import { TouchAdapter, isTouchPointer } from './TouchAdapter';
import { InputManager } from './InputManager';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Input self-check assertion failed: ${message}`);
  }
}

function assertApprox(a: number, b: number, eps = 1e-4, message = ''): void {
  if (Math.abs(a - b) > eps) {
    throw new Error(`Assertion failed: expected ${a} approx ${b} (diff ${Math.abs(a - b)} > ${eps}) ${message}`);
  }
}

/**
 * 1. Kiểm tra default bindings chuẩn hóa:
 * - Kỹ năng 1-4 là Digit1..Digit4 (và Numpad1..Numpad4). Tuyệt đối không còn Q/E/R/T!
 * - Tấn công là MouseLeft và KeyJ.
 * - Né là Space.
 * - Vật phẩm nhanh 1-4 là Digit5..Digit8.
 */
function testDefaultBindings(): void {
  assert(DEFAULT_KEY_BINDINGS.SKILL_1.includes('Digit1'), 'SKILL_1 must include Digit1');
  assert(DEFAULT_KEY_BINDINGS.SKILL_1.includes('Numpad1'), 'SKILL_1 must include Numpad1');
  assert(DEFAULT_KEY_BINDINGS.SKILL_2.includes('Digit2'), 'SKILL_2 must include Digit2');
  assert(DEFAULT_KEY_BINDINGS.SKILL_3.includes('Digit3'), 'SKILL_3 must include Digit3');
  assert(DEFAULT_KEY_BINDINGS.SKILL_4.includes('Digit4'), 'SKILL_4 must include Digit4');

  // Tuyệt đối không còn Q/E/R/T trong default skills
  const legacyKeys = ['KeyQ', 'KeyE', 'KeyR', 'KeyT', 'Q', 'E', 'R', 'T'];
  for (const action of ['SKILL_1', 'SKILL_2', 'SKILL_3', 'SKILL_4'] as const) {
    for (const key of DEFAULT_KEY_BINDINGS[action]) {
      assert(!legacyKeys.includes(key), `${action} must NOT have legacy key ${key} in default`);
    }
  }

  assert(DEFAULT_KEY_BINDINGS.ATTACK.includes('MouseLeft'), 'ATTACK must include MouseLeft');
  assert(DEFAULT_KEY_BINDINGS.ATTACK.includes('KeyJ'), 'ATTACK must include KeyJ');
  assert(DEFAULT_KEY_BINDINGS.DODGE.includes('Space'), 'DODGE must include Space');

  assert(DEFAULT_KEY_BINDINGS.QUICK_ITEM_1.includes('Digit5'), 'QUICK_ITEM_1 must include Digit5');
  assert(DEFAULT_KEY_BINDINGS.QUICK_ITEM_2.includes('Digit6'), 'QUICK_ITEM_2 must include Digit6');
  assert(DEFAULT_KEY_BINDINGS.QUICK_ITEM_3.includes('Digit7'), 'QUICK_ITEM_3 must include Digit7');
  assert(DEFAULT_KEY_BINDINGS.QUICK_ITEM_4.includes('Digit8'), 'QUICK_ITEM_4 must include Digit8');

  assert(DEFAULT_KEY_BINDINGS.INVENTORY.includes('KeyB'), 'INVENTORY must include KeyB');
  assert(DEFAULT_KEY_BINDINGS.INVENTORY.includes('KeyI'), 'INVENTORY must include KeyI');
  assert(DEFAULT_KEY_BINDINGS.INVENTORY.includes('Tab'), 'INVENTORY must include Tab');
  assert(DEFAULT_KEY_BINDINGS.PAUSE.includes('Escape'), 'PAUSE must include Escape');

  // Kiểm tra không có xung đột nội tại trong cấu hình mặc định
  const conflicts = detectBindingConflicts(DEFAULT_KEY_BINDINGS);
  assert(conflicts.length === 0, `Default bindings must have 0 conflicts, got: ${JSON.stringify(conflicts)}`);
}

/**
 * 2. Kiểm tra migration cấu hình cũ:
 * Chuyển đổi an toàn từ Q/E/R/T sang 1/2/3/4; clamp các giá trị mobile/PC ngoài khoảng.
 */
function testDataMigration(): void {
  const legacyCandidate = {
    version: 1,
    bindings: {
      SKILL_1: ['KeyQ'],
      SKILL_2: ['KeyE'],
      SKILL_3: ['KeyR'],
      SKILL_4: ['KeyT'],
      ATTACK: ['KeyJ'],
    },
    mobile: {
      controlScale: 0.1,    // Quá nhỏ -> phải clamp lên 0.8
      buttonOpacity: 2.5,   // Quá lớn -> phải clamp xuống 1.0
      handedness: 'unknown',// Không hợp lệ -> fallback 'right'
    },
  };

  const migrated = migrateAndNormalizeInputSettings(legacyCandidate);

  assert(migrated.version === 2, 'Migrated settings must have version 2');
  assert(migrated.bindings.SKILL_1.includes('Digit1'), 'Legacy KeyQ must migrate to Digit1');
  assert(migrated.bindings.SKILL_2.includes('Digit2'), 'Legacy KeyE must migrate to Digit2');
  assert(migrated.bindings.SKILL_3.includes('Digit3'), 'Legacy KeyR must migrate to Digit3');
  assert(migrated.bindings.SKILL_4.includes('Digit4'), 'Legacy KeyT must migrate to Digit4');

  // Kiểm tra các action bị thiếu được tự động bổ sung
  assert(migrated.bindings.MOVE_UP.includes('KeyW'), 'Missing MOVE_UP must be restored from defaults');
  assert(migrated.bindings.QUICK_ITEM_1.includes('Digit5'), 'Missing QUICK_ITEM_1 must be restored');

  // Kiểm tra clamp mobile settings
  assert(migrated.mobile.controlScale === 0.8, 'controlScale 0.1 must be clamped to 0.8');
  assert(migrated.mobile.buttonOpacity === 1.0, 'buttonOpacity 2.5 must be clamped to 1.0');
  assert(migrated.mobile.handedness === 'right', 'invalid handedness must fallback to right');
}

/**
 * 3. Kiểm tra Remapping và Conflict Detection.
 */
function testRemappingAndConflicts(): void {
  const base = getDefaultInputSettings().bindings;

  // Gán phím mới: Đổi ATTACK sang KeyF (trùng với INTERACT)
  const rebindResult = rebindAction(base, 'ATTACK', 'KeyF', 0);
  assert(rebindResult.bindings.ATTACK[0] === 'KeyF', 'ATTACK slot 0 must be remapped to KeyF');
  assert(rebindResult.conflicts.includes('INTERACT'), 'rebindAction must detect conflict with INTERACT');

  const detected = detectBindingConflicts(rebindResult.bindings);
  assert(detected.length === 1, 'Should detect exactly 1 conflict');
  assert(detected[0].key === 'KeyF', 'Conflicting key must be KeyF');
  assert(detected[0].actions.includes('ATTACK') && detected[0].actions.includes('INTERACT'), 'Conflicting actions must be ATTACK and INTERACT');

  // Swap bindings: Hoán đổi SKILL_1 và SKILL_2
  const swapped = swapBindings(base, 'SKILL_1', 'SKILL_2');
  assert(swapped.SKILL_1.includes('Digit2'), 'SKILL_1 must receive Digit2 from SKILL_2');
  assert(swapped.SKILL_2.includes('Digit1'), 'SKILL_2 must receive Digit1 from SKILL_1');
}

/**
 * 4. Kiểm tra chuẩn hóa vector di chuyển (Vector Normalization khi đi chéo):
 * Khi W + D được giữ cùng lúc -> vector phải có độ dài đúng bằng 1.0.
 */
function testVectorNormalization(): void {
  const manager = new InputManager();

  // Đi chéo lên-phải: W + D
  manager.keyboardMouseAdapter.simulateKeyDown('KeyW');
  manager.keyboardMouseAdapter.simulateKeyDown('KeyD');

  const input = manager.update(16);
  const length = Math.hypot(input.moveX, input.moveY);
  assertApprox(length, 1.0, 1e-4, 'Diagonal vector length must be normalized to 1.0');
  assertApprox(input.moveX, Math.SQRT1_2, 1e-4, 'moveX should be 1/sqrt(2) approx 0.7071');
  assertApprox(input.moveY, -Math.SQRT1_2, 1e-4, 'moveY should be -1/sqrt(2) approx -0.7071');

  // Đi 1 hướng đơn: chỉ D
  manager.keyboardMouseAdapter.simulateKeyUp('KeyW');
  const singleInput = manager.update(16);
  assertApprox(singleInput.moveX, 1.0, 1e-4, 'Single right direction moveX should be 1.0');
  assertApprox(singleInput.moveY, 0.0, 1e-4, 'Single right direction moveY should be 0.0');

  // Thả hết
  manager.keyboardMouseAdapter.simulateKeyUp('KeyD');
  const zeroInput = manager.update(16);
  assertApprox(zeroInput.moveX, 0.0, 1e-4, 'Zero input moveX should be 0.0');
  assertApprox(zeroInput.moveY, 0.0, 1e-4, 'Zero input moveY should be 0.0');

  manager.cleanup();
}

/**
 * 5. Kiểm tra Priority của Context Stack & xử lý Escape:
 * GAMEPLAY = 0 < DIALOGUE = 1 < MENU = 2 < SETTINGS = 3 < MODAL = 4.
 */
function testInputContextPriorityAndEsc(): void {
  const contextManager = new InputContextManager('GAMEPLAY');
  assert(contextManager.peek() === 'GAMEPLAY', 'Initial context must be GAMEPLAY');
  assert(contextManager.isGameplayAllowed(), 'Gameplay must be allowed initially');

  // Push theo thứ tự ưu tiên
  contextManager.push(InputContext.DIALOGUE);
  assert(contextManager.peek() === 'DIALOGUE', 'Top should be DIALOGUE');
  assert(!contextManager.isGameplayAllowed(), 'Gameplay not allowed in DIALOGUE');

  contextManager.push(InputContext.MENU);
  assert(contextManager.peek() === 'MENU', 'Top should be MENU');

  contextManager.push(InputContext.SETTINGS);
  assert(contextManager.peek() === 'SETTINGS', 'Top should be SETTINGS');

  contextManager.push(InputContext.MODAL);
  assert(contextManager.peek() === 'MODAL', 'Top should be MODAL');

  // ESC Handling: Đóng từng tầng context một
  let esc = contextManager.handleEscape();
  assert(esc.handled && esc.closedContext === 'MODAL', '1st ESC must close MODAL');
  assert(contextManager.peek() === 'SETTINGS', 'Top should now be SETTINGS');

  esc = contextManager.handleEscape();
  assert(esc.handled && esc.closedContext === 'SETTINGS', '2nd ESC must close SETTINGS');

  esc = contextManager.handleEscape();
  assert(esc.handled && esc.closedContext === 'MENU', '3rd ESC must close MENU');

  esc = contextManager.handleEscape();
  assert(esc.handled && esc.closedContext === 'DIALOGUE', '4th ESC must close DIALOGUE');

  assert(contextManager.peek() === 'GAMEPLAY', 'Context stack should be back to GAMEPLAY');
  assert(contextManager.isGameplayAllowed(), 'Gameplay must be re-enabled');

  // ESC tại GAMEPLAY: không bị consume, trả về handled = false để mở Menu Tạm dừng
  esc = contextManager.handleEscape();
  assert(!esc.handled, 'ESC at GAMEPLAY level must NOT be handled by context stack');
  assert(contextManager.peek() === 'GAMEPLAY', 'GAMEPLAY root context cannot be popped');

  // Kiểm tra InputManager chặn movement và attack khi trong non-gameplay context
  const manager = new InputManager();
  manager.keyboardMouseAdapter.simulateKeyDown('KeyW');
  manager.keyboardMouseAdapter.simulateKeyDown('KeyJ'); // ATTACK

  manager.pushContext(InputContext.MODAL);
  const blockedInput = manager.update(16);
  assert(blockedInput.moveX === 0 && blockedInput.moveY === 0, 'Movement must be blocked in MODAL context');
  assert(!blockedInput.held.has('ATTACK'), 'ATTACK must not be held in MODAL context');

  manager.popContext();
  manager.keyboardMouseAdapter.simulateKeyDown('KeyW');
  manager.keyboardMouseAdapter.simulateKeyDown('KeyJ');
  const unblockedInput = manager.update(16);
  assert(unblockedInput.moveY < 0, 'Movement must be active once context is restored and keys pressed');
  assert(unblockedInput.held.has('ATTACK'), 'ATTACK must be active once context is restored and keys pressed');

  manager.cleanup();
}

/**
 * 6. Kiểm tra reset held state khi blur (mất focus).
 */
function testResetHeldStateOnBlur(): void {
  const manager = new InputManager();

  manager.keyboardMouseAdapter.simulateKeyDown('KeyW');
  manager.keyboardMouseAdapter.simulateKeyDown('KeyD');
  manager.keyboardMouseAdapter.simulateKeyDown('KeyJ'); // ATTACK
  manager.update(16);

  assert(manager.isActionHeld('MOVE_UP'), 'MOVE_UP should be held before blur');
  assert(manager.isActionHeld('ATTACK'), 'ATTACK should be held before blur');

  // Giả lập Window blur
  manager.keyboardMouseAdapter.simulateBlur();
  const postBlurInput = manager.update(16);

  assert(!manager.isActionHeld('MOVE_UP'), 'MOVE_UP must be cleared after blur');
  assert(!manager.isActionHeld('ATTACK'), 'ATTACK must be cleared after blur');
  assert(postBlurInput.moveX === 0 && postBlurInput.moveY === 0, 'Movement vector must reset to 0 after blur');

  manager.cleanup();
}

/**
 * 7. Kiểm tra Serialization/Deserialization & Resilience với Storage Mock & Corrupted JSON.
 */
function testSettingsSerializationAndCorruptedJson(): void {
  // Storage Mock hợp lệ
  const mockStore: Record<string, string> = {};
  const mockStorage: StorageLike = {
    getItem: (key) => mockStore[key] ?? null,
    setItem: (key, val) => { mockStore[key] = val; },
  };

  const settingsMgr = new InputSettingsManager(mockStorage);
  settingsMgr.update({
    pc: { mouseAiming: false, rightClickDodge: true, holdToRepeatAttack: true },
    mobile: { controlScale: 1.2, buttonOpacity: 0.9, handedness: 'left', floatingJoystick: true, buttonSpacing: 1.1 },
  }, mockStorage);

  // Khởi tạo manager mới từ storage mock để kiểm tra nạp lại
  const reloadedMgr = new InputSettingsManager(mockStorage);
  const reloaded = reloadedMgr.getSettings();
  assert(reloaded.pc.mouseAiming === false, 'mouseAiming should be false');
  assert(reloaded.pc.rightClickDodge === true, 'rightClickDodge should be true');
  assert(reloaded.mobile.handedness === 'left', 'handedness should be left');
  assertApprox(reloaded.mobile.controlScale, 1.2, 1e-4, 'controlScale should be 1.2');

  // Test Corrupted JSON trong storage: Không được crash, tự động fallback về mặc định
  mockStore['than-menh-controls-v2'] = '{"corrupted_json: [invalid...';
  const corruptedMgr = new InputSettingsManager(mockStorage);
  const recovered = corruptedMgr.getSettings();
  assert(recovered.version === 2, 'Must safely recover version 2 on corrupted JSON');
  assert(recovered.pc.mouseAiming === true, 'Must safely recover default mouseAiming');

  // Test Storage bị chặn hoàn toàn (ném Exception)
  const throwingStorage: StorageLike = {
    getItem: () => { throw new Error('QuotaExceeded or SecurityError'); },
    setItem: () => { throw new Error('Blocked'); },
  };
  const throwingMgr = new InputSettingsManager(throwingStorage);
  const fallback = throwingMgr.getSettings();
  assert(fallback.version === 2, 'Must gracefully handle throwing storage without crashing');
  assert(!throwingMgr.save(throwingStorage), 'save should return false gracefully on throwing storage');
}

/**
 * 8. Kiểm tra độc lập Pointer ID trong cảm ứng đa điểm (Multi-touch Isolation).
 */
function testMultiTouchIsolation(): void {
  const touch = new TouchAdapter(null, {
    handedness: 'right',
    controlScale: 1.0,
    buttonOpacity: 0.8,
    floatingJoystick: false,
    buttonSpacing: 1.0,
  });

  // Chạm Pointer 1 vào Joystick
  touch.onTouchStart(1, 109, 421);
  touch.onTouchMove(1, 150, 421); // Kéo sang phải
  let vector = touch.getMovementVector();
  assert(vector.x > 0, 'Joystick should detect right movement for Pointer 1');

  // Chạm Pointer 2 vào nút Tấn công (CHÉM) tại (847, 430)
  touch.onTouchStart(2, 847, 430);
  let touchInput = touch.update();
  assert(touchInput.held.has('ATTACK'), 'Pointer 2 must hold ATTACK');
  assert(touch.getMovementVector().x > 0, 'Pointer 2 must NOT cancel Pointer 1 joystick');

  // Nhả Pointer 2 (nút ATTACK)
  touch.onTouchEnd(2);
  touchInput = touch.update();
  assert(!touchInput.held.has('ATTACK'), 'Pointer 2 release must release ATTACK');
  assert(touchInput.released.has('ATTACK'), 'Pointer 2 release must emit released ATTACK');
  assert(touch.getMovementVector().x > 0, 'Releasing Pointer 2 must NOT cancel Pointer 1 joystick');

  // Nhả Pointer 1 (Joystick)
  touch.onTouchEnd(1);
  touchInput = touch.update();
  vector = touch.getMovementVector();
  assert(vector.x === 0 && vector.y === 0, 'Releasing Pointer 1 must reset joystick vector');

  touch.destroy();
}

/**
 * 9. Kiểm tra cách ly pointer type giữa chuột và cảm ứng (Pointer Type Isolation):
 * - isTouchPointer phân biệt chính xác chuột và cảm ứng.
 * - TouchAdapter gắn listeners vào scene nhưng bỏ qua con trỏ chuột (LMB),
 *   ngăn ngừa click chuột vào vùng phím ảo bị nhận nhầm thành SKILL hoặc DODGE.
 * - KeyboardMouseAdapter bỏ qua các game object đang ẩn hoặc có isTouchControl.
 */
function testPointerTypeIsolation(): void {
  // Test isTouchPointer helper
  assert(isTouchPointer({ wasTouch: false, pointerType: 'mouse' }) === false, 'Mouse pointer must not be touch');
  assert(isTouchPointer({ wasTouch: false, pointerType: 'pen' }) === false, 'Pen pointer must not be touch');
  assert(isTouchPointer({ event: { pointerType: 'mouse' } }) === false, 'Event pointerType mouse must not be touch');
  assert(isTouchPointer({ event: { type: 'mousedown' } }) === false, 'Event type mousedown must not be touch');

  assert(isTouchPointer({ wasTouch: true, pointerType: 'touch' }) === true, 'Touch pointer must be touch');
  assert(isTouchPointer({ event: { pointerType: 'touch' } }) === true, 'Event pointerType touch must be touch');
  assert(isTouchPointer({ event: { type: 'touchstart' } }) === true, 'Event type touchstart must be touch');
  assert(isTouchPointer(undefined) === true, 'Undefined pointer (synthetic/headless) defaults to true');
  assert(isTouchPointer({}) === true, 'Empty pointer object defaults to true');

  // Giả lập scene có input event emitter
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  const mockScene = {
    events: {
      once: () => {},
      on: () => {},
      off: () => {},
    },
    input: {
      on: (event: string, fn: (...args: unknown[]) => void) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      },
      off: (event: string, fn: (...args: unknown[]) => void) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter(cb => cb !== fn);
        }
      },
    },
  } as unknown as Phaser.Scene;

  const touch = new TouchAdapter(mockScene, {
    handedness: 'right',
    controlScale: 1.0,
    buttonOpacity: 0.8,
    floatingJoystick: false,
    buttonSpacing: 1.0,
  });

  const emitScene = (event: string, ...args: unknown[]) => {
    for (const fn of listeners[event] ?? []) {
      fn(...args);
    }
  };

  // Giả lập click chuột trái LMB vào vị trí của SKILL_1 (780, 354)
  emitScene('pointerdown', {
    id: 1,
    x: 780,
    y: 354,
    wasTouch: false,
    pointerType: 'mouse',
  });
  let state = touch.update();
  assert(!state.pressed.has('SKILL_1'), 'Mouse LMB click at (780, 354) must NOT trigger SKILL_1 in TouchAdapter');
  assert(!state.held.has('SKILL_1'), 'Mouse LMB click must NOT be held in TouchAdapter');

  // Giả lập chạm màn hình cảm ứng Touch vào vị trí của SKILL_1 (780, 354)
  emitScene('pointerdown', {
    id: 1,
    x: 780,
    y: 354,
    wasTouch: true,
    pointerType: 'touch',
  });
  state = touch.update();
  assert(state.pressed.has('SKILL_1'), 'Touch tap at (780, 354) MUST trigger SKILL_1 in TouchAdapter');
  assert(state.held.has('SKILL_1'), 'Touch tap must be held in TouchAdapter');

  // Nhả chạm cảm ứng
  emitScene('pointerup', {
    id: 1,
    wasTouch: true,
    pointerType: 'touch',
  });
  state = touch.update();
  assert(!state.held.has('SKILL_1'), 'Touch release must release SKILL_1');
  assert(state.released.has('SKILL_1'), 'Touch release must emit released SKILL_1');

  // Kiểm tra setEnabled(false) vô hiệu hóa adapter hoàn toàn
  touch.setEnabled(false);
  emitScene('pointerdown', {
    id: 2,
    x: 780,
    y: 354,
    wasTouch: true,
    pointerType: 'touch',
  });
  state = touch.update();
  assert(!state.pressed.has('SKILL_1'), 'TouchAdapter when disabled must NOT trigger any actions');

  touch.destroy();

  // Kiểm tra KeyboardMouseAdapter.isPointerOverUI bỏ qua isTouchControl và visible === false
  let hitObjects: Array<{ visible?: boolean; depth?: number; getData?: (k: string) => unknown }> = [];
  const kbScene = {
    events: { once: () => {}, on: () => {}, off: () => {} },
    input: {
      on: () => {},
      off: () => {},
      hitTestPointer: () => hitObjects,
    },
    cameras: {
      main: { getWorldPoint: (x: number, y: number) => ({ x, y }) },
    },
  } as unknown as Phaser.Scene;

  const kbAdapter = new KeyboardMouseAdapter(kbScene, DEFAULT_KEY_BINDINGS);

  // 1. Hit object là touch control -> Không được tính là UI hit
  hitObjects = [{
    visible: true,
    depth: 2000,
    getData: (k: string) => (k === 'isTouchControl' ? true : undefined),
  }];
  assert(!kbAdapter.isPointerOverUI({ x: 780, y: 354 }), 'Touch control object must NOT block mouse pointer in isPointerOverUI');

  // 2. Hit object có visible === false -> Không được tính là UI hit
  hitObjects = [{
    visible: false,
    depth: 2000,
    getData: () => undefined,
  }];
  assert(!kbAdapter.isPointerOverUI({ x: 780, y: 354 }), 'Invisible UI object must NOT block mouse pointer in isPointerOverUI');

  // 3. Hit object là UI thực tế (isUI = true, depth = 2000) -> Phải chặn
  hitObjects = [{
    visible: true,
    depth: 2000,
    getData: (k: string) => (k === 'isUI' ? true : undefined),
  }];
  assert(kbAdapter.isPointerOverUI({ x: 780, y: 354 }), 'Real UI object must block mouse pointer in isPointerOverUI');

  kbAdapter.destroy();
}

/**
 * Hàm điều phối toàn bộ test suite.
 */
export function runInputSelfCheck(): true {
  testDefaultBindings();
  testDataMigration();
  testRemappingAndConflicts();
  testVectorNormalization();
  testInputContextPriorityAndEsc();
  testResetHeldStateOnBlur();
  testSettingsSerializationAndCorruptedJson();
  testMultiTouchIsolation();
  testPointerTypeIsolation();
  return true;
}

export const runAllInputSelfChecks = runInputSelfCheck;
