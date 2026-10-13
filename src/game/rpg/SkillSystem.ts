import {
  getDivinePower,
  getSkill,
  type DivinePowerId,
  type SkillCost,
  type SkillDefinition,
} from '../../data/skills';
import { getWeapon } from '../../data/weapons';

export type SkillSlot = 'slot-1' | 'slot-2' | 'slot-3' | 'slot-4';

export const ALL_SKILL_SLOTS: readonly SkillSlot[] = [
  'slot-1',
  'slot-2',
  'slot-3',
  'slot-4',
];

export interface SkillProgress {
  readonly unlockedSkillIds: readonly string[];
  readonly equippedSlots: Readonly<Partial<Record<SkillSlot, string>>>;
  readonly cooldownUntil: Readonly<Record<string, number>>;
  readonly activeDivinePower?: DivinePowerId;
  readonly unlockedDivinePowers: readonly DivinePowerId[];
}

export interface CasterSnapshot {
  readonly level: number;
  readonly hp: number;
  readonly mp: number;
  readonly maxHp: number;
  readonly maxMp: number;
  readonly attack: number;
  readonly gold: number;
  readonly equippedWeaponId?: string;
}

export type SkillUnlockFailureReason =
  | 'already_unlocked'
  | 'unknown_skill'
  | 'insufficient_level'
  | 'insufficient_gold';

export interface SkillUnlockResult {
  readonly success: boolean;
  readonly progress: SkillProgress;
  readonly caster: CasterSnapshot;
  readonly skill?: SkillDefinition;
  readonly reason?: SkillUnlockFailureReason;
}

export type SkillCastFailureReason =
  | 'unknown_skill'
  | 'not_unlocked'
  | 'insufficient_mp'
  | 'insufficient_hp'
  | 'on_cooldown'
  | 'weapon_mismatch'
  | 'level_too_low';

export interface SkillCastCheck {
  readonly canCast: boolean;
  readonly reason?: SkillCastFailureReason;
  readonly remainingCooldownMs?: number;
}

export interface SkillCastResult {
  readonly success: boolean;
  readonly progress: SkillProgress;
  readonly caster: CasterSnapshot;
  readonly skill?: SkillDefinition;
  readonly damageDealt?: number;
  readonly healedHp?: number;
  readonly healedMp?: number;
  readonly cooldownExpiresAt?: number;
  readonly reason?: SkillCastFailureReason;
}

export function createInitialSkillProgress(
  initialUnlocked: readonly string[] = ['earth-shockwave', 'flame-beam', 'tidal-surge'],
  initialDivine: DivinePowerId = 'earth',
): SkillProgress {
  return {
    unlockedSkillIds: [...initialUnlocked],
    equippedSlots: {
      'slot-1': initialUnlocked[0],
      'slot-2': initialUnlocked[1],
      'slot-3': initialUnlocked[2],
    },
    cooldownUntil: {},
    activeDivinePower: initialDivine,
    unlockedDivinePowers: [initialDivine],
  };
}

export function isSkillUnlocked(progress: SkillProgress, skillId: string): boolean {
  return progress.unlockedSkillIds.includes(skillId);
}

export function canUnlockSkill(
  progress: SkillProgress,
  caster: CasterSnapshot,
  skillId: string,
): { canUnlock: boolean; reason?: SkillUnlockFailureReason } {
  const skill = getSkill(skillId);
  if (!skill) return { canUnlock: false, reason: 'unknown_skill' };
  if (isSkillUnlocked(progress, skillId)) return { canUnlock: false, reason: 'already_unlocked' };
  if (caster.level < skill.requiredLevel) return { canUnlock: false, reason: 'insufficient_level' };
  if (caster.gold < skill.unlockCostGold) return { canUnlock: false, reason: 'insufficient_gold' };
  return { canUnlock: true };
}

export function unlockSkill(
  progress: SkillProgress,
  caster: CasterSnapshot,
  skillId: string,
): SkillUnlockResult {
  const check = canUnlockSkill(progress, caster, skillId);
  if (!check.canUnlock) {
    return {
      success: false,
      progress,
      caster,
      reason: check.reason,
    };
  }

  const skill = getSkill(skillId)!;
  const nextUnlocked = [...progress.unlockedSkillIds, skillId];
  const nextGold = Math.max(0, caster.gold - skill.unlockCostGold);

  return {
    success: true,
    progress: {
      ...progress,
      unlockedSkillIds: nextUnlocked,
    },
    caster: {
      ...caster,
      gold: nextGold,
    },
    skill,
  };
}

export function equipSkill(
  progress: SkillProgress,
  slot: SkillSlot,
  skillId: string,
): { success: boolean; progress: SkillProgress; reason?: 'unknown_skill' | 'not_unlocked' } {
  const skill = getSkill(skillId);
  if (!skill) {
    return { success: false, progress, reason: 'unknown_skill' };
  }
  if (!isSkillUnlocked(progress, skillId)) {
    return { success: false, progress, reason: 'not_unlocked' };
  }

  const nextSlots = { ...progress.equippedSlots, [slot]: skillId };
  return {
    success: true,
    progress: {
      ...progress,
      equippedSlots: nextSlots,
    },
  };
}

export function unequipSkill(progress: SkillProgress, slot: SkillSlot): SkillProgress {
  if (!progress.equippedSlots[slot]) return progress;
  const nextSlots = { ...progress.equippedSlots };
  delete nextSlots[slot];
  return {
    ...progress,
    equippedSlots: nextSlots,
  };
}

export function getEquippedSkill(
  progress: SkillProgress,
  slot: SkillSlot,
): SkillDefinition | undefined {
  const skillId = progress.equippedSlots[slot];
  return skillId ? getSkill(skillId) : undefined;
}

export function setActiveDivinePower(
  progress: SkillProgress,
  powerId: DivinePowerId,
): SkillProgress {
  const power = getDivinePower(powerId);
  if (!power) return progress;
  const unlocked = progress.unlockedDivinePowers.includes(powerId)
    ? progress.unlockedDivinePowers
    : [...progress.unlockedDivinePowers, powerId];
  return {
    ...progress,
    activeDivinePower: powerId,
    unlockedDivinePowers: unlocked,
  };
}

export function unlockDivinePower(
  progress: SkillProgress,
  powerId: DivinePowerId,
): SkillProgress {
  const power = getDivinePower(powerId);
  if (!power || progress.unlockedDivinePowers.includes(powerId)) return progress;
  return {
    ...progress,
    unlockedDivinePowers: [...progress.unlockedDivinePowers, powerId],
  };
}

export function getRemainingCooldown(
  progress: SkillProgress,
  skillId: string,
  nowMs: number,
): number {
  const expiry = progress.cooldownUntil[skillId] ?? 0;
  return Math.max(0, expiry - nowMs);
}

export function calculateEffectiveCooldown(
  skill: SkillDefinition,
  progress: SkillProgress,
): number {
  let reductionPercent = 0;
  if (progress.activeDivinePower) {
    const divinePower = getDivinePower(progress.activeDivinePower);
    if (divinePower?.passiveBonus.cooldownReductionPercent) {
      reductionPercent += divinePower.passiveBonus.cooldownReductionPercent;
    }
  }
  const factor = Math.max(0.1, 1 - reductionPercent / 100);
  return Math.round(skill.cooldownMs * factor);
}

export function calculateEffectiveSkillCost(
  skill: SkillDefinition,
  _progress?: SkillProgress,
): SkillCost {
  return {
    mp: Math.max(0, skill.cost.mp),
    hp: skill.cost.hp ? Math.max(0, skill.cost.hp) : undefined,
  };
}

export function validateSkillCast(
  progress: SkillProgress,
  caster: CasterSnapshot,
  skillId: string,
  nowMs: number,
): SkillCastCheck {
  const skill = getSkill(skillId);
  if (!skill) return { canCast: false, reason: 'unknown_skill' };
  if (!isSkillUnlocked(progress, skillId)) return { canCast: false, reason: 'not_unlocked' };
  if (caster.level < skill.requiredLevel) return { canCast: false, reason: 'level_too_low' };

  if (skill.requiredWeaponType) {
    const weapon = caster.equippedWeaponId ? getWeapon(caster.equippedWeaponId) : undefined;
    if (!weapon || caster.level < weapon.requiredLevel || weapon.weaponType !== skill.requiredWeaponType) {
      return { canCast: false, reason: 'weapon_mismatch' };
    }
  }

  const remaining = getRemainingCooldown(progress, skillId, nowMs);
  if (remaining > 0) {
    return { canCast: false, reason: 'on_cooldown', remainingCooldownMs: remaining };
  }

  const cost = calculateEffectiveSkillCost(skill, progress);
  if (caster.mp < cost.mp) {
    return { canCast: false, reason: 'insufficient_mp' };
  }
  if (cost.hp && caster.hp <= cost.hp) {
    return { canCast: false, reason: 'insufficient_hp' };
  }

  return { canCast: true };
}

export function calculateSkillDamage(
  skill: SkillDefinition,
  caster: CasterSnapshot,
  progress?: SkillProgress,
): number {
  if (!skill.effect.baseDamageMultiplier && !skill.effect.flatDamage) {
    return 0;
  }

  let effectiveAttack = caster.attack;
  const equippedWeapon = caster.equippedWeaponId ? getWeapon(caster.equippedWeaponId) : undefined;
  if (equippedWeapon && caster.level >= equippedWeapon.requiredLevel) {
    effectiveAttack += equippedWeapon.baseAttack + (equippedWeapon.stats.attack ?? 0);
  }

  let multiplier = skill.effect.baseDamageMultiplier ?? 1.0;

  // Divine passive synergy bonus
  if (progress?.activeDivinePower) {
    const divinePower = getDivinePower(progress.activeDivinePower);
    if (divinePower?.passiveBonus.attackPercent) {
      multiplier *= 1 + divinePower.passiveBonus.attackPercent / 100;
    }
    // Matching elemental synergy
    if (progress.activeDivinePower === skill.element) {
      multiplier *= 1.15; // 15% resonance bonus
    }
  }

  const rawDamage = effectiveAttack * multiplier + (skill.effect.flatDamage ?? 0);
  return Math.round(Math.max(1, rawDamage));
}

export function calculateSkillHeal(
  skill: SkillDefinition,
  _caster: CasterSnapshot,
): { hp: number; mp: number } {
  return {
    hp: skill.effect.healHp ?? 0,
    mp: skill.effect.healMp ?? 0,
  };
}

export function castSkill(
  progress: SkillProgress,
  caster: CasterSnapshot,
  skillId: string,
  nowMs: number,
): SkillCastResult {
  const check = validateSkillCast(progress, caster, skillId, nowMs);
  if (!check.canCast) {
    return {
      success: false,
      progress,
      caster,
      reason: check.reason,
    };
  }

  const skill = getSkill(skillId)!;
  const cost = calculateEffectiveSkillCost(skill, progress);
  const cooldownDuration = calculateEffectiveCooldown(skill, progress);
  const cooldownExpiresAt = nowMs + cooldownDuration;

  const nextCooldowns = {
    ...progress.cooldownUntil,
    [skillId]: cooldownExpiresAt,
  };

  const heal = calculateSkillHeal(skill, caster);
  const nextHp = Math.min(
    caster.maxHp,
    Math.max(0, caster.hp - (cost.hp ?? 0) + heal.hp),
  );
  const nextMp = Math.min(
    caster.maxMp,
    Math.max(0, caster.mp - cost.mp + heal.mp),
  );

  const damageDealt = calculateSkillDamage(skill, caster, progress);

  return {
    success: true,
    progress: {
      ...progress,
      cooldownUntil: nextCooldowns,
    },
    caster: {
      ...caster,
      hp: nextHp,
      mp: nextMp,
    },
    skill,
    damageDealt: damageDealt > 0 ? damageDealt : undefined,
    healedHp: heal.hp > 0 ? heal.hp : undefined,
    healedMp: heal.mp > 0 ? heal.mp : undefined,
    cooldownExpiresAt,
  };
}

export function clearExpiredCooldowns(progress: SkillProgress, nowMs: number): SkillProgress {
  let hasExpired = false;
  const nextCooldowns: Record<string, number> = {};

  for (const [skillId, expiry] of Object.entries(progress.cooldownUntil)) {
    if (expiry > nowMs) {
      nextCooldowns[skillId] = expiry;
    } else {
      hasExpired = true;
    }
  }

  if (!hasExpired) return progress;
  return {
    ...progress,
    cooldownUntil: nextCooldowns,
  };
}

export function resetAllCooldowns(progress: SkillProgress): SkillProgress {
  if (Object.keys(progress.cooldownUntil).length === 0) return progress;
  return {
    ...progress,
    cooldownUntil: {},
  };
}
