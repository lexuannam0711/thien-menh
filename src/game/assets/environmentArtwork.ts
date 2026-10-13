import type Phaser from 'phaser';

const regions = ['village', 'forest', 'swamp', 'mountain', 'citadel'] as const;
type EnvironmentRegion = typeof regions[number];
type EnvironmentArtwork = Readonly<{
  terrainKey: string;
  propKey: string;
  tileSize: 32;
  propSize: 128;
  feet: 112;
}>;

export const ENVIRONMENT_ARTWORK: Readonly<Record<EnvironmentRegion, EnvironmentArtwork>> = Object.freeze(
  Object.fromEntries(regions.map(region => [region, Object.freeze({
    terrainKey: 'environment_' + region + '_terrain',
    propKey: 'environment_' + region + '_props',
    tileSize: 32 as const, propSize: 128 as const, feet: 112 as const,
  })])) as Record<EnvironmentRegion, EnvironmentArtwork>,
);

export function loadEnvironmentArtwork(scene: Phaser.Scene): void {
  const queued = (key: string): boolean => scene.textures.exists(key)
    || [scene.load.list, scene.load.inflight, scene.load.queue].some(files => [...files].some(file => file.key === key));
  for (const region of regions) {
    const artwork = ENVIRONMENT_ARTWORK[region];
    for (const [key, kind, size] of [
      [artwork.terrainKey, 'terrain', artwork.tileSize],
      [artwork.propKey, 'props', artwork.propSize],
    ] as const) {
      if (!queued(key)) scene.load.spritesheet(key, '/assets/environments/' + region + '-' + kind + '.png', {
        frameWidth: size, frameHeight: size, startFrame: 0, endFrame: 7,
      });
    }
  }
}
