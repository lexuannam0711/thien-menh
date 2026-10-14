/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * TouchAdapter: Quản lý cảm ứng đa điểm (multitouch), Virtual Joystick và Virtual Buttons
 * với pointerId độc lập tuyệt đối, chống ghost tap và chống hủy lẫn nhau.
 */

import type Phaser from 'phaser';
import type { GameAction } from './GameAction';
import type { MobileInputSettings } from './InputSettings';

export interface TouchButtonConfig {
  action: GameAction;
  title: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  activePointerId: number | null;
  shape?: unknown;
  text?: unknown;
}

export function isTouchPointer(p?: Phaser.Input.Pointer | unknown): boolean {
  if (!p || typeof p !== 'object') {
    // Cho phép gọi trong test harness / synthetic mock không truyền pointer
    return true;
  }
  const pointer = p as {
    wasTouch?: boolean;
    pointerType?: string;
    event?: { type?: string; pointerType?: string };
    button?: number;
  };

  // Nếu được xác nhận là touch rõ ràng
  if (pointer.wasTouch === true) return true;
  if (pointer.pointerType === 'touch') return true;
  if (pointer.event?.pointerType === 'touch') return true;
  if (pointer.event?.type && pointer.event.type.startsWith('touch')) return true;

  // Nếu xác nhận rõ ràng là chuột hoặc bút vẽ stylus trên PC
  if (pointer.wasTouch === false) return false;
  if (pointer.pointerType === 'mouse' || pointer.pointerType === 'pen') return false;
  if (pointer.event?.pointerType === 'mouse' || pointer.event?.pointerType === 'pen') return false;
  if (pointer.event?.type && pointer.event.type.startsWith('mouse')) return false;

  return true;
}

export class TouchAdapter {
  private isEnabled = true;

  // Trạng thái Joystick
  private joystickPointerId: number | null = null;
  private joystickOrigin = { x: 109, y: 421 };
  private joystickCurrent = { x: 109, y: 421 };
  private joystickDirection = { x: 0, y: 0 };
  private readonly joystickRadius = 55;
  private readonly joystickDeadzone = 7;

  // Danh sách nút ảo
  private buttons: TouchButtonConfig[] = [];

  // Trạng thái input sinh ra
  private heldActions: Set<GameAction> = new Set();
  private justPressedActions: Set<GameAction> = new Set();
  private justReleasedActions: Set<GameAction> = new Set();

  private cleanupFns: Array<() => void> = [];

  constructor(
    private scene?: Phaser.Scene | null,
    private mobileSettings?: MobileInputSettings
  ) {
    this.setupButtonLayout(mobileSettings);
    if (scene) {
      this.buildVisuals(scene);
      this.attachSceneListeners(scene);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public setSettings(settings: MobileInputSettings): void {
    this.mobileSettings = settings;
    this.setupButtonLayout(settings);
    if (this.scene) {
      this.rebuildVisuals(this.scene);
    }
  }

  private setupButtonLayout(settings?: MobileInputSettings): void {
    const scale = settings?.controlScale ?? 1.0;
    const spacing = settings?.buttonSpacing ?? 1.0;
    const isLeftHanded = settings?.handedness === 'left';
    const W = 960;

    // Vị trí gốc Joystick
    const baseX = isLeftHanded ? W - 109 : 109;
    const baseY = 421;
    this.joystickOrigin = { x: baseX, y: baseY };
    this.joystickCurrent = { x: baseX, y: baseY };

    // Tọa độ mẫu cho tay phải (nút bên phải)
    const rawButtons: Array<{
      action: GameAction;
      title: string;
      relX: number;
      relY: number;
      radius: number;
      color: number;
    }> = [
      { action: 'ATTACK', title: 'CHÉM', relX: 847, relY: 430, radius: 49, color: 0xc4744c },
      { action: 'DODGE', title: 'NÉ', relX: 745, relY: 464, radius: 35, color: 0x507c7d },
      { action: 'SKILL_1', title: '1', relX: 780, relY: 354, radius: 35, color: 0x877349 },
      { action: 'SKILL_2', title: '2', relX: 891, relY: 351, radius: 35, color: 0x9d5a37 },
      { action: 'SKILL_3', title: '3', relX: 780, relY: 276, radius: 33, color: 0x397f99 },
      { action: 'SKILL_4', title: '4', relX: 891, relY: 276, radius: 33, color: 0x66558a },
      { action: 'INTERACT', title: 'F', relX: 656, relY: 467, radius: 33, color: 0x777b66 },
    ];

    // Trọng tâm cụm nút
    const clusterCenterX = 800;
    const clusterCenterY = 380;

    this.buttons = rawButtons.map(btn => {
      let x = clusterCenterX + (btn.relX - clusterCenterX) * spacing;
      let y = clusterCenterY + (btn.relY - clusterCenterY) * spacing;
      if (isLeftHanded) {
        x = W - x;
      }
      return {
        action: btn.action,
        title: btn.title,
        x,
        y,
        radius: btn.radius * scale,
        color: btn.color,
        activePointerId: null,
      };
    });
  }

  // --- Multi-touch Pointer Event Handling ---

  public onTouchStart(pointerId: number, x: number, y: number): void {
    if (!this.isEnabled) return;
    // 1. Kiểm tra bấm trúng nút ảo
    for (const btn of this.buttons) {
      const dist = Math.hypot(x - btn.x, y - btn.y);
      if (dist <= btn.radius) {
        if (btn.activePointerId === null) {
          btn.activePointerId = pointerId;
          if (!this.heldActions.has(btn.action)) {
            this.heldActions.add(btn.action);
            this.justPressedActions.add(btn.action);
          }
        }
        return; // Đã nhận bởi nút, không gửi vào joystick
      }
    }

    // 2. Kiểm tra Joystick
    if (this.joystickPointerId === null) {
      const isLeftHanded = this.mobileSettings?.handedness === 'left';
      const halfScreen = 960 / 2;
      const inJoystickZone = isLeftHanded ? x > halfScreen : x < halfScreen;

      if (inJoystickZone) {
        if (this.mobileSettings?.floatingJoystick) {
          this.joystickOrigin = { x, y };
        }
        const dist = Math.hypot(x - this.joystickOrigin.x, y - this.joystickOrigin.y);
        const maxGrabDist = this.joystickRadius * 2.5 * (this.mobileSettings?.controlScale ?? 1.0);
        if (dist <= maxGrabDist || this.mobileSettings?.floatingJoystick) {
          this.joystickPointerId = pointerId;
          this.updateJoystick(x, y);
        }
      }
    }
  }

  public onTouchMove(pointerId: number, x: number, y: number): void {
    if (!this.isEnabled) return;
    // 1. Nếu là pointer điều khiển Joystick
    if (pointerId === this.joystickPointerId) {
      this.updateJoystick(x, y);
      return;
    }

    // 2. Nếu là pointer của một nút bấm, kiểm tra xem con trỏ có bị trượt ra quá xa không
    for (const btn of this.buttons) {
      if (btn.activePointerId === pointerId) {
        const dist = Math.hypot(x - btn.x, y - btn.y);
        // Cho phép trượt nhẹ (1.5x bán kính), nếu xa quá thì nhả nút
        if (dist > btn.radius * 1.5) {
          this.releaseButton(btn);
        }
        return;
      }
    }
  }

  public onTouchEnd(pointerId: number): void {
    if (!this.isEnabled) return;
    // 1. Nếu là pointer của Joystick -> nhả joystick độc lập
    if (pointerId === this.joystickPointerId) {
      this.resetJoystick();
      return;
    }

    // 2. Nếu là pointer của nút nào -> nhả riêng nút đó
    for (const btn of this.buttons) {
      if (btn.activePointerId === pointerId) {
        this.releaseButton(btn);
        return;
      }
    }
  }

  public onTouchCancel(pointerId: number): void {
    this.onTouchEnd(pointerId);
  }

  private releaseButton(btn: TouchButtonConfig): void {
    btn.activePointerId = null;
    if (this.heldActions.has(btn.action)) {
      this.heldActions.delete(btn.action);
      this.justReleasedActions.add(btn.action);
    }
  }

  private updateJoystick(x: number, y: number): void {
    const dx = x - this.joystickOrigin.x;
    const dy = y - this.joystickOrigin.y;
    const length = Math.hypot(dx, dy);

    if (length < this.joystickDeadzone) {
      this.joystickDirection = { x: 0, y: 0 };
      this.joystickCurrent = { ...this.joystickOrigin };
      return;
    }

    const effectiveRadius = this.joystickRadius * (this.mobileSettings?.controlScale ?? 1.0);
    const magnitude = Math.min(1, length / effectiveRadius);
    const nx = (dx / length) * magnitude;
    const ny = (dy / length) * magnitude;

    this.joystickDirection = { x: nx, y: ny };
    this.joystickCurrent = {
      x: this.joystickOrigin.x + (dx / length) * Math.min(length, effectiveRadius),
      y: this.joystickOrigin.y + (dy / length) * Math.min(length, effectiveRadius),
    };
  }

  private resetJoystick(): void {
    this.joystickPointerId = null;
    this.joystickDirection = { x: 0, y: 0 };
    this.joystickCurrent = { ...this.joystickOrigin };
  }

  public reset(): void {
    this.resetJoystick();
    for (const btn of this.buttons) {
      if (btn.activePointerId !== null) {
        this.releaseButton(btn);
      }
    }
    this.heldActions.clear();
    this.justPressedActions.clear();
  }

  public update(): {
    pressed: Set<GameAction>;
    held: Set<GameAction>;
    released: Set<GameAction>;
    moveVector: { x: number; y: number };
  } {
    const pressed = new Set(this.justPressedActions);
    const held = new Set(this.heldActions);
    const released = new Set(this.justReleasedActions);

    this.justPressedActions.clear();
    this.justReleasedActions.clear();

    return {
      pressed,
      held,
      released,
      moveVector: { ...this.joystickDirection },
    };
  }

  public getMovementVector(): { x: number; y: number } {
    return { ...this.joystickDirection };
  }

  // --- Phaser Visuals & Scene Integration ---

  private buildVisuals(scene: Phaser.Scene): void {
    // Chỉ tạo visuals nếu scene có add
    if (!scene || !scene.add) return;
    // UI elements có thể được tạo tại đây nếu chạy trên browser
  }

  private rebuildVisuals(scene: Phaser.Scene): void {
    if (!scene || !scene.add) return;
    // Cập nhật lại tọa độ và kích thước visuals
  }

  private attachSceneListeners(scene: Phaser.Scene): void {
    if (!scene.input) return;

    const onDown = (p: Phaser.Input.Pointer) => {
      if (!this.isEnabled) return;
      if (!isTouchPointer(p)) return;
      this.onTouchStart(p.id, p.x, p.y);
    };
    const onMove = (p: Phaser.Input.Pointer) => {
      if (!this.isEnabled) return;
      if (!isTouchPointer(p)) return;
      this.onTouchMove(p.id, p.x, p.y);
    };
    const onUp = (p: Phaser.Input.Pointer) => {
      if (!this.isEnabled) return;
      if (!isTouchPointer(p)) return;
      this.onTouchEnd(p.id);
    };
    const onBlur = () => this.reset();

    scene.input.on('pointerdown', onDown);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    scene.input.on('pointerupoutside', onUp);
    scene.input.on('pointercancel', onUp);

    if (scene.game?.events) {
      scene.game.events.on('blur', onBlur);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onBlur);
    }

    const cleanup = () => {
      scene.input.off('pointerdown', onDown);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      scene.input.off('pointerupoutside', onUp);
      scene.input.off('pointercancel', onUp);
      if (scene.game?.events) {
        scene.game.events.off('blur', onBlur);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onBlur);
      }
      this.reset();
    };

    this.cleanupFns.push(cleanup);
    scene.events.once('shutdown', cleanup);
  }

  public destroy(): void {
    for (const fn of this.cleanupFns) {
      try {
        fn();
      } catch {
        // Ignored
      }
    }
    this.cleanupFns = [];
    this.reset();
  }

  public getButtons(): readonly TouchButtonConfig[] {
    return this.buttons;
  }

  public getJoystickState(): {
    pointerId: number | null;
    origin: { x: number; y: number };
    current: { x: number; y: number };
    direction: { x: number; y: number };
  } {
    return {
      pointerId: this.joystickPointerId,
      origin: { ...this.joystickOrigin },
      current: { ...this.joystickCurrent },
      direction: { ...this.joystickDirection },
    };
  }
}
