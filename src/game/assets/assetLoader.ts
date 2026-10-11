import Phaser from 'phaser';

export const SPRITE_KEYS = {
  hero: 'hero_sprite',
  moctinh: 'moctinh_sprite',
  matroi: 'matroi_sprite',
  hoyer: 'hoyer_sprite',
} as const;

export function loadGameAssets(scene: Phaser.Scene): void {
  // Safe offline loading with error suppression
  scene.load.spritesheet(SPRITE_KEYS.hero, '/assets/sprites/hero.png', {
    frameWidth: 48, frameHeight: 48,
  });
  scene.load.spritesheet(SPRITE_KEYS.moctinh, '/assets/sprites/moctinh.png', {
    frameWidth: 48, frameHeight: 48,
  });
  scene.load.spritesheet(SPRITE_KEYS.matroi, '/assets/sprites/matroi.png', {
    frameWidth: 32, frameHeight: 32,
  });
  scene.load.spritesheet(SPRITE_KEYS.hoyer, '/assets/sprites/hoyer.png', {
    frameWidth: 96, frameHeight: 96,
  });
}

export function createGameAnimations(scene: Phaser.Scene): void {
  const anims = scene.anims;

  // Hero animations
  if (scene.textures.exists(SPRITE_KEYS.hero) && !anims.exists('hero_walk')) {
    anims.create({
      key: 'hero_idle',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.hero, { start: 0, end: 0 }),
      frameRate: 1,
    });
    anims.create({
      key: 'hero_walk',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.hero, { frames: [1, 0, 2, 0] }),
      frameRate: 8,
      repeat: -1,
    });
    anims.create({
      key: 'hero_attack',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.hero, { start: 3, end: 3 }),
      frameRate: 12,
    });
  }

  // Mộc Tinh animations
  if (scene.textures.exists(SPRITE_KEYS.moctinh) && !anims.exists('moctinh_walk')) {
    anims.create({
      key: 'moctinh_idle',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.moctinh, { start: 0, end: 0 }),
      frameRate: 1,
    });
    anims.create({
      key: 'moctinh_walk',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.moctinh, { frames: [1, 0, 2, 0] }),
      frameRate: 6,
      repeat: -1,
    });
    anims.create({
      key: 'moctinh_attack',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.moctinh, { start: 3, end: 3 }),
      frameRate: 8,
    });
  }

  // Ma Trơi animations
  if (scene.textures.exists(SPRITE_KEYS.matroi) && !anims.exists('matroi_float')) {
    anims.create({
      key: 'matroi_float',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.matroi, { start: 0, end: 3 }),
      frameRate: 7,
      repeat: -1,
    });
  }

  // Hổ Yêu animations
  if (scene.textures.exists(SPRITE_KEYS.hoyer) && !anims.exists('hoyer_stalk')) {
    anims.create({
      key: 'hoyer_idle',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.hoyer, { start: 0, end: 0 }),
      frameRate: 1,
    });
    anims.create({
      key: 'hoyer_stalk',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.hoyer, { frames: [1, 0, 2, 0] }),
      frameRate: 6,
      repeat: -1,
    });
    anims.create({
      key: 'hoyer_pounce',
      frames: anims.generateFrameNumbers(SPRITE_KEYS.hoyer, { start: 3, end: 3 }),
      frameRate: 8,
    });
  }
}
