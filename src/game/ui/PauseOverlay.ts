/**
 * PauseOverlay — Thần Mệnh: Hậu Duệ Văn Lang
 *
 * Màn hình tạm dừng trò chơi nâng cấp với phong cách Ancient Bronze Fantasy (uiTokens):
 * - Tạm dừng scene, tweens và nhạc nền audioManager.
 * - Khung viền đồng cổ, đinh tán góc, text sắc nét.
 * - Danh sách nút:
 *   + "TIẾP TỤC" (Resume)
 *   + "CÀI ĐẶT ĐIỀU KHIỂN" (Mở màn hình ControlsSettings)
 *   + "VỀ MENU" (Quay về MenuScene)
 * - Quản lý an toàn phím Escape: Ưu tiên đóng ControlsSettings nếu đang mở, sau đó mới tiếp tục game.
 */

import Phaser from 'phaser';
import { H, UI_DEPTH, W } from '../../data/config';
import { audioManager } from '../audio/AudioManager';
import {
  uiTokens,
  uiNumericColors,
  uiTypography,
} from './design-tokens';
import { ControlsSettings } from './screens/ControlsSettings';

export class PauseOverlay {
  private overlay: Phaser.GameObjects.Container | null = null;
  private controlsSettings: ControlsSettings | null = null;
  private readonly keydown: (event: KeyboardEvent) => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly canOpen: () => boolean = () => true
  ) {
    this.keydown = (event: KeyboardEvent) => {
      if (event.code === 'Escape' || event.code === 'KeyP') {
        // 1. Nếu màn hình Cài đặt điều khiển đang mở, Escape đóng màn hình này trước
        if (this.controlsSettings && this.controlsSettings.isOpen()) {
          event.preventDefault();
          this.controlsSettings.close();
          return;
        }

        // 2. Nếu không, thực hiện toggle màn hình Tạm dừng
        if (this.isOpen() || this.canOpen()) {
          event.preventDefault();
          this.toggle();
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keydown);
    }
  }

  public isOpen(): boolean {
    return this.overlay !== null;
  }

  public isControlsSettingsOpen(): boolean {
    return Boolean(this.controlsSettings && this.controlsSettings.isOpen());
  }

  public toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  public close(): void {
    if (this.controlsSettings && this.controlsSettings.isOpen()) {
      this.controlsSettings.close();
    }

    if (!this.overlay) return;
    this.overlay.destroy(true);
    this.overlay = null;

    this.scene.time.paused = false;
    this.scene.tweens.resumeAll();
    audioManager.resumeMusic();
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydown);
    }
    if (this.controlsSettings) {
      this.controlsSettings.destroy(true);
      this.controlsSettings = null;
    }
    this.close();
  }

  public open(): void {
    if (this.overlay) return;

    this.scene.time.paused = true;
    this.scene.tweens.pauseAll();
    audioManager.pauseMusic();

    const container = this.scene.add.container(0, 0);
    container.setDepth(UI_DEPTH + 100);

    // 1. Nền tối bán trong suốt (Backdrop)
    const backdrop = this.scene.add
      .rectangle(W / 2, H / 2, W * 1.5, H * 1.5, 0x060b0a, 0.82)
      .setInteractive();
    backdrop.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
    });
    container.add(backdrop);

    // 2. Khung viền đồng cổ (Ancient Bronze Panel)
    const panelW = 440;
    const panelH = 340;
    const panelX = W / 2 - panelW / 2;
    const panelY = H / 2 - panelH / 2;
    const r = uiTokens.radius.lg;

    const frameGraphics = this.scene.add.graphics();
    // Nền card
    frameGraphics.fillStyle(uiNumericColors.surfaceRaised, 0.98);
    frameGraphics.fillRoundedRect(panelX, panelY, panelW, panelH, r);
    // Viền chính
    frameGraphics.lineStyle(2.5, uiNumericColors.accent, 0.95);
    frameGraphics.strokeRoundedRect(panelX, panelY, panelW, panelH, r);
    // Viền chỉ phụ
    const pad = 6;
    frameGraphics.lineStyle(1, uiNumericColors.border, 0.5);
    frameGraphics.strokeRoundedRect(panelX + pad, panelY + pad, panelW - pad * 2, panelH - pad * 2, r - 3);

    // 4 đinh tán đồng
    const rivet = 16;
    frameGraphics.fillStyle(uiNumericColors.gold, 0.9);
    frameGraphics.fillCircle(panelX + rivet, panelY + rivet, 3);
    frameGraphics.fillCircle(panelX + panelW - rivet, panelY + rivet, 3);
    frameGraphics.fillCircle(panelX + rivet, panelY + panelH - rivet, 3);
    frameGraphics.fillCircle(panelX + panelW - rivet, panelY + panelH - rivet, 3);

    // Đường gạch dưới tiêu đề
    frameGraphics.lineStyle(1.5, uiNumericColors.border, 0.7);
    frameGraphics.beginPath();
    frameGraphics.moveTo(panelX + 30, panelY + 68);
    frameGraphics.lineTo(panelX + panelW - 30, panelY + 68);
    frameGraphics.strokePath();

    container.add(frameGraphics);

    // 3. Tiêu đề TẠM DỪNG
    const title = this.scene.add.text(W / 2, panelY + 38, 'TẠM DỪNG', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '24px',
      color: uiTokens.colors.gold,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    container.add(title);

    // 4. Các nút bấm chức năng
    const startBtnY = panelY + 115;
    const btnSpacing = 55;

    // Nút TIẾP TỤC
    const resumeBtn = this.createButton(
      W / 2,
      startBtnY,
      280,
      42,
      'TIẾP TỤC',
      () => {
        audioManager.playCue('ui_click');
        this.close();
      },
      0x274936,
      uiNumericColors.success
    );
    container.add(resumeBtn);

    // Nút CÀI ĐẶT ĐIỀU KHIỂN
    const controlsBtn = this.createButton(
      W / 2,
      startBtnY + btnSpacing,
      280,
      42,
      '⚙ CÀI ĐẶT ĐIỀU KHIỂN',
      () => {
        audioManager.playCue('ui_click');
        this.openControlsSettings();
      },
      0x473926,
      uiNumericColors.gold
    );
    container.add(controlsBtn);

    // Nút VỀ MENU
    const menuBtn = this.createButton(
      W / 2,
      startBtnY + btnSpacing * 2,
      280,
      42,
      'VỀ MENU',
      () => {
        audioManager.playCue('ui_click');
        this.close();
        this.scene.scene.start('Menu');
      },
      0x382c2a,
      uiNumericColors.border
    );
    container.add(menuBtn);

    this.overlay = container;
  }

  private openControlsSettings(): void {
    if (!this.controlsSettings) {
      this.controlsSettings = new ControlsSettings(this.scene, () => {
        // Callback khi ControlsSettings đóng
      });
    }
    this.controlsSettings.open();
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
      fontSize: '14px',
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
}
