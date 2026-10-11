import Phaser from 'phaser';
import { W, H, PALETTE } from '../../data/config';
import { button, label } from '../ui/art';
import { gameState } from '../systems/GameState';

export class VictoryScene extends Phaser.Scene {
  constructor() { super('Victory'); }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x15372e);
    for (let i = 0; i < 20; i++) {
      const x = (i * 101 + 91) % W;
      const y = (i * 67 + 45) % H;
      this.add.circle(x, y, 2 + (i % 5), PALETTE.gold, 0.38);
    }
    this.add.circle(480, 130, 80, 0x795e35, 0.23).setStrokeStyle(3, PALETTE.bronze);
    label(this, 480, 128, 'THIÊN MỆNH ẤN', 27, '#ffe09c', 'center');
    label(this, 480, 234, 'CHƯƠNG 1 HOÀN THÀNH', 39, '#fff1c7', 'center');
    label(this, 480, 281, 'Hổ Yêu đã bị đánh bại. Làng Lạc Thủy được bình yên.', 19, '#d9e5c3', 'center');
    label(this, 480, 322, 'Sứ giả Phong Châu: “Vua Hùng thứ 18 triệu kiến người mang Thần Mệnh.”',
      16, '#f0d3a3', 'center');
    const s = gameState.data;
    label(this, 480, 368, `Cấp ${s.level}  ·  Công ${s.attack}  ·  ${s.gold} tiền đồng  ·  ${s.kills} quái bị hạ`,
      15, '#c5d5bd', 'center');
    button(this, 320, 450, 290, 'TRỞ LẠI LÀNG', () => this.scene.start('Village'));
    button(this, 640, 450, 290, 'VỀ MENU', () => this.scene.start('Menu'), 0x445e53);
    label(this, 480, 513, 'Phần tiếp theo: Kinh đô Phong Châu (chưa có trong MVP)', 13, '#adc3ab', 'center');
  }
}
