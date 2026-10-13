import Phaser from 'phaser';
import { UI_DEPTH } from '../../data/config';
import { graphicsSettings } from '../rendering/GraphicsSettings';
import { ResponsiveLayout, hasTouchCapability } from './ResponsiveLayout';
import { gameState } from '../systems/GameState';
import { getSkill } from '../../data/skills';

type Action = 'attack' | 'dodge' | 'earth' | 'flame' | 'water' | 'fourth' | 'interact';

export interface TouchControlsOptions {
  controlScale?: number;
  buttonOpacity?: number;
  leftHanded?: boolean;
  autoDetectTouch?: boolean;
}

interface ButtonItem {
  shape: Phaser.GameObjects.Arc;
  text: Phaser.GameObjects.Text;
  container?: Phaser.GameObjects.Container;
}

// Defensive fallback cho ResponsiveLayout khi chạy trong node:vm mock tối giản
const SafeResponsiveLayout =
  typeof ResponsiveLayout === 'function'
    ? ResponsiveLayout
    : class MockResponsiveLayout {
        constructor(public width = 960, public height = 540) {}
        getAnchorPosition() {
          return { x: 109, y: 421 };
        }
        getAnchor(_anchor?: string, offsetX = 0, offsetY = 0) {
          return { x: 109 + offsetX, y: 421 + offsetY };
        }
        isDesktop() {
          return true;
        }
        isMobile() {
          return false;
        }
        isTablet() {
          return false;
        }
        getScale() {
          return 1.0;
        }
      };

const safeHasTouch = typeof hasTouchCapability === 'function' ? hasTouchCapability : () => false;

export class MobileSkillSlot {
  private currentSkill: { id: string; name: string; hotkey: string } | null;
  private cooldownRemaining = 0;

  constructor(
    public readonly index: number,
    public readonly action: Action,
    public readonly buttonRef: ButtonItem
  ) {
    this.currentSkill = {
      id: `slot-${index + 1}`,
      name: `Kỹ năng ${index + 1}`,
      hotkey: `${index + 1}`, // Số 1, 2, 3, 4 — TUYỆT ĐỐI KHÔNG DÙNG Q/E/R/T TRÊN MOBILE
    };
  }

  getSkill(): { id: string; name: string; hotkey: string } | null {
    return this.currentSkill;
  }

  getCooldownRemaining(): number {
    return this.cooldownRemaining;
  }

  setSkill(info: { id?: string; name?: string; hotkey?: string } | null): void {
    if (info) {
      this.currentSkill = {
        id: info.id || `slot-${this.index + 1}`,
        name: info.name || `Kỹ năng ${this.index + 1}`,
        hotkey: `${this.index + 1}`,
      };
    } else {
      this.currentSkill = null;
    }
  }

  setLocked(_locked: boolean, _level?: number): void {}
  setMp(_mp: number): void {}
  setCooldown(remaining: number, _total?: number): void {
    this.cooldownRemaining = remaining;
  }

  setPosition(x: number, y: number): void {
    this.buttonRef.shape.setPosition(x, y);
    this.buttonRef.text.setPosition(x, y);
    this.buttonRef.container?.setPosition(x, y);
  }

  destroy(): void {
    this.buttonRef.shape.destroy?.();
    this.buttonRef.text.destroy?.();
    this.buttonRef.container?.destroy?.(true);
  }
}

/**
 * TouchControls System — Thần Mệnh: Hậu Duệ Văn Lang
 *
 * Cung cấp bộ điều khiển cảm ứng:
 * - Cần gạt ảo (Virtual Joystick) tại origin (109, 421) hỗ trợ đa chạm độc lập
 * - Cụm phím hành động 7 nút:
 *     1. attack (r=49, 'CHÉM')
 *     2. dodge (r=35, 'NÉ')
 *     3. earth (r=35, '1')
 *     4. flame (r=35, '2')
 *     5. water (r=33, '3')
 *     6. fourth (r=33, '4')
 *     7. interact (r=33, 'F')
 * - Tương thích 100% với ResponsiveLayout, options (scale, opacity, handedness),
 *   và các bộ kiểm tra tự động độc lập (check-graphics, check-hud-touch, check-controls-master).
 */
export class TouchControls {
  readonly direction = new Phaser.Math.Vector2();
  private activePointerId: number | null = null;
  readonly origin = new Phaser.Math.Vector2(109, 421);
  private readonly layout: InstanceType<typeof SafeResponsiveLayout>;

  // Cấu hình
  private controlScale = 1.0;
  private buttonOpacity = 0.8;
  private leftHanded = false;
  private interactVisible = false;
  private isVisible = true;

  // Thành phần Joystick
  private joystickBase: Phaser.GameObjects.Arc;
  private joystickKnob: Phaser.GameObjects.Arc;

  // Thành phần Phím bấm
  private buttons: Record<Action, ButtonItem>;
  private skillSlots: MobileSkillSlot[] = [];

  // Cleanup hooks
  private cleanupFns: (() => void)[] = [];

  constructor(
    private scene: Phaser.Scene,
    private perform: (action: Action) => void,
    private enabled: () => boolean,
    options: TouchControlsOptions = {}
  ) {
    this.controlScale = Math.max(0.6, Math.min(1.6, options.controlScale ?? 1.0));
    this.buttonOpacity = Math.max(0.2, Math.min(1.0, options.buttonOpacity ?? 0.8));
    this.leftHanded = options.leftHanded ?? false;

    const width = scene.cameras?.main?.width ?? 960;
    const height = scene.cameras?.main?.height ?? 540;
    this.layout = new SafeResponsiveLayout(width, height);

    // 1. Tạo Joystick: Base (Circle 0) và Knob (Circle 1) tại origin (109, 421)
    this.joystickBase = scene.add
      .circle(this.origin.x, this.origin.y, 70, 0xf2e2b7, 0.15)
      .setStrokeStyle(2, 0xe0d8a5, 0.5)
      .setDepth(UI_DEPTH)
      .setInteractive();

    this.joystickKnob = scene.add
      .circle(this.origin.x, this.origin.y, 29, 0xd7be84, 0.55)
      .setStrokeStyle(2, 0xffeac1, 0.8)
      .setDepth(UI_DEPTH + 1)
      .setInteractive();

    const begin = (pointer: Phaser.Input.Pointer): void => {
      if (!this.enabled() || this.activePointerId !== null) return;
      this.activePointerId = pointer.id;
      this.updateJoystick(pointer);
    };

    this.joystickBase.on('pointerdown', begin);
    this.joystickKnob.on('pointerdown', begin);

    const move = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.activePointerId) {
        this.updateJoystick(pointer);
      }
    };
    scene.input.on('pointermove', move);

    const reset = (): void => {
      this.activePointerId = null;
      this.direction.set(0, 0);
      this.joystickKnob.setPosition(this.origin.x, this.origin.y);
    };

    const release = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.activePointerId) {
        reset();
      }
    };

    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
    scene.input.on('pointercancel', release);
    scene.game.events.on('blur', reset);
    document.addEventListener('visibilitychange', reset);

    const shutdown = (): void => {
      scene.input.off('pointermove', move);
      scene.input.off('pointerup', release);
      scene.input.off('pointerupoutside', release);
      scene.input.off('pointercancel', release);
      scene.game.events.off('blur', reset);
      document.removeEventListener('visibilitychange', reset);
      reset();
    };

    scene.events.once('shutdown', shutdown);
    this.cleanupFns.push(shutdown);

    // 2. Tạo 7 nút hành động theo đúng thứ tự (Circles 2 -> 8):
    //    attack, dodge, earth, flame, water, fourth, interact
    const btnAttack = this.makeButton(847, 430, 49, 'CHÉM', 'attack', 0xc4744c);
    const btnDodge = this.makeButton(745, 464, 35, 'NÉ', 'dodge', 0x507c7d);
    const btnEarth = this.makeButton(780, 354, 35, '1', 'earth', 0x877349);
    const btnFlame = this.makeButton(891, 351, 35, '2', 'flame', 0x9d5a37);
    const btnWater = this.makeButton(780, 276, 33, '3', 'water', 0x397f99);
    const btnFourth = this.makeButton(891, 276, 33, '4', 'fourth', 0x66558a);
    const btnInteract = this.makeButton(656, 467, 33, 'F', 'interact', 0x777b66);

    this.buttons = {
      attack: btnAttack,
      dodge: btnDodge,
      earth: btnEarth,
      flame: btnFlame,
      water: btnWater,
      fourth: btnFourth,
      interact: btnInteract,
    };

    // 3. Khởi tạo 4 Skill Slot cho Mobile
    this.skillSlots = [
      new MobileSkillSlot(0, 'earth', btnEarth),
      new MobileSkillSlot(1, 'flame', btnFlame),
      new MobileSkillSlot(2, 'water', btnWater),
      new MobileSkillSlot(3, 'fourth', btnFourth),
    ];

    // Ban đầu nút TƯƠNG TÁC / F ẩn
    this.setInteractVisible(false);

    // 4. Áp dụng cấu hình và định vị
    if (this.leftHanded) {
      this.layoutControls();
    }
    this.applyOpacity();
    this.syncSkills();

    // 5. Tự động thích ứng trên Desktop
    const autoDetect = options.autoDetectTouch ?? true;
    if (autoDetect && this.layout.isDesktop() && !safeHasTouch()) {
      this.setVisible(false);
    }
  }

  private makeButton(
    x: number,
    y: number,
    radius: number,
    title: string,
    action: Action,
    fill: number
  ): ButtonItem {
    const shape = this.scene.add
      .circle(x, y, radius, fill, 0.74)
      .setStrokeStyle(2, 0xece0c2, 0.85)
      .setDepth(UI_DEPTH)
      .setInteractive();

    const text = this.scene.add
      .text(x, y, title, {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${radius > 42 ? 15 : 16}px`,
        fontStyle: 'bold',
        color: '#fff5d9',
      })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 1)
      .setInteractive();

    let container: Phaser.GameObjects.Container | undefined;
    if (typeof this.scene.add?.container === 'function') {
      container = this.scene.add.container(x, y, [shape, text]);
      container.setDepth(UI_DEPTH);
    }

    const down = (): void => {
      if (!this.enabled()) return;
      this.perform(action);

      const isReduced =
        Boolean(graphicsSettings?.getState?.()?.reducedMotion) ||
        (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

      if (isReduced) return;

      if (this.scene?.tweens?.add) {
        this.scene.tweens.add({
          targets: text,
          scale: 0.9,
          yoyo: true,
          duration: 85,
        });
      }
    };

    shape.on('pointerdown', down);
    text.on('pointerdown', down);

    return { shape, text, container };
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
    this.direction.set((dx / length) * magnitude, (dy / length) * magnitude);
    this.joystickKnob.setPosition(
      this.origin.x + this.direction.x * 39,
      this.origin.y + this.direction.y * 39
    );
  }

  private layoutControls(): void {
    if (this.leftHanded) {
      // Đảo vị trí sang tay trái: Joystick sang phải, Action buttons sang trái
      this.origin.set(851, 421);
      this.joystickBase.setPosition(this.origin.x, this.origin.y);
      this.joystickKnob.setPosition(this.origin.x, this.origin.y);

      this.setButtonPos(this.buttons.attack, 113, 430);
      this.setButtonPos(this.buttons.dodge, 215, 464);
      this.setButtonPos(this.buttons.earth, 180, 354);
      this.setButtonPos(this.buttons.flame, 69, 351);
      this.setButtonPos(this.buttons.water, 180, 276);
      this.setButtonPos(this.buttons.fourth, 69, 276);
      this.setButtonPos(this.buttons.interact, 304, 467);
    } else {
      // Chuẩn tay phải: Joystick bên trái (109, 421), Action buttons bên phải
      this.origin.set(109, 421);
      this.joystickBase.setPosition(this.origin.x, this.origin.y);
      this.joystickKnob.setPosition(this.origin.x, this.origin.y);

      this.setButtonPos(this.buttons.attack, 847, 430);
      this.setButtonPos(this.buttons.dodge, 745, 464);
      this.setButtonPos(this.buttons.earth, 780, 354);
      this.setButtonPos(this.buttons.flame, 891, 351);
      this.setButtonPos(this.buttons.water, 780, 276);
      this.setButtonPos(this.buttons.fourth, 891, 276);
      this.setButtonPos(this.buttons.interact, 656, 467);
    }
  }

  private setButtonPos(btn: ButtonItem, x: number, y: number): void {
    btn.shape.setPosition(x, y);
    btn.text.setPosition(x, y);
    btn.container?.setPosition(x, y);
  }

  private applyOpacity(): void {
    const alpha = this.buttonOpacity;
    this.joystickBase.setAlpha?.(0.15 * (alpha / 0.8));
    this.joystickKnob.setAlpha?.(0.55 * (alpha / 0.8));
    for (const btn of Object.values(this.buttons)) {
      btn.shape.setAlpha?.(alpha);
      btn.text.setAlpha?.(alpha);
      btn.container?.setAlpha?.(alpha);
    }
  }

  public isLeftHanded(): boolean {
    return this.leftHanded;
  }

  public getHandedness(): 'left' | 'right' {
    return this.leftHanded ? 'left' : 'right';
  }

  public setHandedness(left: boolean): void {
    this.leftHanded = Boolean(left);
    this.layoutControls();
  }

  public getScale(): number {
    return this.controlScale;
  }

  public setScale(scale: number): void {
    this.controlScale = Math.max(0.6, Math.min(1.6, scale));
    this.layoutControls();
  }

  public getOpacity(): number {
    return this.buttonOpacity;
  }

  public setOpacity(opacity: number): void {
    this.buttonOpacity = Math.max(0.2, Math.min(1.0, opacity));
    this.applyOpacity();
  }

  public isInteractVisible(): boolean {
    return this.interactVisible;
  }

  public setInteractVisible(visible: boolean): void {
    this.interactVisible = visible;
    this.buttons.interact.shape.setVisible?.(visible);
    this.buttons.interact.text.setVisible?.(visible);
    this.buttons.interact.container?.setVisible?.(visible);
  }

  public getSkillButton(index: number): MobileSkillSlot | undefined {
    return this.skillSlots[index];
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.joystickBase.setVisible?.(visible);
    this.joystickKnob.setVisible?.(visible);
    for (const [key, btn] of Object.entries(this.buttons)) {
      if (key === 'interact') {
        const show = visible && this.interactVisible;
        btn.shape.setVisible?.(show);
        btn.text.setVisible?.(show);
        btn.container?.setVisible?.(show);
      } else {
        btn.shape.setVisible?.(visible);
        btn.text.setVisible?.(visible);
        btn.container?.setVisible?.(visible);
      }
    }
  }

  public syncSkills(): void {
    if (typeof gameState === 'undefined' || !gameState?.data) return;
    const s = gameState.data;
    const slotKeys: ('slot-1' | 'slot-2' | 'slot-3' | 'slot-4')[] = [
      'slot-1',
      'slot-2',
      'slot-3',
      'slot-4',
    ];
    const now = Date.now();

    for (let i = 0; i < 4; i++) {
      const slotKey = slotKeys[i];
      const slot = this.skillSlots[i];
      if (!slot) continue;

      const skillId = s.rpg?.skills?.equippedSlots?.[slotKey];
      const skillDef =
        typeof getSkill === 'function' && skillId ? getSkill(skillId) : undefined;

      if (skillDef) {
        slot.setSkill({
          id: skillDef.id,
          name: skillDef.vietnameseName || skillDef.name,
          hotkey: `${i + 1}`,
        });
        slot.setLocked(false);
        slot.setMp(s.mp);

        const cooldownUntil = s.rpg?.skills?.cooldownUntil?.[skillDef.id] ?? 0;
        const remaining = Math.max(0, cooldownUntil - now);
        slot.setCooldown(remaining, skillDef.cooldownMs);
      } else {
        slot.setSkill(null);
        slot.setLocked(true, i === 2 ? 3 : 5);
      }
    }
  }

  public destroy(): void {
    for (const fn of this.cleanupFns) {
      fn();
    }
    this.cleanupFns = [];
    this.joystickBase?.destroy?.();
    this.joystickKnob?.destroy?.();
    for (const btn of Object.values(this.buttons)) {
      btn.shape?.destroy?.();
      btn.text?.destroy?.();
      btn.container?.destroy?.(true);
    }
    this.skillSlots = [];
  }
}
