/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * InputManager: Hub trung tâm kết nối KeyboardMouseAdapter, TouchAdapter,
 * InputContextManager và InputSettings. Cung cấp API chuẩn cho Player và Scenes.
 */

import type Phaser from 'phaser';
import {
  ALL_GAME_ACTIONS,
  type GameAction,
  type GameplayInput,
  UI_ACTIONS,
} from './GameAction';
import { InputContext, InputContextManager } from './InputContext';
import { InputSettingsManager, type StorageLike } from './InputSettings';
import {
  KeyboardMouseAdapter,
  type UIHitTestPredicate,
} from './KeyboardMouseAdapter';
import { TouchAdapter } from './TouchAdapter';

export interface InputManagerOptions {
  scene?: Phaser.Scene | null;
  storage?: StorageLike | null;
  customUIHitTest?: UIHitTestPredicate | null;
}

const EMPTY_INPUT: GameplayInput = Object.freeze({
  moveX: 0,
  moveY: 0,
  pressed: Object.freeze(new Set<GameAction>()),
  held: Object.freeze(new Set<GameAction>()),
  released: Object.freeze(new Set<GameAction>()),
});

export class InputManager {
  readonly contextManager: InputContextManager;
  readonly settingsManager: InputSettingsManager;
  readonly keyboardMouseAdapter: KeyboardMouseAdapter;
  readonly touchAdapter: TouchAdapter;

  private currentInput: GameplayInput = EMPTY_INPUT;
  private currentAimPoint: { x: number; y: number } | null = null;

  constructor(options: InputManagerOptions = {}) {
    this.contextManager = new InputContextManager('GAMEPLAY');
    this.settingsManager = new InputSettingsManager(options.storage);

    const settings = this.settingsManager.getSettings();

    this.keyboardMouseAdapter = new KeyboardMouseAdapter(
      options.scene,
      settings.bindings,
      settings.pc
    );
    if (options.customUIHitTest) {
      this.keyboardMouseAdapter.setCustomUIHitTest(options.customUIHitTest);
    }

    this.touchAdapter = new TouchAdapter(options.scene, settings.mobile);

    // Khi context thay đổi ra khỏi gameplay, tự động reset phím giữ
    this.contextManager.onChange((curr) => {
      if (curr !== 'GAMEPLAY') {
        this.keyboardMouseAdapter.resetHeldState();
        this.touchAdapter.reset();
      }
    });
  }

  /**
   * Cập nhật và thu hoạch toàn bộ input trong khung hình hiện tại.
   */
  public update(delta: number = 0): GameplayInput {
    // 1. Cập nhật các adapter
    const kbOutput = this.keyboardMouseAdapter.update();
    const touchOutput = this.touchAdapter.update();

    // 2. Gộp pressed, held, released
    const rawPressed = new Set<GameAction>([...kbOutput.pressed, ...touchOutput.pressed]);
    const rawHeld = new Set<GameAction>([...kbOutput.held, ...touchOutput.held]);
    const rawReleased = new Set<GameAction>([...kbOutput.released, ...touchOutput.released]);

    // 3. Xử lý ESC / PAUSE: Đóng context tầng trên trước khi mở Menu Pause
    if (rawPressed.has('PAUSE')) {
      const escResult = this.contextManager.handleEscape();
      if (escResult.handled) {
        // ESC đã được dùng để đóng một popup/dialogue/menu phía trên, không kích hoạt Pause
        rawPressed.delete('PAUSE');
      }
      // Nếu không handled (đang ở GAMEPLAY), action PAUSE tiếp tục được giữ để Game xử lý tạm dừng
    }

    // 4. Lấy mục tiêu ngắm (Aim point)
    this.currentAimPoint = kbOutput.aimWorldPoint;

    // 5. Kiểm tra quyền Gameplay theo Context Stack
    const gameplayAllowed = this.contextManager.isGameplayAllowed();

    let moveX = 0;
    let moveY = 0;
    const finalPressed = new Set<GameAction>();
    const finalHeld = new Set<GameAction>();
    const finalReleased = new Set<GameAction>(rawReleased);

    if (gameplayAllowed) {
      // 5a. Tính vector di chuyển kết hợp bàn phím và cảm ứng
      let kx = 0;
      let ky = 0;
      if (rawHeld.has('MOVE_RIGHT')) kx += 1;
      if (rawHeld.has('MOVE_LEFT')) kx -= 1;
      if (rawHeld.has('MOVE_DOWN')) ky += 1;
      if (rawHeld.has('MOVE_UP')) ky -= 1;

      const tx = touchOutput.moveVector.x;
      const ty = touchOutput.moveVector.y;

      const vx = kx + tx;
      const vy = ky + ty;
      const len = Math.hypot(vx, vy);

      if (len > 1) {
        // Chuẩn hóa vector khi đi chéo hoặc gộp analog vượt quá 1
        moveX = vx / len;
        moveY = vy / len;
      } else {
        moveX = vx;
        moveY = vy;
      }

      for (const action of rawPressed) finalPressed.add(action);
      for (const action of rawHeld) finalHeld.add(action);
    } else {
      // 5b. Ngăn chặn toàn bộ di chuyển và hành động chiến đấu khi bị che bởi Context khác
      moveX = 0;
      moveY = 0;

      // Chỉ cho phép các action thuộc UI
      for (const action of rawPressed) {
        if (UI_ACTIONS.includes(action)) {
          finalPressed.add(action);
        }
      }
      for (const action of rawHeld) {
        if (UI_ACTIONS.includes(action)) {
          finalHeld.add(action);
        }
      }
    }

    this.currentInput = {
      moveX,
      moveY,
      aimWorldX: this.currentAimPoint ? this.currentAimPoint.x : undefined,
      aimWorldY: this.currentAimPoint ? this.currentAimPoint.y : undefined,
      pressed: Object.freeze(finalPressed),
      held: Object.freeze(finalHeld),
      released: Object.freeze(finalReleased),
    };

    return this.currentInput;
  }

  public isActionJustPressed(action: GameAction): boolean {
    return this.currentInput.pressed.has(action);
  }

  public isActionHeld(action: GameAction): boolean {
    return this.currentInput.held.has(action);
  }

  /**
   * Trả về vector di chuyển chuẩn hóa (độ dài <= 1).
   */
  public getMovementVector(): { x: number; y: number } {
    return { x: this.currentInput.moveX, y: this.currentInput.moveY };
  }

  /**
   * Trả về tọa độ con trỏ chuột trong world space (hoặc null nếu tắt aim hoặc không có).
   */
  public getAimPoint(): { x: number; y: number } | null {
    return this.currentAimPoint ? { ...this.currentAimPoint } : null;
  }

  public pushContext(context: InputContext): void {
    this.contextManager.push(context);
  }

  public popContext(context?: InputContext): void {
    this.contextManager.pop(context);
  }

  public cleanup(): void {
    this.keyboardMouseAdapter.destroy();
    this.touchAdapter.destroy();
    this.contextManager.reset('GAMEPLAY');
    this.currentInput = EMPTY_INPUT;
    this.currentAimPoint = null;
  }
}
