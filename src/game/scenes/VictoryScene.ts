import Phaser from 'phaser';
import { W, H, PALETTE } from '../../data/config';
import { button, label } from '../ui/art';
import { gameState } from '../systems/GameState';
import { getChapter } from '../../data/story';
import { audioManager } from '../audio/AudioManager';
import { advanceAfterVictory, isFinalChapter } from '../systems/CampaignFlow';
import { SPRITE_KEYS } from '../assets/assetLoader';
import { getEquippedWeaponOrDefault } from '../../data/weapons';

export class VictoryScene extends Phaser.Scene {
  constructor() { super('Victory'); }

  create(): void {
    audioManager.startMusic('victory');
    audioManager.playCue('victory', { priority: 3 });
    const chapter = getChapter(gameState.data.chapter);
    const finalChapter = isFinalChapter(gameState.data);
    this.add.rectangle(W / 2, H / 2, W, H, 0x15372e);
    for (let i = 0; i < 20; i++) {
      const x = (i * 101 + 91) % W;
      const y = (i * 67 + 45) % H;
      this.add.circle(x, y, 2 + (i % 5), PALETTE.gold, 0.38);
    }
    this.add.circle(480, 130, 80, 0x795e35, 0.23).setStrokeStyle(3, PALETTE.bronze);
    label(this, 480, 64, 'THIÊN MỆNH ẤN', 27, '#ffe09c', 'center');
    const type = getEquippedWeaponOrDefault(gameState.data.rpg?.equipment?.slots?.weapon, gameState.data.level).weaponType;
    const requested = type === 'axe' ? 'hero_axe' : type === 'sword' ? 'hero_sword' : 'hero';
    const name = this.textures.exists(SPRITE_KEYS[requested]) ? requested : 'hero';
    if (this.textures.exists(SPRITE_KEYS[name])) {
      this.add.sprite(480, 143, SPRITE_KEYS[name]).setScale(2).play(name + '_victory_down');
    }
    label(this, 480, 234, `CHƯƠNG ${chapter.id} HOÀN THÀNH`, 39, '#fff1c7', 'center');
    label(this, 480, 281, `${chapter.title} · ${chapter.objective}`, 19, '#d9e5c3', 'center');
    label(this, 480, 322, 'Sứ giả Phong Châu: “Vua Hùng thứ 18 triệu kiến người mang Thần Mệnh.”',
      16, '#f0d3a3', 'center');
    const s = gameState.data;
    label(this, 480, 368, `Cấp ${s.level}  ·  Công ${s.attack}  ·  ${s.gold} tiền đồng  ·  ${s.kills} quái bị hạ`,
      15, '#c5d5bd', 'center');
    button(this, 320, 450, 290, finalChapter ? 'XEM KẾT THÚC' : `TIẾP TỤC CHƯƠNG ${gameState.data.chapter + 1}`, () => {
      if (finalChapter) { this.scene.start('Ending'); return; }
      gameState.data = advanceAfterVictory(gameState.data);
      gameState.save();
      this.scene.start('Village', { notice: `Hành trình mới: ${getChapter(gameState.data.chapter).title}.` });
    });
    button(this, 640, 450, 290, 'VỀ MENU', () => this.scene.start('Menu'), 0x445e53);
    label(this, 480, 513, finalChapter ? 'Thiên Mệnh đã hoàn tất. Hãy xem lời kết.' : `Mục tiêu tiếp theo: ${getChapter(gameState.data.chapter + 1).area}`, 13, '#adc3ab', 'center');
  }
}
