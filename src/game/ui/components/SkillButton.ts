/**
 * SkillButton Component
 * Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Nút slot kỹ năng dùng cho HUD (1..4 trên PC hoặc cụm phím touch trên Mobile):
 * - Viền đồng cổ tinh tế, phong cách cổ xưa Văn Lang
 * - Icon kỹ năng (hỗ trợ texture Phaser hoặc vẽ procedural icon)
 * - Hotkey badge rõ nét trên PC; ẩn trên Mobile để tối đa hóa không gian icon
 * - Cooldown overlay: quét radial hoặc thanh tiến trình + số giây đếm ngược
 * - MP cost indicator: hiển thị lượng MP tiêu hao, cảnh báo đỏ khi thiếu MP
 * - Trạng thái Locked / Empty khi chưa mở khóa slot (hiển thị ổ khóa và cấp độ mở khóa)
 * - Tooltip hiển thị tên kỹ năng, mô tả và thời gian hồi chiêu khi hover trên Desktop
 */

import Phaser from 'phaser';
import {
  uiTokens,
  uiNumericColors,
  uiTypography,
} from '../design-tokens';
import { UI_DEPTH } from '../../../data/config';
import { graphicsSettings } from '../../rendering/GraphicsSettings';

export interface SkillInfo {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly hotkey: string;
  readonly mpCost: number;
  readonly cooldownMs: number;
  readonly iconKey?: string;
  readonly iconColor?: number;
}

export interface SkillButtonOptions {
  x?: number;
  y?: number;
  size?: number;
  slotIndex?: number;
  skill?: SkillInfo | null;
  showHotkey?: boolean;
  locked?: boolean;
  unlockLevel?: number;
  onPress?: () => void;
}

export class SkillButton extends Phaser.GameObjects.Container {
  private size: number;
  private skill: SkillInfo | null = null;
  private showHotkey: boolean;
  private isLocked: boolean;
  private unlockLevel: number;
  private remainingCooldownMs = 0;
  private totalCooldownMs = 0;
  private currentMp = 100;
  private onPressHandler?: () => void;

  // Visual layers
  private bgGraphics: Phaser.GameObjects.Graphics;
  private iconGraphics: Phaser.GameObjects.Graphics;
  private iconSprite?: Phaser.GameObjects.Image;
  private cooldownGraphics: Phaser.GameObjects.Graphics;
  private cooldownText: Phaser.GameObjects.Text;
  private hotkeyBadgeBg: Phaser.GameObjects.Graphics;
  private hotkeyBadgeText: Phaser.GameObjects.Text;
  private mpCostText: Phaser.GameObjects.Text;
  private lockText: Phaser.GameObjects.Text;
  private hitZone: Phaser.GameObjects.Zone;

  // Tooltip
  private tooltipContainer?: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, options: SkillButtonOptions = {}) {
    super(scene, options.x ?? 0, options.y ?? 0);

    // Kích thước slot tối thiểu 48px
    this.size = Math.max(48, options.size ?? 54);
    this.skill = options.skill ?? null;
    this.showHotkey = options.showHotkey ?? true;
    this.isLocked = options.locked ?? false;
    this.unlockLevel = options.unlockLevel ?? 1;
    this.onPressHandler = options.onPress;

    // 1. Base background
    this.bgGraphics = scene.add.graphics();
    this.add(this.bgGraphics);

    // 2. Icon graphics
    this.iconGraphics = scene.add.graphics();
    this.add(this.iconGraphics);

    // 3. Cooldown overlay graphics & text
    this.cooldownGraphics = scene.add.graphics();
    this.add(this.cooldownGraphics);

    this.cooldownText = scene.add.text(0, 0, '', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: `${Math.round(this.size * 0.32)}px`,
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center',
    }).setOrigin(0.5, 0.5).setVisible(false);
    this.add(this.cooldownText);

    // 4. Hotkey badge (Góc trên bên trái)
    this.hotkeyBadgeBg = scene.add.graphics();
    this.add(this.hotkeyBadgeBg);

    this.hotkeyBadgeText = scene.add.text(
      -this.size / 2 + 3,
      -this.size / 2 + 3,
      this.skill?.hotkey ?? '',
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: uiTokens.colors.gold,
        fontStyle: 'bold',
      }
    ).setOrigin(0, 0);
    this.add(this.hotkeyBadgeText);

    // 5. MP Cost indicator (Góc dưới bên phải)
    this.mpCostText = scene.add.text(
      this.size / 2 - 3,
      this.size / 2 - 3,
      '',
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '10px',
        color: uiTokens.colors.mana,
        fontStyle: 'bold',
        stroke: '#101518',
        strokeThickness: 2,
      }
    ).setOrigin(1, 1);
    this.add(this.mpCostText);

    // 6. Lock indicator
    this.lockText = scene.add.text(0, 0, '🔒', {
      fontSize: `${Math.round(this.size * 0.4)}px`,
      color: uiTokens.colors.disabled,
    }).setOrigin(0.5, 0.5).setVisible(this.isLocked);
    this.add(this.lockText);

    // 7. Interactive Zone
    this.hitZone = scene.add.zone(0, 0, this.size, this.size)
      .setInteractive({ useHandCursor: !this.isLocked && this.skill !== null });
    this.add(this.hitZone);

    this.setupInteractions();
    this.renderAll();

    scene.add.existing(this);
  }

  private setupInteractions(): void {
    this.hitZone.on('pointerover', () => {
      if (this.isLocked || !this.skill) return;
      this.renderFrame(true);
      this.showTooltip();
    });

    this.hitZone.on('pointerout', () => {
      this.renderFrame(false);
      this.hideTooltip();
    });

    this.hitZone.on('pointerdown', () => {
      if (this.isLocked || !this.skill || this.remainingCooldownMs > 0) return;
      this.playPressAnimation();
      if (this.onPressHandler) {
        this.onPressHandler();
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
   * Cập nhật thông tin kỹ năng gán vào ô
   */
  public setSkill(skill: SkillInfo | null): this {
    this.skill = skill;
    this.renderAll();
    return this;
  }

  public getSkill(): SkillInfo | null {
    return this.skill;
  }

  /**
   * Cập nhật tiến trình hồi chiêu
   */
  public setCooldown(remainingMs: number, totalMs: number): this {
    this.remainingCooldownMs = Math.max(0, remainingMs);
    this.totalCooldownMs = Math.max(1, totalMs);
    this.renderCooldown();
    return this;
  }

  public getCooldownRemaining(): number {
    return this.remainingCooldownMs;
  }

  /**
   * Cập nhật lượng MP hiện tại của nhân vật
   */
  public setMp(currentMp: number): this {
    this.currentMp = currentMp;
    this.renderMpCost();
    return this;
  }

  /**
   * Cập nhật trạng thái khóa ô kỹ năng
   */
  public setLocked(locked: boolean, unlockLevel = 1): this {
    this.isLocked = locked;
    this.unlockLevel = unlockLevel;
    this.lockText.setVisible(locked);
    this.renderAll();
    return this;
  }

  public isSlotLocked(): boolean {
    return this.isLocked;
  }

  /**
   * Ẩn/hiện hotkey badge (trên PC hiện, Mobile ẩn)
   */
  public setShowHotkey(show: boolean): this {
    this.showHotkey = show;
    this.hotkeyBadgeBg.setVisible(show && this.skill !== null);
    this.hotkeyBadgeText.setVisible(show && this.skill !== null);
    return this;
  }

  public setOnPress(fn: () => void): this {
    this.onPressHandler = fn;
    return this;
  }

  /**
   * Vẽ lại toàn bộ component
   */
  private renderAll(): void {
    this.renderFrame(false);
    this.renderIcon();
    this.renderCooldown();
    this.renderMpCost();
    this.renderHotkey();
  }

  private renderFrame(isHovered: boolean): void {
    const g = this.bgGraphics;
    g.clear();

    const half = this.size / 2;
    const radius = uiTokens.radius.md; // 10px

    if (this.isLocked) {
      g.fillStyle(uiNumericColors.bg, 0.8);
      g.fillRoundedRect(-half, -half, this.size, this.size, radius);
      g.lineStyle(1.5, uiNumericColors.disabled, 0.4);
      g.strokeRoundedRect(-half, -half, this.size, this.size, radius);
      return;
    }

    if (!this.skill) {
      // Empty slot
      g.fillStyle(uiNumericColors.surface, 0.5);
      g.fillRoundedRect(-half, -half, this.size, this.size, radius);
      g.lineStyle(1.5, uiNumericColors.border, 0.4);
      g.strokeRoundedRect(-half, -half, this.size, this.size, radius);
      return;
    }

    const hasEnoughMp = this.skill.mpCost <= this.currentMp;
    const bgColor = isHovered ? uiNumericColors.surfaceRaised : uiNumericColors.surface;
    const borderColor = isHovered
      ? uiNumericColors.gold
      : hasEnoughMp
      ? uiNumericColors.border
      : uiNumericColors.danger;

    g.fillStyle(bgColor, 0.95);
    g.fillRoundedRect(-half, -half, this.size, this.size, radius);

    g.lineStyle(isHovered ? 2.5 : 1.5, borderColor, isHovered ? 1.0 : 0.85);
    g.strokeRoundedRect(-half, -half, this.size, this.size, radius);

    // Góc đồng trang trí
    const rivetOffset = 5;
    g.fillStyle(isHovered ? uiNumericColors.gold : uiNumericColors.accent, 0.7);
    g.fillCircle(-half + rivetOffset, -half + rivetOffset, 1.5);
    g.fillCircle(half - rivetOffset, -half + rivetOffset, 1.5);
    g.fillCircle(-half + rivetOffset, half - rivetOffset, 1.5);
    g.fillCircle(half - rivetOffset, half - rivetOffset, 1.5);
  }

  private renderIcon(): void {
    const g = this.iconGraphics;
    g.clear();

    if (this.isLocked || !this.skill) {
      if (this.iconSprite) {
        this.iconSprite.setVisible(false);
      }
      return;
    }

    const hasEnoughMp = this.skill.mpCost <= this.currentMp;
    const iconAlpha = hasEnoughMp ? 1.0 : 0.45;
    const iconColor = this.skill.iconColor ?? uiNumericColors.accent;

    // Nếu có texture đã load trong Phaser
    if (this.skill.iconKey && this.scene.textures.exists(this.skill.iconKey)) {
      if (!this.iconSprite) {
        this.iconSprite = this.scene.add.image(0, 0, this.skill.iconKey);
        this.add(this.iconSprite);
      }
      this.iconSprite.setVisible(true);
      this.iconSprite.setDisplaySize(this.size - 16, this.size - 16);
      this.iconSprite.setAlpha(iconAlpha);
      return;
    }

    // Nếu không có texture, vẽ procedural motif biểu tượng kỹ năng
    const rad = this.size * 0.28;
    g.fillStyle(iconColor, iconAlpha * 0.85);
    g.fillCircle(0, 0, rad);

    // Viền sáng bên trong
    g.lineStyle(1.5, 0xffffff, iconAlpha * 0.6);
    g.strokeCircle(0, 0, rad * 0.7);

    // Ký tự viết tắt tên chiêu
    const initial = this.skill.name.charAt(0).toUpperCase();
    g.fillStyle(0xffffff, iconAlpha);
  }

  private renderCooldown(): void {
    const g = this.cooldownGraphics;
    g.clear();

    if (this.remainingCooldownMs <= 0 || !this.skill || this.isLocked) {
      this.cooldownText.setVisible(false);
      return;
    }

    const progress = Math.min(1, this.remainingCooldownMs / this.totalCooldownMs);
    const half = this.size / 2;
    const radius = uiTokens.radius.md;

    // Overlay mờ che ô kỹ năng
    g.fillStyle(0x000000, 0.65);
    g.fillRoundedRect(-half, -half, this.size, this.size, radius);

    // Vòng quét tiến trình hồi chiêu
    const angleEnd = Phaser.Math.DegToRad(progress * 360 - 90);
    g.lineStyle(3, uiNumericColors.mana, 0.9);
    g.beginPath();
    g.arc(0, 0, half - 5, Phaser.Math.DegToRad(-90), angleEnd, false);
    g.strokePath();

    // Text giây còn lại
    const seconds = (this.remainingCooldownMs / 1000).toFixed(
      this.remainingCooldownMs < 1000 ? 1 : 0
    );
    this.cooldownText.setText(`${seconds}s`).setVisible(true);
  }

  private renderMpCost(): void {
    if (!this.skill || this.isLocked || this.skill.mpCost <= 0) {
      this.mpCostText.setVisible(false);
      return;
    }

    const hasEnoughMp = this.skill.mpCost <= this.currentMp;
    this.mpCostText
      .setText(`${this.skill.mpCost}`)
      .setColor(hasEnoughMp ? uiTokens.colors.mana : uiTokens.colors.danger)
      .setVisible(true);
  }

  private renderHotkey(): void {
    const g = this.hotkeyBadgeBg;
    g.clear();

    const shouldShow = this.showHotkey && this.skill !== null && !this.isLocked;
    this.hotkeyBadgeBg.setVisible(shouldShow);
    this.hotkeyBadgeText.setVisible(shouldShow);

    if (!shouldShow || !this.skill) return;

    this.hotkeyBadgeText.setText(this.skill.hotkey);

    const half = this.size / 2;
    g.fillStyle(uiNumericColors.surfaceRaised, 0.9);
    g.fillRoundedRect(-half + 2, -half + 2, 16, 14, 3);
    g.lineStyle(1, uiNumericColors.border, 0.8);
    g.strokeRoundedRect(-half + 2, -half + 2, 16, 14, 3);
  }

  private showTooltip(): void {
    if (!this.skill) return;

    this.hideTooltip();

    const tooltipWidth = 160;
    const tooltipHeight = 70;
    const padding = 8;

    const bg = this.scene.add.graphics();
    bg.fillStyle(uiNumericColors.bg, 0.95);
    bg.fillRoundedRect(0, 0, tooltipWidth, tooltipHeight, uiTokens.radius.sm);
    bg.lineStyle(1.5, uiNumericColors.gold, 0.9);
    bg.strokeRoundedRect(0, 0, tooltipWidth, tooltipHeight, uiTokens.radius.sm);

    const title = this.scene.add.text(padding, padding, this.skill.name, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '12px',
      color: uiTokens.colors.gold,
      fontStyle: 'bold',
    });

    const desc = this.scene.add.text(
      padding,
      padding + 18,
      this.skill.description,
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '10px',
        color: uiTokens.colors.textMuted,
        wordWrap: { width: tooltipWidth - padding * 2 },
      }
    );

    const costCd = this.scene.add.text(
      padding,
      tooltipHeight - 16,
      `Hao: ${this.skill.mpCost} MP | Hồi: ${(this.skill.cooldownMs / 1000).toFixed(1)}s`,
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '9px',
        color: uiTokens.colors.mana,
      }
    );

    this.tooltipContainer = this.scene.add.container(
      -tooltipWidth / 2,
      -this.size / 2 - tooltipHeight - 8,
      [bg, title, desc, costCd]
    ).setDepth(UI_DEPTH + 100);

    this.add(this.tooltipContainer);
  }

  private hideTooltip(): void {
    if (this.tooltipContainer) {
      this.tooltipContainer.destroy();
      this.tooltipContainer = undefined;
    }
  }

  public override destroy(fromScene?: boolean): void {
    this.hideTooltip();
    if (this.scene) {
      this.scene.tweens.killTweensOf(this);
    }
    super.destroy(fromScene);
  }
}
