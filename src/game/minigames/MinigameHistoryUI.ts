/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * MinigameHistoryUI — Bảng Lịch Sử Tham Gia Minigames
 * 
 * Hiển thị nhật ký ván chơi cá nhân:
 * - Thời gian ván đấu
 * - Kết quả (Thắng, Thua, Hòa, Số hình trúng)
 * - Điểm số / Chi tiết
 * - FestivalPoints tích lũy
 * - Trạng thái trống và nút Làm mới.
 */

import Phaser from 'phaser';
import { type MinigameId, type MinigameSessionHistoryItem } from './MinigameTypes';
import { minigameClient } from './MinigameClient';
import { MINIGAME_PALETTE } from './MinigameArtwork';
import { uiTokens, uiTypography } from '../ui/design-tokens';

export class MinigameHistoryUI {
  private container: Phaser.GameObjects.Container;
  private historyItems: MinigameSessionHistoryItem[] = [];
  private isLoading: boolean = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly gameId: MinigameId
  ) {
    this.container = this.scene.add.container(0, 0);
    this.refresh();
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  public destroy(): void {
    this.container.destroy(true);
  }

  public async refresh(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    this.renderLoading();

    try {
      const res = await minigameClient.history(this.gameId, 1, 6);
      if (res.ok) {
        this.historyItems = res.items ?? [];
        this.renderHistory();
      } else {
        this.renderError('Không thể tải lịch sử chơi.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi tải dữ liệu';
      this.renderError(msg);
    } finally {
      this.isLoading = false;
    }
  }

  private renderLoading(): void {
    this.container.removeAll(true);
    const loading = this.scene.add.text(480, 270, 'Đang tải nhật ký ván chơi từ máy chủ...', {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: MINIGAME_PALETTE.goldLight,
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.container.add(loading);
  }

  private renderError(message: string): void {
    this.container.removeAll(true);
    const errText = this.scene.add.text(480, 260, `Thông báo: ${message}`, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '13px',
      color: '#E86D63',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    const retryBtn = this.createButton(480, 310, 140, 34, 'THỬ LẠI', () => this.refresh());
    this.container.add([errText, retryBtn]);
  }

  private renderHistory(): void {
    this.container.removeAll(true);

    const startY = 165;

    // Header tiêu đề
    const title = this.scene.add.text(480, startY, 'NHẬT KÝ VÁN ĐẤU CÁ NHÂN', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '14px',
      color: MINIGAME_PALETTE.goldBright,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.container.add(title);

    // Nút Làm mới góc phải
    const refreshBtn = this.createButton(730, startY, 90, 26, 'LÀM MỚI', () => this.refresh(), 0x1b2824);
    this.container.add(refreshBtn);

    const tableY = startY + 25;

    // Header bảng
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x273b34, 0.9);
    headerBg.fillRect(190, tableY, 580, 26);
    headerBg.lineStyle(1, 0x8a6248, 0.6);
    headerBg.strokeRect(190, tableY, 580, 26);
    this.container.add(headerBg);

    const cols = [
      { text: 'THỜI GIAN', x: 210, align: 0 },
      { text: 'KẾT QUẢ', x: 370, align: 0.5 },
      { text: 'CHI TIẾT', x: 550, align: 0.5 },
      { text: 'FESTIVAL POINTS', x: 710, align: 0.5 },
    ];

    cols.forEach((col) => {
      const th = this.scene.add.text(col.x, tableY + 13, col.text, {
        fontFamily: uiTypography.fontFamilies.display,
        fontSize: '11px',
        color: MINIGAME_PALETTE.goldLight,
        fontStyle: 'bold',
      }).setOrigin(col.align, 0.5);
      this.container.add(th);
    });

    if (this.historyItems.length === 0) {
      // Empty state
      const emptyBg = this.scene.add.graphics();
      emptyBg.fillStyle(0x172420, 0.85);
      emptyBg.fillRect(190, tableY + 28, 580, 140);
      this.container.add(emptyBg);

      const emptyTxt = this.scene.add.text(
        480,
        tableY + 95,
        'Chưa có ván chơi nào được ghi nhận trong hôm nay.\nHãy chuyển sang tab [BÀN CHƠI] để bắt đầu thử tài!',
        {
          fontFamily: uiTypography.fontFamilies.body,
          fontSize: '13px',
          color: '#CBD1CB',
          align: 'center',
          lineSpacing: 5,
        }
      ).setOrigin(0.5, 0.5);
      this.container.add(emptyTxt);
      return;
    }

    let currY = tableY + 28;
    this.historyItems.slice(0, 6).forEach((item, idx) => {
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(idx % 2 === 0 ? 0x182622 : 0x14201c, 0.85);
      rowBg.fillRect(190, currY, 580, 26);
      this.container.add(rowBg);

      // Thời gian
      const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
      const timeTxt = this.scene.add.text(210, currY + 13, dateStr, {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: '#A0ABA6',
      }).setOrigin(0, 0.5);

      // Kết quả
      const won = item.won ?? false;
      const outcomeLabel = won ? 'THẮNG' : item.outcome === 'tie' || item.outcome === 'special_triple' ? 'HÒA' : 'CHƯA TRÚNG';
      const outcomeColor = won ? '#8BC49B' : item.outcome === 'tie' || item.outcome === 'special_triple' ? MINIGAME_PALETTE.goldLight : '#E86D63';

      const outcomeTxt = this.scene.add.text(370, currY + 13, outcomeLabel, {
        fontFamily: uiTypography.fontFamilies.display,
        fontSize: '11px',
        color: outcomeColor,
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);

      // Chi tiết
      const detailStr = item.detail ? (item.detail.length > 32 ? item.detail.slice(0, 30) + '...' : item.detail) : 'Hoàn tất';
      const detailTxt = this.scene.add.text(550, currY + 13, detailStr, {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '10.5px',
        color: uiTokens.colors.text,
      }).setOrigin(0.5, 0.5);

      // Điểm
      const pts = item.totalPoints ?? 5;
      const ptsTxt = this.scene.add.text(710, currY + 13, `+${pts} pts`, {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: MINIGAME_PALETTE.goldBright,
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);

      this.container.add([timeTxt, outcomeTxt, detailTxt, ptsTxt]);
      currY += 27;
    });
  }

  private createButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void,
    fillColor = 0x274936
  ): Phaser.GameObjects.Container {
    const cont = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, w, h, fillColor)
      .setStrokeStyle(1.2, 0x8e754a)
      .setInteractive({ useHandCursor: true });

    const txt = this.scene.add.text(0, 0, text, {
      fontFamily: uiTypography.fontFamilies.body,
      fontSize: '11px',
      color: uiTokens.colors.text,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    cont.add([bg, txt]);

    bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event?.stopPropagation?.();
      onClick();
    });

    return cont;
  }
}
