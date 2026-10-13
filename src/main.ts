import Phaser from 'phaser';
import { W, H } from './data/config';
import { gameState } from './game/systems/GameState';
import { MenuScene } from './game/scenes/MenuScene';
import { VillageScene } from './game/scenes/VillageScene';
import { ForestScene } from './game/scenes/ForestScene';
import { DungeonScene } from './game/scenes/DungeonScene';
import { VictoryScene } from './game/scenes/VictoryScene';
import { EndingScene } from './game/scenes/EndingScene';
import { GameOverScene } from './game/scenes/GameOverScene';
import './style.css';

gameState.load();
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: W,
  height: H,
  backgroundColor: '#10251f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { pixelArt: true, antialias: false, roundPixels: true },
  input: { activePointers: 4 },
  scene: [MenuScene, VillageScene, ForestScene, DungeonScene, VictoryScene, EndingScene, GameOverScene],
};
new Phaser.Game(config);
