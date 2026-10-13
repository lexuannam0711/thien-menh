import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { gameState } from './GameState';
import { BossSystem } from './BossSystem';
import { audioManager } from '../audio/AudioManager';
import { graphicsSettings } from '../rendering/GraphicsSettings';
import type { SkillDefinition } from '../../data/skills';
import { skillHitsTarget } from './SkillCombat';
import {
  calculateWeaponDamage,
  calculateWeaponKnockback,
  getEquippedWeaponOrDefault,
  type WeaponDefinition,
} from '../../data/weapons';

export class CombatSystem {
  constructor(private scene: Phaser.Scene, private enemies: () => Enemy[], private bossSystem?: BossSystem) {}

  basic(player: Player, combo: number, dir: Phaser.Math.Vector2): void {
    const s = gameState.data;
    const weaponId = s.rpg?.equipment?.slots?.weapon;
    const weapon = getEquippedWeaponOrDefault(weaponId, s.level);
    const comboIndex = Math.max(0, combo - 1);
    const isCritical = Math.random() < weapon.criticalChance;
    const base = calculateWeaponDamage(weapon, comboIndex, s.attack, isCritical);
    const reach = weapon.range;
    const knockback = calculateWeaponKnockback(weapon, comboIndex);

    this.slashEffect(player.x, player.y, dir, combo, weapon);
    audioManager.playCue('sword_slash', { pitchMultiplier: 1 + combo * 0.04 });
    let hit = 0;
    for (const enemy of this.enemies()) {
      if (!enemy.isAlive) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const distance = Math.hypot(dx, dy);
      const dot = distance ? (dx * dir.x + dy * dir.y) / distance : 1;
      if (distance <= reach + enemy.radius && dot >= (combo === 3 ? -0.12 : 0.19)) {
        enemy.damage(base, dir.x * knockback, dir.y * knockback);
        hit++;
      }
    }
    const boss = this.bossSystem?.boss;
    if (boss?.isAlive) {
      const dx = boss.x - player.x;
      const dy = boss.y - player.y;
      const distance = Math.hypot(dx, dy);
      const dot = distance ? (dx * dir.x + dy * dir.y) / distance : 1;
      if (distance <= reach + boss.radius && dot >= (combo === 3 ? -0.12 : 0.19)) {
        this.bossSystem?.damageBoss(base, dir.x * knockback, dir.y * knockback);
        hit++;
      }
    }
    if (hit) {
      audioManager.playCue('hit_impact', { volume: 0.75, priority: 1 });
      const shakeIntensity = combo === 3 ? (weapon.knockback >= 30 ? 0.004 : 0.003) : 0.0015;
      if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(combo === 3 ? 80 : 50, shakeIntensity);
    }
  }

  skill(player: Player, skill: SkillDefinition, damage: number, direction: Phaser.Math.Vector2): void {
    this.skillEffect(player.x, player.y, skill, direction);
    audioManager.playCue(skill.element === 'flame' ? 'skill_flame' : 'skill_earth', { priority: 2 });
    if (damage <= 0) return;
    for (const enemy of this.enemies()) {
      if (!enemy.isAlive || !skillHitsTarget(skill, player, direction, enemy)) continue;
      const offsetX = enemy.x - player.x;
      const offsetY = enemy.y - player.y;
      const length = Math.max(1, Math.hypot(offsetX, offsetY));
      enemy.damage(damage, offsetX / length * (skill.effect.knockback ?? 0), offsetY / length * (skill.effect.knockback ?? 0));
      enemy.applyStatus(skill.effect.statusEffect, skill.effect.statusDurationMs ?? 0, damage);
    }
    const boss = this.bossSystem?.boss;
    if (boss?.isAlive && skillHitsTarget(skill, player, direction, boss)) {
      this.bossSystem?.damageBoss(damage, direction.x * (skill.effect.knockback ?? 0), direction.y * (skill.effect.knockback ?? 0));
    }
    if (graphicsSettings.getBudget().cameraShake) this.scene.cameras.main.shake(100, 0.003);
  }

  private slashEffect(x: number, y: number, dir: Phaser.Math.Vector2, combo: number, weapon?: WeaponDefinition): void {
    const g = this.scene.add.graphics().setPosition(x, y).setDepth(900);
    const centerAngle = Math.atan2(dir.y, dir.x);
    const spread = combo === 3 ? 1.45 : 1.12;
    const start = centerAngle - spread;
    const end = centerAngle + spread;
    const reach = weapon?.range ?? 92;
    const heavy = combo === 3;
    const width = heavy ? 18 : 12;
    const color = weapon?.weaponType === 'axe' ? 0xc87939 : weapon?.weaponType === 'spear' ? 0xd9ad61 : 0xd4b887;
    this.meleeFootprint(g, centerAngle, reach, combo, color);
    g.lineStyle(width, color, 0.55);
    if (weapon?.weaponType === 'spear') {
      const sideX = -Math.sin(centerAngle) * (heavy ? 7 : 4);
      const sideY = Math.cos(centerAngle) * (heavy ? 7 : 4);
      const baseX = Math.cos(centerAngle) * reach * 0.65;
      const baseY = Math.sin(centerAngle) * reach * 0.65;
      g.lineStyle(heavy ? 9 : 5, color, 0.8);
      g.lineBetween(0, 0, baseX, baseY);
      g.fillStyle(0xffeed0, 0.95);
      g.fillTriangle(baseX + sideX, baseY + sideY, Math.cos(centerAngle) * reach,
        Math.sin(centerAngle) * reach, baseX - sideX, baseY - sideY);
    } else {
      const radius = reach - width / 2;
      g.beginPath();
      g.arc(0, 0, radius, start, end, false);
      g.strokePath();
      g.lineStyle(heavy ? 6 : 4, 0xffeed0, 0.95);
      g.beginPath();
      g.arc(0, 0, reach - 3, start, end, false);
      g.strokePath();
      if (weapon?.weaponType === 'axe') {
        g.fillStyle(color, 0.55);
        g.beginPath();
        g.arc(0, 0, reach - 3, centerAngle - 0.65, end, false);
        g.arc(0, 0, reach * 0.52, end, centerAngle - 0.65, true);
        g.closePath();
        g.fillPath();
      }
    }
    this.effectSparks(x + Math.cos(centerAngle) * reach, y + Math.sin(centerAngle) * reach, color);
    this.finishEffect(g, 185);
  }

  private meleeFootprint(g: Phaser.GameObjects.Graphics, angle: number, reach: number, combo: number, color: number): void {
    const spread = Math.acos(combo === 3 ? -0.12 : 0.19);
    g.lineStyle(1, color, 0.25);
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, reach, angle - spread, angle + spread, false);
    g.closePath();
    g.strokePath();
  }

  private skillEffect(x: number, y: number, skill: SkillDefinition, direction: Phaser.Math.Vector2): void {
    const color = skill.element === 'water' ? 0x7ccbdc : skill.element === 'flame' ? 0xffa04e
      : skill.element === 'earth' ? 0xd4af37 : 0xe8dcc3;
    const g = this.scene.add.graphics().setPosition(x, y).setDepth(850);
    g.lineStyle(3, color, 0.9);
    g.fillStyle(color, 0.3);
    if (skill.targetType === 'area') this.skillAreaEffect(g, skill);
    else if (skill.targetType === 'directional') this.skillDirectionalEffect(g, skill, direction, color);
    else this.skillSelfEffect(g, skill);
    this.effectSparks(x, y, color);
    this.finishEffect(g, skill.targetType === 'self' ? 600 : 420);
  }

  private skillAreaEffect(g: Phaser.GameObjects.Graphics, skill: SkillDefinition): void {
    const radius = skill.effect.radius ?? 32;
    g.strokeCircle(0, 0, radius);
    if (skill.element === 'earth') {
      g.strokeCircle(0, 0, radius * 0.72);
      for (let index = 0; index < 12; index++) {
        const angle = index * Math.PI / 6;
        g.fillTriangle(Math.cos(angle - 0.16) * 9, Math.sin(angle - 0.16) * 9,
          Math.cos(angle) * 30, Math.sin(angle) * 30,
          Math.cos(angle + 0.16) * 9, Math.sin(angle + 0.16) * 9);
        g.beginPath();
        g.moveTo(Math.cos(angle) * radius * 0.4, Math.sin(angle) * radius * 0.4);
        g.lineTo(Math.cos(angle + 0.08) * radius * 0.65, Math.sin(angle + 0.08) * radius * 0.65);
        g.lineTo(Math.cos(angle) * (radius - 2), Math.sin(angle) * (radius - 2));
        g.strokePath();
      }
    } else if (skill.element === 'flame') {
      g.fillCircle(0, 0, 18);
      for (let index = 0; index < 12; index++) {
        const angle = index * Math.PI / 6;
        g.fillTriangle(Math.cos(angle - 0.12) * radius * 0.3, Math.sin(angle - 0.12) * radius * 0.3,
          Math.cos(angle) * (radius - 2), Math.sin(angle) * (radius - 2),
          Math.cos(angle + 0.12) * radius * 0.3, Math.sin(angle + 0.12) * radius * 0.3);
      }
    } else if (skill.element === 'water') {
      g.beginPath();
      for (let index = 0; index <= 48; index++) {
        const angle = index * Math.PI / 12;
        const distance = radius * (0.12 + index / 48 * 0.82);
        if (index === 0) g.moveTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
        else g.lineTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
      }
      g.strokePath();
    } else {
      for (let index = 0; index < 3; index++) {
        g.beginPath();
        g.arc(0, 0, radius * (0.45 + index * 0.24), index * 2.1, index * 2.1 + 4.3, false);
        g.strokePath();
      }
    }
  }

  private skillDirectionalEffect(g: Phaser.GameObjects.Graphics, skill: SkillDefinition, direction: Phaser.Math.Vector2, color: number): void {
    const range = skill.effect.range ?? 100;
    g.setRotation(Math.atan2(direction.y, direction.x));
    g.lineStyle(1, color, 0.3);
    g.strokeRect(0, -32, range, 64);
    g.lineStyle(2, color, 0.75);
    g.lineBetween(0, 0, range, 0);
    g.strokeCircle(range, 0, 3);
    if (skill.id === 'mountain-cleave') {
      g.beginPath();
      g.moveTo(0, 0);
      for (let index = 1; index <= 8; index++) g.lineTo(range * index / 8, index === 8 ? 0 : (index % 2 ? -8 : 8));
      g.strokePath();
    } else if (skill.id === 'flame-beam') {
      g.fillTriangle(0, -12, range, 0, 0, 12);
      g.fillStyle(0xffdf88, 0.8);
      g.fillTriangle(range * 0.2, -4, range, 0, range * 0.2, 4);
    } else if (skill.id === 'blazing-dash') {
      for (let index = 0; index < 5; index++) {
        const distance = range * index / 5;
        g.fillTriangle(distance, -8, distance + range / 5, 0, distance, 8);
      }
    } else if (skill.id === 'tidal-surge') {
      for (let index = 1; index <= 3; index++) {
        g.beginPath();
        g.arc(range * index / 4, 0, 18, -Math.PI / 2, Math.PI / 2, false);
        g.strokePath();
      }
    } else if (skill.id === 'spear-thrust') {
      g.lineStyle(6, color, 0.75);
      g.lineBetween(0, 0, range * 0.75, 0);
      g.fillTriangle(range * 0.7, -7, range, 0, range * 0.7, 7);
    } else if (skill.id === 'lac-blade-dance') {
      for (let index = 0; index < 3; index++) {
        g.beginPath();
        g.arc(range * (0.2 + index * 0.22), 0, range * 0.25, -1.2, 1.2, false);
        g.strokePath();
      }
    }
  }

  private skillSelfEffect(g: Phaser.GameObjects.Graphics, skill: SkillDefinition): void {
    if (skill.id === 'stone-armor') {
      g.strokeCircle(0, 0, 30);
      for (let index = 0; index < 6; index++) {
        const angle = index * Math.PI / 3;
        g.fillRect(Math.cos(angle) * 23 - 5, Math.sin(angle) * 23 - 7, 10, 14);
      }
    } else {
      g.strokeCircle(0, 0, 32);
      g.strokeCircle(0, 0, 22);
      g.lineStyle(4, 0xb9f5e1, 0.95);
      g.lineBetween(-8, 0, 8, 0);
      g.lineBetween(0, -8, 0, 8);
    }
  }

  private effectSparks(x: number, y: number, color: number): void {
    for (let index = 0; index < graphicsSettings.getBudget().combatSparks; index++) {
      const angle = index * 2.4;
      const spark = this.scene.add.rectangle(x, y, 3, 2, color, 0.8).setDepth(901);
      this.scene.tweens.add({ targets: spark, x: x + Math.cos(angle) * (12 + index * 2),
        y: y + Math.sin(angle) * (12 + index * 2), alpha: 0, duration: 160 });
      this.finishEffect(spark, 160, false);
    }
  }

  private finishEffect(effect: Phaser.GameObjects.Graphics | Phaser.GameObjects.Rectangle, duration: number, fade = true): void {
    let timer: Phaser.Time.TimerEvent | undefined;
    const dispose = () => {
      this.scene.events?.off('shutdown', dispose);
      timer?.remove(false);
      this.scene.tweens.killTweensOf?.(effect);
      effect.destroy();
    };
    this.scene.events?.once('shutdown', dispose);
    if (this.scene.time) timer = this.scene.time.delayedCall(duration, dispose);
    if (fade && graphicsSettings.getBudget().combatSparks > 0) {
      this.scene.tweens.add({ targets: effect, alpha: 0, duration, onComplete: dispose });
    }
  }
}
