import type Phaser from 'phaser';
import { graphicsSettings } from './GraphicsSettings';

export const ENVIRONMENT_PALETTES = Object.freeze({
  village: Object.freeze({ ambient: 0xffedcc, light: 0xffce7a, foliage: 0x9eaf60, water: 0x91caca }),
  forest: Object.freeze({ ambient: 0xc4dcc6, light: 0xb4a0dc, foliage: 0x78ac71, water: 0x70b5ac }),
  swamp: Object.freeze({ ambient: 0xbad9dc, light: 0x7acfd5, foliage: 0x739982, water: 0x9ae1dd }),
  mountain: Object.freeze({ ambient: 0xdae5ee, light: 0xffe1a4, foliage: 0x92aaa0, water: 0xb9deec }),
  citadel: Object.freeze({ ambient: 0xffdfbd, light: 0xffbe72, foliage: 0xa0ab70, water: 0xbad3ca }),
});
type Region = keyof typeof ENVIRONMENT_PALETTES;
export type EnvironmentAnchor = Readonly<{ x: number; y: number; frame: number; scale: number }>;
type Arena = Readonly<{ x: number; y: number; radius: number }>;
const cleanups = new WeakMap<Phaser.Scene, () => void>();

function detail(scene: Phaser.Scene, region: Region, anchor: EnvironmentAnchor, index: number) {
  const palette = ENVIRONMENT_PALETTES[region];
  const water = region === 'swamp' && anchor.frame === 3;
  const foliage = (region === 'village' || region === 'forest') && (anchor.frame === 1 || anchor.frame === 2);
  const y = anchor.y - (water ? 46 * anchor.scale : foliage ? 12 * anchor.scale : 24 * anchor.scale);
  const shape = scene.add.ellipse(anchor.x, y, water ? 28 : foliage ? 8 : 60,
    water ? 6 : foliage ? 3 : 20, water ? palette.water : foliage ? palette.foliage : palette.light,
    water ? 0 : foliage ? 0.35 : 0.08).setDepth(2);
  if (water) shape.setStrokeStyle(1, palette.water, 0.35);
  scene.tweens.add({ targets: shape, scaleX: water ? 1.15 : 1.05, scaleY: 1.05,
    angle: foliage ? 8 : 0, alpha: water ? 0.22 : foliage ? 0.5 : 0.12,
    duration: 2200 + index * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return shape;
}

export function paintEnvironmentAtmosphere(scene: Phaser.Scene, region: Region,
  anchors: readonly EnvironmentAnchor[], arena?: Arena): void {
  cleanups.get(scene)?.();
  const priority = (anchor: EnvironmentAnchor) => (region === 'village' || region === 'forest')
    && (anchor.frame === 1 || anchor.frame === 2) ? 2 : anchor.frame === 3 ? 1 : 0;
  const safe = anchors.filter(anchor => {
    const y = anchor.y - 24 * anchor.scale;
    return (y < 200 || y > 414) && (!arena || Math.hypot(anchor.x - arena.x, y - arena.y) > arena.radius + 96);
  }).sort((left, right) => priority(right) - priority(left));
  let shapes: readonly Phaser.GameObjects.Ellipse[] = [];
  const clear = () => {
    for (const shape of shapes) { scene.tweens.killTweensOf(shape); shape.destroy(); }
    shapes = [];
  };
  const refresh = () => {
    clear();
    const count = Math.floor(graphicsSettings.getBudget().ambientParticles / 5);
    shapes = safe.slice(0, 2).map(anchor => scene.add.ellipse(anchor.x, anchor.y - 24 * anchor.scale,
      60, 20, ENVIRONMENT_PALETTES[region].light, 0.08).setDepth(2));
    if (safe.length) shapes = [...shapes, ...Array.from({ length: count }, (_, index) =>
      detail(scene, region, safe[index % safe.length], index))];
  };
  const preference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const unsubscribe = graphicsSettings.subscribe(refresh);
  const shutdown = () => {
    unsubscribe();
    preference?.removeEventListener('change', refresh);
    scene.events.off('shutdown', shutdown);
    clear();
    cleanups.delete(scene);
  };
  refresh();
  preference?.addEventListener('change', refresh);
  scene.events.once('shutdown', shutdown);
  cleanups.set(scene, shutdown);
}
