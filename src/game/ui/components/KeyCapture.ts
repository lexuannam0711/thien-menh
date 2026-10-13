/**
 * KeyCapture Modal Component
 * Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Modal popover lắng nghe và bắt phím gán mới cho hệ thống điều khiển:
 * - Hiển thị lớp phủ làm mờ nền (modal backdrop)
 * - Khung popover trung tâm viền đồng Đông Sơn cổ kính
 * - Hướng dẫn trực quan: "Bấm phím bất kỳ để gán...", "[ Escape ] để hủy"
 * - Lắng nghe key event, lọc các phím nguy hiểm (F5, F12)
 * - Chuyển đổi mã phím kỹ thuật (event.code) sang tên hiển thị thân thiện với người chơi
 */

import Phaser from 'phaser';
import {
  uiTokens,
  uiNumericColors,
  uiTypography,
} from '../design-tokens';
import { UI_DEPTH, W, H } from '../../../data/config';
import { graphicsSettings } from '../../rendering/GraphicsSettings';

export interface KeyCaptureResult {
  code: string;
  displayName: string;
}

export type KeyCaptureCallback = (result: KeyCaptureResult) => void;
export type KeyCancelCallback = () => void;

const BLOCKED_KEYS = new Set([
  'F5',
  'F11',
  'F12',
  'Tab',
  'ContextMenu',
  'MetaLeft',
  'MetaRight',
  'AltLeft',
  'AltRight',
]);

/**
 * Chuyển đổi event.code kỹ thuật sang nhãn phím thân thiện
 */
export function formatKeyDisplayName(code: string): string {
  if (code.startsWith('Key')) {
    return code.slice(3).toUpperCase();
  }
  if (code.startsWith('Digit')) {
    return code.slice(5);
  }
  if (code.startsWith('Numpad')) {
    return `Num ${code.slice(6)}`;
  }
  switch (code) {
    case 'Space':
      return 'Phím Cách (Space)';
    case 'Enter':
      return 'Enter';
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'Shift';
    case 'ControlLeft':
    case 'ControlRight':
      return 'Ctrl';
    case 'ArrowUp':
      return 'Mũi tên Lên (↑)';
    case 'ArrowDown':
      return 'Mũi tên Xuống (↓)';
    case 'ArrowLeft':
      return 'Mũi tên Trái (←)';
    case 'ArrowRight':
      return 'Mũi tên Phải (→)';
    case 'Backquote':
      return '~';
    default:
      return code;
  }
}

export class KeyCapture extends Phaser.GameObjects.Container {
  private isModalOpen = false;
  private actionId = '';
  private actionTitle = '';
  private captureCallback?: KeyCaptureCallback;
  private cancelCallback?: KeyCancelCallback;

  // DOM key listener
  private keyListener?: (event: KeyboardEvent) => void;

  // Visuals
  private backdrop: Phaser.GameObjects.Rectangle;
  private cardGraphics: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private targetActionText: Phaser.GameObjects.Text;
  private promptText: Phaser.GameObjects.Text;
  private hintText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    this.setDepth(UI_DEPTH + 1000);
    this.setVisible(false);
    this.setAlpha(0);

    // 1. Backdrop đen mờ phủ kín màn hình
    this.backdrop = scene.add.rectangle(W / 2, H / 2, W * 1.5, H * 1.5, 0x070b0c, 0.78)
      .setInteractive();
    this.add(this.backdrop);

    // 2. Card popover trung tâm
    this.cardGraphics = scene.add.graphics();
    this.add(this.cardGraphics);

    // 3. Texts
    const centerX = W / 2;
    const centerY = H / 2;

    this.titleText = scene.add.text(centerX, centerY - 68, 'GÁN PHÍM ĐIỀU KHIỂN', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '18px',
      color: uiTokens.colors.gold,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.add(this.titleText);

    this.targetActionText = scene.add.text(centerX, centerY - 32, '', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '15px',
      color: uiTokens.colors.text,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.add(this.targetActionText);

    this.promptText = scene.add.text(centerX, centerY + 14, 'Bấm phím bất kỳ trên bàn phím để gán...', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '14px',
      color: uiTokens.colors.accent,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.add(this.promptText);

    this.hintText = scene.add.text(centerX, centerY + 62, 'Nhấn [ Escape ] để hủy bỏ', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '12px',
      color: uiTokens.colors.textMuted,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.add(this.hintText);

    this.renderCard();
    scene.add.existing(this);
  }

  /**
   * Mở modal và bắt đầu lắng nghe phím bấm
   */
  public open(
    actionId: string,
    actionTitle: string,
    onCapture: KeyCaptureCallback,
    onCancel?: KeyCancelCallback
  ): this {
    this.actionId = actionId;
    this.actionTitle = actionTitle;
    this.captureCallback = onCapture;
    this.cancelCallback = onCancel;
    this.isModalOpen = true;

    this.targetActionText.setText(`Thao tác: ${actionTitle}`);
    this.renderCard();

    this.setVisible(true);

    const prefersReducedMotion =
      (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      Boolean(graphicsSettings.getState().reducedMotion);

    if (prefersReducedMotion) {
      this.setAlpha(1);
    } else {
      this.scene.tweens.killTweensOf(this);
      this.setAlpha(0);
      this.scene.tweens.add({
        targets: this,
        alpha: 1,
        duration: uiTokens.motionMs.fast,
        ease: 'Quad.easeOut',
      });
    }

    this.bindKeyboard();
    return this;
  }

  /**
   * Đóng modal và dọn dẹp listeners
   */
  public close(): this {
    if (!this.isModalOpen) return this;
    this.isModalOpen = false;
    this.unbindKeyboard();

    const prefersReducedMotion =
      (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      Boolean(graphicsSettings.getState().reducedMotion);

    if (prefersReducedMotion) {
      this.setAlpha(0);
      this.setVisible(false);
    } else {
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: uiTokens.motionMs.fast,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.setVisible(false);
        },
      });
    }

    return this;
  }

  public isOpen(): boolean {
    return this.isModalOpen;
  }

  private bindKeyboard(): void {
    this.unbindKeyboard();

    this.keyListener = (event: KeyboardEvent) => {
      if (!this.isModalOpen) return;

      event.preventDefault();
      event.stopPropagation();

      // Phím Escape: hủy bỏ
      if (event.code === 'Escape') {
        const cancel = this.cancelCallback;
        this.close();
        if (cancel) cancel();
        return;
      }

      // Bỏ qua các phím hệ thống nguy hiểm
      if (BLOCKED_KEYS.has(event.code)) {
        return;
      }

      const result: KeyCaptureResult = {
        code: event.code,
        displayName: formatKeyDisplayName(event.code),
      };

      const capture = this.captureCallback;
      this.close();
      if (capture) {
        capture(result);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keyListener, { capture: true });
    }
  }

  private unbindKeyboard(): void {
    if (this.keyListener && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyListener, { capture: true });
      this.keyListener = undefined;
    }
  }

  private renderCard(): void {
    const g = this.cardGraphics;
    g.clear();

    const cardWidth = 420;
    const cardHeight = 210;
    const centerX = W / 2;
    const centerY = H / 2;
    const halfW = cardWidth / 2;
    const halfH = cardHeight / 2;
    const radius = uiTokens.radius.lg; // 14px

    // Nền card
    g.fillStyle(uiNumericColors.surfaceRaised, 0.98);
    g.fillRoundedRect(centerX - halfW, centerY - halfH, cardWidth, cardHeight, radius);

    // Viền đồng chính
    g.lineStyle(2, uiNumericColors.accent, 0.9);
    g.strokeRoundedRect(centerX - halfW, centerY - halfH, cardWidth, cardHeight, radius);

    // Khung viền chỉ trang trí bên trong
    const innerPad = 8;
    g.lineStyle(1, uiNumericColors.border, 0.45);
    g.strokeRoundedRect(
      centerX - halfW + innerPad,
      centerY - halfH + innerPad,
      cardWidth - innerPad * 2,
      cardHeight - innerPad * 2,
      radius - 4
    );

    // 4 đinh đồng góc
    const rivet = 16;
    g.fillStyle(uiNumericColors.gold, 0.85);
    g.fillCircle(centerX - halfW + rivet, centerY - halfH + rivet, 2.5);
    g.fillCircle(centerX + halfW - rivet, centerY - halfH + rivet, 2.5);
    g.fillCircle(centerX - halfW + rivet, centerY + halfH - rivet, 2.5);
    g.fillCircle(centerX + halfW - rivet, centerY + halfH - rivet, 2.5);

    // Đường gạch phân cách nhẹ dưới tiêu đề
    g.lineStyle(1, uiNumericColors.border, 0.6);
    g.beginPath();
    g.moveTo(centerX - halfW + 30, centerY - 48);
    g.lineTo(centerX + halfW - 30, centerY - 48);
    g.strokePath();

    // Hộp nổi giữ chỗ phím (pulsing focus box)
    g.fillStyle(uiNumericColors.bronzeDark, 0.8);
    g.fillRoundedRect(centerX - 160, centerY - 6, 320, 42, uiTokens.radius.sm);
    g.lineStyle(1.5, uiNumericColors.gold, 0.7);
    g.strokeRoundedRect(centerX - 160, centerY - 6, 320, 42, uiTokens.radius.sm);
  }

  public override destroy(fromScene?: boolean): void {
    this.unbindKeyboard();
    if (this.scene) {
      this.scene.tweens.killTweensOf(this);
    }
    super.destroy(fromScene);
  }
}
