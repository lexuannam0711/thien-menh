import type Phaser from 'phaser';

export interface EnemyArtwork {
  readonly spriteKey: string;
  readonly animationPrefix: string;
  readonly size: 48 | 64;
  readonly feet: 42 | 56;
  readonly frames: 96;
}
const common = [
  'moc-tinh-con', 'ma-troi-u-am', 'soi-rung-hac-am', 'dia-yeu-canh-truc',
  'thuy-quai-tam-ngu', 'dia-dia-khong-lo', 'bo-cap-dam-lay', 'thach-hau-cuong-bao',
  'dieu-sat-tan-vien', 'thach-binh-co', 'hac-an-ve-si', 'u-linh-cung-thu',
] as const;
const elites = ['bach-trao-ho-ma', 'giao-long-thuy-than', 'thach-giap-nguu-ma', 'am-anh-quy-vuong'] as const;
const ids = [...common, ...elites];
const canonical: Readonly<Record<string, EnemyArtwork>> = Object.freeze(Object.fromEntries(ids.map(id => {
  const elite = (elites as readonly string[]).includes(id);
  return [id, Object.freeze({ spriteKey: 'enemy_' + id, animationPrefix: 'enemy_' + id,
    size: elite ? 64 as const : 48 as const, feet: elite ? 56 as const : 42 as const, frames: 96 as const })];
})));
export const ENEMY_ARTWORK_BY_ID: Readonly<Record<string, EnemyArtwork | undefined>> = Object.freeze({
  ...canonical, 'moc-tinh': canonical['moc-tinh-con'], 'ma-troi': canonical['ma-troi-u-am'],
});

export function loadEnemyArtwork(scene: Phaser.Scene): void {
  const queued = (key: string): boolean => scene.textures.exists(key)
    || [...scene.load.list].some(file => file.key === key)
    || [...scene.load.inflight].some(file => file.key === key);
  for (const id of ids) {
    const artwork = canonical[id];
    if (!queued(artwork.spriteKey)) scene.load.spritesheet(artwork.spriteKey, '/assets/enemies/' + id + '.png', {
      frameWidth: artwork.size, frameHeight: artwork.size, endFrame: artwork.frames - 1,
    });
  }
}

export function createEnemyAnimations(scene: Phaser.Scene): void {
  for (const id of ids) {
    const artwork = canonical[id];
    if (!scene.textures.exists(artwork.spriteKey)) continue;
    const texture = scene.textures.get(artwork.spriteKey);
    for (const [directionIndex, direction] of ['down', 'left', 'right', 'up'].entries()) {
      for (const [action, start, count, frameRate, repeat] of [
        ['idle', 0, 4, 5, -1], ['walk', 4, 6, 8, -1], ['attack', 10, 5, 14, 0],
        ['hit', 15, 3, 14, 0], ['death', 18, 6, 24, 0],
      ] as const) {
        const key = artwork.animationPrefix + '_' + action + '_' + direction;
        if (scene.anims.exists(key)) continue;
        const first = directionIndex * 24 + start, end = first + count - 1;
        if (Array.from({ length: count }, (_, index) => first + index).some(frame => !texture.has(String(frame)))) continue;
        scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(artwork.spriteKey, { start: first, end }), frameRate, repeat });
      }
    }
  }
}
