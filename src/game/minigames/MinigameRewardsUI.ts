/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * MinigameRewardsUI — Bảng Phần Thưởng & Minh Bạch Tỷ Lệ
 * 
 * Hiển thị:
 * - Quy tắc 3 lượt miễn phí/ngày (reset 00:00 Việt Nam).
 * - Bảng cơ cấu FestivalPoints (không có giá trị tiền thật, điểm lễ hội ảo).
 * - Minh bạch tỷ lệ xác suất:
 *   + 7321: Thắng ~42.4%, Hòa ~8.5%.
 *   + Tài/Xỉu: Tài ~48.61%, Xỉu ~48.61%, Bộ ba đồng số ~2.78%.
 *   + Đoán Thú: 42.13% trúng ít nhất một linh hình (1 - (5/6)^3).
 */

import Phaser from 'phaser';
import { type MinigameId } from './MinigameTypes';
import { MINIGAME_PALETTE } from './MinigameArtwork';
import { uiTokens, uiTypography } from '../ui/design-tokens';

export class MinigameRewardsUI {
  private container: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly gameId: MinigameId
  ) {
    this.container = this.scene.add.container(0, 0);
    this.buildContent();
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

  private buildContent(): void {
    this.container.removeAll(true);

    const startY = 165;

    // 1. Tiêu đề mục phần thưởng
    const title = this.scene.add.text(480, startY, 'CƠ CẤU PHẦN THƯỞNG FESTIVALPOINTS & TỶ LỆ XÁC SUẤT', {
      fontFamily: uiTypography.fontFamilies.display,
      fontSize: '14px',
      color: MINIGAME_PALETTE.goldBright,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5, 0.5);
    this.container.add(title);

    // 2. Banner chính sách bảo vệ người chơi & lượt ngày
    const policyBox = this.scene.add.graphics();
    policyBox.fillStyle(0x1a2925, 0.85);
    policyBox.fillRoundedRect(190, startY + 16, 580, 52, 6);
    policyBox.lineStyle(1.2, 0x497459, 0.7);
    policyBox.strokeRoundedRect(190, startY + 16, 580, 52, 6);
    this.container.add(policyBox);

    const policyTxt = this.scene.add.text(
      480,
      startY + 42,
      '★ 3 Lượt Miễn Phí Mỗi Ngày cho mỗi trò chơi (Làm mới vào 00:00 giờ Việt Nam).\n' +
      '★ Điểm FestivalPoints là điểm thưởng lễ hội ảo, không nạp/rút hay quy đổi tiền thật.',
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: '#CBD1CB',
        align: 'center',
        lineSpacing: 4,
      }
    ).setOrigin(0.5, 0.5);
    this.container.add(policyTxt);

    // 3. Bảng chi tiết phần thưởng theo trò chơi
    const tableY = startY + 80;
    this.renderRewardTable(tableY);
  }

  private renderRewardTable(tableY: number): void {
    // Header bảng
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x273b34, 0.9);
    headerBg.fillRect(190, tableY, 580, 26);
    headerBg.lineStyle(1, 0x8a6248, 0.6);
    headerBg.strokeRect(190, tableY, 580, 26);
    this.container.add(headerBg);

    const cols = [
      { text: 'ĐIỀU KIỆN', x: 210, align: 0 },
      { text: 'THƯỞNG THAM GIA', x: 420, align: 0.5 },
      { text: 'THƯỞNG KẾT QUẢ', x: 550, align: 0.5 },
      { text: 'XÁC SUẤT LÝ THUYẾT', x: 710, align: 0.5 },
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

    // Dữ liệu dòng tương ứng từng trò
    const rows = this.getRowsForGame(this.gameId);
    let currY = tableY + 28;

    rows.forEach((row, idx) => {
      const rowBg = this.scene.add.graphics();
      rowBg.fillStyle(idx % 2 === 0 ? 0x182622 : 0x14201c, 0.85);
      rowBg.fillRect(190, currY, 580, 24);
      this.container.add(rowBg);

      // Cột Điều kiện
      const c1 = this.scene.add.text(210, currY + 12, row.condition, {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: uiTokens.colors.text,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      // Cột Tham gia
      const c2 = this.scene.add.text(420, currY + 12, `+${row.part} pts`, {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: MINIGAME_PALETTE.goldLight,
      }).setOrigin(0.5, 0.5);

      // Cột Thưởng kết quả
      const c3 = this.scene.add.text(550, currY + 12, `+${row.bonus} pts`, {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: row.bonus > 0 ? '#8BC49B' : '#73807D',
        fontStyle: row.bonus > 0 ? 'bold' : 'normal',
      }).setOrigin(0.5, 0.5);

      // Cột Xác suất
      const c4 = this.scene.add.text(710, currY + 12, row.prob, {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '11px',
        color: MINIGAME_PALETTE.goldBright,
      }).setOrigin(0.5, 0.5);

      this.container.add([c1, c2, c3, c4]);
      currY += 25;
    });

    // Ghi chú cam kết RNG & Luật chơi ở chân bảng
    const footerY = currY + 16;
    const footerNote = this.scene.add.text(
      480,
      footerY,
      'Quy chuẩn: RNG độc lập từ máy chủ, không thiên vị, không can thiệp kết quả.\n' +
      'Mọi phiên chơi đều được ghi nhận nhật ký kiểm toán minh bạch.',
      {
        fontFamily: uiTypography.fontFamilies.body,
        fontSize: '10.5px',
        color: '#A0ABA6',
        align: 'center',
        lineSpacing: 3,
      }
    ).setOrigin(0.5, 0.5);
    this.container.add(footerNote);
  }

  private getRowsForGame(gameId: MinigameId): Array<{ condition: string; part: number; bonus: number; prob: string }> {
    if (gameId === '7321') {
      return [
        { condition: 'Tham gia lượt hợp lệ', part: 5, bonus: 0, prob: '100%' },
        { condition: 'Hòa điểm với Nhà cái', part: 5, bonus: 0, prob: '~8.48%' },
        { condition: 'Thắng điểm thường', part: 5, bonus: 10, prob: '~38.25%' },
        { condition: 'Natural 21 điểm (Ách + 10)', part: 5, bonus: 10, prob: '~4.18%' },
        { condition: 'Quắc bài (vượt quá 21)', part: 5, bonus: 0, prob: '~28.36%' },
      ];
    } else if (gameId === 'lucky_dice') {
      return [
        { condition: 'Tham gia lượt hợp lệ', part: 5, bonus: 0, prob: '100%' },
        { condition: 'Dự đoán đúng TÀI (11–17)', part: 5, bonus: 5, prob: '48.61% (105/216)' },
        { condition: 'Dự đoán đúng XỈU (4–10)', part: 5, bonus: 5, prob: '48.61% (105/216)' },
        { condition: 'Bộ Ba Đồng Số (Hòa đặc biệt)', part: 5, bonus: 0, prob: '2.78% (6/216)' },
      ];
    } else {
      return [
        { condition: 'Tham gia lượt hợp lệ', part: 5, bonus: 0, prob: '100%' },
        { condition: 'Trúng 1 linh hình', part: 5, bonus: 3, prob: '34.72% (75/216)' },
        { condition: 'Trúng 2 linh hình', part: 5, bonus: 15, prob: '6.94% (15/216)' },
        { condition: 'Trúng cả 3 linh hình', part: 5, bonus: 40, prob: '0.46% (1/216)' },
        { condition: 'TỔNG XÁC SUẤT TRÚNG (>=1)', part: 5, bonus: 3, prob: '42.13% (91/216)' },
      ];
    }
  }
}
