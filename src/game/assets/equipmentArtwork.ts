import type Phaser from 'phaser';
import { DIRECTIONS, SPRITE_MANIFEST } from './spriteManifest';

export const EQUIPMENT_ARTWORK = Object.freeze({ armor: 'bamboo-armor', accessory: 'jade-charm' });
export const EQUIPMENT_HEROES = ['hero', 'hero_axe', 'hero_sword'] as const;

export function equipmentTexture(slot: keyof typeof EQUIPMENT_ARTWORK, item: unknown, heroTexture: string): string | null {
  const hero = EQUIPMENT_HEROES.find(name => heroTexture === name + '_sprite');
  return hero && item === EQUIPMENT_ARTWORK[slot] ? 'equipment_' + item + '_' + hero : null;
}

export function loadEquipmentArtwork(scene: Phaser.Scene): void {
  const sheet = SPRITE_MANIFEST.hero;
  for (const item of Object.values(EQUIPMENT_ARTWORK)) {
    for (const hero of EQUIPMENT_HEROES) {
      const key = 'equipment_' + item + '_' + hero;
      if (scene.textures.exists(key)) continue;
      scene.load.spritesheet(key, '/assets/equipment/' + item + '_' + hero + '.png', {
        frameWidth: sheet.size, frameHeight: sheet.size, endFrame: sheet.columns * DIRECTIONS.length - 1,
      });
    }
  }
}
