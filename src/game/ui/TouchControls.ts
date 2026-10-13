import Phaser from 'phaser';
import { UI_DEPTH } from '../../data/config';
import { graphicsSettings } from '../rendering/GraphicsSettings';

type Action = 'attack' | 'dodge' | 'earth' | 'flame' | 'water' | 'fourth' | 'interact';

export class TouchControls {
  readonly direction = new Phaser.Math.Vector2();
  private activePointerId: number | null = null;
  private joystickKnob: Phaser.GameObjects.Arc;
  private readonly origin = new Phaser.Math.Vector2(109, 421);

  constructor(private scene: Phaser.Scene, private perform: (action: Action) => void,
    private enabled: () => boolean) {
    const back = scene.add.circle(this.origin.x, this.origin.y, 70, 0xf2e2b7, 0.13)
      .setStrokeStyle(2, 0xe0d8a5, 0.50).setDepth(UI_DEPTH);
    back.setInteractive();
    this.joystickKnob = scene.add.circle(this.origin.x, this.origin.y, 29, 0xd7be84, 0.45)
      .setStrokeStyle(2, 0xffeac1, 0.8).setDepth(UI_DEPTH + 1).setInteractive();
    const begin = (pointer: Phaser.Input.Pointer): void => {
      if (!enabled() || this.activePointerId !== null) return;
      this.activePointerId = pointer.id;
      this.updateJoystick(pointer);
    };
    back.on('pointerdown', begin);
    this.joystickKnob.on('pointerdown', begin);
    const move = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.activePointerId) this.updateJoystick(pointer);
    };
    scene.input.on('pointermove', move);
    const reset = (): void => {
      this.activePointerId = null;
      this.direction.set(0, 0);
      this.joystickKnob.setPosition(this.origin.x, this.origin.y);
    };
    const release = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.activePointerId) reset();
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
    scene.input.on('pointercancel', release);
    scene.game.events.on('blur', reset);
    document.addEventListener('visibilitychange', reset);
    scene.events.once('shutdown', () => {
      scene.input.off('pointermove', move);
      scene.input.off('pointerup', release);
      scene.input.off('pointerupoutside', release);
      scene.input.off('pointercancel', release);
      scene.game.events.off('blur', reset);
      document.removeEventListener('visibilitychange', reset);
      reset();
    });
    this.makeButton(847, 430, 49, 'CHÉM', 'attack', 0xc4744c);
    this.makeButton(745, 464, 35, 'NÉ', 'dodge', 0x507c7d);
    this.makeButton(780, 354, 35, 'Q', 'earth', 0x877349);
    this.makeButton(891, 351, 35, 'E', 'flame', 0x9d5a37);
    this.makeButton(780, 276, 33, 'R', 'water', 0x397f99);
    this.makeButton(891, 276, 33, 'T', 'fourth', 0x66558a);
    this.makeButton(656, 467, 33, 'F', 'interact', 0x777b66);
  }

  private makeButton(x: number, y: number, radius: number, title: string,
    action: Action, fill: number): void {
    const shape = this.scene.add.circle(x, y, radius, fill, 0.74)
      .setStrokeStyle(2, 0xece0c2, 0.85).setDepth(UI_DEPTH).setInteractive();
    const text = this.scene.add.text(x, y, title, {
      fontFamily: 'Arial, sans-serif', fontSize: `${radius > 42 ? 15 : 16}px`,
      fontStyle: 'bold', color: '#fff5d9',
    }).setOrigin(0.5).setDepth(UI_DEPTH + 1).setInteractive();
    const down = (): void => {
      if (!this.enabled()) return;
      this.perform(action);
      if (graphicsSettings.getState().reducedMotion ||
        (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
      this.scene.tweens.add({ targets: text, scale: 0.90, yoyo: true, duration: 85 });
    };
    shape.on('pointerdown', down);
    text.on('pointerdown', down);
  }

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.origin.x;
    const dy = pointer.y - this.origin.y;
    const length = Math.hypot(dx, dy);
    if (length < 7) {
      this.direction.set(0, 0);
      return;
    }
    const magnitude = Math.min(1, length / 55);
    this.direction.set(dx / length * magnitude, dy / length * magnitude);
    this.joystickKnob.setPosition(this.origin.x + this.direction.x * 39,
      this.origin.y + this.direction.y * 39);
  }
}
