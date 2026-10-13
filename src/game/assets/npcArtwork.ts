import type Phaser from 'phaser';

export interface NpcArtwork {
  readonly spriteKey: string;
  readonly portraitKey: string;
  readonly idleAnimation: string;
  readonly dialogueAnimation: string;
  readonly feet: 42;
  readonly size: 48;
  readonly frames: 8;
}
const ids = [
  'village-chief', 'village-smith', 'village-healer', 'ngu-ong-ba-vi', 'tho-san-tan-vien',
  'dao-si-truc-lam', 'tien-nu-dam-sen', 'thuy-toc-lao-nhan', 'thuong-nhan-van-lang',
  'tu-si-tan-vien', 'chien-tuong-son-cuoc', 'linh-y-nui-cao', 'quan-thi-ve-phong-chau',
  'te-tu-hoang-cung', 'ky-nhan-khong-lo',
] as const;
export const NPC_ARTWORK_BY_ID: Readonly<Record<string, NpcArtwork | undefined>> = Object.freeze(
  Object.fromEntries(ids.map(id => [id, Object.freeze({
    spriteKey: 'npc_' + id,
    portraitKey: 'npc_' + id + '_portrait',
    idleAnimation: 'npc_' + id + '_idle',
    dialogueAnimation: 'npc_' + id + '_dialogue',
    feet: 42 as const, size: 48 as const, frames: 8 as const,
  })])),
);

export function loadNpcArtwork(scene: Phaser.Scene): void {
  const queued = (key: string): boolean => scene.textures.exists(key)
    || [...scene.load.list].some(file => file.key === key)
    || [...scene.load.inflight].some(file => file.key === key);
  for (const id of ids) {
    const artwork = NPC_ARTWORK_BY_ID[id]!;
    if (!queued(artwork.spriteKey)) scene.load.spritesheet(artwork.spriteKey, '/assets/npcs/' + id + '.png', {
      frameWidth: artwork.size, frameHeight: artwork.size, endFrame: artwork.frames - 1,
    });
    if (!queued(artwork.portraitKey)) scene.load.image(artwork.portraitKey, '/assets/npcs/' + id + '-portrait.png');
  }
}

export function createNpcAnimations(scene: Phaser.Scene): void {
  for (const id of ids) {
    const artwork = NPC_ARTWORK_BY_ID[id]!;
    if (!scene.textures.exists(artwork.spriteKey)) continue;
    const texture = scene.textures.get(artwork.spriteKey);
    for (const [key, start, end, frameRate] of [
      [artwork.idleAnimation, 0, 3, 4], [artwork.dialogueAnimation, 4, 7, 6],
    ] as const) {
      if (scene.anims.exists(key)) continue;
      if (Array.from({ length: end - start + 1 }, (_, index) => start + index).some(frame => !texture.has(String(frame)))) continue;
      scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(artwork.spriteKey, { start, end }), frameRate, repeat: key === artwork.idleAnimation ? -1 : 0 });
    }
  }
}
