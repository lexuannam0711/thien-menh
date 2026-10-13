import Phaser from 'phaser';
import { BALANCE, H, W } from '../../data/config';
import { actor, floatText, label } from '../ui/art';
import { gameState, getPlayerStats } from '../systems/GameState';
import { InputManager } from '../input/InputManager';
import { getItem } from '../../data/items';
import { consumeItem } from '../rpg/InventorySystem';
import { SPRITE_KEYS } from '../assets/assetLoader';
import { animationFrames, canPlayLocomotion, facingDirection, SPRITE_MANIFEST } from '../assets/spriteManifest';
import { equipmentTexture, EQUIPMENT_ARTWORK } from '../assets/equipmentArtwork';
import { graphicsSettings } from '../rendering/GraphicsSettings';
import { Barrier, moveInWorld } from '../world/WorldBounds';
import type { SkillDefinition } from '../../data/skills';
import type { SkillSlot } from '../rpg/SkillSystem';
import { castEquippedSkill } from '../systems/SkillCombat';
import { audioManager } from '../audio/AudioManager';
import {
  calculateWeaponAttackTiming,
  getEquippedWeaponOrDefault,
  type WeaponDefinition,
} from '../../data/weapons';

class PlayerStatusPresentation {
  private shield: Phaser.GameObjects.Graphics | null = null;
  private invulnerability: Phaser.GameObjects.Graphics | null = null;
  private disposed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly view: Phaser.GameObjects.Container) {
    scene.events.once('shutdown', this.destroy);
    view.once('destroy', this.destroy);
  }

  sync(shieldRemainingMs: number, skillInvulnerabilityMs: number): void {
    if (this.disposed) return;
    this.shield = this.cue(this.shield, shieldRemainingMs > 0, true);
    this.invulnerability = this.cue(this.invulnerability, skillInvulnerabilityMs > 0, false);
    for (const graphic of [this.shield, this.invulnerability]) {
      graphic?.setPosition(this.view.x, this.view.y).setDepth(this.view.depth + 0.1);
    }
  }

  private cue(graphic: Phaser.GameObjects.Graphics | null, active: boolean, shield: boolean): Phaser.GameObjects.Graphics | null {
    if (!active) { graphic?.destroy(); return null; }
    if (graphic) return graphic;
    const outline = this.scene.add.graphics();
    for (const [width, color] of [[5, 0x112b26], [2, shield ? 0xf3c66f : 0xa4e6e3]]) {
      outline.lineStyle(width, color, 1);
      if (shield) {
        outline.beginPath().moveTo(-24, -28).lineTo(24, -28).lineTo(22, 8)
          .lineTo(0, 26).lineTo(-22, 8).closePath().strokePath();
      } else {
        outline.strokeCircle(0, -4, 34).strokeCircle(0, -4, 29);
      }
    }
    return outline;
  }

  readonly destroy = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    this.shield?.destroy();
    this.invulnerability?.destroy();
    this.shield = this.invulnerability = null;
    this.scene.events.off('shutdown', this.destroy);
    this.view.off('destroy', this.destroy);
  };
}

class PlayerEquipmentPresentation {
  private readonly overlays: Partial<Record<keyof typeof EQUIPMENT_ARTWORK, Phaser.GameObjects.Sprite>> = {};
  private disposed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly view: Phaser.GameObjects.Container) {
    scene.events.once('shutdown', this.destroy);
    view.once('destroy', this.destroy);
  }

  sync(hero: Phaser.GameObjects.Sprite | null, slots: Partial<Record<keyof typeof EQUIPMENT_ARTWORK, string>>): void {
    if (this.disposed) return;
    let below = hero;
    for (const slot of ['armor', 'accessory'] as const) {
      const key = hero ? equipmentTexture(slot, slots[slot], hero.texture.key) : null;
      let overlay = this.overlays[slot];
      if (!hero || !key || !this.aligned(hero, key)) { overlay?.setVisible(false); continue; }
      if (!overlay) {
        overlay = this.scene.add.sprite(hero.x, hero.y, key, hero.frame.name);
        this.overlays[slot] = overlay;
        this.view.add(overlay);
      }
      overlay.setTexture(key, hero.frame.name).setVisible(hero.visible)
        .setPosition(hero.x, hero.y).setOrigin(hero.originX, hero.originY)
        .setFlip(hero.flipX, hero.flipY).setAlpha(hero.alpha)
        .setScale(hero.scaleX, hero.scaleY).setRotation(hero.rotation)
        .setDepth(hero.depth + (slot === 'armor' ? 0.01 : 0.02));
      this.view.moveAbove(overlay, below!);
      below = overlay;
    }
  }

  private aligned(hero: Phaser.GameObjects.Sprite, key: string): boolean {
    if (!this.scene.textures.exists(key) || !this.scene.textures.exists(hero.texture.key)
      || !this.scene.textures.get(hero.texture.key).has(hero.frame.name)) return false;
    const texture = this.scene.textures.get(key);
    if (!texture.has(hero.frame.name)) return false;
    const frame = texture.get(hero.frame.name);
    return hero.frame.cutWidth === SPRITE_MANIFEST.hero.size && hero.frame.cutHeight === SPRITE_MANIFEST.hero.size
      && frame.cutWidth === hero.frame.cutWidth && frame.cutHeight === hero.frame.cutHeight;
  }

  readonly destroy = (): void => {
    if (this.disposed) return;
    this.disposed = true;
    for (const overlay of Object.values(this.overlays)) overlay?.destroy();
    this.scene.events.off('shutdown', this.destroy);
    this.view.off('destroy', this.destroy);
  };
}

interface PlayerActions {
  basic: (step: number, direction: Phaser.Math.Vector2) => void;
  skill: (skill: SkillDefinition, damage: number, direction: Phaser.Math.Vector2) => void;
  interact: () => void;
  dead: (animationMs: number) => void;
}

export class Player {
  readonly view: Phaser.GameObjects.Container;
  readonly direction = new Phaser.Math.Vector2(1, 0);
  readonly inputManager: InputManager;
  readonly controls: { readonly direction: Phaser.Math.Vector2 };
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private visualState = 'idle';
  private keys: Record<string, Phaser.Input.Keyboard.Key> | null = null;
  private attackAt = 0;
  private attackBufferedUntil = 0;
  private removeControlListener?: () => void;
  private lastAttack = -3000;
  private combo = 0;
  private dodgeReadyAt = 0;
  private dodgeEndAt = 0;
  private invulnerableUntil = 0;
  private shieldRemainingMs = 0;
  private skillInvulnerabilityMs = 0;
  private readonly statusPresentation: PlayerStatusPresentation;
  private readonly equipmentPresentation: PlayerEquipmentPresentation;
  private locked: () => boolean;

  constructor(private scene: Phaser.Scene, x: number, y: number,
    private actions: PlayerActions, locked: () => boolean,
    private readonly barriers: readonly Barrier[] = [],
    inputManager?: InputManager) {
    this.locked = locked;

    if (scene.textures.exists(SPRITE_KEYS.hero)) {
      const shadow = scene.add.ellipse(0, 16, 36, 12, 0x112b26, 0.65);
      this.sprite = scene.add.sprite(0, -6, SPRITE_KEYS.hero, 0);
      this.playPose('idle');
      const name = label(scene, 0, -38, 'THIÊN MỆNH', 13, '#fff5d2', 'center');
      this.view = scene.add.container(x, y, [shadow, this.sprite, name]);
      this.view.setDepth(30 + y / 10);
    } else {
      this.view = actor(scene, x, y, 0x4d8db1, 'THIÊN MỆNH', 22, true);
    }

    this.statusPresentation = new PlayerStatusPresentation(scene, this.view);
    this.equipmentPresentation = new PlayerEquipmentPresentation(scene, this.view);
    this.syncEquipmentPresentation();

    if (inputManager) {
      this.inputManager = inputManager;
    } else if (typeof InputManager === 'function') {
      this.inputManager = new InputManager({ scene });
    } else {
      this.inputManager = {
        update: () => ({ moveX: 0, moveY: 0, pressed: new Set(), held: new Set(), released: new Set() }),
        getMovementVector: () => ({ x: 0, y: 0 }),
        getAimPoint: () => null,
        contextManager: { isGameplayAllowed: () => true, getCurrentContext: () => 'GAMEPLAY', peek: () => 'GAMEPLAY', onChange: () => () => {} },
        settingsManager: { getSettings: () => ({ pc: { mouseAiming: true } }) },
        cleanup: () => {},
      } as unknown as InputManager;
    }

    this.controls = { direction: new Phaser.Math.Vector2(0, 0) };

    if (typeof scene.input?.keyboard?.addKeys === 'function') {
      this.keys = scene.input.keyboard.addKeys({
        attack: 'J', dodge: 'SPACE', interact: 'F',
      }) as Record<string, Phaser.Input.Keyboard.Key>;
    }

    const cancelLockedAttack = () => { if (this.isLocked) this.attackBufferedUntil = 0; };
    scene.events.on('preupdate', cancelLockedAttack);
    let unsubContext: (() => void) | undefined;
    if (this.inputManager?.contextManager?.onChange) {
      unsubContext = this.inputManager.contextManager.onChange((curr) => {
        if (curr !== 'GAMEPLAY') this.attackBufferedUntil = 0;
      });
    }

    const cleanup = this.removeControlListener = () => {
      this.attackBufferedUntil = 0;
      scene.events.off('preupdate', cancelLockedAttack);
      scene.events.off('shutdown', cleanup);
      this.view.off('destroy', cleanup);
      unsubContext?.();
      this.inputManager?.cleanup?.();
    };
    scene.events.once('shutdown', cleanup);
    this.view.once('destroy', cleanup);
  }

  get x(): number { return this.view.x; }
  get y(): number { return this.view.y; }
  get isDodging(): boolean { return this.scene.time.now < this.dodgeEndAt; }
  get isDead(): boolean { return this.visualState === 'death'; }
  get canBeHit(): boolean { return this.visualState !== 'death' && this.skillInvulnerabilityMs <= 0 && this.scene.time.now >= this.invulnerableUntil; }
  private get isLocked(): boolean {
    if (this.isDead || this.locked()) return true;
    if (this.inputManager?.contextManager && !this.inputManager.contextManager.isGameplayAllowed()) {
      return true;
    }
    return false;
  }

  update(delta: number): void {
    if (this.isLocked) {
      this.attackBufferedUntil = 0;
      this.syncStatusPresentation();
      this.syncEquipmentPresentation();
      return;
    }
    this.shieldRemainingMs = Math.max(0, this.shieldRemainingMs - delta);
    this.skillInvulnerabilityMs = Math.max(0, this.skillInvulnerabilityMs - delta);
    const time = this.scene.time.now;

    const input = this.inputManager?.update ? this.inputManager.update(delta) : null;
    if (input) {
      if (input.pressed.has('ATTACK')) this.attack();
      if (input.pressed.has('DODGE')) this.dodge();
      if (input.pressed.has('SKILL_1')) this.useSkill('slot-1');
      if (input.pressed.has('SKILL_2')) this.useSkill('slot-2');
      if (input.pressed.has('SKILL_3')) this.useSkill('slot-3');
      if (input.pressed.has('SKILL_4')) this.useSkill('slot-4');
      if (input.pressed.has('QUICK_ITEM_1')) this.useQuickItem(0);
      if (input.pressed.has('QUICK_ITEM_2')) this.useQuickItem(1);
      if (input.pressed.has('QUICK_ITEM_3')) this.useQuickItem(2);
      if (input.pressed.has('QUICK_ITEM_4')) this.useQuickItem(3);
      if (input.pressed.has('INTERACT')) { this.playPose('interaction'); this.actions.interact(); }
    } else if (this.keys) {
      const key = this.keys;
      if (Phaser.Input?.Keyboard?.JustDown && key.attack && Phaser.Input.Keyboard.JustDown(key.attack)) this.attack();
      if (Phaser.Input?.Keyboard?.JustDown && key.dodge && Phaser.Input.Keyboard.JustDown(key.dodge)) this.dodge();
      if (Phaser.Input?.Keyboard?.JustDown && key.interact && Phaser.Input.Keyboard.JustDown(key.interact)) { this.playPose('interaction'); this.actions.interact(); }
    }

    if (this.attackBufferedUntil > 0) {
      if (time > this.attackBufferedUntil) this.attackBufferedUntil = 0;
      else if (time >= this.attackAt && !this.isDodging) this.attack();
    }

    const move = this.inputManager?.getMovementVector ? this.inputManager.getMovementVector() : { x: 0, y: 0 };
    let vx = move.x + this.controls.direction.x;
    let vy = move.y + this.controls.direction.y;
    const length = Math.hypot(vx, vy);
    if (length > 1) {
      vx /= length;
      vy /= length;
    }
    const moveLen = Math.hypot(vx, vy);
    if (moveLen > 0.08 && !this.isDodging) {
      this.direction.set(vx / moveLen, vy / moveLen);
    }
    const moving = moveLen > 0.08 || this.isDodging;
    const speed = this.isDodging ? 540 : getPlayerStats(gameState.data).speed;
    const moveDirX = this.isDodging ? this.direction.x : vx;
    const moveDirY = this.isDodging ? this.direction.y : vy;
    const next = moveInWorld({ x: this.view.x, y: this.view.y }, {
      x: this.view.x + moveDirX * speed * delta / 1000,
      y: this.view.y + moveDirY * speed * delta / 1000,
    }, 22, this.barriers);
    this.view.setPosition(next.x, next.y);
    this.view.setDepth(30 + this.view.y / 10);
    this.syncStatusPresentation();
    if (this.sprite) {
      if (time > this.attackAt && canPlayLocomotion(this.visualState, this.sprite.anims.isPlaying)) {
        this.playPose(this.isDodging || moveLen > 0.75 ? 'run' : moving ? 'walk' : 'idle');
      }
    }
    if (!this.sprite) this.view.setScale(this.isDodging ? 0.89 : 1 + (moving ? Math.sin(time / 80) * 0.04 : 0));
    const s = gameState.data;
    s.mp = Math.min(getPlayerStats(s).maxMp, s.mp + delta / 1000 * 7.5);
    this.syncEquipmentPresentation();
  }

  getEquippedWeapon(): WeaponDefinition {
    const weaponId = gameState.data.rpg?.equipment?.slots?.weapon;
    return getEquippedWeaponOrDefault(weaponId, gameState.data.level);
  }

  private syncStatusPresentation(): void {
    if (this.isDead) this.statusPresentation?.destroy();
    else this.statusPresentation?.sync(this.shieldRemainingMs, this.skillInvulnerabilityMs);
  }

  private syncEquipmentPresentation(): void {
    this.equipmentPresentation?.sync(this.sprite, gameState.data.rpg?.equipment?.slots ?? {});
  }

  private playPose(state: string, durationMs?: number): void {
    if (!this.sprite || (this.visualState === 'death' && state !== 'death')) return;
    const type = this.getEquippedWeapon().weaponType;
    const requested = type === 'axe' ? 'hero_axe' : type === 'sword' ? 'hero_sword' : 'hero';
    const direction = facingDirection(this.direction.x, this.direction.y);
    const name = ([requested, 'hero'] as const).find(candidate =>
      this.scene.textures.exists(SPRITE_KEYS[candidate])
      && this.scene.anims.exists(candidate + '_' + state + '_' + direction)
      && animationFrames(candidate, state, direction).every(frame =>
        this.scene.textures.get(SPRITE_KEYS[candidate]).has(String(frame))));
    if (!name) return;
    if (this.sprite.texture?.key !== SPRITE_KEYS[name]) {
      this.sprite.setTexture(SPRITE_KEYS[name]);
    }
    this.visualState = state;
    this.sprite.setFlipX(false).play(name + '_' + state + '_' + direction, true);
    const pose = SPRITE_MANIFEST.hero.poses[state];
    this.sprite.anims.timeScale = durationMs ? pose.count * 1000 / pose.frameRate / durationMs : 1;
    this.syncEquipmentPresentation();
  }

  private getAimDirection(): Phaser.Math.Vector2 | null {
    if (!this.inputManager) return null;
    const settings = this.inputManager.settingsManager?.getSettings?.();
    const mouseAiming = settings?.pc?.mouseAiming ?? true;
    if (!mouseAiming) return null;
    const aim = this.inputManager.getAimPoint?.();
    if (!aim) return null;
    const dx = aim.x - this.view.x;
    const dy = aim.y - this.view.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1) return null;
    return new Phaser.Math.Vector2(dx / dist, dy / dist);
  }

  attack(): void {
    if (this.isLocked || this.isDodging) { this.attackBufferedUntil = 0; return; }
    const time = this.scene.time.now;
    if (time < this.attackAt) { this.attackBufferedUntil = time + BALANCE.attackBufferMs; return; }
    this.attackBufferedUntil = 0;
    this.combo = time - this.lastAttack <= BALANCE.comboWindowMs ? (this.combo % 3) + 1 : 1;
    this.lastAttack = time;
    const weapon = this.getEquippedWeapon();
    this.attackAt = time + calculateWeaponAttackTiming(weapon, this.combo);

    const aimDir = this.getAimDirection();
    if (aimDir) {
      this.direction.set(aimDir.x, aimDir.y);
    }

    if (this.sprite) {
      this.playPose('attack' + this.combo, this.attackAt - time);
    }
    this.actions.basic(this.combo, this.direction.clone());
  }

  dodge(): void {
    const time = this.scene.time.now;
    if (this.isLocked || time < this.dodgeReadyAt) return;
    this.attackBufferedUntil = 0;
    this.attackAt = 0;
    this.dodgeReadyAt = time + BALANCE.dodgeCooldownMs;
    this.dodgeEndAt = time + BALANCE.dodgeDurationMs;
    this.invulnerableUntil = this.dodgeEndAt + 60;
    this.playPose('dodge', BALANCE.dodgeDurationMs);
    audioManager.playCue('dodge', { priority: 1 });
    floatText(this.scene, this.x, this.y - 34, 'LƯỚT', '#d0f0ea');
  }

  earth(): void {
    this.useSkill('slot-1');
  }

  flame(): void {
    this.useSkill('slot-2');
  }

  useSkill(slot: SkillSlot): void {
    const s = gameState.data;
    if (this.isLocked || this.isDodging) return;
    if (!s.rpg?.skills) return;

    const result = castEquippedSkill(s.rpg.skills, {
      level: s.level, hp: s.hp, mp: s.mp, maxHp: getPlayerStats(s).maxHp, maxMp: getPlayerStats(s).maxMp,
      attack: s.attack, gold: s.gold, equippedWeaponId: s.rpg?.equipment?.slots?.weapon,
    }, slot, Date.now());

    if (!result || !result.success || !result.skill) {
      if (result?.reason === 'on_cooldown') {
        floatText(this.scene, this.x, this.y - 40, 'ĐANG HỒI CHIÊU', '#ffce91');
      } else if (result?.reason !== 'unknown_skill' && result?.reason !== 'not_unlocked') {
        floatText(this.scene, this.x, this.y - 40, 'CHƯA THỂ DÙNG', '#ffce91');
      }
      return;
    }

    const aimDir = this.getAimDirection();
    if (aimDir) {
      this.direction.set(aimDir.x, aimDir.y);
    }

    this.attackBufferedUntil = 0;
    gameState.data = { ...s, hp: result.caster.hp, mp: result.caster.mp, rpg: { ...s.rpg, skills: result.progress } };
    const effect = result.skill.effect;
    if (effect.statusEffect === 'shield') this.shieldRemainingMs = effect.statusDurationMs ?? 0;
    if (effect.statusEffect === 'invulnerable') this.skillInvulnerabilityMs = effect.statusDurationMs ?? 0;
    this.syncStatusPresentation();
    gameState.save();
    this.playPose(result.skill.element === 'flame' ? 'fire' : result.skill.element === 'water' ? 'water' : 'earth');
    floatText(this.scene, this.x, this.y - 40, result.skill.vietnameseName, '#a4e6e3');
    this.actions.skill(result.skill, result.damageDealt ?? 0, this.direction.clone());
  }

  useQuickItem(index: number): void {
    if (this.isLocked || this.isDodging) return;
    const s = gameState.data;
    const inv = s.rpg?.inventory;
    if (!inv?.slots || typeof consumeItem !== 'function' || typeof getItem !== 'function') return;

    const consumables = inv.slots.filter(slot => {
      const it = getItem(slot.itemId);
      return it && it.kind === 'consumable' && slot.quantity > 0;
    });

    const target = consumables[index];
    if (!target) return;

    const item = getItem(target.itemId);
    if (!item) return;

    const change = consumeItem(inv, target.itemId);
    if (change.changed !== 1) return;

    const stats = getPlayerStats(s);
    let healed = false;
    let text = '';
    if (item.restoreHp) {
      s.hp = Math.min(stats.maxHp, s.hp + item.restoreHp);
      text = `+${item.restoreHp} HP`;
      healed = true;
    }
    if (item.restoreMp) {
      s.mp = Math.min(stats.maxMp, s.mp + item.restoreMp);
      text = (text ? text + ' ' : '') + `+${item.restoreMp} MP`;
      healed = true;
    }

    s.rpg.inventory = change.state;
    gameState.save();
    if (healed) {
      audioManager.playCue('heal', { priority: 2 });
      floatText(this.scene, this.x, this.y - 40, `${item.name}: ${text}`, '#9df2c8');
    }
  }

  hit(damage: number): void {
    if (!this.canBeHit) return;
    this.attackBufferedUntil = 0;
    if (this.shieldRemainingMs > 0) damage = Math.max(1, Math.round(damage / 2));
    const s = gameState.data;
    audioManager.playCue('player_hurt', { priority: 2 });
    s.hp = Math.max(0, s.hp - damage);
    this.invulnerableUntil = this.scene.time.now + 550;
    floatText(this.scene, this.x, this.y - 45, `-${damage}`, '#ff827c');
    if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(85, 0.0025);
    this.playPose(s.hp <= 0 ? 'death' : 'hit');
    if (s.hp <= 0) {
      this.removeControlListener?.();
      this.statusPresentation?.destroy();
      const pose = SPRITE_MANIFEST.hero.poses.death;
      this.actions.dead(this.sprite ? pose.count * 1000 / pose.frameRate : 0);
    } else {
      this.scene.tweens.add({ targets: this.view, alpha: 0.33, yoyo: true, repeat: 2, duration: 85,
        onComplete: () => this.view.setAlpha(1) });
    }
  }
}
