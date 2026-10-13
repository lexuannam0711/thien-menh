import type Phaser from 'phaser';
import { facingDirection, SPRITE_MANIFEST, type SpriteName } from '../assets/spriteManifest';
import { SPRITE_KEYS } from '../assets/assetLoader';
import { graphicsSettings } from '../rendering/GraphicsSettings';
import {
  BossAttackDefinition,
  BossDefinition,
  BossId,
  BossPhaseDefinition,
  getBoss,
} from '../../data/bosses';

export type BossState =
  | 'idle'
  | 'chasing'
  | 'windup'
  | 'attacking'
  | 'recovering'
  | 'transitioning'
  | 'channeling'
  | 'submerged'
  | 'staggered'
  | 'dead';

export interface BossDamageResult {
  readonly hpDamage: number;
  readonly shieldDamage: number;
  readonly killed: boolean;
  readonly triggeredPhaseTransition: boolean;
}

export interface ActiveTelegraph {
  readonly attack: BossAttackDefinition;
  readonly startAt: number;
  readonly endAt: number;
  readonly duration: number;
  readonly originX: number;
  readonly originY: number;
  readonly targetX: number;
  readonly targetY: number;
  readonly directionX: number;
  readonly directionY: number;
}

export interface BossCombatTarget {
  readonly x: number;
  readonly y: number;
  readonly isDodging?: boolean;
  readonly canBeHit?: boolean;
  hit?: (damage: number) => void;
}

export type ProjectileSpawnCallback = (
  scene: Phaser.Scene,
  x: number,
  y: number,
  target: BossCombatTarget,
  damage: number,
  speed: number,
) => void;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fontSize = 13,
  color = '#fff5d2',
  align: 'left' | 'center' = 'left',
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${fontSize}px`,
      color,
      stroke: '#10251f',
      strokeThickness: 3,
      align,
    })
    .setOrigin(align === 'center' ? 0.5 : 0, 0.5);
}

function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color = '#ffe68b',
): void {
  if (!scene || !scene.add) return;
  const t = scene.add
    .text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      color,
      stroke: '#10251f',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(2100);
  if (scene.tweens) {
    scene.tweens.add({
      targets: t,
      y: y - 28,
      alpha: 0,
      duration: 650,
      onComplete: () => t.destroy(),
    });
  }
}

const BOSS_SPRITES = { 'ho-yeu': 'hoyer', 'thuong-luong': 'thuongluong', 'thach-tuong': 'thachtuong', 'hac-an': 'hacan' } as const;

export class Boss {
  readonly view: Phaser.GameObjects.Container;
  readonly definition: BossDefinition;
  readonly bossId: BossId;
  private readonly spriteName: SpriteName;

  private hp: number;
  private readonly maxHp: number;
  private shield = 0;
  private maxShield = 0;
  private alive = true;
  private state: BossState = 'idle';

  private currentPhaseIndex = 0;
  private phaseState: BossPhaseDefinition;

  private facingX = 1;
  private facingY = 0;

  private readyAt = 0;
  private windupEndAt = 0;
  private recoveryEndAt = 0;
  private transitionEndAt = 0;
  private channelEndAt = 0;
  private staggerEndAt = 0;
  private submergedEndAt = 0;

  private channelDamageReceived = 0;
  private currentAttack: BossAttackDefinition | null = null;
  private activeTelegraphState: ActiveTelegraph | null = null;
  private attackCooldowns: Map<string, number> = new Map();

  // Rendering elements (guarded for headless/mock environments)
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private visualPose = '';
  private hpFill: Phaser.GameObjects.Rectangle | null = null;
  private shieldFill: Phaser.GameObjects.Rectangle | null = null;
  private nameLabel: Phaser.GameObjects.Text | null = null;
  private telegraphGfx: Phaser.GameObjects.Graphics | null = null;
  private bossAuraGfx: Phaser.GameObjects.Graphics | null = null;

  // Headless simulation position
  private simX: number;
  private simY: number;

  constructor(
    private readonly scene: Phaser.Scene | null,
    bossId: BossId,
    x: number,
    y: number,
    private readonly onDeath?: (boss: Boss) => void,
    private readonly spawnProjectile?: ProjectileSpawnCallback,
    private readonly onPhaseChange?: (boss: Boss, phase: BossPhaseDefinition) => void,
  ) {
    const def = getBoss(bossId);
    if (!def) {
      throw new Error(`Unknown boss ID: ${bossId}`);
    }
    this.definition = def;
    this.bossId = bossId;
    this.spriteName = BOSS_SPRITES[bossId];
    this.hp = def.maxHp;
    this.maxHp = def.maxHp;
    this.phaseState = def.phases[0];
    this.currentPhaseIndex = 0;

    this.simX = x;
    this.simY = y;

    // Visual setup if running in a valid Phaser scene
    if (scene && scene.add) {
      this.view = scene.add.container(x, y);
      this.view.setDepth(35 + y / 10);
      this.setupVisuals(scene, def);
    } else {
      // Mock minimal container for headless execution
      this.view = {
        x,
        y,
        setDepth: () => this.view,
        setPosition: (px: number, py: number) => {
          this.view.x = px;
          this.view.y = py;
          return this.view;
        },
        destroy: () => {},
        setAlpha: () => this.view,
      } as unknown as Phaser.GameObjects.Container;
    }
  }

  get x(): number {
    return this.view ? this.view.x : this.simX;
  }

  get y(): number {
    return this.view ? this.view.y : this.simY;
  }

  get isAlive(): boolean {
    return this.alive;
  }

  get isBoss(): boolean {
    return true;
  }

  get radius(): number {
    return this.definition.radius;
  }

  get currentHp(): number {
    return this.hp;
  }

  get currentMaxHp(): number {
    return this.maxHp;
  }

  get currentShield(): number {
    return this.shield;
  }

  get healthFraction(): number {
    return this.maxHp > 0 ? this.hp / this.maxHp : 0;
  }

  get currentState(): BossState {
    return this.state;
  }

  get currentPhase(): BossPhaseDefinition {
    return this.phaseState;
  }

  get phaseIndex(): number {
    return this.currentPhaseIndex;
  }

  get activeTelegraph(): ActiveTelegraph | null {
    return this.activeTelegraphState;
  }

  get activeAttack(): BossAttackDefinition | null {
    return this.currentAttack;
  }

  /**
   * Main update tick for Boss AI, state transitions, and telegraph management.
   */
  update(time: number, delta: number, target: BossCombatTarget): void {
    if (!this.alive) return;

    // Update facing direction toward target
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      this.facingX = dx / dist;
      this.facingY = dy / dist;
    }
    this.syncPose();

    // Handle Phase Transitions
    if (this.state === 'transitioning') {
      if (time >= this.transitionEndAt) {
        this.completePhaseTransition();
      }
      return;
    }

    // Handle Staggered state (vulnerable recovery)
    if (this.state === 'staggered') {
      if (time >= this.staggerEndAt) {
        this.state = 'idle';
        this.readyAt = time + 400;
      }
      return;
    }

    // Handle Submerged state (Thuồng Luồng mechanic)
    if (this.state === 'submerged') {
      if (time >= this.submergedEndAt) {
        this.surfaceFromWater(time, target);
      } else {
        // Move silently toward target while submerged
        const subSpeed = this.definition.baseSpeed * 1.5;
        this.moveToward(target.x, target.y, subSpeed, delta);
      }
      return;
    }

    // Handle Active Attack Windup (Telegraph stage)
    if (this.state === 'windup' && this.currentAttack) {
      this.renderTelegraph(time);
      if (time >= this.windupEndAt) {
        this.executeAttackImpact(time, target);
      }
      return;
    }

    // Handle Channeling (Hắc Ấn ultimate mechanic)
    if (this.state === 'channeling' && this.currentAttack) {
      this.renderTelegraph(time);
      if (time >= this.channelEndAt) {
        this.executeAttackImpact(time, target);
      }
      return;
    }

    // Handle Attack Recovery
    if (this.state === 'recovering') {
      if (time >= this.recoveryEndAt) {
        this.state = 'idle';
      }
      return;
    }

    // Check for HP-based Phase Transition trigger
    const triggered = this.checkPhaseThreshold(time);
    if (triggered) return;

    // Idle / Chasing behavior: Select attack or close distance
    if (time >= this.readyAt) {
      const selectedAttack = this.selectBestAttack(dist, time);
      if (selectedAttack) {
        this.startAttack(selectedAttack, time, target);
        return;
      }
    }

    // Standard chase behavior toward player
    const speed = this.definition.baseSpeed * this.phaseState.speedMultiplier;
    const minEngageDist = Math.max(45, this.radius + 15);
    if (dist > minEngageDist) {
      this.moveToward(target.x, target.y, speed, delta);
      this.state = 'chasing';
    } else {
      this.state = 'idle';
    }
  }

  /**
   * Apply damage to the boss with shield absorption, defense bonus,
   * stagger interruption, and phase transitions.
   */
  damage(amount: number, knockX = 0, knockY = 0): BossDamageResult {
    if (!this.alive) {
      return { hpDamage: 0, shieldDamage: 0, killed: false, triggeredPhaseTransition: false };
    }

    // Immune while submerged or transitioning
    if (this.state === 'submerged' || this.state === 'transitioning') {
      if (this.scene) {
        floatText(this.scene, this.x, this.y - 45, 'VÔ HIỆU!', '#80deea');
      }
      return { hpDamage: 0, shieldDamage: 0, killed: false, triggeredPhaseTransition: false };
    }

    // Apply defense reduction from current phase
    const effectiveDamage = Math.max(1, amount - this.phaseState.defenseBonus);

    let shieldDamage = 0;
    let hpDamage = 0;

    // 1. Shield absorbs damage first
    if (this.shield > 0) {
      shieldDamage = Math.min(this.shield, effectiveDamage);
      this.shield -= shieldDamage;
      const remainder = effectiveDamage - shieldDamage;
      if (remainder > 0) {
        hpDamage = Math.min(this.hp, remainder);
        this.hp -= hpDamage;
      }
      if (this.scene) {
        floatText(this.scene, this.x, this.y - 50, `Giáp -${shieldDamage}`, '#ffd54f');
      }
    } else {
      hpDamage = Math.min(this.hp, effectiveDamage);
      this.hp -= hpDamage;
    }

    // 2. Track damage during channel for interrupt mechanic
    if (this.state === 'channeling') {
      this.channelDamageReceived += effectiveDamage;
      const staggerReq = this.getMechanicValue('ultimate_channel', 65);
      if (this.channelDamageReceived >= staggerReq) {
        this.interruptChannel();
      }
    }

    // Update visual bars
    this.refreshBars();

    // Floating damage text and hit feedback
    if (this.scene) {
      if (hpDamage > 0) {
        floatText(this.scene, this.x, this.y - 40, String(hpDamage), '#ffe68b');
      }
      this.applyHitFeedback(knockX, knockY);
    }

    // 3. Check for Boss Defeat
    if (this.hp <= 0) {
      this.alive = false;
      this.state = 'dead';
      this.clearTelegraph();
      this.onDeath?.(this);
      this.playDeathVisuals();
      return { hpDamage, shieldDamage, killed: true, triggeredPhaseTransition: false };
    }

    // 4. Check Phase Transition
    const triggeredTransition = this.checkPhaseThreshold(this.scene?.time.now ?? 0);

    return {
      hpDamage,
      shieldDamage,
      killed: false,
      triggeredPhaseTransition: triggeredTransition,
    };
  }

  /**
   * Adds shield points (e.g. Thạch Tướng Stone Shield mechanic).
   */
  addShield(amount: number): void {
    const grant = Math.max(0, amount);
    this.shield += grant;
    this.maxShield = Math.max(this.maxShield, this.shield);
    this.refreshBars();
    if (this.scene) {
      floatText(this.scene, this.x, this.y - 60, `+${grant} Thạch Giáp`, '#ffd54f');
      if (this.scene.tweens) {
        this.scene.tweens.add({
          targets: this.view,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 120,
          yoyo: true,
        });
      }
    }
  }

  /**
   * Interrupts an ongoing ultimate channel (e.g. Hắc Ấn Vô Diện).
   */
  interruptChannel(): boolean {
    if (this.state !== 'channeling') return false;
    this.state = 'staggered';
    this.clearTelegraph();
    const now = this.scene?.time.now ?? 0;
    this.staggerEndAt = now + 1800;
    this.currentAttack = null;
    this.channelDamageReceived = 0;

    if (this.scene) {
      floatText(this.scene, this.x, this.y - 65, 'CHOÁNG VÁNG! PHÁ TRẬN!', '#ff5252');
      if (this.scene.cameras?.main) {
        if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(160, 0.006);
      }
    }
    return true;
  }

  /**
   * Sets submerge state (e.g. Thuồng Luồng aquatic diving).
   */
  setSubmerged(submerged: boolean, durationMs = 1600): void {
    if (submerged) {
      this.state = 'submerged';
      const now = this.scene?.time.now ?? 0;
      this.submergedEndAt = now + durationMs;
      this.clearTelegraph();
      if (this.scene) {
        floatText(this.scene, this.x, this.y - 40, 'LẶN ĐÁY ĐẦM', '#4dd0e1');
        if (this.scene.tweens) {
          this.scene.tweens.add({ targets: this.view, alpha: 0.25, duration: 250 });
        }
      }
    } else {
      this.state = 'idle';
      if (this.scene?.tweens) {
        this.scene.tweens.add({ targets: this.view, alpha: 1, duration: 200 });
      }
    }
  }

  /**
   * Teleports boss to a given location (e.g. Hắc Ấn void teleport).
   */
  teleport(newX: number, newY: number): void {
    this.setPosition(newX, newY);
    if (this.scene) {
      floatText(this.scene, newX, newY - 45, 'HƯ KHÔNG DỊCH CHUYỂN', '#ce93d8');
      if (this.scene.cameras?.main) {
        if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(80, 0.002);
      }
    }
  }

  /**
   * Sets absolute position for container & simulation.
   */
  setPosition(x: number, y: number): void {
    this.simX = x;
    this.simY = y;
    if (this.view && this.view.setPosition) {
      this.view.setPosition(x, y);
      if (this.view.setDepth) {
        this.view.setDepth(35 + y / 10);
      }
    }
  }

  /**
   * Clean up graphics, container, and state.
   */
  destroy(): void {
    this.alive = false;
    this.clearTelegraph();
    if (this.telegraphGfx) {
      this.telegraphGfx.destroy();
      this.telegraphGfx = null;
    }
    if (this.view && this.view.destroy) {
      this.view.destroy();
    }
  }

  // ==========================================
  // Private AI and Combat Execution Methods
  // ==========================================

  private selectBestAttack(dist: number, time: number): BossAttackDefinition | null {
    const attacks = this.phaseState.attacks;
    const readyAttacks: BossAttackDefinition[] = [];

    for (const attack of attacks) {
      const cdEnd = this.attackCooldowns.get(attack.id) ?? 0;
      if (time >= cdEnd && dist <= attack.range * 1.25) {
        readyAttacks.push(attack);
      }
    }

    if (readyAttacks.length === 0) return null;

    readyAttacks.sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
    return readyAttacks[0];
  }

  private startAttack(
    attack: BossAttackDefinition,
    time: number,
    target: BossCombatTarget,
  ): void {
    this.currentAttack = attack;
    this.windupEndAt = time + attack.windupMs;
    this.attackCooldowns.set(attack.id, time + attack.cooldownMs);

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len;
    const dirY = dy / len;

    this.activeTelegraphState = {
      attack,
      startAt: time,
      endAt: this.windupEndAt,
      duration: attack.windupMs,
      originX: this.x,
      originY: this.y,
      targetX: target.x,
      targetY: target.y,
      directionX: dirX,
      directionY: dirY,
    };

    if (attack.kind === 'channel') {
      if (attack.id.includes('submerge')) {
        this.setSubmerged(true, attack.hazardDurationMs ?? 1600);
        return;
      }
      this.state = 'channeling';
      this.channelEndAt = time + attack.windupMs;
      this.channelDamageReceived = 0;
    } else {
      this.state = 'windup';
    }
    this.syncPose();

    if (this.scene) {
      const notice = attack.telegraph.warningText ?? attack.name;
      floatText(this.scene, this.x, this.y - 55, notice, '#ffab91');
    }
  }

  private executeAttackImpact(time: number, target: BossCombatTarget): void {
    const attack = this.currentAttack;
    if (!attack) return;

    if (this.activeTelegraphState) {
      this.facingX = this.activeTelegraphState.directionX;
      this.facingY = this.activeTelegraphState.directionY;
    }
    const finalDamage = Math.round(
      attack.damage * this.phaseState.damageMultiplier * (this.definition.baseAttack / 20),
    );

    // 1. Dash displacement
    if (attack.kind === 'dash') {
      const warning = this.activeTelegraphState;
      const leapDist = Math.min(attack.range, warning
        ? Math.hypot(warning.targetX - warning.originX, warning.targetY - warning.originY)
        : Math.hypot(target.x - this.x, target.y - this.y));
      this.simX += this.facingX * leapDist * 0.75;
      this.simY += this.facingY * leapDist * 0.75;
      this.setPosition(this.simX, this.simY);
    }

    // 2. Shield generation
    if (attack.kind === 'shield' && attack.shieldAmount) {
      this.addShield(attack.shieldAmount);
    }

    // 3. Projectile barrage
    if (attack.kind === 'ranged' && attack.projectileCount && this.scene && this.spawnProjectile) {
      this.fireProjectiles(attack, target);
    }

    // 4. Hit detection & Player damage
    const hit = this.checkHitbox(attack, target);
    if (hit && finalDamage > 0) {
      if (target.isDodging) {
        if (this.scene) {
          floatText(this.scene, target.x, target.y - 30, 'NÉ HOÀN HẢO', '#80cbc4');
        }
      } else if (target.hit && (target.canBeHit === undefined || target.canBeHit)) {
        target.hit(finalDamage);
      }
    }

    // Set recovery
    this.state = 'recovering';
    this.syncPose(true);
    this.clearTelegraph();
    this.recoveryEndAt = time + attack.recoveryMs;
    this.readyAt = this.recoveryEndAt + 250;
    this.currentAttack = null;

    if (this.scene?.cameras?.main) {
      if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(attack.damage > 30 ? 120 : 60, 0.003);
    }
  }

  private checkHitbox(attack: BossAttackDefinition, target: BossCombatTarget): boolean {
    const t = this.activeTelegraphState;
    const originX = t ? t.originX : this.x;
    const originY = t ? t.originY : this.y;
    const dx = target.x - originX;
    const dy = target.y - originY;
    const dist = Math.hypot(dx, dy);

    const tg = attack.telegraph;
    switch (tg.shape) {
      case 'circle': {
        const radius = tg.radius ?? attack.range;
        return dist <= radius;
      }
      case 'cone': {
        const radius = tg.radius ?? attack.range;
        if (dist > radius) return false;
        const targetDirX = dx / (dist || 1);
        const targetDirY = dy / (dist || 1);
        const facingX = t ? t.directionX : this.facingX;
        const facingY = t ? t.directionY : this.facingY;
        const dot = targetDirX * facingX + targetDirY * facingY;
        const halfAngleRad = ((tg.angleDeg ?? 90) * Math.PI) / 360;
        return dot >= Math.cos(halfAngleRad);
      }
      case 'line':
      case 'rect': {
        const length = tg.length ?? attack.range;
        const halfWidth = (tg.width ?? 40) / 2;
        const fX = t ? t.directionX : this.facingX;
        const fY = t ? t.directionY : this.facingY;
        const forward = dx * fX + dy * fY;
        const perp = Math.abs(dx * -fY + dy * fX);
        return forward >= -10 && forward <= length && perp <= halfWidth;
      }
      case 'ring': {
        const outer = tg.radius ?? attack.range;
        const inner = outer * 0.35;
        return dist >= inner && dist <= outer;
      }
      default:
        return dist <= attack.range;
    }
  }

  private fireProjectiles(attack: BossAttackDefinition, target: BossCombatTarget): void {
    if (!this.scene || !this.spawnProjectile) return;
    const count = attack.projectileCount ?? 1;
    const speed = attack.projectileSpeed ?? 220;
    const spreadDeg = attack.projectileSpreadDeg ?? 30;

    const warning = this.activeTelegraphState;
    const baseAngle = warning ? Math.atan2(warning.directionY, warning.directionX)
      : Math.atan2(target.y - this.y, target.x - this.x);
    const startAngle = count > 1 ? baseAngle - ((spreadDeg * Math.PI) / 360) : baseAngle;
    const step = count > 1 ? (spreadDeg * Math.PI) / (180 * (count - 1)) : 0;

    for (let i = 0; i < count; i++) {
      const angle = startAngle + step * i;
      const dummyTarget: BossCombatTarget = {
        x: this.x + Math.cos(angle) * 350,
        y: this.y + Math.sin(angle) * 350,
        hit: (dmg: number) => {
          if (!target.isDodging && target.hit) target.hit(dmg);
        },
      };
      this.spawnProjectile(this.scene, this.x, this.y, dummyTarget, attack.damage, speed);
    }
  }

  private surfaceFromWater(time: number, target: BossCombatTarget): void {
    this.setSubmerged(false);
    this.state = 'windup';
    this.windupEndAt = time + 350;
    const eruptionAttack: BossAttackDefinition = {
      id: 'geyser-eruption',
      name: 'Thủy Bộc Trào Dâng',
      kind: 'aoe',
      damage: 28,
      windupMs: 350,
      recoveryMs: 600,
      cooldownMs: 4000,
      range: 125,
      telegraph: {
        shape: 'circle',
        radius: 125,
        warningText: 'THỦY BỘC TRÀO DÂNG',
        color: 0x00e5ff,
        alpha: 0.6,
      },
      knockback: 45,
    };
    this.currentAttack = eruptionAttack;
    this.activeTelegraphState = {
      attack: eruptionAttack,
      startAt: time,
      endAt: this.windupEndAt,
      duration: 350,
      originX: this.x,
      originY: this.y,
      targetX: target.x,
      targetY: target.y,
      directionX: this.facingX,
      directionY: this.facingY,
    };
  }

  private checkPhaseThreshold(time: number): boolean {
    const nextPhaseIndex = this.currentPhaseIndex + 1;
    if (nextPhaseIndex >= this.definition.phases.length) return false;

    const nextPhase = this.definition.phases[nextPhaseIndex];
    if (this.hp <= this.maxHp * nextPhase.hpThresholdPercent) {
      this.startPhaseTransition(nextPhaseIndex, time);
      return true;
    }
    return false;
  }

  private startPhaseTransition(nextIndex: number, time: number): void {
    this.currentPhaseIndex = nextIndex;
    this.phaseState = this.definition.phases[nextIndex];
    this.state = 'transitioning';
    this.transitionEndAt = time + this.phaseState.transitionDurationMs;
    this.clearTelegraph();
    this.currentAttack = null;

    if (this.scene) {
      floatText(this.scene, this.x, this.y - 70, this.phaseState.transitionNotice, '#ff9800');
      if (this.scene.cameras?.main) {
        if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(250, 0.007);
      }
    }

    this.onPhaseChange?.(this, this.phaseState);
  }

  private completePhaseTransition(): void {
    this.state = 'idle';
    this.readyAt = (this.scene?.time.now ?? 0) + 500;

    for (const mech of this.definition.uniqueMechanics) {
      if (mech.id === 'stone_shield' && this.phaseIndex >= 1) {
        this.addShield(mech.value);
      }
    }
  }

  private moveToward(targetX: number, targetY: number, speed: number, delta: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1) return;

    const travel = Math.min(dist, (speed * delta) / 1000);
    this.simX += (dx / dist) * travel;
    this.simY += (dy / dist) * travel;

    this.simX = clamp(this.simX, 40, 920);
    this.simY = clamp(this.simY, 80, 500);

    this.setPosition(this.simX, this.simY);

  }

  private syncPose(restart = false): void {
    if (!this.sprite) return;
    const pose = this.state === 'dead' ? 'death' : this.state === 'chasing' ? 'walk' :
      this.state === 'staggered' ? 'hit' :
      this.state === 'transitioning' ? 'transition' :
      this.state === 'windup' || this.state === 'channeling' ? 'windup' :
      this.state === 'attacking' || this.state === 'recovering' ? 'attack' : 'idle';
    if ((pose === 'idle' || pose === 'walk') && this.visualPose.startsWith(this.spriteName + '_hit_') && this.sprite.anims.isPlaying) return;
    this.playPose(pose, restart);
  }

  private playPose(pose: string, restart = false): void {
    if (!this.sprite) return;
    const sheet = SPRITE_MANIFEST[this.spriteName];
    const state = sheet.poses[pose] ? pose : 'attack';
    const direction = this.activeTelegraphState;
    const key = this.spriteName + '_' + state + '_' + facingDirection(direction?.directionX ?? this.facingX, direction?.directionY ?? this.facingY);
    if (key === this.visualPose && !restart) return;
    this.visualPose = key;
    this.sprite.setFlipX(false).play(key, !restart);
  }

  private renderTelegraph(time: number): void {
    if (!this.telegraphGfx || !this.activeTelegraphState) return;
    const t = this.activeTelegraphState;
    const progress = Math.min(1, Math.max(0, (time - t.startAt) / t.duration));
    const tg = t.attack.telegraph;
    const color = tg.color ?? 0xff3d00;
    const alpha = (tg.alpha ?? 0.4) * (0.6 + progress * 0.4);

    this.telegraphGfx.clear();
    this.telegraphGfx.lineStyle(2.5, color, 0.9);
    this.telegraphGfx.fillStyle(color, alpha);

    switch (tg.shape) {
      case 'circle': {
        const r = tg.radius ?? t.attack.range;
        this.telegraphGfx.fillCircle(t.originX, t.originY, r * progress);
        this.telegraphGfx.strokeCircle(t.originX, t.originY, r);
        break;
      }
      case 'cone': {
        const r = tg.radius ?? t.attack.range;
        const angle = Math.atan2(t.directionY, t.directionX);
        const spread = ((tg.angleDeg ?? 90) * Math.PI) / 360;
        this.telegraphGfx.beginPath();
        this.telegraphGfx.moveTo(t.originX, t.originY);
        this.telegraphGfx.arc(
          t.originX,
          t.originY,
          r * (0.3 + progress * 0.7),
          angle - spread,
          angle + spread,
          false,
        );
        this.telegraphGfx.closePath();
        this.telegraphGfx.fillPath();
        this.telegraphGfx.strokePath();
        break;
      }
      case 'line':
      case 'rect': {
        const length = (tg.length ?? t.attack.range) * progress;
        const halfWidth = (tg.width ?? 40) / 2;
        const perpX = -t.directionY * halfWidth;
        const perpY = t.directionX * halfWidth;
        const endX = t.originX + t.directionX * length;
        const endY = t.originY + t.directionY * length;

        this.telegraphGfx.beginPath();
        this.telegraphGfx.moveTo(t.originX + perpX, t.originY + perpY);
        this.telegraphGfx.lineTo(endX + perpX, endY + perpY);
        this.telegraphGfx.lineTo(endX - perpX, endY - perpY);
        this.telegraphGfx.lineTo(t.originX - perpX, t.originY - perpY);
        this.telegraphGfx.closePath();
        this.telegraphGfx.fillPath();
        this.telegraphGfx.strokePath();
        break;
      }
      case 'ring': {
        const r = (tg.radius ?? t.attack.range) * progress;
        this.telegraphGfx.strokeCircle(t.originX, t.originY, r);
        this.telegraphGfx.lineStyle(6, color, alpha);
        this.telegraphGfx.strokeCircle(t.originX, t.originY, Math.max(10, r * 0.75));
        break;
      }
    }
  }

  private clearTelegraph(): void {
    this.activeTelegraphState = null;
    if (this.telegraphGfx) {
      this.telegraphGfx.clear();
    }
  }

  private getMechanicValue(id: string, fallback: number): number {
    const m = this.definition.uniqueMechanics.find((mech) => mech.id === id);
    return m ? m.value : fallback;
  }

  // ==========================================
  // Visuals and Rendering Setup
  // ==========================================

  private setupVisuals(scene: Phaser.Scene, def: BossDefinition): void {
    const shadow = scene.add.ellipse(0, def.radius * 0.9, def.radius * 2.3, 16, 0x112b26, 0.65);
    this.view.add(shadow);

    this.telegraphGfx = scene.add.graphics().setDepth(25);

    const spriteKey = SPRITE_KEYS[this.spriteName];
    if (scene.textures.exists(spriteKey)) {
      this.sprite = scene.add.sprite(0, -10, spriteKey, 0);
      this.syncPose();
      this.view.add(this.sprite);
    } else {
      this.bossAuraGfx = this.createProceduralBossArt(scene, def);
      this.view.add(this.bossAuraGfx);
    }

    this.nameLabel = createLabel(
      scene,
      0,
      -def.radius - 28,
      `${def.name}`,
      13,
      '#fff5d2',
      'center',
    );
    this.view.add(this.nameLabel);

    const barWidth = def.radius * 2.4;
    const bg = scene.add.rectangle(0, def.radius + 18, barWidth, 7, 0x222624);
    this.hpFill = scene
      .add.rectangle(-barWidth / 2, def.radius + 18, barWidth, 5, 0xff7043)
      .setOrigin(0, 0.5);
    this.shieldFill = scene
      .add.rectangle(-barWidth / 2, def.radius + 24, barWidth, 3, 0xffd54f)
      .setOrigin(0, 0.5)
      .setVisible(false);

    this.view.add([bg, this.hpFill, this.shieldFill]);
  }

  private createProceduralBossArt(
    scene: Phaser.Scene,
    def: BossDefinition,
  ): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    const r = def.radius;

    switch (def.id) {
      case 'thuong-luong': {
        g.fillStyle(0x006064, 0.95);
        g.fillCircle(0, 0, r);
        g.fillStyle(0x00bcd4, 0.85);
        g.fillCircle(0, -6, r * 0.7);
        g.lineStyle(4, 0x80deea, 0.9);
        g.strokeCircle(0, 0, r);
        g.lineBetween(-r * 0.5, -r * 0.3, -r * 1.1, -r * 0.6);
        g.lineBetween(r * 0.5, -r * 0.3, r * 1.1, -r * 0.6);
        break;
      }
      case 'thach-tuong': {
        g.fillStyle(0x4e342e, 0.95);
        g.fillRoundedRect(-r, -r * 0.9, r * 2, r * 1.8, 12);
        g.lineStyle(5, 0x8d6e63, 0.95);
        g.strokeRoundedRect(-r, -r * 0.9, r * 2, r * 1.8, 12);
        g.fillStyle(0xffd54f, 0.9);
        g.fillTriangle(0, -r * 0.4, -r * 0.4, r * 0.3, r * 0.4, r * 0.3);
        break;
      }
      case 'hac-an': {
        g.fillStyle(0x212121, 0.98);
        g.fillCircle(0, 0, r);
        g.lineStyle(4, 0xd500f9, 0.9);
        g.strokeCircle(0, 0, r);
        g.fillStyle(0x9c27b0, 0.7);
        g.fillCircle(0, 0, r * 0.5);
        for (let i = 0; i < 4; i++) {
          const ang = (i * Math.PI) / 2;
          g.fillStyle(0xe040fb, 0.9);
          g.fillCircle(Math.cos(ang) * (r * 0.85), Math.sin(ang) * (r * 0.85), 5);
        }
        break;
      }
      default: {
        g.fillStyle(def.color, 0.95);
        g.fillCircle(0, 0, r);
        g.lineStyle(3, 0xffa000, 0.95);
        g.strokeCircle(0, 0, r);
        break;
      }
    }
    return g;
  }

  private refreshBars(): void {
    if (this.hpFill) {
      this.hpFill.setScale(Math.max(0, this.healthFraction), 1);
    }
    if (this.shieldFill) {
      if (this.shield > 0 && this.maxShield > 0) {
        this.shieldFill.setVisible(true);
        this.shieldFill.setScale(Math.min(1, this.shield / this.maxShield), 1);
      } else {
        this.shieldFill.setVisible(false);
      }
    }
  }

  private applyHitFeedback(knockX: number, knockY: number): void {
    if (this.state === 'idle' || this.state === 'chasing') this.playPose('hit');
    if (!this.scene) return;
    this.simX = clamp(this.simX + knockX * 0.4, 40, 920);
    this.simY = clamp(this.simY + knockY * 0.4, 80, 500);
    this.setPosition(this.simX, this.simY);

    if (this.scene.tweens) {
      this.scene.tweens.add({
        targets: this.view,
        alpha: 0.5,
        duration: 65,
        yoyo: true,
        onComplete: () => {
          if (this.alive) this.view.setAlpha(1);
        },
      });
    }
  }

  private playDeathVisuals(): void {
    this.syncPose();
    if (!this.scene) return;
    if (this.scene.cameras?.main) {
      if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(300, 0.008);
    }
    floatText(this.scene, this.x, this.y - 70, `${this.definition.name} ĐÃ BỊ TIÊU DIỆT!`, '#ffe082');
    const death = SPRITE_MANIFEST[this.spriteName].poses.death;

    if (this.scene.tweens) {
      this.scene.tweens.add({
        targets: this.view,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        delay: this.sprite ? death.count * 1000 / death.frameRate : 0,
        duration: this.sprite ? 250 : 500,
        onComplete: () => {
          this.destroy();
        },
      });
    } else {
      this.destroy();
    }
  }
}
