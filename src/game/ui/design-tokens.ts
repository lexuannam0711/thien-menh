/**
 * Design Tokens & Visual Primitives System
 * Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Cung cấp hệ thống tokens màu sắc, khoảng cách, bo góc, chuyển động,
 * typography tiếng Việt và kiểm tra độ tương phản theo chuẩn WCAG AA/AAA.
 */

export const uiTokens = {
  colors: {
    bg: '#171E21',
    surface: '#243033',
    surfaceRaised: '#303F42',
    border: '#8E754A',
    accent: '#D8B675',
    text: '#F5EBDD',
    textMuted: '#CBD1CB',
    danger: '#E86D63',
    mana: '#64B5DD',
    success: '#8BC49B',
    disabled: '#73807D',
    gold: '#F3C66F',
    bronzeDark: '#1B2624',
  },
  spacing: [4, 8, 12, 16, 20, 24] as const,
  radius: { sm: 6, md: 10, lg: 14 } as const,
  motionMs: { fast: 120, normal: 180, slow: 240 } as const,
} as const;

export type UIColorName = keyof typeof uiTokens.colors;

/**
 * Chuyển đổi mã hex (ví dụ '#D8B675' hoặc '0xD8B675') sang số nguyên 0x... dùng cho Phaser Graphics
 */
export function uiColorHexToNumber(hex: string): number {
  const clean = hex.replace(/^#|^0x/i, '');
  return parseInt(clean, 16);
}

/**
 * Chuyển đổi số màu nguyên (ví dụ 0xD8B675) sang mã hex dạng chuỗi '#D8B675'
 */
export function uiColorNumberToHex(color: number): string {
  const hex = (color & 0xffffff).toString(16).padStart(6, '0').toUpperCase();
  return `#${hex}`;
}

/**
 * Các giá trị màu dạng số nguyên (Phaser color numbers) tương ứng với tokens
 */
export const uiNumericColors = {
  bg: uiColorHexToNumber(uiTokens.colors.bg),
  surface: uiColorHexToNumber(uiTokens.colors.surface),
  surfaceRaised: uiColorHexToNumber(uiTokens.colors.surfaceRaised),
  border: uiColorHexToNumber(uiTokens.colors.border),
  accent: uiColorHexToNumber(uiTokens.colors.accent),
  text: uiColorHexToNumber(uiTokens.colors.text),
  textMuted: uiColorHexToNumber(uiTokens.colors.textMuted),
  danger: uiColorHexToNumber(uiTokens.colors.danger),
  mana: uiColorHexToNumber(uiTokens.colors.mana),
  success: uiColorHexToNumber(uiTokens.colors.success),
  disabled: uiColorHexToNumber(uiTokens.colors.disabled),
  gold: uiColorHexToNumber(uiTokens.colors.gold),
  bronzeDark: uiColorHexToNumber(uiTokens.colors.bronzeDark),
} as const;

/**
 * Typography Tokens hỗ trợ hiển thị tiếng Việt đầy đủ dấu (sắc, huyền, hỏi, ngã, nặng, ư, ơ, đ,...)
 */
export const uiTypography = {
  fontFamilies: {
    display: "'Cinzel', 'Spectral', 'Noto Serif', 'Arial', serif",
    body: "'Noto Sans', 'Segoe UI', 'Arial', sans-serif",
    mono: "'Consolas', 'Courier New', monospace",
  },
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    title: 26,
  },
  weights: {
    regular: 'normal',
    medium: '500',
    bold: 'bold',
  },
  lineHeights: {
    tight: 1.15,
    normal: 1.35,
    relaxed: 1.5,
  },
} as const;

export type UIComponentState =
  | 'default'
  | 'hover'
  | 'active'
  | 'pressed'
  | 'disabled'
  | 'cooldown'
  | 'locked';

export interface ComponentVisualState {
  bg: number;
  border: number;
  text: string;
  alpha: number;
  borderWidth: number;
  scale?: number;
}

/**
 * Lấy kiểu dáng tương ứng với từng trạng thái tương tác của component
 */
export function getComponentStateVisual(state: UIComponentState): ComponentVisualState {
  switch (state) {
    case 'hover':
      return {
        bg: uiNumericColors.surfaceRaised,
        border: uiNumericColors.accent,
        text: uiTokens.colors.text,
        alpha: 1.0,
        borderWidth: 2,
        scale: 1.02,
      };
    case 'pressed':
    case 'active':
      return {
        bg: uiNumericColors.bronzeDark,
        border: uiNumericColors.gold,
        text: uiTokens.colors.gold,
        alpha: 0.95,
        borderWidth: 2,
        scale: 0.97,
      };
    case 'disabled':
      return {
        bg: uiNumericColors.bg,
        border: uiNumericColors.disabled,
        text: uiTokens.colors.disabled,
        alpha: 0.5,
        borderWidth: 1,
        scale: 1.0,
      };
    case 'cooldown':
      return {
        bg: uiNumericColors.surface,
        border: uiNumericColors.border,
        text: uiTokens.colors.textMuted,
        alpha: 0.75,
        borderWidth: 1.5,
        scale: 1.0,
      };
    case 'locked':
      return {
        bg: uiNumericColors.bg,
        border: uiNumericColors.border,
        text: uiTokens.colors.textMuted,
        alpha: 0.45,
        borderWidth: 1,
        scale: 1.0,
      };
    case 'default':
    default:
      return {
        bg: uiNumericColors.surface,
        border: uiNumericColors.border,
        text: uiTokens.colors.text,
        alpha: 0.95,
        borderWidth: 1.5,
        scale: 1.0,
      };
  }
}

/**
 * Tính relative luminance theo WCAG 2.1 (sRGB L = 0.2126*R + 0.7152*G + 0.0722*B)
 */
export function getRelativeLuminance(color: string | number): number {
  const num = typeof color === 'string' ? uiColorHexToNumber(color) : color;
  const r = ((num >> 16) & 0xff) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);

  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/**
 * Tính contrast ratio giữa 2 màu theo chuẩn WCAG (1:1 đến 21:1)
 */
export function getContrastRatio(colorA: string | number, colorB: string | number): number {
  const lumA = getRelativeLuminance(colorA);
  const lumB = getRelativeLuminance(colorB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Kiểm tra màu sắc có đạt chuẩn WCAG AA không
 * (>= 4.5:1 cho normal text, >= 3.0:1 cho large text >= 18px hoặc bold >= 14px)
 */
export function isWcagCompliant(
  textColor: string | number,
  bgColor: string | number,
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(textColor, bgColor);
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5;
}
