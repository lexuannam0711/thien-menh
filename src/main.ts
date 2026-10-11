import Phaser from 'phaser';
import { W, H } from './data/config';
import { gameState } from './game/systems/GameState';
import { MenuScene } from './game/scenes/MenuScene';
import { VillageScene } from './game/scenes/VillageScene';
import { ForestScene } from './game/scenes/ForestScene';
import { VictoryScene } from './game/scenes/VictoryScene';
import './style.css';

gameState.load();
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: W,
  height: H,
  backgroundColor: '#10251f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { pixelArt: true, antialias: false },
  input: { activePointers: 4 },
  scene: [MenuScene, VillageScene, ForestScene, VictoryScene],
};
new Phaser.Game(config);
