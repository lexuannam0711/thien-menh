/**
 * ActionButton Component
 * Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Nút bấm hành động tiêu chuẩn trong game:
 * - Kế thừa Phaser.GameObjects.Container
 * - Tạo hình bo góc, viền đồng cổ điển, họa tiết đinh tán / motif Đông Sơn 4 góc
 * - Hỗ trợ Text tiếng Việt có dấu đầy đủ và/hoặc icon ký tự
 * - Quản lý các trạng thái tương tác: default, hover, pressed, disabled
 * - Hiệu ứng tween phản hồi bấm nhanh (120ms), tôn trọng reducedMotion
 * - Hit area đảm bảo tối thiểu 44-48px theo chuẩn Touch Target Accessibility
 */

import Phaser from 'phaser';
import {
  uiTokens,
  uiNumericColors,
  uiTypography,
  UIComponentState,
} from '../design-tokens';
import { graphicsSettings } from '../../rendering/GraphicsSettings';

export type ActionButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export interface ActionButtonOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  icon?: string;
  fontSize?: number;
  variant?: ActionButtonVariant;
  enabled?: boolean;
  onClick?: () => void;
}

export class ActionButton extends Phaser.GameObjects.Container {
  private btnWidth: number;
  private btnHeight: number;
  private btnText: string;
  private btnIcon?: string;
  private variant: ActionButtonVariant;
  private isBtnEnabled: boolean;
  private currentState: UIComponentState = 'default';
  private clickHandler?: () => void;

  // Graphics & text objects
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  private iconText?: Phaser.GameObjects.Text;
  private hitZone: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene, options: ActionButtonOptions = {}) {
    super(scene, options.x ?? 0, options.y ?? 0);

    // Kích thước tối thiểu 44px để đảm bảo chuẩn touch target
    this.btnWidth = Math.max(48, options.width ?? 140);
    this.btnHeight = Math.max(44, options.height ?? 44);
    this.btnText = options.text ?? '';
    this.btnIcon = options.icon;
    this.variant = options.variant ?? 'primary';
    this.isBtnEnabled = options.enabled ?? true;
    this.clickHandler = options.onClick;

    // 1. Background Graphics (vẽ nền, viền và họa tiết đinh đồng góc)
    this.backgroundGraphics = scene.add.graphics();
    this.add(this.backgroundGraphics);

    // 2. Icon (nếu có)
    if (this.btnIcon) {
      this.iconText = scene.add.text(
        this.btnText ? -this.btnWidth / 2 + 22 : 0,
        0,
        this.btnIcon,
        {
          fontFamily: uiTypography.fontFamilies.body,
          fontSize: `${options.fontSize ?? uiTypography.sizes.md}px`,
          color: uiTokens.colors.gold,
        }
      ).setOrigin(this.btnText ? 0.5 : 0.5, 0.5);
      this.add(this.iconText);
    }

    // 3. Label Text
    const textOffsetX = this.btnIcon ? 12 : 0;
    this.labelText = scene.add.text(
      textOffsetX,
      0,
      this.btnText,
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: `${options.fontSize ?? uiTypography.sizes.md}px`,
        color: uiTokens.colors.text,
        fontStyle: 'bold',
        stroke: '#10251F',
        strokeThickness: 2,
        align: 'center',
      }
    ).setOrigin(0.5, 0.5);
    this.add(this.labelText);

    // 4. Hit Zone để nhận sự kiện tương tác chuẩn xác
    this.hitZone = scene.add.zone(0, 0, this.btnWidth, this.btnHeight)
      .setInteractive({ useHandCursor: this.isBtnEnabled });
    this.add(this.hitZone);

    this.setupInteractions();
    this.renderVisual();

    scene.add.existing(this);
  }

  private setupInteractions(): void {
    this.hitZone.on('pointerover', () => {
      if (!this.isBtnEnabled) return;
      this.setState('hover');
    });

    this.hitZone.on('pointerout', () => {
      if (!this.isBtnEnabled) return;
      this.setState('default');
    });

    this.hitZone.on('pointerdown', () => {
      if (!this.isBtnEnabled) return;
      this.setState('pressed');
      this.playPressAnimation();
    });

    this.hitZone.on('pointerup', () => {
      if (!this.isBtnEnabled) return;
      this.setState('hover');
      if (this.clickHandler) {
        this.clickHandler();
      }
    });

    this.hitZone.on('pointercancel', () => {
      if (!this.isBtnEnabled) return;
      this.setState('default');
    });
  }

  private playPressAnimation(): void {
    const prefersReducedMotion =
      (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      Boolean(graphicsSettings.getState().reducedMotion);

    if (prefersReducedMotion) return;

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: uiTokens.motionMs.fast / 2,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
  }

  /**
   * Cập nhật trạng thái hiển thị
   */
  public setState(state: UIComponentState): this {
    this.currentState = state;
    this.renderVisual();
    return this;
  }

  public getState(): UIComponentState {
    return this.currentState;
  }

  /**
   * Bật / tắt khả năng tương tác
   */
  public setEnabled(enabled: boolean): this {
    this.isBtnEnabled = enabled;
    this.currentState = enabled ? 'default' : 'disabled';
    this.hitZone.input && (this.hitZone.input.cursor = enabled ? 'pointer' : 'default');
    this.renderVisual();
    return this;
  }

  public isEnabled(): boolean {
    return this.isBtnEnabled;
  }

  /**
   * Cập nhật văn bản nút
   */
  public setText(text: string): this {
    this.btnText = text;
    this.labelText.setText(text);
    return this;
  }

  public getText(): string {
    return this.btnText;
  }

  /**
   * Cập nhật biến thể màu sắc
   */
  public setVariant(variant: ActionButtonVariant): this {
    this.variant = variant;
    this.renderVisual();
    return this;
  }

  public setOnClick(callback: () => void): this {
    this.clickHandler = callback;
    return this;
  }

  /**
   * Vẽ lại toàn bộ hình khối đồ họa của nút theo state và variant
   */
  private renderVisual(): void {
    const g = this.backgroundGraphics;
    g.clear();

    const w = this.btnWidth;
    const h = this.btnHeight;
    const halfW = w / 2;
    const halfH = h / 2;
    const radius = uiTokens.radius.md; // 10px

    let bgColor = uiNumericColors.surface;
    let borderColor = uiNumericColors.border;
    let textColor: string = uiTokens.colors.text;
    let borderWidth = 2;
    let alpha = 0.95;

    // Biến thể màu cơ sở
    if (this.variant === 'primary') {
      bgColor = uiNumericColors.surfaceRaised;
      borderColor = uiNumericColors.accent;
    } else if (this.variant === 'secondary') {
      bgColor = uiNumericColors.surface;
      borderColor = uiNumericColors.border;
    } else if (this.variant === 'danger') {
      bgColor = uiNumericColors.bronzeDark;
      borderColor = uiNumericColors.danger;
      textColor = uiTokens.colors.danger;
    } else if (this.variant === 'ghost') {
      bgColor = uiNumericColors.bg;
      borderColor = uiNumericColors.border;
      alpha = 0.6;
    }

    // Điều chỉnh theo trạng thái
    if (!this.isBtnEnabled || this.currentState === 'disabled') {
      bgColor = uiNumericColors.bg;
      borderColor = uiNumericColors.disabled;
      textColor = uiTokens.colors.disabled;
      alpha = 0.5;
      borderWidth = 1;
    } else if (this.currentState === 'hover') {
      bgColor = uiNumericColors.surfaceRaised;
      borderColor = uiNumericColors.gold;
      textColor = '#FFFFFF';
      alpha = 1.0;
      borderWidth = 2;
    } else if (this.currentState === 'pressed' || this.currentState === 'active') {
      bgColor = uiNumericColors.bronzeDark;
      borderColor = uiNumericColors.gold;
      textColor = uiTokens.colors.gold;
      alpha = 1.0;
    }

    // 1. Thân nút bo tròn
    g.fillStyle(bgColor, alpha);
    g.fillRoundedRect(-halfW, -halfH, w, h, radius);

    // 2. Viền đồng
    g.lineStyle(borderWidth, borderColor, alpha);
    g.strokeRoundedRect(-halfW, -halfH, w, h, radius);

    // 3. Motif Đông Sơn: 4 đinh đồng góc & viền chỉ vàng nhạt
    if (this.isBtnEnabled && this.variant !== 'ghost') {
      const rivetOffset = 7;
      const rivetColor = this.currentState === 'hover' ? uiNumericColors.gold : uiNumericColors.accent;
      const rivetAlpha = this.currentState === 'hover' ? 1.0 : 0.8;

      g.fillStyle(rivetColor, rivetAlpha);
      g.fillCircle(-halfW + rivetOffset, -halfH + rivetOffset, 2);
      g.fillCircle(halfW - rivetOffset, -halfH + rivetOffset, 2);
      g.fillCircle(-halfW + rivetOffset, halfH - rivetOffset, 2);
      g.fillCircle(halfW - rivetOffset, halfH - rivetOffset, 2);

      // Điểm xuyết viền nổi nhẹ ở cạnh trên
      g.lineStyle(1, uiNumericColors.accent, 0.4);
      g.beginPath();
      g.moveTo(-halfW + radius, -halfH + 2);
      g.lineTo(halfW - radius, -halfH + 2);
      g.strokePath();
    }

    this.labelText.setColor(textColor);
  }

  public override destroy(fromScene?: boolean): void {
    if (this.scene) {
      this.scene.tweens.killTweensOf(this);
    }
    super.destroy(fromScene);
  }
}
