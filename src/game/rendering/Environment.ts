import type Phaser from 'phaser';
import { H, W } from '../../data/config';
import { ENVIRONMENT_ARTWORK } from '../assets/environmentArtwork';
import type { Barrier } from '../world/WorldBounds';
import { ENVIRONMENT_PALETTES, paintEnvironmentAtmosphere, type EnvironmentAnchor } from './EnvironmentAtmosphere';
const cleanups = new WeakMap<Phaser.Scene, () => void>();

function ownEnvironment(scene: Phaser.Scene) {
  cleanups.get(scene)?.();
  let objects: readonly Phaser.GameObjects.GameObject[] = [];
  const shutdown = () => {
    scene.events.off('shutdown', shutdown);
    for (const object of objects) { scene.tweens.killTweensOf(object); object.destroy(); }
    objects = [];
    cleanups.delete(scene);
  };
  scene.events.once('shutdown', shutdown);
  cleanups.set(scene, shutdown);
  return (...painted: Phaser.GameObjects.GameObject[]) => { objects = [...objects, ...painted]; };
}

function paintArena(scene: Phaser.Scene, region: keyof typeof ENVIRONMENT_ARTWORK,
  arena: { readonly x: number; readonly y: number; readonly radius: number }) {
  const art = ENVIRONMENT_ARTWORK[region];
  return [scene.add.tileSprite(arena.x, arena.y, arena.radius * 2, arena.radius * 2, art.terrainKey, 6)
    .setDepth(1).setTint(ENVIRONMENT_PALETTES[region].ambient),
  scene.add.image(arena.x, arena.y, art.terrainKey, 7).setScale(3).setDepth(2)];
}

export function paintEnvironment(scene: Phaser.Scene, region: keyof typeof ENVIRONMENT_ARTWORK,
  barriers: readonly Barrier[], arena?: { readonly x: number; readonly y: number; readonly radius: number }): boolean {
  const art = ENVIRONMENT_ARTWORK[region];
  if (!art || !scene.textures.exists(art.terrainKey) || !scene.textures.exists(art.propKey)) return false;
  const own = ownEnvironment(scene);
  let anchors: readonly EnvironmentAnchor[] = [];
  const terrain = (x: number, y: number, width: number, height: number, frame: number, depth = 1): void => {
    own(scene.add.tileSprite(x, y, width, height, art.terrainKey, frame).setDepth(depth).setTint(ENVIRONMENT_PALETTES[region].ambient));
  };
  const prop = (x: number, groundY: number, frame: number, scale = 1): void => {
    const depth = 30 + groundY / 10;
    anchors = [...anchors, { x, y: groundY, frame, scale }];
    own(scene.add.ellipse(x, groundY, 48 * scale, 12 * scale, 0x10251f, 0.35).setDepth(depth - 0.1));
    own(scene.add.image(x, groundY - (art.feet - art.propSize / 2) * scale, art.propKey, frame)
      .setScale(scale).setDepth(depth));
  };
  terrain(W / 2, H / 2, W, H, 0, 0);
  terrain(W / 2, region === 'village' ? 305 : 285, W, region === 'village' ? 120 : 64, 1);
  for (let index = 0; index < 12; index++) {
    const x = 64 + (index * 181) % 832;
    const y = 112 + (index * 113) % 384;
    if (arena && Math.hypot(x - arena.x, y - arena.y) < arena.radius + 32) continue;
    if (y > 240 && y < 370) continue;
    terrain(x, y, 32, 32, index % 2 ? 3 : 4);
  }
  barriers.forEach((barrier, index) => {
    const x = barrier.x + barrier.width / 2;
    const groundY = barrier.y + barrier.height;
    if (region === 'village' && index === 3) {
      terrain(x, barrier.y + barrier.height / 2, barrier.width, barrier.height, 5);
      prop(x, groundY, 2, 0.75);
    } else {
      prop(x, groundY, region === 'village' ? 0 : region === 'forest' ? 1 : 5,
        region === 'village' ? barrier.width / art.propSize : 0.75);
    }
  });
  for (const [x, y] of [[48, 160], [890, 160], [48, 478], [890, 478]]) prop(x, y, 2, 0.75);
  if (region === 'village') {
    prop(435, 213, 4, 0.5);
    prop(690, 204, 3, 0.5);
    prop(945, 365, 6, 0.75);
  } else {
    prop(780, 180, 0);
    prop(820, 455, 3, 0.75);
  }
  if (arena) own(...paintArena(scene, region, arena));
  paintEnvironmentAtmosphere(scene, region, anchors, arena);
  return true;
}
