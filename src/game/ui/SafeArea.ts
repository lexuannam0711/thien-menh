/**
 * Safe Area Insets System
 * Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Tính toán vùng an toàn (Safe Area Insets) cho các thiết bị mobile có notch,
 * camera hole, hoặc system navigation bar (Home indicator trên iOS/Android).
 * Đảm bảo hoạt động an toàn cả trong trình duyệt lẫn môi trường test Node.js / SSR.
 */

export interface SafeAreaInsets {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export interface UIRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_INSETS: SafeAreaInsets = Object.freeze({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
});

// Fallback tiêu chuẩn cho thiết bị di động khi không đọc được env()
const MOBILE_DEFAULT_FALLBACK: SafeAreaInsets = Object.freeze({
  top: 16,
  bottom: 12,
  left: 12,
  right: 12,
});

let insetsOverride: SafeAreaInsets | null = null;
let cachedBrowserInsets: SafeAreaInsets | null = null;

/**
 * Trích xuất giá trị pixel từ chuỗi CSS (ví dụ: '16px' -> 16)
 */
function parseCssPx(val: string | null | undefined): number {
  if (!val) return 0;
  const num = parseFloat(val);
  return isNaN(num) ? 0 : Math.max(0, Math.round(num));
}

/**
 * Đọc safe area insets từ môi trường CSS của trình duyệt
 */
export function readBrowserSafeArea(): SafeAreaInsets {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return DEFAULT_INSETS;
  }

  try {
    const computed = window.getComputedStyle(document.documentElement);
    // Kiểm tra custom properties hoặc CSS env fallback
    const top = parseCssPx(computed.getPropertyValue('--safe-area-top') || computed.getPropertyValue('env(safe-area-inset-top)'));
    const bottom = parseCssPx(computed.getPropertyValue('--safe-area-bottom') || computed.getPropertyValue('env(safe-area-inset-bottom)'));
    const left = parseCssPx(computed.getPropertyValue('--safe-area-left') || computed.getPropertyValue('env(safe-area-inset-left)'));
    const right = parseCssPx(computed.getPropertyValue('--safe-area-right') || computed.getPropertyValue('env(safe-area-inset-right)'));

    // Nếu không đọc được từ CSS custom property, thử dùng div đo đạc ẩn
    if (top === 0 && bottom === 0 && left === 0 && right === 0 && document.body) {
      let measureDiv = document.getElementById('safe-area-measure');
      if (!measureDiv) {
        measureDiv = document.createElement('div');
        measureDiv.id = 'safe-area-measure';
        measureDiv.style.position = 'fixed';
        measureDiv.style.visibility = 'hidden';
        measureDiv.style.pointerEvents = 'none';
        measureDiv.style.top = '0';
        measureDiv.style.left = '0';
        measureDiv.style.paddingTop = 'env(safe-area-inset-top, 0px)';
        measureDiv.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
        measureDiv.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
        measureDiv.style.paddingRight = 'env(safe-area-inset-right, 0px)';
        document.body.appendChild(measureDiv);
      }
      const measured = window.getComputedStyle(measureDiv);
      return Object.freeze({
        top: parseCssPx(measured.paddingTop),
        bottom: parseCssPx(measured.paddingBottom),
        left: parseCssPx(measured.paddingLeft),
        right: parseCssPx(measured.paddingRight),
      });
    }

    return Object.freeze({ top, bottom, left, right });
  } catch {
    return DEFAULT_INSETS;
  }
}

/**
 * Lấy vùng an toàn hiện tại.
 * Ưu tiên: Override -> Browser Insets -> Fallback nếu là mobile
 */
export function getSafeAreaInsets(isMobileFallback = false): SafeAreaInsets {
  if (insetsOverride !== null) {
    return insetsOverride;
  }

  if (cachedBrowserInsets === null) {
    cachedBrowserInsets = readBrowserSafeArea();
  }

  // Nếu trình duyệt trả về 0 hết và đang yêu cầu mobile fallback
  if (
    isMobileFallback &&
    cachedBrowserInsets.top === 0 &&
    cachedBrowserInsets.bottom === 0 &&
    cachedBrowserInsets.left === 0 &&
    cachedBrowserInsets.right === 0
  ) {
    return MOBILE_DEFAULT_FALLBACK;
  }

  return cachedBrowserInsets;
}

/**
 * Gán giá trị insets cố định (dùng cho unit test hoặc custom setting của player)
 */
export function setSafeAreaInsetsOverride(insets: Partial<SafeAreaInsets> | null): void {
  if (insets === null) {
    insetsOverride = null;
  } else {
    insetsOverride = Object.freeze({
      top: insets.top ?? 0,
      bottom: insets.bottom ?? 0,
      left: insets.left ?? 0,
      right: insets.right ?? 0,
    });
  }
}

/**
 * Xóa cache insets để đọc lại (ví dụ sau khi xoay màn hình hoặc resize)
 */
export function refreshSafeArea(): void {
  cachedBrowserInsets = null;
}

/**
 * Điều chỉnh hình chữ nhật màn hình theo Safe Area Insets
 */
export function applySafeAreaToRect(rect: UIRect, insets: SafeAreaInsets = getSafeAreaInsets()): UIRect {
  return {
    x: rect.x + insets.left,
    y: rect.y + insets.top,
    width: Math.max(0, rect.width - insets.left - insets.right),
    height: Math.max(0, rect.height - insets.top - insets.bottom),
  };
}
