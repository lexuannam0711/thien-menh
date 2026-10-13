import Phaser from 'phaser';
import { H, PALETTE, UI_DEPTH, W } from '../../data/config';
import { button, label } from './art';
import { audioManager } from '../audio/AudioManager';

export class PauseOverlay {
  private overlay: Phaser.GameObjects.Container | null = null;
  private readonly keydown: (event: KeyboardEvent) => void;

  constructor(private readonly scene: Phaser.Scene, private readonly canOpen: () => boolean = () => true) {
    this.keydown = (event) => {
      if ((event.code === 'Escape' || event.code === 'KeyP') && (this.isOpen() || this.canOpen())) {
        event.preventDefault();
        this.toggle();
      }
    };
    window.addEventListener('keydown', this.keydown);
  }

  isOpen(): boolean { return this.overlay !== null; }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }

  close(): void {
    if (!this.overlay) return;
    this.overlay?.destroy(true);
    this.overlay = null;
    this.scene.time.paused = false;
    this.scene.tweens.resumeAll();
    audioManager.resumeMusic();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.keydown);
    this.close();
  }

  private open(): void {
    if (this.overlay) return;
    this.scene.time.paused = true;
    this.scene.tweens.pauseAll();
    audioManager.pauseMusic();
    const backdrop = this.scene.add.rectangle(W / 2, H / 2, W, H, 0x071512, 0.82).setInteractive();
    const frame = this.scene.add.rectangle(W / 2, H / 2, 420, 260, 0x1b3a32).setStrokeStyle(3, PALETTE.bronze);
    const title = label(this.scene, W / 2, 190, 'TẠM DỪNG', 30, '#ffe09c', 'center');
    const resume = button(this.scene, W / 2, 280, 250, 'TIẾP TỤC', () => this.close());
    const menu = button(this.scene, W / 2, 350, 250, 'VỀ MENU', () => {
      this.close();
      this.scene.scene.start('Menu');
    }, 0x445e53);
    this.overlay = this.scene.add.container(0, 0, [backdrop, frame, title, resume, menu]).setDepth(UI_DEPTH + 100);
  }
}
