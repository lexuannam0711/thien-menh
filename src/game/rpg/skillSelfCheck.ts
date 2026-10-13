import {
  BRONZE_SPEAR,
  BATTLE_AXE,
  LAC_SWORD,
  getWeapon,
  getWeaponsByType,
  calculateWeaponDamage,
  calculateWeaponKnockback,
  calculateWeaponAttackTiming,
  getEquippedWeaponOrDefault,
  getWeaponRecipe,
  WEAPONS,
} from '../../data/weapons';
import { getItem, getItemRecipe, ITEMS_BY_ID } from '../../data/items';
import { castEquippedSkill, skillHitsTarget } from '../systems/SkillCombat';
import {
  DIVINE_POWERS,
  getDivinePower,
  getActiveSkills,
  getSkill,
  getSkillsByDivinePower,
  getSkillsByWeaponType,
} from '../../data/skills';
import {
  createInitialSkillProgress,
  isSkillUnlocked,
  canUnlockSkill,
  unlockSkill,
  equipSkill,
  unequipSkill,
  getEquippedSkill,
  validateSkillCast,
  castSkill,
  calculateSkillDamage,
  calculateSkillHeal,
  getRemainingCooldown,
  clearExpiredCooldowns,
  setActiveDivinePower,
  type CasterSnapshot,
  type SkillProgress,
} from './SkillSystem';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Skill self-check assertion failed: ${message}`);
  }
}

export function runSkillSelfCheck(): true {
  const runtimeCaster: CasterSnapshot = { level: 10, hp: 40, mp: 100, maxHp: 100, maxMp: 100, attack: 12, gold: 100 };
  const runtimeProgress = createInitialSkillProgress(['sacred-spring', 'tidal-surge', 'sun-burst']);
  const runtimeNow = 1_791_800_000_000;
  const healing = castEquippedSkill(runtimeProgress, runtimeCaster, 'slot-1', runtimeNow);
  assert(healing.success && healing.caster.hp === 85, 'equipped healing skill restores HP');
  assert(!castEquippedSkill(healing.progress, healing.caster, 'slot-1', runtimeNow + 1).success, 'scene transition cannot bypass equipped cooldown');
  assert(castEquippedSkill(healing.progress, healing.caster, 'slot-1', runtimeNow + 10000).success, 'persisted cooldown expires on the shared clock');
  assert(!castEquippedSkill(runtimeProgress, runtimeCaster, 'slot-4', runtimeNow).success, 'empty slot cannot spend MP');
  const water = getSkill('tidal-surge')!;
  assert(skillHitsTarget(water, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 240, y: 0, radius: 10 }), 'water beam hits at range');
  assert(!skillHitsTarget(water, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -30, y: 0, radius: 10 }), 'water beam excludes targets behind caster');
  assert(!skillHitsTarget(water, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 80, y: 80, radius: 10 }), 'water beam excludes lateral targets');
  assert(skillHitsTarget(getSkill('sun-burst')!, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -100, y: 0, radius: 10 }), 'area skill hits behind caster');
  assert(!skillHitsTarget(getSkill('sacred-spring')!, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0, radius: 10 }), 'healing never hits enemies');
  // -------------------------------------------------------------
  // 1. Data-driven Weapons Verification & Prototype Pollution Guards
  // -------------------------------------------------------------
  assert(WEAPONS.length >= 3, 'At least 3 weapons defined');

  // Prototype key guards (coordinator reviewer requirement)
  assert(getItem('constructor') === undefined, 'getItem rejects constructor');
  assert(getItem('__proto__') === undefined, 'getItem rejects __proto__');
  assert(getItem('toString') === undefined, 'getItem rejects toString');
  assert(getItem('non_existent') === undefined, 'getItem returns undefined for unknown id');

  assert(getWeapon('constructor') === undefined, 'getWeapon rejects constructor');
  assert(getWeapon('__proto__') === undefined, 'getWeapon rejects __proto__');
  assert(getWeapon('toString') === undefined, 'getWeapon rejects toString');
  assert(getWeapon('non_existent') === undefined, 'getWeapon returns undefined for unknown id');

  // Item catalog exposure of 3 weapons (for shop, inventory, equipment)
  const spearItem = getItem('bronze-spear');
  const axeItem = getItem('battle-axe');
  const swordItem = getItem('lac-sword');
  assert(Boolean(spearItem && spearItem.slot === 'weapon'), 'Bronze spear exists in items catalog');
  assert(Boolean(axeItem && axeItem.slot === 'weapon'), 'Battle axe exists in items catalog');
  assert(Boolean(swordItem && swordItem.slot === 'weapon'), 'Lac sword exists in items catalog');
  assert(spearItem?.price === 60, 'Spear item price matches 60');
  assert(axeItem?.price === 85, 'Axe item price matches 85');
  assert(swordItem?.price === 110, 'Sword item price matches 110');
  assert(Boolean(ITEMS_BY_ID['battle-axe'] && ITEMS_BY_ID['lac-sword']), 'All weapons indexed in ITEMS_BY_ID');

  // Crafting recipe exposure for all 3 weapons
  assert(Boolean(getItemRecipe('bronze-spear')), 'Bronze spear has item crafting recipe');
  assert(Boolean(getItemRecipe('battle-axe')), 'Battle axe has item crafting recipe');
  assert(Boolean(getItemRecipe('lac-sword')), 'Lac sword has item crafting recipe');
  assert(Boolean(getWeaponRecipe('bronze-spear')), 'Bronze spear has weapon crafting recipe');
  assert(Boolean(getWeaponRecipe('battle-axe')), 'Battle axe has weapon crafting recipe');
  assert(Boolean(getWeaponRecipe('lac-sword')), 'Lac sword has weapon crafting recipe');

  const bronzeSpear = getWeapon('bronze-spear');
  assert(Boolean(bronzeSpear), 'Bronze spear must exist');
  assert(bronzeSpear?.weaponType === 'spear', 'Bronze spear type must be spear');
  assert((bronzeSpear?.baseAttack ?? 0) > 0, 'Bronze spear must have positive base attack');
  assert((bronzeSpear?.range ?? 0) >= 100, 'Spear should have high melee reach');
  assert(bronzeSpear?.comboSteps.length === 3, 'Spear must have 3-hit combo steps');

  const battleAxe = getWeapon('battle-axe');
  assert(Boolean(battleAxe), 'Battle axe must exist');
  assert(battleAxe?.weaponType === 'axe', 'Battle axe type must be axe');
  assert((battleAxe?.knockback ?? 0) >= 40, 'Battle axe should deliver heavy knockback');
  assert((battleAxe?.criticalMultiplier ?? 0) >= 2.0, 'Battle axe should have high crit multiplier');

  const lacSword = getWeapon('lac-sword');
  assert(Boolean(lacSword), 'Lac sword must exist');
  assert(lacSword?.weaponType === 'sword', 'Lac sword type must be sword');
  assert((lacSword?.criticalChance ?? 0) >= 0.15, 'Lac sword should feature high precision critical chance');

  assert(getWeaponsByType('spear').length >= 1, 'getWeaponsByType(spear) works');
  assert(getWeaponsByType('axe').length >= 1, 'getWeaponsByType(axe) works');
  assert(getWeaponsByType('sword').length >= 1, 'getWeaponsByType(sword) works');

  // Distinct Reach (Range): Spear (112) > Sword (95) > Axe (88)
  assert(bronzeSpear!.range > lacSword!.range, 'Spear has greater reach than sword');
  assert(lacSword!.range > battleAxe!.range, 'Sword has greater reach than axe');
  assert(bronzeSpear!.range === 112 && lacSword!.range === 95 && battleAxe!.range === 88, 'Weapon ranges match design metadata');

  // Distinct Knockback: Axe (42) > Sword (24) > Spear (18)
  assert(battleAxe!.knockback > lacSword!.knockback, 'Axe has greater knockback than sword');
  assert(lacSword!.knockback > bronzeSpear!.knockback, 'Sword has greater knockback than spear');
  assert(battleAxe!.knockback === 42 && lacSword!.knockback === 24 && bronzeSpear!.knockback === 18, 'Base knockback matches design');

  const spearKb0 = calculateWeaponKnockback(bronzeSpear!, 0);
  const spearKb2 = calculateWeaponKnockback(bronzeSpear!, 2);
  const axeKb0 = calculateWeaponKnockback(battleAxe!, 0);
  const axeKb2 = calculateWeaponKnockback(battleAxe!, 2);
  const swordKb0 = calculateWeaponKnockback(lacSword!, 0);
  const swordKb2 = calculateWeaponKnockback(lacSword!, 2);
  assert(spearKb0 === 18 && spearKb2 === 36, `Spear combo knockback (18, 36), got (${spearKb0}, ${spearKb2})`);
  assert(axeKb0 === 50 && axeKb2 === 118, `Axe combo knockback (50, 118), got (${axeKb0}, ${axeKb2})`);
  assert(swordKb0 === 24 && swordKb2 === 53, `Sword combo knockback (24, 53), got (${swordKb0}, ${swordKb2})`);
  assert(axeKb2 > spearKb2 && axeKb2 > swordKb2, 'Axe finisher delivers massive knockback');

  // Distinct Attack Timing (Speed): Spear (1.15) > Sword (1.05) > Axe (0.82)
  assert(bronzeSpear!.attackSpeed > lacSword!.attackSpeed, 'Spear is faster than sword');
  assert(lacSword!.attackSpeed > battleAxe!.attackSpeed, 'Sword is faster than axe');

  const spearTiming1 = calculateWeaponAttackTiming(bronzeSpear!, 1);
  const axeTiming1 = calculateWeaponAttackTiming(battleAxe!, 1);
  const swordTiming1 = calculateWeaponAttackTiming(lacSword!, 1);
  assert(spearTiming1 < swordTiming1, 'Spear attack delay is less than sword');
  assert(swordTiming1 < axeTiming1, 'Sword attack delay is less than axe');
  assert(spearTiming1 === 217, `Spear combo 1 timing 217ms, got ${spearTiming1}`);
  assert(axeTiming1 === 305, `Axe combo 1 timing 305ms, got ${axeTiming1}`);
  assert(swordTiming1 === 238, `Sword combo 1 timing 238ms, got ${swordTiming1}`);

  // Default and fallback weapon resolution
  assert(getEquippedWeaponOrDefault(undefined).id === 'bronze-spear', 'Default weapon is bronze-spear');
  assert(getEquippedWeaponOrDefault('battle-axe').id === 'battle-axe', 'Equipped battle-axe resolved');
  assert(getEquippedWeaponOrDefault('lac-sword').id === 'lac-sword', 'Equipped lac-sword resolved');
  assert(getEquippedWeaponOrDefault('unknown-id').id === 'bronze-spear', 'Unknown weapon fallback to bronze-spear');
  assert(getEquippedWeaponOrDefault('constructor').id === 'bronze-spear', 'Prototype key fallback to bronze-spear');

  // Deterministic weapon damage calculation
  const spearDmgCombo0 = calculateWeaponDamage(BRONZE_SPEAR, 0, 10, false);
  const spearDmgCombo2Crit = calculateWeaponDamage(BRONZE_SPEAR, 2, 10, true);
  assert(spearDmgCombo0 === 28, `Spear combo step 0 damage mismatch (got ${spearDmgCombo0})`);
  assert(spearDmgCombo2Crit === 81, `Spear combo step 2 crit damage mismatch (got ${spearDmgCombo2Crit})`);

  const axeDmgCombo0 = calculateWeaponDamage(BATTLE_AXE, 0, 10, false);
  const axeDmgCombo2Crit = calculateWeaponDamage(BATTLE_AXE, 2, 10, true);
  assert(axeDmgCombo0 === 42, `Axe combo step 0 damage mismatch (got ${axeDmgCombo0})`);
  assert(axeDmgCombo2Crit === 184, `Axe combo step 2 crit damage mismatch (got ${axeDmgCombo2Crit})`);

  const swordDmgCombo0 = calculateWeaponDamage(LAC_SWORD, 0, 10, false);
  const swordDmgCombo2Crit = calculateWeaponDamage(LAC_SWORD, 2, 10, true);
  assert(swordDmgCombo0 === 32, `Sword combo step 0 damage mismatch (got ${swordDmgCombo0})`);
  assert(swordDmgCombo2Crit === 112, `Sword combo step 2 crit damage mismatch (got ${swordDmgCombo2Crit})`);

  // -------------------------------------------------------------
  // 2. Three Divine Powers Verification
  // -------------------------------------------------------------
  assert(DIVINE_POWERS.length === 3, 'Exactly three divine powers defined');
  const earthPower = getDivinePower('earth');
  const flamePower = getDivinePower('flame');
  const waterPower = getDivinePower('water');

  assert(Boolean(earthPower && earthPower.element === 'earth'), 'Earth divine power valid');
  assert(Boolean(flamePower && flamePower.element === 'flame'), 'Flame divine power valid');
  assert(Boolean(waterPower && waterPower.element === 'water'), 'Water divine power valid');
  assert((earthPower?.passiveBonus.defensePercent ?? 0) > 0, 'Earth grants defense bonus');
  assert((flamePower?.passiveBonus.attackPercent ?? 0) > 0, 'Flame grants attack bonus');
  assert((waterPower?.passiveBonus.maxMpBonus ?? 0) > 0, 'Water grants max MP bonus');

  // -------------------------------------------------------------
  // 3. At Least Nine Active Skills Verification
  // -------------------------------------------------------------
  const activeSkills = getActiveSkills();
  assert(activeSkills.length >= 9, `Expected at least 9 active skills, found ${activeSkills.length}`);

  const earthSkills = getSkillsByDivinePower('earth');
  const flameSkills = getSkillsByDivinePower('flame');
  const waterSkills = getSkillsByDivinePower('water');
  assert(earthSkills.length >= 3, 'At least 3 Earth divine skills');
  assert(flameSkills.length >= 3, 'At least 3 Flame divine skills');
  assert(waterSkills.length >= 3, 'At least 3 Water divine skills');

  const spearSkills = getSkillsByWeaponType('spear');
  const axeSkills = getSkillsByWeaponType('axe');
  const swordSkills = getSkillsByWeaponType('sword');
  assert(spearSkills.length >= 1 && axeSkills.length >= 1 && swordSkills.length >= 1, 'Weapon-tied skills exist');

  for (const skill of activeSkills) {
    assert(skill.kind === 'active', `Skill ${skill.id} must be active`);
    assert(skill.cooldownMs > 0, `Skill ${skill.id} must have positive cooldown`);
    assert(skill.cost.mp >= 0, `Skill ${skill.id} must have valid MP cost`);
    assert(skill.requiredLevel >= 1, `Skill ${skill.id} requiredLevel must be >= 1`);
  }

  // -------------------------------------------------------------
  // 4. Immutable Skill Unlock Helper Tests
  // -------------------------------------------------------------
  let progress: SkillProgress = createInitialSkillProgress(['earth-shockwave'], 'earth');
  assert(isSkillUnlocked(progress, 'earth-shockwave'), 'Initial skill is unlocked');
  assert(!isSkillUnlocked(progress, 'stone-armor'), 'Advanced skill starts locked');

  let caster: CasterSnapshot = {
    level: 2,
    hp: 100,
    mp: 100,
    maxHp: 100,
    maxMp: 100,
    attack: 12,
    gold: 30,
    equippedWeaponId: 'bronze-spear',
  };

  // Locked due to level requirement (stone-armor requires level 3)
  const levelCheck = canUnlockSkill(progress, caster, 'stone-armor');
  assert(!levelCheck.canUnlock && levelCheck.reason === 'insufficient_level', 'Gated by level');

  // Locked due to gold (stone-armor requires 45 gold, caster has 30 gold)
  const casterLvl3Poor: CasterSnapshot = { ...caster, level: 3, gold: 30 };
  const goldCheck = canUnlockSkill(progress, casterLvl3Poor, 'stone-armor');
  assert(!goldCheck.canUnlock && goldCheck.reason === 'insufficient_gold', 'Gated by gold');

  // Successful unlock with level 3 and 50 gold
  const casterLvl3Rich: CasterSnapshot = { ...caster, level: 3, gold: 50 };
  const unlockResult = unlockSkill(progress, casterLvl3Rich, 'stone-armor');
  assert(unlockResult.success, 'Unlock succeeds when requirements met');
  assert(unlockResult.caster.gold === 5, 'Gold deducted properly (50 - 45 = 5)');
  assert(casterLvl3Rich.gold === 50, 'Original caster snapshot remained immutable');
  assert(!isSkillUnlocked(progress, 'stone-armor'), 'Original progress remained immutable');
  assert(isSkillUnlocked(unlockResult.progress, 'stone-armor'), 'Next progress contains new skill');

  // Attempt duplicate unlock
  const duplicateResult = unlockSkill(unlockResult.progress, unlockResult.caster, 'stone-armor');
  assert(!duplicateResult.success && duplicateResult.reason === 'already_unlocked', 'Duplicate unlock rejected');

  progress = unlockResult.progress;
  caster = unlockResult.caster;

  // -------------------------------------------------------------
  // 5. Immutable Skill Equip & Unequip Tests
  // -------------------------------------------------------------
  const equipLocked = equipSkill(progress, 'slot-2', 'mountain-cleave');
  assert(!equipLocked.success && equipLocked.reason === 'not_unlocked', 'Cannot equip locked skill');

  const equipUnlocked = equipSkill(progress, 'slot-2', 'stone-armor');
  assert(equipUnlocked.success, 'Can equip unlocked skill');
  assert(getEquippedSkill(equipUnlocked.progress, 'slot-2')?.id === 'stone-armor', 'Slot 2 contains stone-armor');

  const unequipped = unequipSkill(equipUnlocked.progress, 'slot-2');
  assert(getEquippedSkill(unequipped, 'slot-2') === undefined, 'Unequip clears slot');

  progress = equipUnlocked.progress;

  // -------------------------------------------------------------
  // 6. Immutable Skill Cast, Costs & Cooldowns
  // -------------------------------------------------------------
  const now = 10000;

  // Cast failure: Insufficient MP
  const lowMpCaster: CasterSnapshot = { ...caster, mp: 10 };
  const oomCheck = validateSkillCast(progress, lowMpCaster, 'earth-shockwave', now);
  assert(!oomCheck.canCast && oomCheck.reason === 'insufficient_mp', 'Cast blocked by insufficient MP');

  // Cast failure: Weapon mismatch for weapon skills
  const spearSkillProgress = unlockSkill(
    progress,
    { ...caster, gold: 100 },
    'spear-thrust',
  ).progress;
  const axeEquippedCaster: CasterSnapshot = { ...caster, mp: 100, equippedWeaponId: 'battle-axe' };
  const weaponCheck = validateSkillCast(spearSkillProgress, axeEquippedCaster, 'spear-thrust', now);
  assert(!weaponCheck.canCast && weaponCheck.reason === 'weapon_mismatch', 'Weapon mismatch blocks cast');

  // Cast success: Earth Shockwave (costs 30 MP, cooldown 5000ms)
  const castResult = castSkill(progress, caster, 'earth-shockwave', now);
  assert(castResult.success, 'Earth shockwave cast succeeds');
  assert(castResult.caster.mp === 70, `MP deducted correctly (100 - 30 = 70, got ${castResult.caster.mp})`);
  assert(caster.mp === 100, 'Original caster state remained immutable');
  assert(castResult.cooldownExpiresAt === now + 5000, 'Cooldown set to 5000ms');

  // Immediate recast fails due to cooldown
  const recastCheck = validateSkillCast(castResult.progress, castResult.caster, 'earth-shockwave', now + 1000);
  assert(!recastCheck.canCast && recastCheck.reason === 'on_cooldown', 'Immediate recast blocked by cooldown');
  assert(getRemainingCooldown(castResult.progress, 'earth-shockwave', now + 1000) === 4000, 'Remaining cooldown is 4000ms');

  // After cooldown expires (now + 5001ms), cast succeeds again
  const afterCooldownCheck = validateSkillCast(castResult.progress, castResult.caster, 'earth-shockwave', now + 5001);
  assert(afterCooldownCheck.canCast, 'Recast succeeds after cooldown expiry');

  // Cooldown cleanup helper
  const cleaned = clearExpiredCooldowns(castResult.progress, now + 6000);
  assert(Object.keys(cleaned.cooldownUntil).length === 0, 'Expired cooldowns cleared');

  // -------------------------------------------------------------
  // 7. Healing & Damage Determinism
  // -------------------------------------------------------------
  const sacredSpring = getSkill('sacred-spring');
  assert(Boolean(sacredSpring), 'Sacred spring skill exists');
  const healValues = calculateSkillHeal(sacredSpring!, caster);
  assert(healValues.hp === 45 && healValues.mp === 25, 'Sacred spring heal values match definitions');

  // Cast heal while injured: HP increases up to maxHp
  const injuredCaster: CasterSnapshot = { ...caster, level: 4, hp: 40, mp: 50 };
  const waterUnlock = unlockSkill(progress, { ...caster, level: 4, gold: 100 }, 'sacred-spring');
  assert(waterUnlock.success, 'Sacred spring unlocks at level 4 with gold');
  const healCastResult = castSkill(waterUnlock.progress, injuredCaster, 'sacred-spring', now);
  assert(healCastResult.success, 'Healing skill cast succeeds');
  assert(healCastResult.caster.hp === 85, `Healed HP should be 40 + 45 = 85 (got ${healCastResult.caster.hp})`);
  assert(healCastResult.caster.mp === 57, `MP should be 50 - 18 + 25 = 57 (got ${healCastResult.caster.mp})`);

  // Damage calculation test
  const earthShockwaveSkill = getSkill('earth-shockwave')!;
  const testCaster: CasterSnapshot = {
    ...caster,
    attack: 12,
    equippedWeaponId: 'battle-axe', // Battle axe gives +20 baseAttack + 8 item attack = 28. Total atk = 40.
  };
  // Base attack = 12 + 20 + 8 = 40.
  // Skill baseDamageMultiplier = 3.0.
  // In Earth divine power with matching element ('earth'):
  // Resonance multiplier: 1.15.
  // Total damage = round(40 * (3.0 * 1.15)) = round(40 * 3.45) = 138.
  const earthDamage = calculateSkillDamage(earthShockwaveSkill, testCaster, progress);
  assert(earthDamage === 138, `Calculated earth shockwave damage must match 138 (got ${earthDamage})`);

  // Divine switch test
  const flameSwitchedProgress = setActiveDivinePower(progress, 'flame');
  assert(flameSwitchedProgress.activeDivinePower === 'flame', 'Active divine power switched to flame');

  return true;
}

// Self-executing runner if executed via node
const proc = (globalThis as unknown as { process?: { argv?: string[]; exit?: (code: number) => void } }).process;
if (proc?.argv && proc.argv[1]?.includes('skillSelfCheck')) {
  try {
    runSkillSelfCheck();
    // eslint-disable-next-line no-console
    console.log('Skill self-check: PASS');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    proc.exit?.(1);
  }
}
