/**
 * Màn hình Cài đặt Điều khiển (ControlsSettings)
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Xây dựng hoàn chỉnh bằng Phaser Container với phong cách Premium Ancient Bronze Fantasy (uiTokens):
 * - Tab 1: Bàn phím & Chuột (PC)
 *   + Danh sách các hành động: Tấn công, Né / Lướt, Kỹ năng 1..4, Vật phẩm 5..8, Tương tác (F), Túi đồ (B/I/Tab), Bản đồ (M).
 *   + Hiển thị phím hiện tại dưới dạng badge viền đồng.
 *   + Mở KeyCapture modal khi đổi phím.
 *   + Kiểm tra xung đột phím và hỗ trợ hoán đổi (swapBindings).
 *   + Tùy chọn PC: mouseAiming, rightClickDodge, holdToRepeatAttack.
 *   + Khôi phục mặc định PC.
 * - Tab 2: Cảm ứng (Mobile)
 *   + Tay thuận (handedness): Tay Phải / Tay Trái.
 *   + Tỉ lệ nút (controlScale: 80% .. 140%).
 *   + Độ mờ nút (buttonOpacity: 40% .. 100%).
 *   + Khoảng cách nút (buttonSpacing: 0.5x .. 2.0x).
 *   + Khung xem trước (Mini Preview) cập nhật thời gian thực.
 *   + Khôi phục mặc định Cảm ứng.
 * - Lưu và đóng an toàn, tương thích phím Escape, lưu ngay lập tức vào InputSettings (than-menh-controls-v2).
 */

import Phaser from 'phaser';
import { UI_DEPTH, W, H } from '../../../data/config';
import {
  uiTokens,
  uiNumericColors,
  uiTypography,
} from '../design-tokens';
import {
  InputSettingsManager,
  type InputSettingsData,
  type PcInputSettings,
  type MobileInputSettings,
} from '../../input/InputSettings';
import {
  formatKeyDisplayName,
  KeyCapture,
} from '../components/KeyCapture';
import {
  DEFAULT_KEY_BINDINGS,
  cloneBindings,
  findConflictingActions,
  swapBindings,
  type KeyBindingMap,
} from '../../input/InputBindings';
import type { GameAction } from '../../input/GameAction';
import { graphicsSettings } from '../../rendering/GraphicsSettings';

export interface ActionDisplayConfig {
  action: GameAction;
  label: string;
  category: 'combat' | 'skills' | 'items' | 'general';
}

export const REBINDABLE_ACTIONS: readonly ActionDisplayConfig[] = Object.freeze([
  { action: 'ATTACK', label: 'Tấn công', category: 'combat' },
  { action: 'DODGE', label: 'Né / Lướt', category: 'combat' },
  { action: 'INTERACT', label: 'Tương tác (F)', category: 'combat' },
  { action: 'SKILL_1', label: 'Kỹ năng 1', category: 'skills' },
  { action: 'SKILL_2', label: 'Kỹ năng 2', category: 'skills' },
  { action: 'SKILL_3', label: 'Kỹ năng 3', category: 'skills' },
  { action: 'SKILL_4', label: 'Kỹ năng 4', category: 'skills' },
  { action: 'QUICK_ITEM_1', label: 'Vật phẩm 5', category: 'items' },
  { action: 'QUICK_ITEM_2', label: 'Vật phẩm 6', category: 'items' },
  { action: 'QUICK_ITEM_3', label: 'Vật phẩm 7', category: 'items' },
  { action: 'QUICK_ITEM_4', label: 'Vật phẩm 8', category: 'items' },
  { action: 'INVENTORY', label: 'Túi đồ (B/I/Tab)', category: 'general' },
  { action: 'MAP', label: 'Bản đồ (M)', category: 'general' },
]);

export class ControlsSettings extends Phaser.GameObjects.Container {
  private settingsManager: InputSettingsManager;
  private currentSettings: InputSettingsData;
  private activeTab: 'pc' | 'mobile' = 'pc';

  // Modal visual components
  private backdrop: Phaser.GameObjects.Rectangle;
  private panelGraphics: Phaser.GameObjects.Graphics;
  private contentContainer: Phaser.GameObjects.Container;
  private previewGraphics: Phaser.GameObjects.Graphics;

  // Subcomponents
  private keyCapture: KeyCapture;
  private conflictBanner: Phaser.GameObjects.Container | null = null;

  // Event handlers
  private keyListener?: (event: KeyboardEvent) => void;
  private onCloseCallback?: () => void;
  private isModalOpen = false;

  constructor(scene: Phaser.Scene, onClose?: () => void) {
    super(scene, 0, 0);

    this.onCloseCallback = onClose;
    this.settingsManager = new InputSettingsManager();
    this.currentSettings = this.settingsManager.getSettings();

    this.setDepth(UI_DEPTH + 500);
    this.setVisible(false);
    this.setAlpha(0);

    // 1. Nền mờ bao phủ toàn màn hình
    this.backdrop = scene.add
      .rectangle(W / 2, H / 2, W * 1.5, H * 1.5, 0x060b0a, 0.82)
      .setInteractive();
    this.backdrop.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
    });
    this.add(this.backdrop);

    // 2. Khung viền và đồ họa chính
    this.panelGraphics = scene.add.graphics();
    this.add(this.panelGraphics);

    // 3. Container chứa nội dung tab động
    this.contentContainer = scene.add.container(0, 0);
    this.add(this.contentContainer);

    // 4. Graphics hiển thị mini preview cho mobile
    this.previewGraphics = scene.add.graphics();
    this.add(this.previewGraphics);

    // 5. Thành phần KeyCapture modal
    this.keyCapture = new KeyCapture(scene);
    this.add(this.keyCapture);

    scene.add.existing(this);
    this.setupKeyboardHandler();
  }

  public open(): this {
    this.isModalOpen = true;
    this.currentSettings = this.settingsManager.load();
    this.activeTab = 'pc';
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
        duration: uiTokens.motionMs.normal,
        ease: 'Quad.easeOut',
      });
    }

    this.renderModal();
    return this;
  }

  public close(): this {
    if (!this.isModalOpen) return this;
    if (this.keyCapture.isOpen()) {
      this.keyCapture.close();
      return this;
    }

    this.isModalOpen = false;
    this.clearConflictBanner();

    const prefersReducedMotion =
      (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      Boolean(graphicsSettings.getState().reducedMotion);

    if (prefersReducedMotion) {
      this.setAlpha(0);
      this.setVisible(false);
      this.onCloseCallback?.();
    } else {
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: uiTokens.motionMs.fast,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.setVisible(false);
          this.onCloseCallback?.();
        },
      });
    }

    return this;
  }

  public isOpen(): boolean {
    return this.isModalOpen;
  }

  public getSettings(): InputSettingsData {
    return this.currentSettings;
  }

  private setupKeyboardHandler(): void {
    this.keyListener = (event: KeyboardEvent) => {
      if (!this.isModalOpen) return;

      if (event.code === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (this.keyCapture.isOpen()) {
          this.keyCapture.close();
          return;
        }
        if (this.conflictBanner) {
          this.clearConflictBanner();
          return;
        }
        this.saveAndClose();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keyListener);
    }
  }

  private renderModal(): void {
    this.contentContainer.removeAll(true);
    this.clearConflictBanner();
    this.drawFrame();
    this.drawHeader();

    if (this.activeTab === 'pc') {
      this.previewGraphics.clear();
      this.renderPcTab();
    } else {
      this.renderMobileTab();
    }

    this.drawFooter();
  }

  private drawFrame(): void {
    const g = this.panelGraphics;
    g.clear();

    const panelX = W / 2 - 380;
    const panelY = H / 2 - 240;
    const panelW = 760;
    const panelH = 480;
    const r = uiTokens.radius.lg; // 14px

    // Nền tối đồng cổ
    g.fillStyle(uiNumericColors.surfaceRaised, 0.98);
    g.fillRoundedRect(panelX, panelY, panelW, panelH, r);

    // Viền ngoài đồng cổ đậm nét
    g.lineStyle(2.5, uiNumericColors.accent, 0.95);
    g.strokeRoundedRect(panelX, panelY, panelW, panelH, r);

    // Viền chỉ trang trí bên trong
    const pad = 7;
    g.lineStyle(1, uiNumericColors.border, 0.5);
    g.strokeRoundedRect(panelX + pad, panelY + pad, panelW - pad * 2, panelH - pad * 2, r - 3);

    // 4 đinh tán đồng tại 4 góc
    const rivet = 16;
    g.fillStyle(uiNumericColors.gold, 0.9);
    g.fillCircle(panelX + rivet, panelY + rivet, 3);
    g.fillCircle(panelX + panelW - rivet, panelY + rivet, 3);
    g.fillCircle(panelX + rivet, panelY + panelH - rivet, 3);
    g.fillCircle(panelX + panelW - rivet, panelY + panelH - rivet, 3);

    // Thanh phân cách tiêu đề
    g.lineStyle(1.5, uiNumericColors.border, 0.7);
    g.beginPath();
    g.moveTo(panelX + 24, panelY + 68);
    g.lineTo(panelX + panelW - 24, panelY + 68);
    g.strokePath();

    // Thanh phân cách chân trang
    g.lineStyle(1, uiNumericColors.border, 0.6);
    g.beginPath();
    g.moveTo(panelX + 24, panelY + panelH - 58);
    g.lineTo(panelX + panelW - 24, panelY + panelH - 58);
    g.strokePath();
  }

  private drawHeader(): void {
    const title = this.scene.add.text(W / 2, H / 2 - 216, 'CÀI ĐẶT ĐIỀU KHIỂN', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '22px',
      color: uiTokens.colors.gold,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.contentContainer.add(title);

    // Tabs selector
    const tabY = H / 2 - 188;
    const tab1Active = this.activeTab === 'pc';

    const tab1Btn = this.createButton(
      W / 2 - 130,
      tabY,
      220,
      32,
      '⌨ BÀN PHÍM & CHUỘT (PC)',
      () => {
        if (this.activeTab !== 'pc') {
          this.activeTab = 'pc';
          this.renderModal();
        }
      },
      tab1Active ? 0x473926 : 0x222a2c,
      tab1Active ? uiNumericColors.gold : uiNumericColors.border
    );
    this.contentContainer.add(tab1Btn);

    const tab2Active = this.activeTab === 'mobile';
    const tab2Btn = this.createButton(
      W / 2 + 130,
      tabY,
      220,
      32,
      '📱 CẢM ỨNG (MOBILE)',
      () => {
        if (this.activeTab !== 'mobile') {
          this.activeTab = 'mobile';
          this.renderModal();
        }
      },
      tab2Active ? 0x473926 : 0x222a2c,
      tab2Active ? uiNumericColors.gold : uiNumericColors.border
    );
    this.contentContainer.add(tab2Btn);
  }

  private renderPcTab(): void {
    const leftColX = W / 2 - 190;
    const rightColX = W / 2 + 180;
    const startY = H / 2 - 146;
    const rowH = 34;

    const leftActions = REBINDABLE_ACTIONS.slice(0, 7);
    const rightActions = REBINDABLE_ACTIONS.slice(7);

    // Cột trái: Combat & Skills
    leftActions.forEach((item, index) => {
      const y = startY + index * rowH;
      this.renderRebindRow(leftColX, y, item, 320);
    });

    // Cột phải: Items & General
    rightActions.forEach((item, index) => {
      const y = startY + index * rowH;
      this.renderRebindRow(rightColX, y, item, 320);
    });

    // Hàng tùy chọn PC (PC Options): Toggles
    const optionsY = startY + 7 * rowH + 8;
    const pc = this.currentSettings.pc;

    // 1. Mouse Aiming toggle
    const aimBtn = this.createToggleButton(
      W / 2 - 240,
      optionsY,
      210,
      28,
      'Ngắm chuột',
      pc.mouseAiming,
      () => {
        this.currentSettings.pc.mouseAiming = !this.currentSettings.pc.mouseAiming;
        this.renderModal();
      }
    );
    this.contentContainer.add(aimBtn);

    // 2. Right Click Dodge toggle
    const dodgeBtn = this.createToggleButton(
      W / 2,
      optionsY,
      210,
      28,
      'Chuột phải né',
      pc.rightClickDodge,
      () => {
        this.currentSettings.pc.rightClickDodge = !this.currentSettings.pc.rightClickDodge;
        this.renderModal();
      }
    );
    this.contentContainer.add(dodgeBtn);

    // 3. Hold to Repeat Attack toggle
    const holdBtn = this.createToggleButton(
      W / 2 + 240,
      optionsY,
      210,
      28,
      'Giữ chuột đánh liên tục',
      pc.holdToRepeatAttack,
      () => {
        this.currentSettings.pc.holdToRepeatAttack = !this.currentSettings.pc.holdToRepeatAttack;
        this.renderModal();
      }
    );
    this.contentContainer.add(holdBtn);

    // Nút Khôi phục mặc định PC
    const resetPcBtn = this.createButton(
      W / 2 - 240,
      H / 2 + 208,
      220,
      34,
      '↺ MẶC ĐỊNH BÀN PHÍM',
      () => {
        this.restorePcDefaults();
      },
      0x3d2724,
      uiNumericColors.danger
    );
    this.contentContainer.add(resetPcBtn);
  }

  private renderRebindRow(
    centerX: number,
    y: number,
    item: ActionDisplayConfig,
    width: number
  ): void {
    const halfW = width / 2;
    const labelX = centerX - halfW + 10;
    const badgeX = centerX + halfW - 55;

    // Tên hành động
    const label = this.scene.add.text(labelX, y, item.label, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: uiTokens.colors.text,
    }).setOrigin(0, 0.5);
    this.contentContainer.add(label);

    // Danh sách phím hiện tại
    const currentKeys = this.currentSettings.bindings[item.action] ?? [];
    const primaryKey = currentKeys[0] || 'Chưa gán';
    const displayKey = formatKeyDisplayName(primaryKey);

    // Badge phím viền đồng (nút bấm để đổi phím)
    const badgeBtn = this.createKeyBadge(badgeX, y, 95, 26, displayKey, () => {
      this.startKeyCapture(item.action, item.label);
    });
    this.contentContainer.add(badgeBtn);
  }

  private renderMobileTab(): void {
    const mobile = this.currentSettings.mobile;
    const startX = W / 2 - 220;
    const startY = H / 2 - 138;
    const stepY = 46;

    // 1. Tùy chọn tay thuận (Handedness)
    const handLabel = this.scene.add.text(startX, startY, 'Tay thuận:', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '14px',
      color: uiTokens.colors.text,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.contentContainer.add(handLabel);

    const isRight = mobile.handedness === 'right';
    const rightBtn = this.createButton(
      startX + 130,
      startY,
      100,
      30,
      'TAY PHẢI',
      () => {
        this.currentSettings.mobile.handedness = 'right';
        this.renderModal();
      },
      isRight ? 0x473926 : 0x222a2c,
      isRight ? uiNumericColors.gold : uiNumericColors.border
    );
    this.contentContainer.add(rightBtn);

    const leftBtn = this.createButton(
      startX + 240,
      startY,
      100,
      30,
      'TAY TRÁI',
      () => {
        this.currentSettings.mobile.handedness = 'left';
        this.renderModal();
      },
      !isRight ? 0x473926 : 0x222a2c,
      !isRight ? uiNumericColors.gold : uiNumericColors.border
    );
    this.contentContainer.add(leftBtn);

    // 2. Tỉ lệ nút (controlScale: 80% .. 140%)
    this.renderSliderRow(
      startX,
      startY + stepY,
      'Tỉ lệ nút:',
      `${Math.round(mobile.controlScale * 100)}%`,
      () => {
        const next = Math.max(0.8, mobile.controlScale - 0.1);
        this.currentSettings.mobile.controlScale = Math.round(next * 10) / 10;
        this.renderModal();
      },
      () => {
        const next = Math.min(1.4, mobile.controlScale + 0.1);
        this.currentSettings.mobile.controlScale = Math.round(next * 10) / 10;
        this.renderModal();
      }
    );

    // 3. Độ mờ nút (buttonOpacity: 40% .. 100%)
    this.renderSliderRow(
      startX,
      startY + stepY * 2,
      'Độ mờ nút:',
      `${Math.round(mobile.buttonOpacity * 100)}%`,
      () => {
        const next = Math.max(0.4, mobile.buttonOpacity - 0.1);
        this.currentSettings.mobile.buttonOpacity = Math.round(next * 10) / 10;
        this.renderModal();
      },
      () => {
        const next = Math.min(1.0, mobile.buttonOpacity + 0.1);
        this.currentSettings.mobile.buttonOpacity = Math.round(next * 10) / 10;
        this.renderModal();
      }
    );

    // 4. Khoảng cách nút (buttonSpacing: 0.5x .. 2.0x)
    this.renderSliderRow(
      startX,
      startY + stepY * 3,
      'Khoảng cách:',
      `${mobile.buttonSpacing.toFixed(1)}x`,
      () => {
        const next = Math.max(0.5, mobile.buttonSpacing - 0.1);
        this.currentSettings.mobile.buttonSpacing = Math.round(next * 10) / 10;
        this.renderModal();
      },
      () => {
        const next = Math.min(2.0, mobile.buttonSpacing + 0.1);
        this.currentSettings.mobile.buttonSpacing = Math.round(next * 10) / 10;
        this.renderModal();
      }
    );

    // Khung xem trước trực quan (Mini Preview) ở góc bên phải
    this.renderMiniPreview(W / 2 + 180, startY + 68);

    // Nút Khôi phục mặc định Mobile
    const resetMobileBtn = this.createButton(
      W / 2 - 240,
      H / 2 + 208,
      220,
      34,
      '↺ MẶC ĐỊNH CẢM ỨNG',
      () => {
        this.restoreMobileDefaults();
      },
      0x3d2724,
      uiNumericColors.danger
    );
    this.contentContainer.add(resetMobileBtn);
  }

  private renderSliderRow(
    x: number,
    y: number,
    title: string,
    valueText: string,
    onMinus: () => void,
    onPlus: () => void
  ): void {
    const label = this.scene.add.text(x, y, title, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '14px',
      color: uiTokens.colors.text,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.contentContainer.add(label);

    const minusBtn = this.createButton(x + 130, y, 36, 28, '−', onMinus, 0x243033, uiNumericColors.border);
    this.contentContainer.add(minusBtn);

    const valLabel = this.scene.add.text(x + 185, y, valueText, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '14px',
      color: uiTokens.colors.gold,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.contentContainer.add(valLabel);

    const plusBtn = this.createButton(x + 240, y, 36, 28, '+', onPlus, 0x243033, uiNumericColors.border);
    this.contentContainer.add(plusBtn);
  }

  private renderMiniPreview(centerX: number, centerY: number): void {
    const g = this.previewGraphics;
    g.clear();

    const boxW = 270;
    const boxH = 155;
    const x = centerX - boxW / 2;
    const y = centerY - boxH / 2;

    // Nền màn hình di động xem trước
    g.fillStyle(0x0c1416, 0.95);
    g.fillRoundedRect(x, y, boxW, boxH, 8);
    g.lineStyle(1.5, uiNumericColors.accent, 0.8);
    g.strokeRoundedRect(x, y, boxW, boxH, 8);

    // Tiêu đề xem trước
    const title = this.scene.add.text(centerX, y - 14, 'XEM TRƯỚC VỊ TRÍ PHÍM', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '11px',
      color: uiTokens.colors.accent,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.contentContainer.add(title);

    const m = this.currentSettings.mobile;
    const scale = m.controlScale;
    const opacity = m.buttonOpacity;
    const isLeft = m.handedness === 'left';
    const spacing = m.buttonSpacing;

    // Tọa độ tương đối joystick và action cluster
    const joyBaseX = isLeft ? x + boxW - 55 : x + 55;
    const joyBaseY = y + boxH - 50;

    // Vẽ joystick
    g.lineStyle(1.5, uiNumericColors.accent, opacity);
    g.strokeCircle(joyBaseX, joyBaseY, 24 * scale * 0.5);
    g.fillStyle(uiNumericColors.gold, opacity * 0.6);
    g.fillCircle(joyBaseX, joyBaseY, 12 * scale * 0.5);

    // Cụm nút hành động
    const actionBaseX = isLeft ? x + 65 : x + boxW - 65;
    const actionBaseY = y + boxH - 50;

    // Nút tấn công (chém)
    g.fillStyle(uiNumericColors.danger, opacity);
    g.fillCircle(actionBaseX, actionBaseY, 18 * scale * 0.5);

    // Nút né
    const dodgeOffset = 26 * spacing * 0.6;
    g.fillStyle(uiNumericColors.mana, opacity);
    g.fillCircle(
      isLeft ? actionBaseX + dodgeOffset : actionBaseX - dodgeOffset,
      actionBaseY - 14,
      13 * scale * 0.5
    );

    // 4 nút kỹ năng vòng cung
    for (let i = 0; i < 4; i++) {
      const angle = (isLeft ? 0.3 : Math.PI - 0.3) - i * 0.45;
      const dist = 38 * spacing * 0.5;
      const sx = actionBaseX + Math.cos(angle) * dist;
      const sy = actionBaseY - Math.sin(angle) * dist;
      g.fillStyle(uiNumericColors.gold, opacity * 0.8);
      g.fillCircle(sx, sy, 8 * scale * 0.5);
    }
  }

  private drawFooter(): void {
    // Nút LƯU & ĐÓNG
    const saveBtn = this.createButton(
      W / 2 + 150,
      H / 2 + 208,
      200,
      34,
      '✔ LƯU & ĐÓNG',
      () => {
        this.saveAndClose();
      },
      0x274936,
      uiNumericColors.success
    );
    this.contentContainer.add(saveBtn);

    // Nút HỦY
    const cancelBtn = this.createButton(
      W / 2 + 295,
      H / 2 + 208,
      80,
      34,
      'ĐÓNG',
      () => {
        this.close();
      },
      0x243033,
      uiNumericColors.border
    );
    this.contentContainer.add(cancelBtn);
  }

  private createButton(
    x: number,
    y: number,
    w: number,
    h: number,
    textStr: string,
    onClick: () => void,
    bgColor: number = 0x243033,
    borderColor: number = uiNumericColors.border
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const halfW = w / 2;
    const halfH = h / 2;
    const r = uiTokens.radius.sm;

    const bg = this.scene.add.graphics();
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(-halfW, -halfH, w, h, r);
    bg.lineStyle(1.5, borderColor, 0.9);
    bg.strokeRoundedRect(-halfW, -halfH, w, h, r);
    container.add(bg);

    const label = this.scene.add.text(0, 0, textStr, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: uiTokens.colors.text,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    container.add(label);

    const hit = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      onClick();
    });
    hit.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(bgColor, 1);
      bg.fillRoundedRect(-halfW, -halfH, w, h, r);
      bg.lineStyle(2, uiNumericColors.gold, 1);
      bg.strokeRoundedRect(-halfW, -halfH, w, h, r);
      label.setColor(uiTokens.colors.gold);
    });
    hit.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(bgColor, 1);
      bg.fillRoundedRect(-halfW, -halfH, w, h, r);
      bg.lineStyle(1.5, borderColor, 0.9);
      bg.strokeRoundedRect(-halfW, -halfH, w, h, r);
      label.setColor(uiTokens.colors.text);
    });
    container.add(hit);

    return container;
  }

  private createKeyBadge(
    x: number,
    y: number,
    w: number,
    h: number,
    textStr: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const halfW = w / 2;
    const halfH = h / 2;
    const r = uiTokens.radius.sm;

    const bg = this.scene.add.graphics();
    bg.fillStyle(uiNumericColors.bronzeDark, 0.9);
    bg.fillRoundedRect(-halfW, -halfH, w, h, r);
    bg.lineStyle(1.5, uiNumericColors.accent, 0.9);
    bg.strokeRoundedRect(-halfW, -halfH, w, h, r);
    container.add(bg);

    const label = this.scene.add.text(0, 0, textStr, {
      fontFamily: uiTypography.fontFamilies.mono,
      fontSize: '12px',
      color: uiTokens.colors.gold,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    container.add(label);

    const hit = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      onClick();
    });
    hit.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x352b22, 1);
      bg.fillRoundedRect(-halfW, -halfH, w, h, r);
      bg.lineStyle(2, uiNumericColors.gold, 1);
      bg.strokeRoundedRect(-halfW, -halfH, w, h, r);
    });
    hit.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(uiNumericColors.bronzeDark, 0.9);
      bg.fillRoundedRect(-halfW, -halfH, w, h, r);
      bg.lineStyle(1.5, uiNumericColors.accent, 0.9);
      bg.strokeRoundedRect(-halfW, -halfH, w, h, r);
    });
    container.add(hit);

    return container;
  }

  private createToggleButton(
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
    enabled: boolean,
    onToggle: () => void
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const halfW = w / 2;
    const halfH = h / 2;
    const r = uiTokens.radius.sm;

    const bg = this.scene.add.graphics();
    bg.fillStyle(enabled ? 0x223c30 : 0x243033, 1);
    bg.fillRoundedRect(-halfW, -halfH, w, h, r);
    bg.lineStyle(1.5, enabled ? uiNumericColors.success : uiNumericColors.border, 0.85);
    bg.strokeRoundedRect(-halfW, -halfH, w, h, r);
    container.add(bg);

    const statusBadge = enabled ? ' [BẬT]' : ' [TẮT]';
    const label = this.scene.add.text(0, 0, `${title}${statusBadge}`, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '12px',
      color: enabled ? uiTokens.colors.success : uiTokens.colors.textMuted,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    container.add(label);

    const hit = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      onToggle();
    });
    container.add(hit);

    return container;
  }

  private startKeyCapture(action: GameAction, actionTitle: string): void {
    this.keyCapture.open(
      action,
      actionTitle,
      (result) => {
        this.onKeyCaptured(action, result.code);
      }
    );
  }

  private onKeyCaptured(action: GameAction, newKeyCode: string): void {
    const currentBindings = this.currentSettings.bindings;
    const conflicts = findConflictingActions(currentBindings, action, newKeyCode);

    if (conflicts.length > 0) {
      // Có xung đột với hành động khác!
      const conflictingAction = conflicts[0];
      const conflictCfg = REBINDABLE_ACTIONS.find(a => a.action === conflictingAction);
      const conflictLabel = conflictCfg?.label ?? conflictingAction;

      this.showConflictDialog(action, conflictingAction, conflictLabel, newKeyCode);
    } else {
      // Không xung đột: gán trực tiếp
      this.currentSettings.bindings[action] = [newKeyCode];
      this.renderModal();
    }
  }

  private showConflictDialog(
    newAction: GameAction,
    oldAction: GameAction,
    oldActionLabel: string,
    keyCode: string
  ): void {
    this.clearConflictBanner();

    const banner = this.scene.add.container(W / 2, H / 2);
    const boxW = 460;
    const boxH = 160;
    const halfW = boxW / 2;
    const halfH = boxH / 2;

    const bg = this.scene.add.graphics();
    bg.fillStyle(uiNumericColors.surfaceRaised, 0.98);
    bg.fillRoundedRect(-halfW, -halfH, boxW, boxH, 12);
    bg.lineStyle(2, uiNumericColors.danger, 1);
    bg.strokeRoundedRect(-halfW, -halfH, boxW, boxH, 12);
    banner.add(bg);

    const keyName = formatKeyDisplayName(keyCode);
    const title = this.scene.add.text(0, -42, 'XUNG ĐỘT PHÍM ĐIỀU KHIỂN!', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '16px',
      color: uiTokens.colors.danger,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    banner.add(title);

    const desc = this.scene.add.text(
      0,
      -10,
      `Phím [ ${keyName} ] đã được gán cho [ ${oldActionLabel} ].\nBạn có muốn hoán đổi (Swap) vị trí hai phím này không?`,
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '13px',
        color: uiTokens.colors.text,
        align: 'center',
        lineSpacing: 4,
      }
    ).setOrigin(0.5, 0.5);
    banner.add(desc);

    // Nút Hoán đổi phím (Swap bindings)
    const swapBtn = this.createButton(
      -100,
      42,
      170,
      32,
      '⚡ HOÁN ĐỔI PHÍM',
      () => {
        this.currentSettings.bindings = swapBindings(this.currentSettings.bindings, newAction, oldAction);
        this.clearConflictBanner();
        this.renderModal();
      },
      0x4a3622,
      uiNumericColors.gold
    );
    banner.add(swapBtn);

    // Nút Gán đè (chỉ gán cho action mới, xóa khỏi action cũ)
    const overwriteBtn = this.createButton(
      100,
      42,
      170,
      32,
      'GÁN ĐÈ / BỎ PHÍM CŨ',
      () => {
        this.currentSettings.bindings[newAction] = [keyCode];
        this.currentSettings.bindings[oldAction] = [];
        this.clearConflictBanner();
        this.renderModal();
      },
      0x243033,
      uiNumericColors.border
    );
    banner.add(overwriteBtn);

    this.conflictBanner = banner;
    this.add(this.conflictBanner);
  }

  private clearConflictBanner(): void {
    if (this.conflictBanner) {
      this.conflictBanner.destroy();
      this.conflictBanner = null;
    }
  }

  private restorePcDefaults(): void {
    const defaults = cloneBindings(DEFAULT_KEY_BINDINGS);
    this.currentSettings.bindings = defaults;
    this.currentSettings.pc = {
      mouseAiming: true,
      rightClickDodge: false,
      holdToRepeatAttack: false,
    };
    this.renderModal();
  }

  private restoreMobileDefaults(): void {
    this.currentSettings.mobile = {
      handedness: 'right',
      controlScale: 1.0,
      buttonOpacity: 0.8,
      floatingJoystick: false,
      buttonSpacing: 1.0,
    };
    this.renderModal();
  }

  public saveAndClose(): void {
    this.settingsManager.update(this.currentSettings);
    this.close();
  }

  public override destroy(fromScene?: boolean): void {
    if (this.keyListener && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = undefined;
    }
    this.clearConflictBanner();
    super.destroy(fromScene);
  }
}
