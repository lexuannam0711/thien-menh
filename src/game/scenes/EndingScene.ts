import Phaser from 'phaser';
import { H, PALETTE, W } from '../../data/config';
import { button, label } from '../ui/art';
import { gameState } from '../systems/GameState';
import { audioManager } from '../audio/AudioManager';

export class EndingScene extends Phaser.Scene {
  constructor() { super('Ending'); }

  create(): void {
    audioManager.startMusic('ending');
    this.add.rectangle(W / 2, H / 2, W, H, 0x102b29);
    this.add.circle(W / 2, 135, 88, 0x9c7745, 0.2).setStrokeStyle(4, PALETTE.bronze, 0.8);
    label(this, W / 2, 135, 'THIÊN MỆNH VĂN LANG', 27, '#ffe09c', 'center');
    label(this, W / 2, 245, 'Lời kết', 40, '#fff1c7', 'center');
    label(this, W / 2, 302, 'Người mang Thiên Mệnh đã bảo vệ đất nước. Hành trình của Văn Lang còn tiếp diễn.', 20, '#d9e5c3', 'center');
    label(this, W / 2, 370, `Cấp ${gameState.data.level} · Bốn chương đã hoàn tất · ${gameState.data.kills} quái bị hạ`, 15, '#c5d5bd', 'center');
    button(this, W / 2, 450, 300, 'VỀ MENU', () => this.scene.start('Menu'));
    label(this, W / 2, 395, 'Thực hiện: Dự án Thần Mệnh · Engine: Phaser (MIT) · TypeScript & Vite', 13, '#c5d5bd', 'center');
    label(this, W / 2, 416, 'Đồ họa, hiệu ứng, âm thanh: dự án tự tạo · Cảm hứng: văn hóa Văn Lang', 12, '#adc3ab', 'center');
    label(this, W / 2, 510, 'Cảm ơn đã chơi THẦN MỆNH.', 14, '#adc3ab', 'center');
  }
}
