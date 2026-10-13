/**
 * Mô hình quản lý Cài đặt và Hướng dẫn điều khiển (Settings & Controls Model)
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Đảm bảo:
 * - Lưu trạng thái âm thanh (mute toggle) bền vững vào localStorage.
 * - Cung cấp danh mục hướng dẫn điều khiển bàn phím (PC) và cảm ứng (Mobile).
 * - Tự kiểm tra tất định (deterministic self-check) với các khẳng định nội tuyến.
 * - Hoạt động độc lập, không phụ thuộc thư viện ngoài, an toàn với môi trường chặn Storage.
 */

export const SETTINGS_STORAGE_KEY = 'than-menh-settings-v1';

export interface SettingsState {
  muted: boolean;
}

export interface ControlHelpEntry {
  id: string;
  label: string;
  binding: string;
  description: string;
}

export interface ControlsGuide {
  keyboard: readonly ControlHelpEntry[];
  mobile: readonly ControlHelpEntry[];
  shortcuts: readonly ControlHelpEntry[];
  tips: readonly string[];
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface SoundManagerLike {
  mute: boolean;
}

export const DEFAULT_SETTINGS: Readonly<SettingsState> = Object.freeze({
  muted: false,
});

export const CONTROLS_GUIDE: ControlsGuide = Object.freeze({
  keyboard: Object.freeze([
    {
      id: 'move',
      label: 'Di chuyển',
      binding: 'W, A, S, D / Phím mũi tên',
      description: 'Điều khiển nhân vật di chuyển 4 hướng trong Làng và Rừng Trúc.',
    },
    {
      id: 'attack',
      label: 'Tấn công',
      binding: 'Chuột trái (LMB) / J',
      description: 'Tấn công cận chiến; bấm liên tục để tạo chuỗi liên kích 3 đòn.',
    },
    {
      id: 'dodge',
      label: 'Lướt né',
      binding: 'Space (Phím cách)',
      description: 'Lướt nhanh né đòn tấn công của quái thú và tạm thời miễn nhiễm sát thương.',
    },
    {
      id: 'skills',
      label: '4 Ô Kỹ năng',
      binding: '1 / 2 / 3 / 4 (Digit1..Digit4)',
      description: 'Kích hoạt 4 ô kỹ năng võ học (Phím 1..4 mặc định; không dùng Q/E/R/T).',
    },
    {
      id: 'quick-items',
      label: '4 Ô Vật phẩm',
      binding: '5 / 6 / 7 / 8 (Digit5..Digit8)',
      description: 'Sử dụng nhanh dược thảo, linh đan và vật phẩm hồi phục trong túi đồ.',
    },
    {
      id: 'interact',
      label: 'Tương tác',
      binding: 'F',
      description: 'Nói chuyện với Trưởng làng, Thợ rèn hoặc Thầy mo khi đứng gần.',
    },
    {
      id: 'inventory',
      label: 'Túi đồ / Trang bị',
      binding: 'B / I / Tab',
      description: 'Mở hòm đồ và bảng quản lý trang bị nhân vật.',
    },
    {
      id: 'map',
      label: 'Bản đồ',
      binding: 'M',
      description: 'Mở bản đồ khu vực Làng Văn Lang và các phụ bản.',
    },
  ]),
  mobile: Object.freeze([
    {
      id: 'virtual-joystick',
      label: 'Cần gạt ảo (Joystick)',
      binding: 'Khu vực góc dưới bên trái',
      description: 'Chạm và kéo ngón tay theo hướng muốn nhân vật di chuyển.',
    },
    {
      id: 'touch-attack',
      label: 'Nút CHÉM',
      binding: 'Nút lớn màu đỏ cam (bên phải)',
      description: 'Nhấn để tung đòn chém kiếm cận chiến.',
    },
    {
      id: 'touch-dodge',
      label: 'Nút NÉ',
      binding: 'Nút màu xanh ngọc (bên phải)',
      description: 'Nhấn để lướt né đòn tức thời.',
    },
    {
      id: 'touch-skills',
      label: '4 Nút Kỹ năng',
      binding: 'Nút kỹ năng 1..4 (vòng cung)',
      description: 'Kích hoạt kỹ năng tương ứng với thời gian hồi chiêu và hiển thị năng lượng MP.',
    },
    {
      id: 'touch-items',
      label: 'Vật phẩm nhanh',
      binding: 'Hàng ô vật phẩm 5..8',
      description: 'Chạm để dùng nhanh thảo dược hoặc thần đan hồi phục.',
    },
    {
      id: 'touch-interact',
      label: 'Nút Tương tác F',
      binding: 'Nút màu rêu sẫm',
      description: 'Trò chuyện nhận và trả nhiệm vụ với NPC làng Văn Lang.',
    },
  ]),
  shortcuts: Object.freeze([
    {
      id: 'nav-tab',
      label: 'Điều hướng Menu',
      binding: 'Tab / Shift + Tab / Mũi tên',
      description: 'Di chuyển tiêu điểm lấy nét (Focus) giữa các nút trên Menu.',
    },
    {
      id: 'nav-activate',
      label: 'Kích hoạt nút',
      binding: 'Enter / Space',
      description: 'Kích hoạt nút đang được chọn trên giao diện.',
    },
    {
      id: 'quick-mute',
      label: 'Phím tắt Âm thanh',
      binding: 'M',
      description: 'Bật hoặc tắt nhanh âm thanh trò chơi.',
    },
    {
      id: 'quick-help',
      label: 'Phím tắt Cài đặt & Hướng dẫn',
      binding: 'H / C',
      description: 'Mở hoặc đóng bảng Cài đặt & Hướng dẫn điều khiển.',
    },
    {
      id: 'close-dialog',
      label: 'Đóng hộp thoại',
      binding: 'Esc',
      description: 'Đóng bảng hướng dẫn cài đặt và quay lại Menu chính.',
    },
  ]),
  tips: Object.freeze([
    'Trên điện thoại, hãy xoay ngang màn hình (Landscape) để hiển thị đầy đủ cần điều khiển và tầm nhìn.',
    'Trạng thái cài đặt bàn phím và cảm ứng được tự động lưu lại vào trình duyệt cho những lần chơi sau.',
    'Giao diện hỗ trợ đầy đủ bộ đọc màn hình và phím Tab theo tiêu chuẩn trợ năng web.',
    'Có thể tùy chỉnh lại phím trong mục Cài đặt Điều khiển theo thói quen của bạn.',
  ]),
});

export function getSafeLocalStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Môi trường iframe bảo mật cao hoặc tắt cookie/storage
  }
  return null;
}

export function normalizeSettings(candidate: unknown): SettingsState {
  if (!candidate || typeof candidate !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  const raw = candidate as Record<string, unknown>;
  const muted = raw.muted === true;
  return { muted };
}

export function loadSettings(storage?: StorageLike | null): SettingsState {
  const store = storage !== undefined ? storage : getSafeLocalStorage();
  if (!store) return { ...DEFAULT_SETTINGS };
  try {
    const raw = store.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: SettingsState, storage?: StorageLike | null): boolean {
  const store = storage !== undefined ? storage : getSafeLocalStorage();
  if (!store) return false;
  try {
    const normalized = normalizeSettings(settings);
    store.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function toggleMuteState(current: SettingsState): SettingsState {
  return {
    ...current,
    muted: !current.muted,
  };
}

export function applySoundSettings(settings: SettingsState, soundManager?: SoundManagerLike | null): void {
  if (soundManager && typeof soundManager === 'object' && 'mute' in soundManager) {
    soundManager.mute = settings.muted;
  }
}

export class SettingsModel {
  private state: SettingsState;
  private readonly storage: StorageLike | null;

  constructor(storage?: StorageLike | null) {
    this.storage = storage !== undefined ? storage : getSafeLocalStorage();
    this.state = loadSettings(this.storage);
  }

  getState(): Readonly<SettingsState> {
    return this.state;
  }

  isMuted(): boolean {
    return this.state.muted;
  }

  setMuted(muted: boolean): boolean {
    this.state = { muted: Boolean(muted) };
    return saveSettings(this.state, this.storage);
  }

  toggleMute(): boolean {
    this.state = toggleMuteState(this.state);
    saveSettings(this.state, this.storage);
    return this.state.muted;
  }

  syncSound(soundManager?: SoundManagerLike | null): void {
    applySoundSettings(this.state, soundManager);
  }

  getControlsGuide(): ControlsGuide {
    return CONTROLS_GUIDE;
  }

  getMuteLabel(): string {
    return this.state.muted ? 'ÂM THANH: TẮT' : 'ÂM THANH: BẬT';
  }

  getAccessibleMuteLabel(): string {
    return this.state.muted
      ? 'Âm thanh: Đang tắt. Nhấn để bật âm thanh.'
      : 'Âm thanh: Đang bật. Nhấn để tắt âm thanh.';
  }
}

export const settingsModel = new SettingsModel();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`SettingsModel self-check failed: ${message}`);
  }
}

/**
 * Deterministic self-check function.
 * Verifies all invariants without depending on browser globals.
 */
export function runSettingsSelfCheck(): true {
  // 1. Kiểm tra cấu trúc danh mục hướng dẫn (Controls guide catalog)
  assert(CONTROLS_GUIDE.keyboard.length >= 6, 'keyboard controls must have at least 6 actions');
  assert(CONTROLS_GUIDE.mobile.length >= 6, 'mobile controls must have at least 6 actions');
  assert(CONTROLS_GUIDE.shortcuts.length >= 4, 'shortcuts must have at least 4 items');
  for (const item of [...CONTROLS_GUIDE.keyboard, ...CONTROLS_GUIDE.mobile, ...CONTROLS_GUIDE.shortcuts]) {
    assert(typeof item.id === 'string' && item.id.length > 0, `item id valid: ${item.id}`);
    assert(typeof item.label === 'string' && item.label.length > 0, `item label valid: ${item.label}`);
    assert(typeof item.binding === 'string' && item.binding.length > 0, `item binding valid: ${item.binding}`);
    assert(typeof item.description === 'string' && item.description.length > 0, `item desc valid: ${item.description}`);
  }

  // 2. Kiểm tra chuẩn hóa dữ liệu (Normalization)
  assert(normalizeSettings(null).muted === false, 'null fallback');
  assert(normalizeSettings(undefined).muted === false, 'undefined fallback');
  assert(normalizeSettings({}).muted === false, 'empty object fallback');
  assert(normalizeSettings({ muted: true }).muted === true, 'true preserved');
  assert(normalizeSettings({ muted: false }).muted === false, 'false preserved');
  assert(normalizeSettings({ muted: 'true' }).muted === false, 'string truthy coerced to false');
  assert(normalizeSettings({ muted: 1 }).muted === false, 'number truthy coerced to false');

  // 3. Kiểm tra lưu trữ mô phỏng trong bộ nhớ (In-memory storage roundtrip)
  const memoryStore = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (key) => memoryStore.get(key) ?? null,
    setItem: (key, val) => { memoryStore.set(key, val); },
    removeItem: (key) => { memoryStore.delete(key); },
  };

  const loadedDefault = loadSettings(mockStorage);
  assert(loadedDefault.muted === false, 'default loaded is unmuted');

  const saveResult = saveSettings({ muted: true }, mockStorage);
  assert(saveResult === true, 'save returns true');
  assert(memoryStore.has(SETTINGS_STORAGE_KEY), 'key stored');
  const storedJson = memoryStore.get(SETTINGS_STORAGE_KEY)!;
  assert(JSON.parse(storedJson).muted === true, 'json content valid');

  const reloaded = loadSettings(mockStorage);
  assert(reloaded.muted === true, 'reloaded muted is true');

  // 4. Kiểm tra khả năng chống chịu dữ liệu hỏng (Corrupted JSON tolerance)
  memoryStore.set(SETTINGS_STORAGE_KEY, '{malformed json: true');
  const corruptedFallback = loadSettings(mockStorage);
  assert(corruptedFallback.muted === false, 'corrupted JSON falls back safely');

  // 5. Kiểm tra trường hợp Storage ném ngoại lệ (Quota/Permission errors)
  const throwingStorage: StorageLike = {
    getItem: () => { throw new Error('SecurityError: storage disabled'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => { throw new Error('Disabled'); },
  };
  const throwingLoaded = loadSettings(throwingStorage);
  assert(throwingLoaded.muted === false, 'throwing storage returns default');
  const throwingSaved = saveSettings({ muted: true }, throwingStorage);
  assert(throwingSaved === false, 'throwing storage save returns false');

  // 6. Kiểm tra vòng đời SettingsModel
  const isolatedStore = new Map<string, string>();
  const testStorage: StorageLike = {
    getItem: (key) => isolatedStore.get(key) ?? null,
    setItem: (key, val) => { isolatedStore.set(key, val); },
  };

  const model = new SettingsModel(testStorage);
  assert(model.isMuted() === false, 'initial model is unmuted');
  assert(model.getMuteLabel() === 'ÂM THANH: BẬT', 'initial mute label');
  assert(model.getAccessibleMuteLabel().includes('Đang bật'), 'initial accessible label');

  const toggled1 = model.toggleMute();
  assert(toggled1 === true && model.isMuted() === true, 'first toggle turns mute ON');
  assert(model.getMuteLabel() === 'ÂM THANH: TẮT', 'muted label updated');
  assert(model.getAccessibleMuteLabel().includes('Đang tắt'), 'muted accessible label updated');

  const toggled2 = model.toggleMute();
  assert(toggled2 === false && model.isMuted() === false, 'second toggle turns mute OFF');

  // 7. Kiểm tra đồng bộ với SoundManager
  const mockSound1 = { mute: false };
  model.setMuted(true);
  model.syncSound(mockSound1);
  assert(mockSound1.mute === true, 'sound manager syncs mute true');

  const mockSound2 = { mute: true };
  model.setMuted(false);
  model.syncSound(mockSound2);
  assert(mockSound2.mute === false, 'sound manager syncs mute false');

  // Không lỗi khi truyền null/undefined
  model.syncSound(null);
  model.syncSound(undefined);

  return true;
}

// Chạy tự kiểm tra tất định ngay khi module khởi tạo
export const SETTINGS_SELF_CHECK_RESULT: true = runSettingsSelfCheck();
