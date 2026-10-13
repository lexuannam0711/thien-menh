import Phaser from 'phaser';
import { UI_DEPTH } from '../../data/config';
import { graphicsSettings } from '../rendering/GraphicsSettings';
import { ResponsiveLayout, hasTouchCapability } from './ResponsiveLayout';
import { SkillButton, type SkillInfo } from './components/SkillButton';
import { gameState } from '../systems/GameState';
import { getSkill, type SkillDefinition } from '../../data/skills';

type Action = 'attack' | 'dodge' | 'earth' | 'flame' | 'water' | 'fourth' | 'interact';

export interface TouchControlsOptions {
  controlScale?: number;
  buttonOpacity?: number;
  leftHanded?: boolean;
  autoDetectTouch?: boolean;
}

interface ActionButtonRef {
  container: Phaser.GameObjects.Container;
  shape: Phaser.GameObjects.Arc;
  text: Phaser.GameObjects.Text;
}

/**
 * TouchControls System — Thần Mệnh: Hậu Duệ Văn Lang
 *
 * Bộ điều khiển cảm ứng di động cao cấp:
 * - Cần gạt ảo (Virtual Joystick) thích ứng ResponsiveLayout & SafeArea,
 *   hỗ trợ đảo vị trí tay trái (Left-handed preset), scale và opacity.
 * - Cụm phím hành động góc đối diện:
 *   + Nút CHÉM lớn nhất (hit target 56-72px)
 *   + Nút NÉ (hit target 48px+)
 *   + 4 Nút kỹ năng SkillButton có cooldown sweep, MP indicator (TUYỆT ĐỐI KHÔNG raw 'Q/E/R/T' trên mobile)
 *   + Nút TƯƠNG TÁC / F chỉ hiện khi NPC/vật thể trong tầm.
 * - Đa chạm (Multi-touch): pointerId độc lập cho joystick và từng nút bấm, không xung đột hay ghost tap.
 * - Tự động thích ứng: Ẩn trên Desktop thuần có chuột và bàn phím.
 */
export class TouchControls {
  readonly direction = new Phaser.Math.Vector2();
  private activePointerId: number | null = null;
  private readonly layout: ResponsiveLayout;

  // Cấu hình điều khiển
  private controlScale: number;
  private buttonOpacity: number;
  private leftHanded: boolean;
  private interactVisible = false;
  private isVisible = true;

  // Cần gạt ảo
  private joystickBase: Phaser.GameObjects.Arc;
  private joystickKnob: Phaser.GameObjects.Arc;
  private readonly joystickOrigin = new Phaser.Math.Vector2();

  // Cụm nút hành động
  private attackBtn!: ActionButtonRef;
  private dodgeBtn!: ActionButtonRef;
  private interactBtn!: ActionButtonRef;
  private skillButtons: SkillButton[] = [];

  // Danh sách các đối tượng để quản lý ẩn/hiện và opacity
  private allVisuals: (Phaser.GameObjects.Container | Phaser.GameObjects.Arc)[] = [];

  // Cleanup listeners
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
    this.layout = new ResponsiveLayout(width, height);

    // 1. Tạo Cần gạt ảo (Virtual Joystick)
    this.joystickBase = scene.add
      .circle(0, 0, 62 * this.controlScale, 0xf2e2b7, 0.15)
      .setStrokeStyle(2, 0xe0d8a5, 0.55)
      .setDepth(UI_DEPTH)
      .setInteractive();

    this.joystickKnob = scene.add
      .circle(0, 0, 27 * this.controlScale, 0xd7be84, 0.55)
      .setStrokeStyle(2, 0xffeac1, 0.85)
      .setDepth(UI_DEPTH + 1)
      .setInteractive();

    this.allVisuals.push(this.joystickBase, this.joystickKnob);

    // Multi-touch Joystick Pointer Handlers
    const onJoystickDown = (pointer: Phaser.Input.Pointer): void => {
      if (!this.enabled() || this.activePointerId !== null) return;
      this.activePointerId = pointer.id;
      this.updateJoystick(pointer);
    };

    this.joystickBase.on('pointerdown', onJoystickDown);
    this.joystickKnob.on('pointerdown', onJoystickDown);

    const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.activePointerId) {
        this.updateJoystick(pointer);
      }
    };
    scene.input.on('pointermove', onPointerMove);

    const resetJoystick = (): void => {
      this.activePointerId = null;
      this.direction.set(0, 0);
      this.joystickKnob.setPosition(this.joystickOrigin.x, this.joystickOrigin.y);
    };

    const onPointerUp = (pointer: Phaser.Input.Pointer): void => {
      if (pointer.id === this.activePointerId) {
        resetJoystick();
      }
    };

    scene.input.on('pointerup', onPointerUp);
    scene.input.on('pointerupoutside', onPointerUp);
    scene.input.on('pointercancel', onPointerUp);
    scene.game.events.on('blur', resetJoystick);

    const onVisibilityChange = (): void => {
      if (document.hidden) resetJoystick();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    this.cleanupFns.push(() => {
      scene.input.off('pointermove', onPointerMove);
      scene.input.off('pointerup', onPointerUp);
      scene.input.off('pointerupoutside', onPointerUp);
      scene.input.off('pointercancel', onPointerUp);
      scene.game.events.off('blur', resetJoystick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resetJoystick();
    });

    // 2. Tạo Cụm phím hành động (Attack, Dodge, Skills, Interact)
    this.createActionButtons();

    // 3. Định vị layout theo Handedness & Responsive
    this.layoutControls();

    // 4. Đồng bộ kỹ năng ban đầu
    this.syncSkills();

    // 5. Tự động thích ứng thiết bị: Ẩn trên Desktop thuần
    const autoDetect = options.autoDetectTouch ?? true;
    if (autoDetect && this.layout.isDesktop() && !hasTouchCapability()) {
      this.setVisible(false);
    }

    // Tự động giải phóng khi Scene shutdown
    scene.events.once('shutdown', () => this.destroy());
  }

  // =========================================================================
  // ACTION BUTTONS CREATION
  // =========================================================================

  private createActionButtons(): void {
    // 1. Nút CHÉM (Attack) — Lớn nhất, chuẩn touch 66px
    this.attackBtn = this.createCircularActionButton(
      33 * this.controlScale,
      'CHÉM',
      'attack',
      0xc4744c,
      0xffeac1,
      15
    );

    // 2. Nút NÉ (Dodge) — Chuẩn touch 50px (>= 48px)
    this.dodgeBtn = this.createCircularActionButton(
      25 * this.controlScale,
      'NÉ',
      'dodge',
      0x507c7d,
      0xd0f0ea,
      13
    );

    // 3. 4 Nút kỹ năng dùng SkillButton (showHotkey = false trên Mobile)
    const skillActions: Action[] = ['earth', 'flame', 'water', 'fourth'];
    for (let i = 0; i < 4; i++) {
      const action = skillActions[i];
      const btn = new SkillButton(this.scene, {
        size: Math.round(48 * this.controlScale),
        slotIndex: i,
        showHotkey: false, // TUYỆT ĐỐI KHÔNG hiện nhãn raw 'Q/E/R/T' trên mobile
        onPress: () => {
          if (this.enabled()) {
            this.perform(action);
          }
        },
      }).setDepth(UI_DEPTH);

      this.skillButtons.push(btn);
      this.allVisuals.push(btn);
    }

    // 4. Nút TƯƠNG TÁC / F — Ban đầu ẩn, chỉ hiện khi có NPC trong tầm
    this.interactBtn = this.createCircularActionButton(
      25 * this.controlScale,
      'NÓI',
      'interact',
      0x8b7d3b,
      0xffe082,
      12
    );
    this.interactBtn.container.setVisible(false);
  }

  private createCircularActionButton(
    radius: number,
    title: string,
    action: Action,
    fillColor: number,
    strokeColor: number,
    fontSize = 14
  ): ActionButtonRef {
    const shape = this.scene.add
      .circle(0, 0, radius, fillColor, 0.8)
      .setStrokeStyle(2, strokeColor, 0.9)
      .setInteractive();

    const text = this.scene.add
      .text(0, 0, title, {
        fontFamily: 'Arial, sans-serif',
        fontSize: `${Math.round(fontSize * this.controlScale)}px`,
        fontStyle: 'bold',
        color: '#fff5d9',
        stroke: '#101518',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0.5)
      .setInteractive();

    const container = this.scene.add
      .container(0, 0, [shape, text])
      .setDepth(UI_DEPTH);

    this.allVisuals.push(container);

    const onActionDown = (pointer: Phaser.Input.Pointer): void => {
      // Đa chạm: chỉ phản hồi nếu controls được phép và không can thiệp pointer của joystick
      if (!this.enabled()) return;
      this.perform(action);

      const prefersReduced =
        (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) ||
        Boolean(graphicsSettings.getState().reducedMotion);

      if (!prefersReduced && this.scene) {
        this.scene.tweens.killTweensOf(container);
        this.scene.tweens.add({
          targets: container,
          scaleX: 0.92,
          scaleY: 0.92,
          yoyo: true,
          duration: 90,
          ease: 'Quad.easeInOut',
        });
      }
    };

    shape.on('pointerdown', onActionDown);
    text.on('pointerdown', onActionDown);

    return { container, shape, text };
  }

  // =========================================================================
  // POSITIONING & RESPONSIVE LAYOUT
  // =========================================================================

  private layoutControls(): void {
    const s = this.controlScale;

    if (!this.leftHanded) {
      // Chế độ tay phải (Default):
      // Joystick ở góc trái dưới, Cụm phím hành động ở góc phải dưới
      const jPos = this.layout.getAnchor('BOTTOM_LEFT', 90 * s, -90 * s);
      this.joystickOrigin.set(jPos.x, jPos.y);

      const aBase = this.layout.getAnchor('BOTTOM_RIGHT', -85 * s, -85 * s);
      this.attackBtn.container.setPosition(aBase.x, aBase.y);
      this.dodgeBtn.container.setPosition(aBase.x - 68 * s, aBase.y + 18 * s);

      // Kỹ năng 1..4 hình cánh cung tiện ngón cái lướt
      if (this.skillButtons[0]) this.skillButtons[0].setPosition(aBase.x - 48 * s, aBase.y - 58 * s);
      if (this.skillButtons[1]) this.skillButtons[1].setPosition(aBase.x + 12 * s, aBase.y - 72 * s);
      if (this.skillButtons[2]) this.skillButtons[2].setPosition(aBase.x - 96 * s, aBase.y - 42 * s);
      if (this.skillButtons[3]) this.skillButtons[3].setPosition(aBase.x - 52 * s, aBase.y - 116 * s);

      // Nút Tương tác
      this.interactBtn.container.setPosition(aBase.x - 132 * s, aBase.y + 15 * s);
    } else {
      // Chế độ tay trái (Left-handed preset):
      // Joystick ở góc phải dưới, Cụm phím hành động ở góc trái dưới
      const jPos = this.layout.getAnchor('BOTTOM_RIGHT', -90 * s, -90 * s);
      this.joystickOrigin.set(jPos.x, jPos.y);

      const aBase = this.layout.getAnchor('BOTTOM_LEFT', 85 * s, -85 * s);
      this.attackBtn.container.setPosition(aBase.x, aBase.y);
      this.dodgeBtn.container.setPosition(aBase.x + 68 * s, aBase.y + 18 * s);

      // Kỹ năng đối xứng sang góc trái
      if (this.skillButtons[0]) this.skillButtons[0].setPosition(aBase.x + 48 * s, aBase.y - 58 * s);
      if (this.skillButtons[1]) this.skillButtons[1].setPosition(aBase.x - 12 * s, aBase.y - 72 * s);
      if (this.skillButtons[2]) this.skillButtons[2].setPosition(aBase.x + 96 * s, aBase.y - 42 * s);
      if (this.skillButtons[3]) this.skillButtons[3].setPosition(aBase.x + 52 * s, aBase.y - 116 * s);

      // Nút Tương tác
      this.interactBtn.container.setPosition(aBase.x + 132 * s, aBase.y + 15 * s);
    }

    this.joystickBase.setPosition(this.joystickOrigin.x, this.joystickOrigin.y);
    this.joystickKnob.setPosition(this.joystickOrigin.x, this.joystickOrigin.y);
  }

  // =========================================================================
  // MULTI-TOUCH JOYSTICK LOGIC
  // =========================================================================

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.joystickOrigin.x;
    const dy = pointer.y - this.joystickOrigin.y;
    const length = Math.hypot(dx, dy);

    if (length < 7) {
      this.direction.set(0, 0);
      this.joystickKnob.setPosition(this.joystickOrigin.x, this.joystickOrigin.y);
      return;
    }

    const maxDistance = 50 * this.controlScale;
    const magnitude = Math.min(1, length / maxDistance);
    this.direction.set((dx / length) * magnitude, (dy / length) * magnitude);

    const visualLimit = 36 * this.controlScale;
    this.joystickKnob.setPosition(
      this.joystickOrigin.x + this.direction.x * visualLimit,
      this.joystickOrigin.y + this.direction.y * visualLimit
    );
  }

  // =========================================================================
  // CONFIGURATION & CUSTOMIZATION API
  // =========================================================================

  public setHandedness(isLeftHanded: boolean): this {
    this.leftHanded = isLeftHanded;
    this.layoutControls();
    return this;
  }

  public isLeftHanded(): boolean {
    return this.leftHanded;
  }

  public getHandedness(): 'left' | 'right' {
    return this.leftHanded ? 'left' : 'right';
  }

  public setScale(scale: number): this {
    return this.setControlScale(scale);
  }

  public setControlScale(scale: number): this {
    this.controlScale = Math.max(0.6, Math.min(1.6, scale));
    this.joystickBase.setRadius(62 * this.controlScale);
    this.joystickKnob.setRadius(27 * this.controlScale);
    this.attackBtn.shape.setRadius(33 * this.controlScale);
    this.dodgeBtn.shape.setRadius(25 * this.controlScale);
    this.interactBtn.shape.setRadius(25 * this.controlScale);
    this.layoutControls();
    return this;
  }

  public getScale(): number {
    return this.controlScale;
  }

  public getControlScale(): number {
    return this.controlScale;
  }

  public setOpacity(opacity: number): this {
    return this.setButtonOpacity(opacity);
  }

  public setButtonOpacity(opacity: number): this {
    this.buttonOpacity = Math.max(0.2, Math.min(1.0, opacity));
    this.joystickBase.setAlpha(0.18 * (this.buttonOpacity / 0.8));
    this.joystickKnob.setAlpha(0.65 * (this.buttonOpacity / 0.8));
    this.attackBtn.container.setAlpha(this.buttonOpacity);
    this.dodgeBtn.container.setAlpha(this.buttonOpacity);
    this.interactBtn.container.setAlpha(this.buttonOpacity);
    for (const btn of this.skillButtons) {
      btn.setAlpha(this.buttonOpacity);
    }
    return this;
  }

  public getOpacity(): number {
    return this.buttonOpacity;
  }

  public getButtonOpacity(): number {
    return this.buttonOpacity;
  }

  public setInteractVisible(visible: boolean): this {
    this.interactVisible = visible;
    this.interactBtn.container.setVisible(this.isVisible && visible);
    return this;
  }

  public isInteractVisible(): boolean {
    return this.interactVisible;
  }

  public setVisible(visible: boolean): this {
    this.isVisible = visible;
    this.joystickBase.setVisible(visible);
    this.joystickKnob.setVisible(visible);
    this.attackBtn.container.setVisible(visible);
    this.dodgeBtn.container.setVisible(visible);
    for (const btn of this.skillButtons) {
      btn.setVisible(visible);
    }
    this.interactBtn.container.setVisible(visible && this.interactVisible);
    return this;
  }

  public isVisibleState(): boolean {
    return this.isVisible;
  }

  // =========================================================================
  // SKILL STATE SYNCHRONIZATION
  // =========================================================================

  public syncSkills(): void {
    const s = gameState.data;
    const slotKeys: ('slot-1' | 'slot-2' | 'slot-3' | 'slot-4')[] = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];
    const now = Date.now();

    for (let i = 0; i < 4; i++) {
      const slotKey = slotKeys[i];
      const btn = this.skillButtons[i];
      if (!btn) continue;

      const skillId = s.rpg?.skills?.equippedSlots?.[slotKey];
      const skillDef: SkillDefinition | undefined = skillId ? getSkill(skillId) : undefined;

      if (skillDef) {
        const elementColor =
          skillDef.element === 'earth' ? 0x877349 :
          skillDef.element === 'flame' ? 0xc4744c :
          skillDef.element === 'water' ? 0x397f99 : 0x66558a;

        const info: SkillInfo = {
          id: skillDef.id,
          name: skillDef.vietnameseName || skillDef.name,
          description: skillDef.description,
          hotkey: '', // Không hiển thị hotkey text trên mobile
          mpCost: skillDef.cost.mp,
          cooldownMs: skillDef.cooldownMs,
          iconColor: elementColor,
        };

        btn.setSkill(info);
        btn.setLocked(false);
        btn.setMp(s.mp);

        const cooldownUntil = s.rpg?.skills?.cooldownUntil?.[skillDef.id] ?? 0;
        const remaining = Math.max(0, cooldownUntil - now);
        btn.setCooldown(remaining, skillDef.cooldownMs);
      } else {
        btn.setSkill(null);
        btn.setLocked(true, i === 2 ? 3 : 5);
      }
    }
  }

  public getSkillButton(index: number): SkillButton | undefined {
    return this.skillButtons[index];
  }

  // =========================================================================
  // CLEANUP & LIFECYCLE
  // =========================================================================

  public destroy(): void {
    for (const fn of this.cleanupFns) {
      fn();
    }
    this.cleanupFns = [];
    this.joystickBase.destroy();
    this.joystickKnob.destroy();
    this.attackBtn.container.destroy(true);
    this.dodgeBtn.container.destroy(true);
    this.interactBtn.container.destroy(true);
    for (const btn of this.skillButtons) {
      btn.destroy(true);
    }
    this.allVisuals = [];
  }
}
