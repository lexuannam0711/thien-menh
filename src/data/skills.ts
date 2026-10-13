import type { WeaponType } from './weapons';

export type DivinePowerId = 'earth' | 'flame' | 'water';

export interface DivinePowerDefinition {
  readonly id: DivinePowerId;
  readonly name: string;
  readonly vietnameseName: string;
  readonly element: DivinePowerId;
  readonly patron: string;
  readonly description: string;
  readonly passivePerk: string;
  readonly passiveBonus: {
    readonly attackPercent?: number;
    readonly defensePercent?: number;
    readonly maxHpBonus?: number;
    readonly maxMpBonus?: number;
    readonly cooldownReductionPercent?: number;
    readonly moveSpeedPercent?: number;
  };
}

export const DIVINE_POWERS: readonly DivinePowerDefinition[] = [
  {
    id: 'earth',
    name: 'Son Tinh Divine Earth',
    vietnameseName: 'Thần Lực Địa Long (Sơn Tinh)',
    element: 'earth',
    patron: 'Đức Thánh Tản Viên (Sơn Tinh)',
    description: 'Uy lực dời non lấp biển từ non cao Tản Viên, chuyển hóa địa chấn thành hộ thể kim thân và sóng chấn động.',
    passivePerk: 'Giảm 15% sát thương nhận vào, tăng 20 sinh lực tối đa.',
    passiveBonus: {
      defensePercent: 15,
      maxHpBonus: 20,
    },
  },
  {
    id: 'flame',
    name: 'Solar Nine-Heavens Flame',
    vietnameseName: 'Thần Lực Cửu Dương (Nhật Thần)',
    element: 'flame',
    patron: 'Thái Dương Thần Nữ & Mặt Trời Trống Đồng',
    description: 'Ngọn lửa Chu Sa thuần dương thiêu rụi tà khí, ngưng tụ ánh hào quang mặt trời tạo nên những đòn xuyên thấu mãnh liệt.',
    passivePerk: 'Tăng 12% sát thương đòn đánh và kỹ năng, giảm 10% thời gian hồi chiêu.',
    passiveBonus: {
      attackPercent: 12,
      cooldownReductionPercent: 10,
    },
  },
  {
    id: 'water',
    name: 'Lac Long Oceanic Tide',
    vietnameseName: 'Thần Lực Thủy Triều (Lạc Long Quân)',
    element: 'water',
    patron: 'Đức Thủy Tổ Lạc Long Quân',
    description: 'Sức mạnh cội nguồn biển sâu của loài Rồng, điều khiển sóng thần cuốn phăng quân thù và dòng linh tuyền tái sinh.',
    passivePerk: 'Tăng 25 nội lực tối đa, tăng 8% tốc độ di chuyển.',
    passiveBonus: {
      maxMpBonus: 25,
      moveSpeedPercent: 8,
    },
  },
];

export const DIVINE_POWERS_BY_ID: Readonly<Record<DivinePowerId, DivinePowerDefinition>> = Object.fromEntries(
  DIVINE_POWERS.map((power) => [power.id, power]),
) as Record<DivinePowerId, DivinePowerDefinition>;

export function getDivinePower(id: DivinePowerId): DivinePowerDefinition | undefined {
  return Object.hasOwn(DIVINE_POWERS_BY_ID, id) ? DIVINE_POWERS_BY_ID[id] : undefined;
}

export type SkillKind = 'active';
export type SkillTargetType = 'self' | 'directional' | 'area';
export type SkillElement = 'earth' | 'flame' | 'water' | 'physical';
export type SkillStatusEffect = 'burn' | 'slow' | 'stun' | 'shield' | 'invulnerable';

export interface SkillCost {
  readonly mp: number;
  readonly hp?: number;
}

export interface SkillEffect {
  readonly baseDamageMultiplier?: number;
  readonly flatDamage?: number;
  readonly healHp?: number;
  readonly healMp?: number;
  readonly knockback?: number;
  readonly radius?: number;
  readonly range?: number;
  readonly durationMs?: number;
  readonly statusEffect?: SkillStatusEffect;
  readonly statusDurationMs?: number;
}

export interface SkillDefinition {
  readonly id: string;
  readonly name: string;
  readonly vietnameseName: string;
  readonly kind: SkillKind;
  readonly description: string;
  readonly divinePowerId?: DivinePowerId;
  readonly requiredWeaponType?: WeaponType;
  readonly requiredLevel: number;
  readonly unlockCostGold: number;
  readonly cooldownMs: number;
  readonly cost: SkillCost;
  readonly targetType: SkillTargetType;
  readonly element: SkillElement;
  readonly effect: SkillEffect;
}

export const SKILLS: readonly SkillDefinition[] = [
  // --- 1. EARTH DIVINE ACTIVE SKILLS ---
  {
    id: 'earth-shockwave',
    name: 'Dong Son Earth Shockwave',
    vietnameseName: 'Trống Đồng Địa Chấn',
    kind: 'active',
    description: 'Dộng chân kích phát sóng địa chấn khắc họa hoa văn Mặt Trời 12 cánh, đánh văng và làm choáng kẻ địch xung quanh.',
    divinePowerId: 'earth',
    requiredLevel: 1,
    unlockCostGold: 0,
    cooldownMs: 5000,
    cost: { mp: 30 },
    targetType: 'area',
    element: 'earth',
    effect: {
      baseDamageMultiplier: 3.0,
      radius: 153,
      knockback: 54,
      statusEffect: 'stun',
      statusDurationMs: 1000,
    },
  },
  {
    id: 'stone-armor',
    name: 'Stone Bulwark Barrier',
    vietnameseName: 'Khí Thạch Hộ Thể',
    kind: 'active',
    description: 'Gọi đá tảng ngàn năm từ đỉnh Tản Viên bao bọc cơ thể, tạo lớp giáp kiên cố chống chịu sát thương và triệt tiêu văng lùi.',
    divinePowerId: 'earth',
    requiredLevel: 3,
    unlockCostGold: 45,
    cooldownMs: 10000,
    cost: { mp: 25 },
    targetType: 'self',
    element: 'earth',
    effect: {
      durationMs: 6000,
      statusEffect: 'shield',
      statusDurationMs: 6000,
    },
  },
  {
    id: 'mountain-cleave',
    name: 'Mountain Fissure Cleave',
    vietnameseName: 'Khai Sơn Phá Thạch',
    kind: 'active',
    description: 'Bật nhảy dồn thần lực bổ đất xẻ núi, tạo vết nứt chấn động hướng về phía trước gây sát thương nặng nề.',
    divinePowerId: 'earth',
    requiredLevel: 5,
    unlockCostGold: 90,
    cooldownMs: 7000,
    cost: { mp: 35 },
    targetType: 'directional',
    element: 'earth',
    effect: {
      baseDamageMultiplier: 2.8,
      range: 180,
      knockback: 45,
      statusEffect: 'stun',
      statusDurationMs: 1500,
    },
  },

  // --- 2. FLAME DIVINE ACTIVE SKILLS ---
  {
    id: 'flame-beam',
    name: 'Cinnabar Flame Beam',
    vietnameseName: 'Chu Sa Hỏa Diễm',
    kind: 'active',
    description: 'Phóng ra luồng sáng Lửa Chu Sa rực rỡ xuyên thấu thẳng hàng, thiêu đốt mọi yêu ma cản đường.',
    divinePowerId: 'flame',
    requiredLevel: 1,
    unlockCostGold: 0,
    cooldownMs: 3000,
    cost: { mp: 20 },
    targetType: 'directional',
    element: 'flame',
    effect: {
      baseDamageMultiplier: 2.25,
      range: 280,
      knockback: 35,
      statusEffect: 'burn',
      statusDurationMs: 3000,
    },
  },
  {
    id: 'blazing-dash',
    name: 'Blazing Trail Dash',
    vietnameseName: 'Hỏa Ảnh Thần Hành',
    kind: 'active',
    description: 'Lướt nhanh để lại vệt lửa hồng thiêu đốt mặt đất, tăng tốc độ di chuyển và gây sát thương liên tục lên kẻ bám đuổi.',
    divinePowerId: 'flame',
    requiredLevel: 2,
    unlockCostGold: 35,
    cooldownMs: 4000,
    cost: { mp: 15 },
    targetType: 'directional',
    element: 'flame',
    effect: {
      baseDamageMultiplier: 1.5,
      range: 200,
      knockback: 20,
      durationMs: 2500,
      statusEffect: 'burn',
      statusDurationMs: 2500,
    },
  },
  {
    id: 'sun-burst',
    name: 'Solar Star Nova',
    vietnameseName: 'Nhật Luân Bộc Phá',
    kind: 'active',
    description: 'Ngưng tụ sức nóng của vầng thái dương giải phóng một đợt nổ quang năng chói lóa, quét sạch kẻ địch xung quanh.',
    divinePowerId: 'flame',
    requiredLevel: 4,
    unlockCostGold: 80,
    cooldownMs: 8000,
    cost: { mp: 40 },
    targetType: 'area',
    element: 'flame',
    effect: {
      baseDamageMultiplier: 3.2,
      radius: 175,
      knockback: 40,
      statusEffect: 'burn',
      statusDurationMs: 4000,
    },
  },

  // --- 3. WATER DIVINE ACTIVE SKILLS ---
  {
    id: 'tidal-surge',
    name: 'Tidal Wave Surge',
    vietnameseName: 'Thủy Triều Cuộn Sóng',
    kind: 'active',
    description: 'Triệu hồi bức tường sóng cuộn dâng trào về phía trước, quét lui quái vật và làm giảm mạnh tốc độ di chuyển của chúng.',
    divinePowerId: 'water',
    requiredLevel: 1,
    unlockCostGold: 0,
    cooldownMs: 4500,
    cost: { mp: 22 },
    targetType: 'directional',
    element: 'water',
    effect: {
      baseDamageMultiplier: 2.0,
      range: 240,
      knockback: 48,
      statusEffect: 'slow',
      statusDurationMs: 3500,
    },
  },
  {
    id: 'dragon-vortex',
    name: 'Dragon Water Vortex',
    vietnameseName: 'Lạc Long Ba Đào',
    kind: 'active',
    description: 'Xoáy nước rồng ngầm cuồn cuộn hút đối thủ vào tâm xoáy, xé rách hàng phòng ngự kẻ địch.',
    divinePowerId: 'water',
    requiredLevel: 3,
    unlockCostGold: 50,
    cooldownMs: 7500,
    cost: { mp: 35 },
    targetType: 'area',
    element: 'water',
    effect: {
      baseDamageMultiplier: 2.6,
      radius: 140,
      knockback: -30,
      statusEffect: 'slow',
      statusDurationMs: 2500,
    },
  },
  {
    id: 'sacred-spring',
    name: 'Sacred Spring Blessing',
    vietnameseName: 'Linh Tuyền Hồi Phục',
    kind: 'active',
    description: 'Dòng nước thiêng Lạc Việt tuôn chảy gột rửa vết thương, hồi phục sinh lực và thanh lọc tâm trí tức thì.',
    divinePowerId: 'water',
    requiredLevel: 4,
    unlockCostGold: 75,
    cooldownMs: 9000,
    cost: { mp: 18 },
    targetType: 'self',
    element: 'water',
    effect: {
      healHp: 45,
      healMp: 25,
      durationMs: 5000,
    },
  },

  // --- 4. WEAPON MARTIAL ACTIVE SKILLS ---
  {
    id: 'spear-thrust',
    name: 'Armor Piercing Spear Thrust',
    vietnameseName: 'Thấu Giáp Kim Thương',
    kind: 'active',
    description: 'Thế đâm giáo thần tốc tập trung toàn bộ lực đạo vào một điểm, xuyên thủng giáp trụ kẻ thù.',
    requiredWeaponType: 'spear',
    requiredLevel: 1,
    unlockCostGold: 20,
    cooldownMs: 2500,
    cost: { mp: 12 },
    targetType: 'directional',
    element: 'physical',
    effect: {
      baseDamageMultiplier: 1.8,
      range: 160,
      knockback: 25,
    },
  },
  {
    id: 'axe-whirlwind',
    name: 'Axe Whirlwind Cleave',
    vietnameseName: 'Khai Hoang Đoạt Phách',
    kind: 'active',
    description: 'Xoay tròn lưỡi rìu chiến Đông Sơn quét một vòng 360 độ, đẩy lùi toàn bộ kẻ thù áp sát.',
    requiredWeaponType: 'axe',
    requiredLevel: 2,
    unlockCostGold: 40,
    cooldownMs: 3500,
    cost: { mp: 18 },
    targetType: 'area',
    element: 'physical',
    effect: {
      baseDamageMultiplier: 2.2,
      radius: 110,
      knockback: 50,
    },
  },
  {
    id: 'lac-blade-dance',
    name: 'Lac Blade Dance',
    vietnameseName: 'Lạc Hồng Kiếm Vũ',
    kind: 'active',
    description: 'Ba đường kiếm liên hoàn chớp nhoáng với tỷ lệ bạo kích cao vút như cánh chim Lạc vút bay.',
    requiredWeaponType: 'sword',
    requiredLevel: 2,
    unlockCostGold: 40,
    cooldownMs: 3000,
    cost: { mp: 16 },
    targetType: 'directional',
    element: 'physical',
    effect: {
      baseDamageMultiplier: 2.1,
      range: 130,
      knockback: 28,
    },
  },
];

export const SKILLS_BY_ID: Readonly<Record<string, SkillDefinition>> = Object.fromEntries(
  SKILLS.map((skill) => [skill.id, skill]),
);

export function getSkill(skillId: string): SkillDefinition | undefined {
  return Object.hasOwn(SKILLS_BY_ID, skillId) ? SKILLS_BY_ID[skillId] : undefined;
}

export function getSkillsByDivinePower(power: DivinePowerId): readonly SkillDefinition[] {
  return SKILLS.filter((skill) => skill.divinePowerId === power);
}

export function getSkillsByWeaponType(weaponType: WeaponType): readonly SkillDefinition[] {
  return SKILLS.filter((skill) => skill.requiredWeaponType === weaponType);
}

export function getActiveSkills(): readonly SkillDefinition[] {
  return SKILLS.filter((skill) => skill.kind === 'active');
}
