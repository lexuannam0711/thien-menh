import Phaser from 'phaser';
import { BALANCE, PALETTE, UI_DEPTH } from '../../data/config';
import { gameState } from '../systems/GameState';
import { label } from './art';

export class Hud {
  private health: Phaser.GameObjects.Rectangle;
  private mana: Phaser.GameObjects.Rectangle;
  private statLabel: Phaser.GameObjects.Text;
  private questLabel: Phaser.GameObjects.Text;
  private zone: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, place: string) {
    const panel = scene.add.rectangle(195, 35, 360, 69, 0x102b27, 0.90)
      .setStrokeStyle(2, PALETTE.bronze).setDepth(UI_DEPTH);
    scene.add.rectangle(194, 24, 265, 14, 0x352e2b).setDepth(UI_DEPTH + 1);
    scene.add.rectangle(194, 47, 265, 12, 0x29333d).setDepth(UI_DEPTH + 1);
    this.health = scene.add.rectangle(61, 24, 265, 12, PALETTE.red)
      .setOrigin(0, 0.5).setDepth(UI_DEPTH + 2);
    this.mana = scene.add.rectangle(61, 47, 265, 10, PALETTE.blue)
      .setOrigin(0, 0.5).setDepth(UI_DEPTH + 2);
    this.statLabel = label(scene, 346, 35, '', 12, '#f8ebc8').setOrigin(0.5)
      .setDepth(UI_DEPTH + 3);
    const questPanel = scene.add.rectangle(678, 35, 546, 69, 0x102b27, 0.90)
      .setStrokeStyle(2, PALETTE.bronze).setDepth(UI_DEPTH);
    this.questLabel = label(scene, 421, 26, '', 14, '#f9e9bf')
      .setDepth(UI_DEPTH + 2);
    this.zone = label(scene, 421, 49, place, 12, '#a3c9a8')
      .setDepth(UI_DEPTH + 2);
    panel.setAlpha(0.96);
    questPanel.setAlpha(0.96);
    this.health.setScale(1, 1);
    this.mana.setScale(1, 1);
    this.refresh();
  }

  refresh(): void {
    const s = gameState.data;
    this.health.setScale(Math.max(0, s.hp / s.maxHp), 1);
    this.mana.setScale(Math.max(0, s.mp / s.maxMp), 1);
    this.statLabel.setText(`Lv.${s.level}\n${s.gold} đồng`);
    const msg = s.quest === 'new' ? 'Gặp trưởng làng để nhận nhiệm vụ' :
      s.quest === 'active' ? `Săn quái: ${Math.min(s.kills, BALANCE.requiredKills)}/${BALANCE.requiredKills} | Boss: ${s.bossDead ? 'đã hạ' : 'chưa hạ'}` :
      s.quest === 'return' ? 'Đã hạ Hổ Yêu! Về báo trưởng làng' : 'Nhiệm vụ hoàn thành!';
    this.questLabel.setText(msg);
  }
}

export function toast(scene: Phaser.Scene, text: string, color = '#f9e9bd'): void {
  const panel = scene.add.rectangle(480, 128, Math.min(720, Math.max(240, text.length * 10)), 38, 0x17342e, 0.95)
    .setStrokeStyle(1, PALETTE.bronze).setDepth(UI_DEPTH + 10);
  const textObj = label(scene, 480, 128, text, 16, color, 'center')
    .setDepth(UI_DEPTH + 11);
  scene.tweens.add({ targets: [panel, textObj], alpha: 0, delay: 2000,
    duration: 400, onComplete: () => { panel.destroy(); textObj.destroy(); } });
}
