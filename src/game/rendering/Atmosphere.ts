import Phaser from 'phaser';
import { W, H } from '../../data/config';
import { graphicsSettings } from './GraphicsSettings';
const cleanups = new WeakMap<Phaser.Scene, () => void>();

export function addAtmosphere(scene: Phaser.Scene, village: boolean): void {
  cleanups.get(scene)?.();
  let motes: Phaser.GameObjects.Rectangle[] = [];
  const clear = () => {
    for (const mote of motes) { scene.tweens.killTweensOf(mote); mote.destroy(); }
    motes = [];
  };
  const refresh = () => {
    clear();
    motes = Array.from({ length: graphicsSettings.getBudget().ambientParticles }, (_, index) => {
      const firefly = !village && index % 3 === 0;
      const mote = scene.add.rectangle(Phaser.Math.Between(15, W - 15), Phaser.Math.Between(115, H - 50),
        firefly ? 2 : 3, firefly ? 2 : 1, firefly ? 0xc8f0a3 : village ? 0xc9a46a : 0x79a765, 0.45)
        .setDepth(700);
      scene.tweens.add({ targets: mote, x: mote.x + (village ? 15 : -20), y: mote.y - 24,
        alpha: firefly ? 0.1 : 0.7, duration: 2500 + index * 110, delay: index * 60,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return mote;
    });
  };
  refresh();
  const preference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const unsubscribe = graphicsSettings.subscribe(refresh);
  preference?.addEventListener('change', refresh);
  const shutdown = () => {
    unsubscribe();
    preference?.removeEventListener('change', refresh);
    scene.events.off('shutdown', shutdown);
    clear();
    cleanups.delete(scene);
  };
  scene.events.once('shutdown', shutdown);
  cleanups.set(scene, shutdown);
}
