import Phaser from 'phaser';
import { W, H, PALETTE } from '../../data/config';
import { button, label } from '../ui/art';
import { gameState } from '../systems/GameState';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x102b29);
    for (let i = 0; i < 33; i++) {
      const x = (i * 139 + 37) % W;
      const y = (i * 71 + 60) % H;
      this.add.circle(x, y, 2 + i % 4, 0xa6b87d, 0.26);
    }
    this.add.circle(820, 100, 150, 0x4d7853, 0.2);
    const drum = this.add.circle(480, 198, 128, 0x9c7745, 0.16).setStrokeStyle(5, PALETTE.bronze, 0.6);
    drum.setDepth(0);
    this.add.circle(480, 198, 100, 0x14352d, 0).setStrokeStyle(2, PALETTE.bronze, 0.8);
    this.add.circle(480, 198, 55, 0x14352d, 0).setStrokeStyle(2, PALETTE.bronze, 0.8);
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      this.add.circle(480 + Math.cos(a) * 80, 198 + Math.sin(a) * 80, 4, PALETTE.bronze, 0.7);
    }
    label(this, 480, 147, 'THẦN MỆNH', 51, '#fbe3a2', 'center');
    label(this, 480, 208, 'HẬU DUỆ VĂN LANG', 27, '#e4c58e', 'center');
    label(this, 480, 274, 'Khi thần linh chọn một người phàm bảo vệ đất nước', 18, '#b8cbb2', 'center');
    button(this, 480, 350, 300, 'BẮT ĐẦU HÀNH TRÌNH', () => this.scene.start('Village'));
    button(this, 480, 407, 300, 'CHƠI LẠI TỪ ĐẦU', () => {
      gameState.reset();
      this.scene.start('Village');
    }, 0x4f5e54);
    label(this, 480, 475, 'WASD: di chuyển  ·  J: chém  ·  Space: né  ·  Q/E: thần lực  ·  F: nói chuyện',
      14, '#c8d6c5', 'center');
    label(this, 480, 506, 'H5 prototype — đồ họa tạm dựng bằng mã nguồn', 12, '#9aab96', 'center');
  }
}
