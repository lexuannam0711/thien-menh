import { getItemRecipe, type ItemStats, type ItemCraftingRecipe } from './items';

export type WeaponType = 'spear' | 'axe' | 'sword';

export interface WeaponComboStep {
  readonly step: number;
  readonly multiplier: number;
  readonly knockbackMultiplier: number;
  readonly animationName?: string;
}


export interface WeaponDefinition {
  readonly id: string;
  readonly name: string;
  readonly vietnameseName: string;
  readonly weaponType: WeaponType;
  readonly description: string;
  readonly lore: string;
  readonly baseAttack: number;
  readonly attackSpeed: number;
  readonly range: number;
  readonly knockback: number;
  readonly criticalChance: number;
  readonly criticalMultiplier: number;
  readonly comboSteps: readonly WeaponComboStep[];
  readonly divineSynergy?: 'earth' | 'flame' | 'water';
  readonly requiredLevel: number;
  readonly price: number;
  readonly stats: ItemStats;
  readonly recipe?: ItemCraftingRecipe;
}

export { getItemRecipe as getWeaponRecipe };

export const BRONZE_SPEAR: WeaponDefinition = {
  id: 'bronze-spear',
  name: 'Bronze Spear',
  vietnameseName: 'Giáo đồng Văn Lang',
  weaponType: 'spear',
  description: 'Mũi giáo đồng đúc hình ngọn lửa, tầm đâm xa, xuyên phá nhanh nhẹn và chính xác.',
  lore: 'Vũ khí hộ vệ của lính chiến thời Hùng Vương, đúc từ đồng đỏ Cổ Loa tôi qua lửa thiêng.',
  baseAttack: 14,
  attackSpeed: 1.15,
  range: 112,
  knockback: 18,
  criticalChance: 0.08,
  criticalMultiplier: 1.6,
  comboSteps: [
    { step: 1, multiplier: 1.0, knockbackMultiplier: 1.0, animationName: 'thrust_quick' },
    { step: 2, multiplier: 1.25, knockbackMultiplier: 1.2, animationName: 'thrust_double' },
    { step: 3, multiplier: 1.8, knockbackMultiplier: 2.0, animationName: 'lunge_pierce' },
  ],
  divineSynergy: 'flame',
  requiredLevel: 1,
  price: 60,
  stats: { attack: 4, speed: 6 },
  recipe: getItemRecipe('bronze-spear'),
};

export const BATTLE_AXE: WeaponDefinition = {
  id: 'battle-axe',
  name: 'Dong Son Battle Axe',
  vietnameseName: 'Rìu chiến Đông Sơn',
  weaponType: 'axe',
  description: 'Lưỡi búa xòe cánh chim Lạc, chém nặng tựa ngàn cân làm rung chuyển đất trời.',
  lore: 'Vũ khí tế khí kiêm chiến trận của các tù trưởng Tây Vu, khắc hoa văn mặt trời và cá sấu Giao Long.',
  baseAttack: 20,
  attackSpeed: 0.82,
  range: 88,
  knockback: 42,
  criticalChance: 0.12,
  criticalMultiplier: 2.1,
  comboSteps: [
    { step: 1, multiplier: 1.1, knockbackMultiplier: 1.2, animationName: 'chop_heavy' },
    { step: 2, multiplier: 1.45, knockbackMultiplier: 1.5, animationName: 'cleave_sweep' },
    { step: 3, multiplier: 2.3, knockbackMultiplier: 2.8, animationName: 'ground_slam' },
  ],
  divineSynergy: 'earth',
  requiredLevel: 2,
  price: 85,
  stats: { attack: 8, maxHp: 20 },
  recipe: getItemRecipe('battle-axe'),
};

export const LAC_SWORD: WeaponDefinition = {
  id: 'lac-sword',
  name: 'Sacred Lac Sword',
  vietnameseName: 'Gươm thiêng Lạc Long',
  weaponType: 'sword',
  description: 'Thanh đoản kiếm rèn từ linh đồng và vảy Rồng, đường chém linh hoạt biến ảo khôn lường.',
  lore: 'Gươm báu lưu truyền từ thời Lạc Long Quân định đô, ẩn chứa hơi thở của sóng thần và triều dâng.',
  baseAttack: 16,
  attackSpeed: 1.05,
  range: 95,
  knockback: 24,
  criticalChance: 0.18,
  criticalMultiplier: 1.85,
  comboSteps: [
    { step: 1, multiplier: 1.0, knockbackMultiplier: 1.0, animationName: 'slash_cross' },
    { step: 2, multiplier: 1.3, knockbackMultiplier: 1.3, animationName: 'slash_rising' },
    { step: 3, multiplier: 1.9, knockbackMultiplier: 2.2, animationName: 'dragon_finisher' },
  ],
  divineSynergy: 'water',
  requiredLevel: 3,
  price: 110,
  stats: { attack: 6, maxMp: 15, speed: 10 },
  recipe: getItemRecipe('lac-sword'),
};

export const WEAPONS: readonly WeaponDefinition[] = [
  BRONZE_SPEAR,
  BATTLE_AXE,
  LAC_SWORD,
];

export const WEAPONS_BY_ID: Readonly<Record<string, WeaponDefinition>> = Object.fromEntries(
  WEAPONS.map((weapon) => [weapon.id, weapon]),
);

export function getWeapon(weaponId: string): WeaponDefinition | undefined {
  return Object.hasOwn(WEAPONS_BY_ID, weaponId) ? WEAPONS_BY_ID[weaponId] : undefined;
}

export function getWeaponsByType(weaponType: WeaponType): readonly WeaponDefinition[] {
  return WEAPONS.filter((weapon) => weapon.weaponType === weaponType);
}

export function getEquippedWeaponOrDefault(weaponId?: string, level = Infinity): WeaponDefinition {
  if (typeof weaponId === 'string' && Object.hasOwn(WEAPONS_BY_ID, weaponId)) {
    const weapon = WEAPONS_BY_ID[weaponId];
    if (level >= weapon.requiredLevel) return weapon;
  }
  return BRONZE_SPEAR;
}

export function calculateWeaponDamage(
  weapon: WeaponDefinition,
  comboIndex: number,
  playerAttack: number,
  isCritical = false,
): number {
  const boundedStep = Math.max(0, Math.min(weapon.comboSteps.length - 1, comboIndex));
  const stepConfig = weapon.comboSteps[boundedStep] ?? weapon.comboSteps[0];
  const stepMultiplier = stepConfig ? stepConfig.multiplier : 1.0;
  const totalBase = (playerAttack + weapon.baseAttack + (weapon.stats.attack ?? 0)) * stepMultiplier;
  const critMultiplier = isCritical ? weapon.criticalMultiplier : 1.0;
  return Math.round(totalBase * critMultiplier);
}

export function calculateWeaponKnockback(
  weapon: WeaponDefinition,
  comboIndex: number,
): number {
  const boundedStep = Math.max(0, Math.min(weapon.comboSteps.length - 1, comboIndex));
  const stepConfig = weapon.comboSteps[boundedStep] ?? weapon.comboSteps[0];
  const mult = stepConfig ? stepConfig.knockbackMultiplier : 1.0;
  return Math.round(weapon.knockback * mult);
}

export function calculateWeaponAttackTiming(
  weapon: WeaponDefinition,
  combo: number,
): number {
  const baseDelays = [0, 250, 295, 380];
  const delay = baseDelays[combo] ?? 250;
  const speed = weapon.attackSpeed > 0 ? weapon.attackSpeed : 1.0;
  return Math.round(delay / speed);
}

export function calculateWeaponReach(
  weapon: WeaponDefinition,
  combo = 1,
): number {
  return weapon.range + (combo === 3 ? 6 : 0);
}
