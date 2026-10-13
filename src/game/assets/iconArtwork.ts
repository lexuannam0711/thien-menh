import type Phaser from 'phaser';

export const ICON_TEXTURE_KEY = 'rpg-icons';
export const ICON_FRAME_SIZE = 32;
export const ICON_FRAME_COUNT = 21;

export const ITEM_ICON_FRAMES: Readonly<Record<string, number | undefined>> = Object.freeze({
  "herbal-balm": 0,
  "spirit-tea": 1,
  "bronze-spear": 2,
  "battle-axe": 3,
  "lac-sword": 4,
  "bamboo-armor": 5,
  "jade-charm": 6,
  "spirit-stone": 7,
  "bronze-scrap": 8,
} as const);

export const SKILL_ICON_FRAMES: Readonly<Record<string, number | undefined>> = Object.freeze({
  "earth-shockwave": 9,
  "stone-armor": 10,
  "mountain-cleave": 11,
  "flame-beam": 12,
  "blazing-dash": 13,
  "sun-burst": 14,
  "tidal-surge": 15,
  "dragon-vortex": 16,
  "sacred-spring": 17,
  "spear-thrust": 18,
  "axe-whirlwind": 19,
  "lac-blade-dance": 20,
} as const);

export function loadIconArtwork(scene: Phaser.Scene): void {
  if (scene.textures.exists(ICON_TEXTURE_KEY)
    || [scene.load.list, scene.load.inflight, scene.load.queue].some(files =>
      [...files].some(file => file.key === ICON_TEXTURE_KEY))) return;
  scene.load.spritesheet(ICON_TEXTURE_KEY, '/assets/icons/rpg-icons.png', {
    frameWidth: ICON_FRAME_SIZE, frameHeight: ICON_FRAME_SIZE, endFrame: ICON_FRAME_COUNT - 1,
  });
}
