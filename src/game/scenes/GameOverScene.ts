import Phaser from 'phaser';
import { W } from '../../data/config';
import { audioManager } from '../audio/AudioManager';
import { gameState, getPlayerStats } from '../systems/GameState';
import { button, label } from '../ui/art';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create(): void {
    audioManager.stopMusic();
    this.cameras.main.setBackgroundColor('#10251f');
    label(this, W / 2, 150, 'THẤT BẠI', 36, '#ffb3a7', 'center');
    label(this, W / 2, 205, 'Hành trình chưa kết thúc.', 18, '#ffe9c2', 'center');
    button(this, W / 2, 300, 260, 'VỀ LÀNG', () => {
      gameState.data.hp = getPlayerStats(gameState.data).maxHp;
      gameState.data.mp = getPlayerStats(gameState.data).maxMp;
      gameState.save();
      this.scene.start('Village', { notice: 'Được đưa về làng để dưỡng thương.' });
    });
    button(this, W / 2, 365, 260, 'VỀ MENU', () => this.scene.start('Menu'), 0x445e53);
    audioManager.playCue('defeat', { priority: 3 });
  }
}
