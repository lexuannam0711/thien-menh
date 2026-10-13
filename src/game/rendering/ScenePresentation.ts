import type Phaser from 'phaser';
import { graphicsSettings } from './GraphicsSettings';

const cycles = new WeakMap<Phaser.Scene, () => void>();

function loadingPanel(scene: Phaser.Scene): () => void {
  const width = Math.max(64, Math.min(440, scene.scale.width - 32)), center = scene.scale.width / 2;
  const top = scene.scale.height / 2;
  const panel = scene.add.rectangle(center, top, width, 104, 0x182322, 0.98)
    .setStrokeStyle(2, 0xb7985d).setDepth(10000).setScrollFactor(0);
  const title = scene.add.text(center, top - 30, 'Đang tải hành trình', {
    fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffe6b1',
  }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);
  const bar = scene.add.rectangle(center - width / 2 + 16, top + 4, 1, 8, 0xb7985d)
    .setOrigin(0, 0.5).setDepth(10001).setScrollFactor(0);
  const percent = scene.add.text(center, top + 28, '0%', {
    fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ffe6b1',
  }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);
  const progress = (value: number) => {
    const bounded = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    bar.setDisplaySize((width - 32) * bounded, 8);
    percent.setText(Math.round(bounded * 100) + '%');
  };
  progress(0);
  scene.load.on('progress', progress);
  return () => {
    scene.load.off('progress', progress);
    for (const object of [panel, title, bar, percent]) object.destroy();
  };
}

function entryFade(scene: Phaser.Scene, done: () => void): () => void {
  const camera = scene.cameras.main;
  const fade = camera.fadeEffect as typeof camera.fadeEffect & { alpha: number; _onUpdate: (() => void) | null };
  if (!graphicsSettings.getBudget().cameraShake || fade.isRunning
    || (fade.isComplete && fade.alpha > 0)) {
    done();
    return () => {};
  }
  const preference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let stopped = false;
  const marker = () => {};
  const ownsFade = () => fade._onUpdate === marker;
  const soften = () => {
    if (stopped) return;
    if (!ownsFade()) { done(); return; }
    fade.alpha = 0.12 * (1 - fade.progress);
  };
  const refresh = () => { if (!graphicsSettings.getBudget().cameraShake) done(); };
  const unsubscribe = graphicsSettings.subscribe(refresh);
  scene.events.on('postupdate', soften);
  camera.once('camerafadeincomplete', done);
  preference?.addEventListener('change', refresh);
  camera.fadeIn(120, 0, 0, 0, marker);
  soften();
  return () => {
    if (stopped) return;
    stopped = true;
    unsubscribe();
    preference?.removeEventListener('change', refresh);
    scene.events.off('postupdate', soften);
    camera.off('camerafadeincomplete', done);
    if (ownsFade()) { fade.reset(); fade.alpha = 0; }
  };
}

export function presentScenePreload(scene: Phaser.Scene): void {
  if (cycles.has(scene)) return;
  const pending = () => [scene.load.list, scene.load.inflight, scene.load.queue].some(files => files.size > 0);
  let clearPanel: (() => void) | undefined;
  const start = () => { if (!clearPanel && pending()) clearPanel = loadingPanel(scene); };
  start();
  let stopFade = () => {};
  let cleaned = false;
  const complete = () => {
    clearPanel?.();
    clearPanel = undefined;
    scene.load.off('start', start);
    scene.load.off('complete', complete);
  };
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    complete();
    stopFade();
    scene.events.off('create', create);
    scene.events.off('shutdown', cleanup);
    if (cycles.get(scene) === cleanup) cycles.delete(scene);
  };
  const create = () => {
    complete();
    stopFade = entryFade(scene, cleanup);
    if (cycles.get(scene) !== cleanup) stopFade();
  };
  cycles.set(scene, cleanup);
  scene.load.once('start', start);
  scene.load.once('complete', complete);
  scene.events.once('create', create);
  scene.events.once('shutdown', cleanup);
}
