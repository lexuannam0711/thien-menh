import type Phaser from 'phaser';
import {
  BossDefinition,
  BossId,
  BossPhaseDefinition,
  BossReward,
} from '../../data/bosses';
import { Boss, BossCombatTarget, BossDamageResult, ProjectileSpawnCallback } from '../entities/Boss';
import { audioManager } from '../audio/AudioManager';
import { graphicsSettings } from '../rendering/GraphicsSettings';

export type EncounterStatus = 'idle' | 'intro' | 'active' | 'victory' | 'failed';

export interface ProjectileLike {
  update(delta: number): void;
  destroy(): void;
  readonly isAlive: boolean;
}

export interface BossHazard {
  readonly id: string;
  readonly kind: 'whirlpool' | 'fissure' | 'void-rift';
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly damage: number;
  readonly expiresAt: number;
  readonly pullForce?: number;
  readonly pulseIntervalMs?: number;
  lastPulseAt?: number;
  gfx?: Phaser.GameObjects.Graphics | null;
}

export interface BossMinion {
  readonly id: string;
  readonly kind: string;
  x: number;
  y: number;
  readonly radius: number;
  hp: number;
  readonly maxHp: number;
  isAlive: boolean;
  readyAt: number;
  view?: Phaser.GameObjects.Container | null;
  damage(amount: number): void;
  update(time: number, delta: number, target: BossCombatTarget): void;
  destroy(): void;
}

export interface BossSystemOptions {
  readonly onDefeated?: (boss: Boss, reward: BossReward) => void;
  readonly onPhaseChange?: (boss: Boss, phase: BossPhaseDefinition) => void;
  readonly onPlayerDamaged?: (damage: number, source: string) => void;
  readonly onHazardSpawn?: (hazard: BossHazard) => void;
  readonly createProjectile?: ProjectileSpawnCallback;
}

function createLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  fontSize = 13,
  color = '#ffd574',
  align: 'left' | 'center' = 'center',
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
  color = '#ffe082',
): void {
  if (!scene || !scene.add) return;
  const t = scene.add
    .text(x, y, text, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color,
      stroke: '#10251f',
      strokeThickness: 3,
    })
    .setOrigin(0.5)
    .setDepth(2100);
  if (scene.tweens) {
    scene.tweens.add({
      targets: t,
      y: y - 32,
      alpha: 0,
      duration: 700,
      onComplete: () => t.destroy(),
    });
  }
}

export class BossSystem {
  private currentBoss: Boss | null = null;
  private status: EncounterStatus = 'idle';

  private hazards: BossHazard[] = [];
  private minions: BossMinion[] = [];
  private projectiles: ProjectileLike[] = [];

  // Boss Top HUD (Phaser scene rendering)
  private hudContainer: Phaser.GameObjects.Container | null = null;
  private hudHpFill: Phaser.GameObjects.Rectangle | null = null;
  private hudShieldFill: Phaser.GameObjects.Rectangle | null = null;
  private hudTitleText: Phaser.GameObjects.Text | null = null;
  private hudPhaseText: Phaser.GameObjects.Text | null = null;

  constructor(
    private readonly scene: Phaser.Scene | null,
    private readonly options: BossSystemOptions = {},
  ) {
    if (scene && scene.add) {
      this.setupBossHud(scene);
    }
  }

  get boss(): Boss | null {
    return this.currentBoss;
  }

  get encounterStatus(): EncounterStatus {
    return this.status;
  }

  get activeHazards(): readonly BossHazard[] {
    return this.hazards;
  }

  get activeMinions(): readonly BossMinion[] {
    return this.minions;
  }

  get activeProjectiles(): readonly ProjectileLike[] {
    return this.projectiles;
  }

  /**
   * Spawns and starts encounter with a Vietnamese mythology boss.
   */
  startEncounter(bossId: BossId, x: number, y: number): Boss {
    this.resetEncounter();

    const boss = new Boss(
      this.scene,
      bossId,
      x,
      y,
      (b) => this.handleBossDefeated(b),
      this.options.createProjectile,
      (b, phase) => this.handlePhaseChange(b, phase),
    );

    this.currentBoss = boss;
    this.status = 'active';
    audioManager.playCue('boss_roar', { priority: 3 });

    if (this.hudContainer) {
      this.hudContainer.setVisible(true);
      this.updateHud(boss);
    }

    if (this.scene) {
      floatText(this.scene, x, y - 90, `ĐỐI ĐẦU: ${boss.definition.name.toUpperCase()}!`, '#ffe082');
      if (this.scene.cameras?.main) {
        if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(200, 0.005);
      }
    }

    return boss;
  }

  /**
   * Stops and cleans up the active encounter.
   */
  resetEncounter(): void {
    if (this.currentBoss) {
      this.currentBoss.destroy();
      this.currentBoss = null;
    }

    for (const h of this.hazards) {
      if (h.gfx) h.gfx.destroy();
    }
    this.hazards = [];

    for (const m of this.minions) {
      m.destroy();
    }
    this.minions = [];

    for (const p of this.projectiles) {
      p.destroy();
    }
    this.projectiles = [];

    if (this.hudContainer) {
      this.hudContainer.setVisible(false);
    }

    this.status = 'idle';
  }

  /**
   * Routes damage directly to the active boss.
   */
  damageBoss(amount: number, knockX = 0, knockY = 0): BossDamageResult {
    if (!this.currentBoss || !this.currentBoss.isAlive) {
      return { hpDamage: 0, shieldDamage: 0, killed: false, triggeredPhaseTransition: false };
    }
    const result = this.currentBoss.damage(amount, knockX, knockY);
    this.updateHud(this.currentBoss);
    return result;
  }

  /**
   * Spawns a persistent arena hazard (whirlpool, fissure, void rift).
   */
  spawnHazard(
    kind: 'whirlpool' | 'fissure' | 'void-rift',
    x: number,
    y: number,
    radius: number,
    damage: number,
    durationMs: number,
    pullForce = 0,
  ): BossHazard {
    const now = this.scene?.time.now ?? 0;
    const expiresAt = now + durationMs;
    const id = `hazard_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    let gfx: Phaser.GameObjects.Graphics | null = null;
    if (this.scene && this.scene.add) {
      gfx = this.scene.add.graphics().setDepth(20);
    }

    const hazard: BossHazard = {
      id,
      kind,
      x,
      y,
      radius,
      damage,
      expiresAt,
      pullForce,
      pulseIntervalMs: 800,
      lastPulseAt: now,
      gfx,
    };

    this.hazards.push(hazard);
    this.options.onHazardSpawn?.(hazard);
    return hazard;
  }

  /**
   * Spawns a minion or shadow clone for unique boss mechanics.
   */
  spawnMinion(
    kind: string,
    x: number,
    y: number,
    hp: number,
    attack: number,
    radius = 24,
  ): BossMinion {
    const id = `minion_${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let view: Phaser.GameObjects.Container | null = null;

    if (this.scene && this.scene.add) {
      const circle = this.scene.add.circle(0, 0, radius, 0x4a148c, 0.7);
      circle.setStrokeStyle(2, 0xba68c8, 0.9);
      const name = createLabel(this.scene, 0, -radius - 12, 'ẢO ẢNH', 11, '#e1bee7', 'center');
      view = this.scene.add.container(x, y, [circle, name]).setDepth(30);
    }

    const minion: BossMinion = {
      id,
      kind,
      x,
      y,
      radius,
      hp,
      maxHp: hp,
      isAlive: true,
      readyAt: 0,
      view,
      damage: (amount: number) => {
        if (!minion.isAlive) return;
        minion.hp -= amount;
        if (minion.hp <= 0) {
          minion.isAlive = false;
          minion.destroy();
        }
      },
      update: (time: number, delta: number, target: BossCombatTarget) => {
        if (!minion.isAlive) return;
        const dx = target.x - minion.x;
        const dy = target.y - minion.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 35) {
          const move = Math.min(dist, (85 * delta) / 1000);
          minion.x += (dx / dist) * move;
          minion.y += (dy / dist) * move;
          if (minion.view) minion.view.setPosition(minion.x, minion.y);
        } else if (time >= minion.readyAt) {
          minion.readyAt = time + 1400;
          if (!target.isDodging && target.hit) {
            target.hit(attack);
          }
        }
      },
      destroy: () => {
        minion.isAlive = false;
        if (minion.view) {
          minion.view.destroy();
          minion.view = null;
        }
      },
    };

    this.minions.push(minion);
    return minion;
  }

  /**
   * Main system update tick: drives Boss AI, hazards, minions, projectiles, and HUD.
   */
  update(time: number, delta: number, target: BossCombatTarget): void {
    if (this.status !== 'active' || !this.currentBoss) return;

    // 1. Update Boss AI and Combat State
    this.currentBoss.update(time, delta, target);

    // 2. Handle Unique Boss Mechanic Spawns
    this.processBossMechanics(time);

    // 3. Update Minions
    for (const minion of this.minions) {
      if (minion.isAlive) {
        minion.update(time, delta, target);
      }
    }
    this.minions = this.minions.filter((m) => m.isAlive);

    // 4. Update Hazards & Apply Pull / Tick Damage
    this.updateHazards(time, delta, target);

    // 5. Update Projectiles
    for (const proj of this.projectiles) {
      proj.update(delta);
    }
    this.projectiles = this.projectiles.filter((p) => p.isAlive);

    // 6. Refresh HUD
    this.updateHud(this.currentBoss);
  }

  // ==========================================
  // Private System Processing Methods
  // ==========================================

  private processBossMechanics(time: number): void {
    const boss = this.currentBoss;
    if (!boss || !boss.isAlive) return;

    // Hổ Yêu U Minh: Shadow Clones
    const activeAtk = boss.activeAttack;
    if (activeAtk && activeAtk.kind === 'summon' && activeAtk.id.includes('shadow-clones')) {
      if (this.minions.length < (activeAtk.summonCount ?? 2)) {
        this.spawnMinion('shadow-clone', boss.x + 60, boss.y - 40, 45, 12);
        this.spawnMinion('shadow-clone', boss.x - 60, boss.y + 40, 45, 12);
      }
    }

    // Thuồng Luồng: Whirlpool Hazard
    if (activeAtk && activeAtk.id.includes('whirlpool') && this.hazards.length === 0) {
      this.spawnHazard(
        'whirlpool',
        boss.x,
        boss.y,
        170,
        12,
        activeAtk.hazardDurationMs ?? 3000,
        90,
      );
    }

    // Thạch Tướng: Fissure Cross
    if (activeAtk && activeAtk.id.includes('fissure') && this.hazards.length === 0) {
      this.spawnHazard(
        'fissure',
        boss.x,
        boss.y,
        120,
        18,
        activeAtk.hazardDurationMs ?? 2200,
      );
    }

    // Hắc Ấn: Void Rifts
    if (activeAtk && activeAtk.id.includes('rift') && this.hazards.length < 2) {
      this.spawnHazard(
        'void-rift',
        boss.x - 120,
        boss.y,
        90,
        15,
        activeAtk.hazardDurationMs ?? 3500,
      );
      this.spawnHazard(
        'void-rift',
        boss.x + 120,
        boss.y,
        90,
        15,
        activeAtk.hazardDurationMs ?? 3500,
      );
    }
  }

  private updateHazards(time: number, delta: number, target: BossCombatTarget): void {
    for (const h of this.hazards) {
      if (time >= h.expiresAt) {
        if (h.gfx) h.gfx.destroy();
        continue;
      }

      const dx = h.x - target.x;
      const dy = h.y - target.y;
      const dist = Math.hypot(dx, dy);

      if (h.gfx) {
        h.gfx.clear();
        if (h.kind === 'whirlpool') {
          h.gfx.fillStyle(0x00bcd4, 0.22);
          h.gfx.fillCircle(h.x, h.y, h.radius);
          h.gfx.lineStyle(3, 0x80deea, 0.65);
          h.gfx.strokeCircle(h.x, h.y, h.radius);
        } else if (h.kind === 'fissure') {
          h.gfx.fillStyle(0xff5722, 0.25);
          h.gfx.fillCircle(h.x, h.y, h.radius);
          h.gfx.lineStyle(3, 0xffab91, 0.7);
          h.gfx.strokeCircle(h.x, h.y, h.radius);
        } else {
          h.gfx.fillStyle(0x7c4dff, 0.22);
          h.gfx.fillCircle(h.x, h.y, h.radius);
          h.gfx.lineStyle(3, 0xb388ff, 0.7);
          h.gfx.strokeCircle(h.x, h.y, h.radius);
        }
      }

      if (h.pullForce && dist > 15 && dist <= h.radius) {
        const pullTravel = Math.min(dist, (h.pullForce * delta) / 1000);
        const mutableTarget = target as { x: number; y: number };
        if (typeof mutableTarget.x === 'number' && typeof mutableTarget.y === 'number') {
          mutableTarget.x += (dx / dist) * pullTravel;
          mutableTarget.y += (dy / dist) * pullTravel;
        }
      }

      const interval = h.pulseIntervalMs ?? 800;
      if (dist <= h.radius && time - (h.lastPulseAt ?? 0) >= interval) {
        h.lastPulseAt = time;
        if (!target.isDodging && target.hit) {
          target.hit(h.damage);
          this.options.onPlayerDamaged?.(h.damage, h.kind);
        }
      }
    }

    this.hazards = this.hazards.filter((h) => time < h.expiresAt);
  }

  private handlePhaseChange(boss: Boss, phase: BossPhaseDefinition): void {
    if (this.hudPhaseText) {
      this.hudPhaseText.setText(`[GIAI ĐOẠN ${phase.phaseIndex}] ${phase.name.toUpperCase()}`);
    }
    this.options.onPhaseChange?.(boss, phase);
  }

  private handleBossDefeated(boss: Boss): void {
    this.status = 'victory';
    audioManager.playCue('boss_impact', { priority: 3 });
    if (this.hudContainer) {
      this.hudContainer.setVisible(false);
    }
    this.options.onDefeated?.(boss, boss.definition.reward);
  }

  // ==========================================
  // Reusable Cinematic Top Boss HUD
  // ==========================================

  private setupBossHud(scene: Phaser.Scene): void {
    const screenWidth = 960;
    const centerX = screenWidth / 2;
    const topY = 94;
    const barWidth = 460;
    const barHeight = 14;

    const bgFrame = scene.add.rectangle(0, 0, barWidth + 8, barHeight + 8, 0x1b2820, 0.85);
    bgFrame.setStrokeStyle(2, 0xc9a46a, 0.95);

    const hpBg = scene.add.rectangle(0, 0, barWidth, barHeight, 0x2e1919);

    this.hudHpFill = scene
      .add.rectangle(-barWidth / 2, 0, barWidth, barHeight, 0xf26e62)
      .setOrigin(0, 0.5);

    this.hudShieldFill = scene
      .add.rectangle(-barWidth / 2, 0, 0, barHeight, 0xffd54f, 0.85)
      .setOrigin(0, 0.5)
      .setVisible(false);

    this.hudTitleText = createLabel(scene, 0, -18, 'TRÙM HUYỀN THOẠI', 14, '#ffd574', 'center');
    this.hudPhaseText = createLabel(scene, 0, 16, '[GIAI ĐOẠN 1]', 11, '#b6c4a8', 'center');

    this.hudContainer = scene.add
      .container(centerX, topY, [
        bgFrame,
        hpBg,
        this.hudHpFill,
        this.hudShieldFill,
        this.hudTitleText,
        this.hudPhaseText,
      ])
      .setDepth(2050)
      .setVisible(false);
  }

  private updateHud(boss: Boss): void {
    if (!this.hudContainer || !boss) return;

    if (this.hudTitleText) {
      this.hudTitleText.setText(boss.definition.name.toUpperCase());
    }

    if (this.hudHpFill) {
      this.hudHpFill.setScale(Math.max(0, boss.healthFraction), 1);
    }

    if (this.hudShieldFill) {
      const barWidth = 460;
      if (boss.currentShield > 0) {
        this.hudShieldFill.setVisible(true);
        const shieldRatio = Math.min(1, boss.currentShield / boss.currentMaxHp);
        this.hudShieldFill.setSize(barWidth * shieldRatio, 14);
      } else {
        this.hudShieldFill.setVisible(false);
      }
    }
  }
}
