/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * KeyboardMouseAdapter: Quản lý sự kiện chuột và bàn phím, ngăn đánh xuyên UI,
 * chuyển đổi tọa độ world và xử lý mất focus tự động.
 */

import type Phaser from 'phaser';
import type { GameAction } from './GameAction';
import { normalizeKeyCode, type KeyBindingMap } from './InputBindings';
import type { PcInputSettings } from './InputSettings';

export interface PointerLike {
  x: number;
  y: number;
  button?: number;
  id?: number;
  worldX?: number;
  worldY?: number;
}

export type UIHitTestPredicate = (pointer: Phaser.Input.Pointer | PointerLike) => boolean;

export class KeyboardMouseAdapter {
  private heldKeys: Set<string> = new Set();
  private heldActions: Set<GameAction> = new Set();
  private justPressedActions: Set<GameAction> = new Set();
  private justReleasedActions: Set<GameAction> = new Set();

  private aimWorldPoint: { x: number; y: number } | null = null;
  private pointerDownOverUI = false;

  private keyToActionMap: Map<string, GameAction[]> = new Map();
  private customUIHitTest: UIHitTestPredicate | null = null;
  private cleanupFns: Array<() => void> = [];

  constructor(
    private scene?: Phaser.Scene | null,
    private bindings?: KeyBindingMap,
    private pcSettings?: PcInputSettings
  ) {
    if (bindings) {
      this.rebuildKeyMap(bindings, pcSettings);
    }
    if (scene) {
      this.attachSceneListeners(scene);
    }
  }

  public setBindings(bindings: KeyBindingMap, pcSettings?: PcInputSettings): void {
    this.bindings = bindings;
    if (pcSettings) this.pcSettings = pcSettings;
    this.rebuildKeyMap(bindings, this.pcSettings);
  }

  public setPcSettings(pcSettings: PcInputSettings): void {
    this.pcSettings = pcSettings;
    if (this.bindings) {
      this.rebuildKeyMap(this.bindings, pcSettings);
    }
  }

  public setCustomUIHitTest(predicate: UIHitTestPredicate | null): void {
    this.customUIHitTest = predicate;
  }

  /**
   * Tái cấu trúc bảng tra cứu nhanh từ Key code -> GameAction.
   */
  private rebuildKeyMap(bindings: KeyBindingMap, pcSettings?: PcInputSettings): void {
    this.keyToActionMap.clear();

    for (const [actionStr, keys] of Object.entries(bindings)) {
      const action = actionStr as GameAction;
      for (const rawKey of keys) {
        const norm = normalizeKeyCode(rawKey);
        if (!norm) continue;
        const list = this.keyToActionMap.get(norm) ?? [];
        if (!list.includes(action)) {
          list.push(action);
        }
        this.keyToActionMap.set(norm, list);
      }
    }

    // Nếu rightClickDodge được bật, tự động gán MouseRight vào DODGE nếu chưa có
    if (pcSettings?.rightClickDodge) {
      const dodgeList = this.keyToActionMap.get('MouseRight') ?? [];
      if (!dodgeList.includes('DODGE')) {
        dodgeList.push('DODGE');
        this.keyToActionMap.set('MouseRight', dodgeList);
      }
    }
  }

  /**
   * Kiểm tra xem con trỏ chuột có đang nằm trên UI element không để chặn click xuyên UI.
   */
  public isPointerOverUI(pointer: Phaser.Input.Pointer | PointerLike): boolean {
    if (this.customUIHitTest && this.customUIHitTest(pointer)) {
      return true;
    }

    if (!this.scene || !this.scene.input) return false;

    try {
      const inputPlugin = this.scene.input as unknown as {
        hitTestPointer?: (p: unknown) => Array<{ depth?: number; getData?: (k: string) => unknown }>;
      };
      if (typeof inputPlugin.hitTestPointer === 'function') {
        const hits = inputPlugin.hitTestPointer(pointer);
        if (hits && hits.length > 0) {
          for (const obj of hits) {
            const gameObj = obj as { visible?: boolean; depth?: number; getData?: (k: string) => unknown };
            // Bỏ qua object đang ẩn hoặc là touch control
            if (gameObj.visible === false) continue;
            if (typeof gameObj.getData === 'function' && gameObj.getData('isTouchControl')) continue;
            // Độ sâu UI trong game thường >= 1000 (UI_DEPTH = 2000)
            if (typeof gameObj.depth === 'number' && gameObj.depth >= 1000) return true;
            if (typeof gameObj.getData === 'function') {
              if (gameObj.getData('isUI') || gameObj.getData('ui') || gameObj.getData('dialogue')) return true;
            }
          }
        }
      }
    } catch {
      // Fallback an toàn nếu môi trường không có đầy đủ input plugin
    }

    return false;
  }

  private updateWorldCoordinates(pointer: Phaser.Input.Pointer | PointerLike): void {
    if (this.pcSettings && !this.pcSettings.mouseAiming) {
      this.aimWorldPoint = null;
      return;
    }

    if (this.scene?.cameras?.main) {
      try {
        const wp = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.aimWorldPoint = { x: wp.x, y: wp.y };
        return;
      } catch {
        // Fallback bên dưới
      }
    }

    if (typeof pointer.worldX === 'number' && typeof pointer.worldY === 'number') {
      this.aimWorldPoint = { x: pointer.worldX, y: pointer.worldY };
    } else {
      this.aimWorldPoint = { x: pointer.x, y: pointer.y };
    }
  }

  public handleKeyDown(code: string): void {
    const norm = normalizeKeyCode(code);
    if (!norm) return;

    if (!this.heldKeys.has(norm)) {
      this.heldKeys.add(norm);

      const actions = this.keyToActionMap.get(norm);
      if (actions) {
        for (const action of actions) {
          if (!this.heldActions.has(action)) {
            this.justPressedActions.add(action);
            this.heldActions.add(action);
          }
        }
      }
    }
  }

  public handleKeyUp(code: string): void {
    const norm = normalizeKeyCode(code);
    if (!norm) return;

    this.heldKeys.delete(norm);

    const actions = this.keyToActionMap.get(norm);
    if (actions) {
      for (const action of actions) {
        // Kiểm tra xem action này còn phím nào khác đang được giữ không
        const stillHeld = this.isActionStillHeldByOtherKeys(action);
        if (!stillHeld && this.heldActions.has(action)) {
          this.heldActions.delete(action);
          this.justReleasedActions.add(action);
        }
      }
    }
  }

  private isActionStillHeldByOtherKeys(action: GameAction): boolean {
    if (!this.bindings) return false;
    const boundKeys = this.bindings[action] ?? [];
    for (const key of boundKeys) {
      if (this.heldKeys.has(normalizeKeyCode(key))) {
        return true;
      }
    }
    return false;
  }

  public handlePointerDown(pointer: Phaser.Input.Pointer | PointerLike): void {
    this.updateWorldCoordinates(pointer);

    if (this.isPointerOverUI(pointer)) {
      this.pointerDownOverUI = true;
      return; // CHẶN ĐÁNH XUYÊN UI: Không phát sinh ATTACK hay action nào
    }

    this.pointerDownOverUI = false;
    const buttonCode = pointer.button === 2 ? 'MouseRight' : pointer.button === 1 ? 'MouseMiddle' : 'MouseLeft';
    this.handleKeyDown(buttonCode);
  }

  public handlePointerUp(pointer: Phaser.Input.Pointer | PointerLike): void {
    this.updateWorldCoordinates(pointer);
    const buttonCode = pointer.button === 2 ? 'MouseRight' : pointer.button === 1 ? 'MouseMiddle' : 'MouseLeft';
    this.handleKeyUp(buttonCode);
    this.pointerDownOverUI = false;
  }

  public handlePointerMove(pointer: Phaser.Input.Pointer | PointerLike): void {
    this.updateWorldCoordinates(pointer);
  }

  /**
   * Tự động xóa sạch toàn bộ phím và nút đang giữ khi mất tiêu điểm (window blur, visibilitychange).
   */
  public resetHeldState(): void {
    // Thu thập tất cả các action vừa bị mất để trigger release
    for (const action of this.heldActions) {
      this.justReleasedActions.add(action);
    }
    this.heldKeys.clear();
    this.heldActions.clear();
    this.justPressedActions.clear();
    this.pointerDownOverUI = false;
  }

  private attachSceneListeners(scene: Phaser.Scene): void {
    const onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e.code);
    const onKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e.code);
    const onPointerDown = (p: Phaser.Input.Pointer) => this.handlePointerDown(p);
    const onPointerUp = (p: Phaser.Input.Pointer) => this.handlePointerUp(p);
    const onPointerMove = (p: Phaser.Input.Pointer) => this.handlePointerMove(p);
    const onPointerUpOutside = (p: Phaser.Input.Pointer) => this.handlePointerUp(p);
    const onBlur = () => this.resetHeldState();

    if (scene.input) {
      if (scene.input.keyboard) {
        scene.input.keyboard.on('keydown', onKeyDown);
        scene.input.keyboard.on('keyup', onKeyUp);
      }
      scene.input.on('pointerdown', onPointerDown);
      scene.input.on('pointerup', onPointerUp);
      scene.input.on('pointermove', onPointerMove);
      scene.input.on('pointerupoutside', onPointerUpOutside);
    }

    if (scene.game?.events) {
      scene.game.events.on('blur', onBlur);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('blur', onBlur);
      document.addEventListener('visibilitychange', onBlur);
    }

    const cleanup = () => {
      if (scene.input) {
        if (scene.input.keyboard) {
          scene.input.keyboard.off('keydown', onKeyDown);
          scene.input.keyboard.off('keyup', onKeyUp);
        }
        scene.input.off('pointerdown', onPointerDown);
        scene.input.off('pointerup', onPointerUp);
        scene.input.off('pointermove', onPointerMove);
        scene.input.off('pointerupoutside', onPointerUpOutside);
      }
      if (scene.game?.events) {
        scene.game.events.off('blur', onBlur);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onBlur);
      }
      this.resetHeldState();
    };

    this.cleanupFns.push(cleanup);
    scene.events.once('shutdown', cleanup);
  }

  public update(): {
    pressed: Set<GameAction>;
    held: Set<GameAction>;
    released: Set<GameAction>;
    aimWorldPoint: { x: number; y: number } | null;
  } {
    const pressed = new Set(this.justPressedActions);
    const held = new Set(this.heldActions);
    const released = new Set(this.justReleasedActions);

    // Xử lý tùy chọn holdToRepeatAttack: nếu đang giữ ATTACK và bật thiết lập, lặp lại pressed
    if (this.pcSettings?.holdToRepeatAttack && this.heldActions.has('ATTACK')) {
      pressed.add('ATTACK');
    }

    // Reset các action tức thời sau mỗi khung hình update
    this.justPressedActions.clear();
    this.justReleasedActions.clear();

    return {
      pressed,
      held,
      released,
      aimWorldPoint: this.aimWorldPoint ? { ...this.aimWorldPoint } : null,
    };
  }

  public isActionHeld(action: GameAction): boolean {
    return this.heldActions.has(action);
  }

  public getAimWorldPoint(): { x: number; y: number } | null {
    return this.aimWorldPoint ? { ...this.aimWorldPoint } : null;
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
    this.resetHeldState();
  }

  // --- Hook kiểm thử tất định (Headless / Unit test) ---
  public simulateKeyDown(code: string): void {
    this.handleKeyDown(code);
  }

  public simulateKeyUp(code: string): void {
    this.handleKeyUp(code);
  }

  public simulatePointerDown(button: number, x: number, y: number, isOverUI: boolean = false): void {
    if (isOverUI) {
      const orig = this.customUIHitTest;
      this.customUIHitTest = () => true;
      this.handlePointerDown({ button, x, y, id: 0 });
      this.customUIHitTest = orig;
    } else {
      this.handlePointerDown({ button, x, y, id: 0 });
    }
  }

  public simulatePointerUp(button: number, x: number, y: number): void {
    this.handlePointerUp({ button, x, y, id: 0 });
  }

  public simulatePointerMove(x: number, y: number): void {
    this.handlePointerMove({ x, y, id: 0 });
  }

  public simulateBlur(): void {
    this.resetHeldState();
  }
}
