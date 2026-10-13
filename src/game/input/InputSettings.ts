/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * InputSettings: Quản lý cấu hình điều khiển người dùng, di chuyển cấu hình cũ (migration)
 * và lưu trữ localStorage an toàn, chống crash.
 */

import { ALL_GAME_ACTIONS, type GameAction } from './GameAction';
import {
  DEFAULT_KEY_BINDINGS,
  cloneBindings,
  normalizeKeyCode,
  rebindAction,
  type KeyBindingMap,
} from './InputBindings';

export const CONTROLS_STORAGE_KEY = 'than-menh-controls-v2';
export const LEGACY_STORAGE_KEYS = ['than-menh-controls-v1', 'than-menh-controls'] as const;

export interface PcInputSettings {
  mouseAiming: boolean;        // Mặc định: true
  rightClickDodge: boolean;    // Mặc định: false
  holdToRepeatAttack: boolean; // Mặc định: false
}

export interface MobileInputSettings {
  handedness: 'right' | 'left'; // Mặc định: 'right'
  controlScale: number;         // 0.8 .. 1.4, default: 1.0
  buttonOpacity: number;        // 0.4 .. 1.0, default: 0.8
  floatingJoystick: boolean;    // default: false
  buttonSpacing: number;        // default: 1.0
}

export interface InputSettingsData {
  version: number;
  bindings: KeyBindingMap;
  pc: PcInputSettings;
  mobile: MobileInputSettings;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const DEFAULT_PC_SETTINGS: Readonly<PcInputSettings> = Object.freeze({
  mouseAiming: true,
  rightClickDodge: false,
  holdToRepeatAttack: false,
});

export const DEFAULT_MOBILE_SETTINGS: Readonly<MobileInputSettings> = Object.freeze({
  handedness: 'right',
  controlScale: 1.0,
  buttonOpacity: 0.8,
  floatingJoystick: false,
  buttonSpacing: 1.0,
});

export function getDefaultInputSettings(): InputSettingsData {
  return {
    version: 2,
    bindings: cloneBindings(DEFAULT_KEY_BINDINGS),
    pc: { ...DEFAULT_PC_SETTINGS },
    mobile: { ...DEFAULT_MOBILE_SETTINGS },
  };
}

export function getSafeLocalStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Môi trường iframe sandboxed hoặc cấm storage
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Kiểm tra xem danh sách phím có chứa phím di sản (legacy) Q, E, R, T hay không.
 */
function hasLegacyKey(keys: string[] | undefined, targetLegacy: string): boolean {
  if (!keys || !Array.isArray(keys)) return false;
  const legacyNorm = normalizeKeyCode(targetLegacy);
  return keys.some(k => {
    const norm = normalizeKeyCode(k);
    return norm === legacyNorm || norm === targetLegacy;
  });
}

/**
 * Chuẩn hóa và di chuyển (migration) dữ liệu cài đặt từ phiên bản cũ sang format chuẩn v2.
 */
export function migrateAndNormalizeInputSettings(candidate: unknown): InputSettingsData {
  const defaults = getDefaultInputSettings();
  if (!candidate || typeof candidate !== 'object') {
    return defaults;
  }

  const raw = candidate as Record<string, unknown>;
  const rawBindings = (raw.bindings && typeof raw.bindings === 'object')
    ? (raw.bindings as Record<string, unknown>)
    : raw; // Hỗ trợ cả trường hợp v1 lưu trực tiếp map action -> keys

  const migratedBindings: KeyBindingMap = cloneBindings(DEFAULT_KEY_BINDINGS);

  // Đọc và chuẩn hóa từng action
  for (const action of ALL_GAME_ACTIONS) {
    const rawList = rawBindings[action];
    if (Array.isArray(rawList) && rawList.length > 0) {
      const sanitized = rawList
        .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        .map(normalizeKeyCode);
      if (sanitized.length > 0) {
        migratedBindings[action] = sanitized;
      }
    }
  }

  // MIGRATION ĐẶC BIỆT: Q/E/R/T -> 1/2/3/4
  // Nếu SKILL_1 có KeyQ / Q -> đổi sang Digit1
  if (hasLegacyKey(migratedBindings.SKILL_1, 'KeyQ')) {
    migratedBindings.SKILL_1 = ['Digit1', 'Numpad1'];
  }
  if (hasLegacyKey(migratedBindings.SKILL_2, 'KeyE')) {
    migratedBindings.SKILL_2 = ['Digit2', 'Numpad2'];
  }
  if (hasLegacyKey(migratedBindings.SKILL_3, 'KeyR')) {
    migratedBindings.SKILL_3 = ['Digit3', 'Numpad3'];
  }
  if (hasLegacyKey(migratedBindings.SKILL_4, 'KeyT')) {
    migratedBindings.SKILL_4 = ['Digit4', 'Numpad4'];
  }

  // Đọc PC settings
  const rawPc = (raw.pc && typeof raw.pc === 'object') ? (raw.pc as Record<string, unknown>) : {};
  const pc: PcInputSettings = {
    mouseAiming: typeof rawPc.mouseAiming === 'boolean' ? rawPc.mouseAiming : DEFAULT_PC_SETTINGS.mouseAiming,
    rightClickDodge: typeof rawPc.rightClickDodge === 'boolean' ? rawPc.rightClickDodge : DEFAULT_PC_SETTINGS.rightClickDodge,
    holdToRepeatAttack: typeof rawPc.holdToRepeatAttack === 'boolean' ? rawPc.holdToRepeatAttack : DEFAULT_PC_SETTINGS.holdToRepeatAttack,
  };

  // Đọc Mobile settings
  const rawMobile = (raw.mobile && typeof raw.mobile === 'object') ? (raw.mobile as Record<string, unknown>) : {};
  const handedness: 'right' | 'left' = rawMobile.handedness === 'left' ? 'left' : 'right';
  const controlScale = typeof rawMobile.controlScale === 'number'
    ? clamp(rawMobile.controlScale, 0.8, 1.4)
    : DEFAULT_MOBILE_SETTINGS.controlScale;
  const buttonOpacity = typeof rawMobile.buttonOpacity === 'number'
    ? clamp(rawMobile.buttonOpacity, 0.4, 1.0)
    : DEFAULT_MOBILE_SETTINGS.buttonOpacity;
  const floatingJoystick = typeof rawMobile.floatingJoystick === 'boolean'
    ? rawMobile.floatingJoystick
    : DEFAULT_MOBILE_SETTINGS.floatingJoystick;
  const buttonSpacing = typeof rawMobile.buttonSpacing === 'number'
    ? clamp(rawMobile.buttonSpacing, 0.5, 2.0)
    : DEFAULT_MOBILE_SETTINGS.buttonSpacing;

  const mobile: MobileInputSettings = {
    handedness,
    controlScale,
    buttonOpacity,
    floatingJoystick,
    buttonSpacing,
  };

  return {
    version: 2,
    bindings: migratedBindings,
    pc,
    mobile,
  };
}

export class InputSettingsManager {
  private currentSettings: InputSettingsData;

  constructor(storage?: StorageLike | null) {
    this.currentSettings = this.load(storage);
  }

  getSettings(): InputSettingsData {
    return {
      version: this.currentSettings.version,
      bindings: cloneBindings(this.currentSettings.bindings),
      pc: { ...this.currentSettings.pc },
      mobile: { ...this.currentSettings.mobile },
    };
  }

  load(storage?: StorageLike | null): InputSettingsData {
    const store = storage !== undefined ? storage : getSafeLocalStorage();
    if (!store) {
      this.currentSettings = getDefaultInputSettings();
      return this.getSettings();
    }

    try {
      // 1. Thử đọc từ key v2
      let raw = store.getItem(CONTROLS_STORAGE_KEY);
      if (raw) {
        this.currentSettings = migrateAndNormalizeInputSettings(JSON.parse(raw));
        return this.getSettings();
      }

      // 2. Thử fallback các legacy keys
      for (const legacyKey of LEGACY_STORAGE_KEYS) {
        raw = store.getItem(legacyKey);
        if (raw) {
          this.currentSettings = migrateAndNormalizeInputSettings(JSON.parse(raw));
          // Tự động nâng cấp lên CONTROLS_STORAGE_KEY
          this.save(store);
          return this.getSettings();
        }
      }
    } catch {
      // JSON hỏng hoặc storage bị chặn -> fallback mặc định an toàn
    }

    this.currentSettings = getDefaultInputSettings();
    return this.getSettings();
  }

  save(storage?: StorageLike | null): boolean {
    const store = storage !== undefined ? storage : getSafeLocalStorage();
    if (!store) return false;

    try {
      store.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(this.currentSettings));
      return true;
    } catch {
      return false;
    }
  }

  restoreDefaults(storage?: StorageLike | null): InputSettingsData {
    this.currentSettings = getDefaultInputSettings();
    this.save(storage);
    return this.getSettings();
  }

  update(partial: Partial<InputSettingsData>, storage?: StorageLike | null): InputSettingsData {
    if (partial.bindings) {
      this.currentSettings.bindings = cloneBindings(partial.bindings);
    }
    if (partial.pc) {
      this.currentSettings.pc = { ...this.currentSettings.pc, ...partial.pc };
    }
    if (partial.mobile) {
      this.currentSettings.mobile = { ...this.currentSettings.mobile, ...partial.mobile };
    }
    this.currentSettings = migrateAndNormalizeInputSettings(this.currentSettings);
    this.save(storage);
    return this.getSettings();
  }

  rebind(action: GameAction, newKey: string, slotIndex: number = 0, storage?: StorageLike | null): boolean {
    const { bindings } = rebindAction(this.currentSettings.bindings, action, newKey, slotIndex);
    this.currentSettings.bindings = bindings;
    return this.save(storage);
  }
}
