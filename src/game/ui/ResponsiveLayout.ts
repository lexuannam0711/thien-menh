/**
 * Responsive Layout & Anchoring System
 * Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Quản lý thích ứng giao diện theo kích thước màn hình và loại thiết bị (Desktop / Tablet / Mobile).
 * Cung cấp hệ thống điểm neo (Anchor points) kết hợp cùng Safe Area Insets để định vị UI chuẩn xác,
 * giữ không gian trung tâm màn hình thông thoáng cho trải nghiệm nhập vai và chiến đấu.
 */

import { getSafeAreaInsets, SafeAreaInsets } from './SafeArea';

export type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export type AnchorPoint =
  | 'TOP_LEFT'
  | 'TOP_CENTER'
  | 'TOP_RIGHT'
  | 'BOTTOM_LEFT'
  | 'BOTTOM_CENTER'
  | 'BOTTOM_RIGHT'
  | 'CENTER';

export interface ScreenBounds {
  readonly width: number;
  readonly height: number;
}

export interface AnchorOffset {
  readonly x: number;
  readonly y: number;
}

export interface LayoutConfig {
  readonly deviceMode: DeviceMode;
  readonly bounds: ScreenBounds;
  readonly insets: SafeAreaInsets;
  readonly scaleFactor: number;
}

/**
 * Kiểm tra thiết bị có hỗ trợ màn hình cảm ứng hay không
 */
export function hasTouchCapability(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return (
    navigator.maxTouchPoints > 0 ||
    'ontouchstart' in window ||
    // @ts-expect-error fallback cho trình duyệt cũ
    (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
  );
}

/**
 * Xác định DeviceMode dựa trên kích thước màn hình và khả năng cảm ứng
 */
export function resolveDeviceMode(
  width: number,
  height: number,
  isTouch: boolean = hasTouchCapability()
): DeviceMode {
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  const aspectRatio = maxDim / Math.max(1, minDim);

  // Màn hình di động (Smartphones):
  // Nhỏ gọn (minDim <= 480), hoặc touch smartphone có tỷ lệ màn hình dài (minDim <= 768 && aspectRatio >= 1.5)
  if (minDim <= 480 || (isTouch && (maxDim <= 920 || (minDim <= 768 && aspectRatio >= 1.5)))) {
    return 'mobile';
  }

  // Máy tính bảng (Tablets): Có cảm ứng và kích thước lớn hơn điện thoại (iPad, tablet Android)
  if (isTouch && maxDim <= 1366) {
    return 'tablet';
  }

  return 'desktop';
}

/**
 * Tính toán hệ số co giãn UI (Scale Factor) để đảm bảo UI không chiếm quá nhiều diện tích
 * Chuẩn game cơ sở: 960 x 540
 */
export function calculateUiScale(width: number, height: number, mode: DeviceMode): number {
  const baseWidth = 960;
  const baseHeight = 540;

  const scaleX = width / baseWidth;
  const scaleY = height / baseHeight;
  const aspectScale = Math.min(scaleX, scaleY);

  if (mode === 'mobile') {
    // Trên mobile, giữ UI vừa tay, không quá nhỏ để chạm dễ dàng (tối thiểu 0.82, tối đa 1.1)
    return Math.max(0.82, Math.min(1.15, aspectScale * 0.95));
  } else if (mode === 'tablet') {
    return Math.max(0.85, Math.min(1.2, aspectScale));
  } else {
    // Desktop: UI gọn gàng, tôn trọng tầm nhìn chiến trường
    return Math.max(0.8, Math.min(1.25, aspectScale));
  }
}

/**
 * Tính toán tọa độ (x, y) của một điểm neo trên màn hình dựa vào bounds và safe area
 */
export function getAnchorPosition(
  anchor: AnchorPoint,
  bounds: ScreenBounds,
  insets: SafeAreaInsets = getSafeAreaInsets(),
  offsetX = 0,
  offsetY = 0
): AnchorOffset {
  const safeLeft = insets.left;
  const safeRight = bounds.width - insets.right;
  const safeTop = insets.top;
  const safeBottom = bounds.height - insets.bottom;
  const centerX = bounds.width / 2;
  const centerY = bounds.height / 2;

  switch (anchor) {
    case 'TOP_LEFT':
      return { x: safeLeft + offsetX, y: safeTop + offsetY };
    case 'TOP_CENTER':
      return { x: centerX + offsetX, y: safeTop + offsetY };
    case 'TOP_RIGHT':
      return { x: safeRight + offsetX, y: safeTop + offsetY };
    case 'BOTTOM_LEFT':
      return { x: safeLeft + offsetX, y: safeBottom + offsetY };
    case 'BOTTOM_CENTER':
      return { x: centerX + offsetX, y: safeBottom + offsetY };
    case 'BOTTOM_RIGHT':
      return { x: safeRight + offsetX, y: safeBottom + offsetY };
    case 'CENTER':
    default:
      return { x: centerX + offsetX, y: centerY + offsetY };
  }
}

/**
 * Class quản lý Layout thích ứng cho Scene
 */
export class ResponsiveLayout {
  private bounds: ScreenBounds;
  private mode: DeviceMode;
  private scale: number;

  constructor(width = 960, height = 540, touch?: boolean) {
    this.bounds = { width, height };
    this.mode = resolveDeviceMode(width, height, touch);
    this.scale = calculateUiScale(width, height, this.mode);
  }

  /**
   * Cập nhật kích thước khi khung hình thay đổi (resize / rotate)
   */
  updateBounds(width: number, height: number, touch?: boolean): void {
    this.bounds = { width, height };
    this.mode = resolveDeviceMode(width, height, touch);
    this.scale = calculateUiScale(width, height, this.mode);
  }

  getBounds(): ScreenBounds {
    return this.bounds;
  }

  getMode(): DeviceMode {
    return this.mode;
  }

  getScale(): number {
    return this.scale;
  }

  isMobile(): boolean {
    return this.mode === 'mobile';
  }

  isTablet(): boolean {
    return this.mode === 'tablet';
  }

  isDesktop(): boolean {
    return this.mode === 'desktop';
  }

  /**
   * Lấy tọa độ neo với Safe Area tự động
   */
  getAnchor(anchor: AnchorPoint, offsetX = 0, offsetY = 0): AnchorOffset {
    const insets = getSafeAreaInsets(this.isMobile());
    return getAnchorPosition(anchor, this.bounds, insets, offsetX, offsetY);
  }

  /**
   * Tính toán bounds cho khung chiến trường an toàn không bị UI che
   */
  getCombatSafeZone(): { x: number; y: number; width: number; height: number } {
    const insets = getSafeAreaInsets(this.isMobile());
    // Trừ 80px trên cho HUD HP/MP, 100px dưới cho cụm kỹ năng / phím bấm
    const topMargin = insets.top + (this.isMobile() ? 70 : 80);
    const bottomMargin = insets.bottom + (this.isMobile() ? 100 : 90);
    const leftMargin = insets.left + (this.isMobile() ? 90 : 20); // trừ cụm joystick nếu có
    const rightMargin = insets.right + (this.isMobile() ? 110 : 20); // trừ cụm nút kỹ năng

    return {
      x: leftMargin,
      y: topMargin,
      width: Math.max(200, this.bounds.width - leftMargin - rightMargin),
      height: Math.max(200, this.bounds.height - topMargin - bottomMargin),
    };
  }
}
