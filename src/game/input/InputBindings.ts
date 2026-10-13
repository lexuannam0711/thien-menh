/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * InputBindings: Ánh xạ phím mặc định, chuẩn hóa mã phím, phát hiện xung đột và rebind.
 */

import type { GameAction } from './GameAction';

export type KeyBindingMap = Record<GameAction, string[]>;

export interface BindingConflict {
  key: string;
  actions: GameAction[];
}

export const MOUSE_BUTTON_CODES = Object.freeze({
  LEFT: 'MouseLeft',
  RIGHT: 'MouseRight',
  MIDDLE: 'MouseMiddle',
} as const);

/**
 * Cấu hình phím mặc định chuẩn:
 * - Di chuyển: WASD và mũi tên.
 * - Tấn công: Chuột trái (MouseLeft) và phím J.
 * - Né / Lướt: Phím Space (và RMB nếu bật trong cài đặt).
 * - Kỹ năng 1-4: Digit1..Digit4 và Numpad1..Numpad4 (Q/E/R/T tuyệt đối không còn là mặc định).
 * - Vật phẩm nhanh 1-4: Digit5..Digit8 (hỗ trợ Numpad5..Numpad8).
 * - Tương tác: F.
 * - Túi đồ: B, I, Tab.
 * - Nhiệm vụ: L.
 * - Bản đồ: M.
 * - Nhân vật: C.
 * - Bảng kỹ năng: K.
 * - Tạm dừng: Escape.
 */
export const DEFAULT_KEY_BINDINGS: Readonly<KeyBindingMap> = Object.freeze({
  MOVE_UP: ['KeyW', 'ArrowUp'],
  MOVE_DOWN: ['KeyS', 'ArrowDown'],
  MOVE_LEFT: ['KeyA', 'ArrowLeft'],
  MOVE_RIGHT: ['KeyD', 'ArrowRight'],
  ATTACK: ['MouseLeft', 'KeyJ'],
  DODGE: ['Space'],
  INTERACT: ['KeyF'],
  PAUSE: ['Escape'],
  INVENTORY: ['KeyB', 'KeyI', 'Tab'],
  QUEST_JOURNAL: ['KeyL'],
  CHARACTER: ['KeyC'],
  SKILL_TREE: ['KeyK'],
  MAP: ['KeyM'],
  SKILL_1: ['Digit1', 'Numpad1'],
  SKILL_2: ['Digit2', 'Numpad2'],
  SKILL_3: ['Digit3', 'Numpad3'],
  SKILL_4: ['Digit4', 'Numpad4'],
  QUICK_ITEM_1: ['Digit5', 'Numpad5'],
  QUICK_ITEM_2: ['Digit6', 'Numpad6'],
  QUICK_ITEM_3: ['Digit7', 'Numpad7'],
  QUICK_ITEM_4: ['Digit8', 'Numpad8'],
});

/**
 * Chuẩn hóa chuỗi phím sang mã phím tiêu chuẩn (KeyboardEvent.code hoặc Mouse code).
 */
export function normalizeKeyCode(raw: string): string {
  const code = raw.trim();
  if (!code) return '';
  const lower = code.toLowerCase();

  // Chuột
  if (lower === 'lmb' || lower === 'mouse0' || lower === 'leftclick' || lower === 'mouseleft' || code === '0') {
    return 'MouseLeft';
  }
  if (lower === 'rmb' || lower === 'mouse2' || lower === 'rightclick' || lower === 'mouseright' || code === '2') {
    return 'MouseRight';
  }
  if (lower === 'mmb' || lower === 'mouse1' || lower === 'middleclick' || lower === 'mousemiddle' || code === '1') {
    return 'MouseMiddle';
  }

  // Phím đặc biệt
  if (code === ' ' || lower === 'space' || lower === 'spacebar') return 'Space';
  if (lower === 'esc' || lower === 'escape') return 'Escape';
  if (lower === 'tab') return 'Tab';
  if (lower === 'enter' || lower === 'return') return 'Enter';

  // Phím chữ cái đơn: 'w' -> 'KeyW'
  if (/^[a-zA-Z]$/.test(code)) {
    return `Key${code.toUpperCase()}`;
  }

  // Phím số hàng trên đơn: '1' -> 'Digit1'
  if (/^[0-9]$/.test(code)) {
    return `Digit${code}`;
  }

  return code;
}

export function cloneBindings(source: KeyBindingMap): KeyBindingMap {
  const result = {} as KeyBindingMap;
  for (const action of Object.keys(source) as GameAction[]) {
    result[action] = [...source[action]];
  }
  return result;
}

/**
 * Phát hiện nếu 2 action bất kỳ được gán cùng 1 phím.
 */
export function detectBindingConflicts(bindings: KeyBindingMap): BindingConflict[] {
  const keyToActionMap = new Map<string, GameAction[]>();

  for (const action of Object.keys(bindings) as GameAction[]) {
    const keys = bindings[action] ?? [];
    for (const rawKey of keys) {
      const norm = normalizeKeyCode(rawKey);
      if (!norm) continue;
      const list = keyToActionMap.get(norm) ?? [];
      if (!list.includes(action)) {
        list.push(action);
      }
      keyToActionMap.set(norm, list);
    }
  }

  const conflicts: BindingConflict[] = [];
  for (const [key, actions] of keyToActionMap.entries()) {
    if (actions.length > 1) {
      conflicts.push({ key, actions });
    }
  }
  return conflicts;
}

/**
 * Tìm các hành động khác đang sử dụng chung mã phím targetKey.
 */
export function findConflictingActions(
  bindings: KeyBindingMap,
  targetAction: GameAction,
  targetKey: string
): GameAction[] {
  const normTarget = normalizeKeyCode(targetKey);
  if (!normTarget) return [];
  const conflicts: GameAction[] = [];

  for (const action of Object.keys(bindings) as GameAction[]) {
    if (action === targetAction) continue;
    const keys = bindings[action] ?? [];
    if (keys.some(k => normalizeKeyCode(k) === normTarget)) {
      conflicts.push(action);
    }
  }

  return conflicts;
}

/**
 * Gán phím mới cho một hành động, tự động chuẩn hóa và thông báo các action bị xung đột nếu có.
 */
export function rebindAction(
  bindings: KeyBindingMap,
  action: GameAction,
  newKey: string,
  slotIndex: number = 0
): { bindings: KeyBindingMap; conflicts: GameAction[] } {
  const next = cloneBindings(bindings);
  const normNew = normalizeKeyCode(newKey);
  const conflicts = findConflictingActions(next, action, normNew);

  const currentKeys = next[action] ? [...next[action]] : [];
  if (slotIndex >= 0 && slotIndex < currentKeys.length) {
    currentKeys[slotIndex] = normNew;
  } else {
    currentKeys.push(normNew);
  }
  next[action] = currentKeys;

  return { bindings: next, conflicts };
}

/**
 * Hoán đổi (swap) phím giữa 2 hành động.
 */
export function swapBindings(
  bindings: KeyBindingMap,
  actionA: GameAction,
  actionB: GameAction
): KeyBindingMap {
  const next = cloneBindings(bindings);
  const keysA = next[actionA] ? [...next[actionA]] : [];
  const keysB = next[actionB] ? [...next[actionB]] : [];
  next[actionA] = keysB;
  next[actionB] = keysA;
  return next;
}
