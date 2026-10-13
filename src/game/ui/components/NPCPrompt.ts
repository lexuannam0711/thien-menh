/**
 * NPCPrompt Component
 * Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Badge ngữ cảnh tương tác khi người chơi ở gần NPC hoặc vật thể tương tác:
 * - Hiển thị phím tắt nổi bật: [ F ] + Tên hành động ("Trò chuyện", "Vào phó bản",...)
 * - Tạo hình compact phong cách thẻ đồng Đông Sơn cổ điển
 * - Xuất hiện mượt mà bằng tween fade-in / float nhẹ, ẩn đi khi ra xa
 * - Tôn trọng reducedMotion
 * - Giữ không gian thông thoáng, không che khuất tầm nhìn của nhân vật
 */

import Phaser from 'phaser';
import {
  uiTokens,
  uiNumericColors,
  uiTypography,
} from '../design-tokens';
import { UI_DEPTH } from '../../../data/config';
import { graphicsSettings } from '../../rendering/GraphicsSettings';

export interface NPCPromptOptions {
  x?: number;
  y?: number;
  key?: string;
  actionText?: string;
}

export class NPCPrompt extends Phaser.GameObjects.Container {
  private promptKey: string;
  private actionText: string;
  private isShown = false;

  private bgGraphics: Phaser.GameObjects.Graphics;
  private keyBadgeGraphics: Phaser.GameObjects.Graphics;
  private keyTextObj: Phaser.GameObjects.Text;
  private labelTextObj: Phaser.GameObjects.Text;

  private baseOffsetY = 0;

  constructor(scene: Phaser.Scene, options: NPCPromptOptions = {}) {
    super(scene, options.x ?? 0, options.y ?? 0);

    this.promptKey = options.key ?? 'F';
    this.actionText = options.actionText ?? 'Trò chuyện';

    this.setDepth(UI_DEPTH + 50);
    this.setAlpha(0);
    this.setVisible(false);

    // 1. Background panel
    this.bgGraphics = scene.add.graphics();
    this.add(this.bgGraphics);

    // 2. Key badge background
    this.keyBadgeGraphics = scene.add.graphics();
    this.add(this.keyBadgeGraphics);

    // 3. Key label
    this.keyTextObj = scene.add.text(0, 0, this.promptKey, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '12px',
      color: uiTokens.colors.gold,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.add(this.keyTextObj);

    // 4. Action text
    this.labelTextObj = scene.add.text(0, 0, this.actionText, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: uiTokens.colors.text,
      fontStyle: 'bold',
      stroke: '#10251F',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.add(this.labelTextObj);

    this.renderPrompt();
    scene.add.existing(this);
  }

  /**
   * Hiển thị prompt với nội dung tương tác mới
   */
  public showPrompt(key: string, action: string, x?: number, y?: number): this {
    this.promptKey = key;
    this.actionText = action;
    if (x !== undefined && y !== undefined) {
      this.setPosition(x, y);
      this.baseOffsetY = y;
    }

    this.renderPrompt();

    if (this.isShown) {
      return this;
    }

    this.isShown = true;
    this.setVisible(true);

    const prefersReducedMotion =
      (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      Boolean(graphicsSettings.getState().reducedMotion);

    if (prefersReducedMotion) {
      this.setAlpha(1);
      return this;
    }

    this.scene.tweens.killTweensOf(this);
    this.setAlpha(0);
    this.y = this.baseOffsetY + 6;

    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      y: this.baseOffsetY,
      duration: uiTokens.motionMs.normal,
      ease: 'Back.easeOut',
    });

    return this;
  }

  /**
   * Ẩn prompt khi nhân vật rời xa khỏi tầm tương tác
   */
  public hidePrompt(): this {
    if (!this.isShown) {
      return this;
    }

    this.isShown = false;

    const prefersReducedMotion =
      (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      Boolean(graphicsSettings.getState().reducedMotion);

    if (prefersReducedMotion) {
      this.setAlpha(0);
      this.setVisible(false);
      return this;
    }

    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.baseOffsetY - 4,
      duration: uiTokens.motionMs.fast,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this.isShown) {
          this.setVisible(false);
        }
      },
    });

    return this;
  }

  public isPromptVisible(): boolean {
    return this.isShown;
  }

  public getPromptText(): string {
    return `${this.promptKey} — ${this.actionText}`;
  }

  /**
   * Cập nhật vị trí neo phía trên đầu NPC/vật thể
   */
  public updateWorldPosition(worldX: number, worldY: number, offsetY = -45): this {
    this.setPosition(worldX, worldY + offsetY);
    this.baseOffsetY = worldY + offsetY;
    return this;
  }

  /**
   * Vẽ lại các thành phần đồ họa của thẻ prompt
   */
  private renderPrompt(): void {
    this.keyTextObj.setText(this.promptKey);
    this.labelTextObj.setText(this.actionText);

    // Tính kích thước tự động theo chiều dài chữ
    const keyBadgeWidth = 24;
    const keyBadgeHeight = 22;
    const padding = 10;
    const spacing = 8;
    const textWidth = this.labelTextObj.width;
    const totalWidth = padding + keyBadgeWidth + spacing + textWidth + padding;
    const totalHeight = 32;
    const radius = uiTokens.radius.md; // 10px

    const halfW = totalWidth / 2;
    const halfH = totalHeight / 2;

    // 1. Background Panel
    const bg = this.bgGraphics;
    bg.clear();
    bg.fillStyle(uiNumericColors.bronzeDark, 0.92);
    bg.fillRoundedRect(-halfW, -halfH, totalWidth, totalHeight, radius);

    // Viền đồng
    bg.lineStyle(1.5, uiNumericColors.border, 0.9);
    bg.strokeRoundedRect(-halfW, -halfH, totalWidth, totalHeight, radius);

    // Điểm nhấn Đông Sơn nhỏ ở cạnh dưới
    bg.fillStyle(uiNumericColors.gold, 0.75);
    bg.fillCircle(-halfW + 6, 0, 1.5);
    bg.fillCircle(halfW - 6, 0, 1.5);

    // 2. Key badge
    const badgeX = -halfW + padding + keyBadgeWidth / 2;
    const badgeY = 0;

    const kb = this.keyBadgeGraphics;
    kb.clear();
    kb.fillStyle(uiNumericColors.surfaceRaised, 0.95);
    kb.fillRoundedRect(
      badgeX - keyBadgeWidth / 2,
      badgeY - keyBadgeHeight / 2,
      keyBadgeWidth,
      keyBadgeHeight,
      uiTokens.radius.sm
    );
    kb.lineStyle(1, uiNumericColors.accent, 0.85);
    kb.strokeRoundedRect(
      badgeX - keyBadgeWidth / 2,
      badgeY - keyBadgeHeight / 2,
      keyBadgeWidth,
      keyBadgeHeight,
      uiTokens.radius.sm
    );

    this.keyTextObj.setPosition(badgeX, badgeY);

    // 3. Action text
    const textStartX = badgeX + keyBadgeWidth / 2 + spacing;
    this.labelTextObj.setPosition(textStartX, 0);
  }

  public override destroy(fromScene?: boolean): void {
    if (this.scene) {
      this.scene.tweens.killTweensOf(this);
    }
    super.destroy(fromScene);
  }
}
