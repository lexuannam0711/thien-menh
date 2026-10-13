/**
 * ItemSlot Component
 * Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Slot trang bị / vật phẩm dùng nhanh (cho thanh phím tắt 5..8 hoặc bình máu, bình linh dược):
 * - Kế thừa Phaser.GameObjects.Container
 * - Kích thước chuẩn tối thiểu 44-48px, đảm bảo chuẩn cảm ứng
 * - Viền đồng Đông Sơn cổ kính
 * - Hiển thị icon vật phẩm, số lượng chồng (stack count) ở góc dưới phải
 * - Hiển thị nhãn phím nhanh (5, 6, 7, 8) góc trên trái
 * - Hiệu ứng cooldown mờ khi vật phẩm đang trong thời gian hồi
 * - Trạng thái ô trống (empty slot) tinh tế
 */

import Phaser from 'phaser';
import {
  uiTokens,
  uiNumericColors,
  uiTypography,
} from '../design-tokens';
import { graphicsSettings } from '../../rendering/GraphicsSettings';

export interface ItemSlotData {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly hotkey?: string;
  readonly iconKey?: string;
  readonly iconType?: 'heal' | 'mana' | 'buff' | 'generic';
}

export interface ItemSlotOptions {
  x?: number;
  y?: number;
  size?: number;
  item?: ItemSlotData | null;
  hotkey?: string;
  showHotkey?: boolean;
  onPress?: () => void;
}

export class ItemSlot extends Phaser.GameObjects.Container {
  private size: number;
  private item: ItemSlotData | null = null;
  private hotkeyLabel = '';
  private showHotkey: boolean;
  private remainingCooldownMs = 0;
  private totalCooldownMs = 0;
  private pressHandler?: () => void;

  // Visuals
  private bgGraphics: Phaser.GameObjects.Graphics;
  private iconGraphics: Phaser.GameObjects.Graphics;
  private iconSprite?: Phaser.GameObjects.Image;
  private cooldownGraphics: Phaser.GameObjects.Graphics;
  private quantityText: Phaser.GameObjects.Text;
  private hotkeyText: Phaser.GameObjects.Text;
  private hitZone: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene, options: ItemSlotOptions = {}) {
    super(scene, options.x ?? 0, options.y ?? 0);

    this.size = Math.max(44, options.size ?? 48);
    this.item = options.item ?? null;
    this.hotkeyLabel = options.hotkey ?? options.item?.hotkey ?? '';
    this.showHotkey = options.showHotkey ?? true;
    this.pressHandler = options.onPress;

    // 1. Frame & Background
    this.bgGraphics = scene.add.graphics();
    this.add(this.bgGraphics);

    // 2. Icon graphics
    this.iconGraphics = scene.add.graphics();
    this.add(this.iconGraphics);

    // 3. Cooldown overlay
    this.cooldownGraphics = scene.add.graphics();
    this.add(this.cooldownGraphics);

    // 4. Hotkey badge text (top-left)
    this.hotkeyText = scene.add.text(
      -this.size / 2 + 3,
      -this.size / 2 + 2,
      this.hotkeyLabel,
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: uiTokens.colors.gold,
        fontStyle: 'bold',
        stroke: '#101518',
        strokeThickness: 2,
      }
    ).setOrigin(0, 0);
    this.add(this.hotkeyText);

    // 5. Quantity count text (bottom-right)
    this.quantityText = scene.add.text(
      this.size / 2 - 3,
      this.size / 2 - 2,
      '',
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: '#FFFFFF',
        fontStyle: 'bold',
        stroke: '#101518',
        strokeThickness: 2,
      }
    ).setOrigin(1, 1);
    this.add(this.quantityText);

    // 6. Interactive Hit Zone
    this.hitZone = scene.add.zone(0, 0, this.size, this.size)
      .setInteractive({ useHandCursor: this.item !== null && this.item.quantity > 0 });
    this.add(this.hitZone);

    this.setupInteractions();
    this.renderAll();

    scene.add.existing(this);
  }

  private setupInteractions(): void {
    this.hitZone.on('pointerover', () => {
      if (!this.item || this.item.quantity <= 0) return;
      this.renderFrame(true);
    });

    this.hitZone.on('pointerout', () => {
      this.renderFrame(false);
    });

    this.hitZone.on('pointerdown', () => {
      if (!this.item || this.item.quantity <= 0 || this.remainingCooldownMs > 0) return;
      this.playPressAnimation();
      if (this.pressHandler) {
        this.pressHandler();
      }
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
      scaleX: 0.94,
      scaleY: 0.94,
      duration: uiTokens.motionMs.fast / 2,
      yoyo: true,
      ease: 'Quad.easeInOut',
    });
  }

  /**
   * Cập nhật vật phẩm trong slot
   */
  public setItem(item: ItemSlotData | null): this {
    this.item = item;
    if (item?.hotkey) {
      this.hotkeyLabel = item.hotkey;
    }
    this.renderAll();
    return this;
  }

  public getItem(): ItemSlotData | null {
    return this.item;
  }

  /**
   * Cập nhật số lượng vật phẩm
   */
  public setQuantity(count: number): this {
    if (this.item) {
      this.item = { ...this.item, quantity: Math.max(0, count) };
    }
    this.renderQuantity();
    return this;
  }

  /**
   * Cập nhật thời gian hồi chiêu của vật phẩm
   */
  public setCooldown(remainingMs: number, totalMs: number): this {
    this.remainingCooldownMs = Math.max(0, remainingMs);
    this.totalCooldownMs = Math.max(1, totalMs);
    this.renderCooldown();
    return this;
  }

  /**
   * Ẩn/hiện phím tắt
   */
  public setShowHotkey(show: boolean): this {
    this.showHotkey = show;
    this.hotkeyText.setVisible(show && this.hotkeyLabel.length > 0);
    return this;
  }

  public setOnPress(fn: () => void): this {
    this.pressHandler = fn;
    return this;
  }

  private renderAll(): void {
    this.renderFrame(false);
    this.renderIcon();
    this.renderQuantity();
    this.renderCooldown();
    this.renderHotkey();
  }

  private renderFrame(isHovered: boolean): void {
    const g = this.bgGraphics;
    g.clear();

    const half = this.size / 2;
    const radius = uiTokens.radius.sm; // 6px
    const isEmpty = !this.item || this.item.quantity <= 0;

    const bgColor = isEmpty
      ? uiNumericColors.bg
      : isHovered
      ? uiNumericColors.surfaceRaised
      : uiNumericColors.surface;

    const borderColor = isEmpty
      ? uiNumericColors.border
      : isHovered
      ? uiNumericColors.gold
      : uiNumericColors.accent;

    const alpha = isEmpty ? 0.45 : 0.95;

    g.fillStyle(bgColor, alpha);
    g.fillRoundedRect(-half, -half, this.size, this.size, radius);

    g.lineStyle(isHovered ? 2 : 1.5, borderColor, isHovered ? 1.0 : 0.7);
    g.strokeRoundedRect(-half, -half, this.size, this.size, radius);

    // Điểm nhấn Đông Sơn nhỏ ở 4 góc
    if (!isEmpty) {
      g.fillStyle(uiNumericColors.accent, 0.6);
      g.fillCircle(-half + 4, -half + 4, 1.2);
      g.fillCircle(half - 4, -half + 4, 1.2);
      g.fillCircle(-half + 4, half - 4, 1.2);
      g.fillCircle(half - 4, half - 4, 1.2);
    }
  }

  private renderIcon(): void {
    const g = this.iconGraphics;
    g.clear();

    if (!this.item || this.item.quantity <= 0) {
      if (this.iconSprite) {
        this.iconSprite.setVisible(false);
      }
      return;
    }

    if (this.item.iconKey && this.scene.textures.exists(this.item.iconKey)) {
      if (!this.iconSprite) {
        this.iconSprite = this.scene.add.image(0, 0, this.item.iconKey);
        this.add(this.iconSprite);
      }
      this.iconSprite.setVisible(true);
      this.iconSprite.setDisplaySize(this.size - 14, this.size - 14);
      return;
    }

    // Procedural icon cho dược phẩm và bùa
    const iconType = this.item.iconType ?? 'generic';
    const half = this.size / 2;

    if (iconType === 'heal') {
      // Bình hồ lô huyết dược đỏ
      g.fillStyle(uiNumericColors.danger, 0.9);
      g.fillCircle(0, 3, 10);
      g.fillCircle(0, -5, 6);
      g.fillStyle(uiNumericColors.gold, 0.9);
      g.fillRect(-2, -12, 4, 4);
    } else if (iconType === 'mana') {
      // Bình linh dược xanh
      g.fillStyle(uiNumericColors.mana, 0.9);
      g.fillCircle(0, 3, 10);
      g.fillCircle(0, -5, 6);
      g.fillStyle(uiNumericColors.gold, 0.9);
      g.fillRect(-2, -12, 4, 4);
    } else if (iconType === 'buff') {
      // Bùa hộ mệnh Văn Lang vàng
      g.fillStyle(uiNumericColors.gold, 0.9);
      g.fillRoundedRect(-8, -10, 16, 20, 3);
      g.lineStyle(1.5, uiNumericColors.bronzeDark, 0.9);
      g.strokeCircle(0, 0, 4);
    } else {
      // Generic item
      g.fillStyle(uiNumericColors.accent, 0.85);
      g.fillCircle(0, 0, 9);
      g.lineStyle(1, 0xffffff, 0.7);
      g.strokeCircle(0, 0, 6);
    }
  }

  private renderQuantity(): void {
    if (!this.item || this.item.quantity <= 1) {
      this.quantityText.setVisible(false);
      return;
    }

    this.quantityText.setText(`${this.item.quantity}`).setVisible(true);
  }

  private renderCooldown(): void {
    const g = this.cooldownGraphics;
    g.clear();

    if (this.remainingCooldownMs <= 0 || !this.item) {
      return;
    }

    const progress = Math.min(1, this.remainingCooldownMs / this.totalCooldownMs);
    const half = this.size / 2;
    const radius = uiTokens.radius.sm;

    // Lớp phủ mờ quét từ dưới lên hoặc từ trên xuống
    g.fillStyle(0x000000, 0.65);
    const fillHeight = this.size * progress;
    g.fillRect(-half, half - fillHeight, this.size, fillHeight);
  }

  private renderHotkey(): void {
    const shouldShow = this.showHotkey && this.hotkeyLabel.length > 0;
    this.hotkeyText.setVisible(shouldShow);
    if (shouldShow) {
      this.hotkeyText.setText(this.hotkeyLabel);
    }
  }

  public override destroy(fromScene?: boolean): void {
    if (this.scene) {
      this.scene.tweens.killTweensOf(this);
    }
    super.destroy(fromScene);
  }
}
