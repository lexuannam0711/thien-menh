import Phaser from 'phaser';
import { animationFrames, DIRECTIONS, SPRITE_MANIFEST, type SpriteName } from './spriteManifest';
import { loadEnemyArtwork, createEnemyAnimations } from './enemyArtwork';
import { loadEnvironmentArtwork } from './environmentArtwork';
import { loadEquipmentArtwork } from './equipmentArtwork';
import { presentScenePreload } from '../rendering/ScenePresentation';

export const SPRITE_KEYS = {
  hero: 'hero_sprite', hero_axe: 'hero_axe_sprite', hero_sword: 'hero_sword_sprite', moctinh: 'moctinh_sprite', matroi: 'matroi_sprite', hoyer: 'hoyer_sprite',
  wolf: 'wolf_sprite', spider: 'spider_sprite',
  thuongluong: 'thuongluong_sprite', thachtuong: 'thachtuong_sprite', hacan: 'hacan_sprite',
} as const;

export function loadGameAssets(scene: Phaser.Scene): void {
  loadEnemyArtwork(scene);
  loadEnvironmentArtwork(scene);
  loadEquipmentArtwork(scene);
  for (const [name, sheet] of Object.entries(SPRITE_MANIFEST)) {
    if (scene.textures.exists(SPRITE_KEYS[name as SpriteName])) continue;
    scene.load.spritesheet(SPRITE_KEYS[name as SpriteName], '/assets/sprites/' + name + '.png', {
      frameWidth: sheet.size, frameHeight: sheet.size, endFrame: sheet.columns * DIRECTIONS.length - 1,
    });
  }
  presentScenePreload(scene);
}

export function createGameAnimations(scene: Phaser.Scene): void {
  createEnemyAnimations(scene);
  for (const [spriteName, sheet] of Object.entries(SPRITE_MANIFEST)) {
    const name = spriteName as SpriteName;
    const texture = SPRITE_KEYS[name];
    if (!scene.textures.exists(texture)) continue;
    for (const [state, pose] of Object.entries(sheet.poses)) {
      for (const direction of DIRECTIONS) {
        const key = name + '_' + state + '_' + direction;
        if (scene.anims.exists(key)) continue;
        const frames = animationFrames(name, state, direction);
        if (frames.some(frame => !scene.textures.get(texture).has(String(frame)))) continue;
        scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(texture, { frames }), frameRate: pose.frameRate, repeat: pose.repeat });
      }
    }
    const aliases = { ...Object.fromEntries(Object.keys(sheet.poses).map(state => [state, state])),
      ...(sheet.poses.attack1 ? { attack: 'attack1' } : { run: 'walk' }),
      ...(name === 'matroi' ? { float: 'walk' } : {}),
      ...(name === 'hoyer' ? { stalk: 'walk', pounce: 'attack' } : {}),
    };
    for (const [alias, state] of Object.entries(aliases)) {
      const key = name + '_' + alias;
      if (scene.anims.exists(key)) continue;
      const pose = sheet.poses[state];
      const frames = animationFrames(name, state, 'down');
      if (frames.some(frame => !scene.textures.get(texture).has(String(frame)))) continue;
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(texture, { frames }), frameRate: pose.frameRate, repeat: pose.repeat });
    }
  }
}
