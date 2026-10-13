export type BossId = 'ho-yeu' | 'thuong-luong' | 'thach-tuong' | 'hac-an';

export type TelegraphShape = 'circle' | 'cone' | 'line' | 'ring' | 'rect';

export interface TelegraphDefinition {
  readonly shape: TelegraphShape;
  readonly radius?: number;
  readonly length?: number;
  readonly width?: number;
  readonly angleDeg?: number;
  readonly warningText?: string;
  readonly color?: number;
  readonly alpha?: number;
}

export type BossAttackKind =
  | 'melee'
  | 'ranged'
  | 'aoe'
  | 'dash'
  | 'channel'
  | 'summon'
  | 'shield';

export interface BossAttackDefinition {
  readonly id: string;
  readonly name: string;
  readonly kind: BossAttackKind;
  readonly damage: number;
  readonly windupMs: number;
  readonly recoveryMs: number;
  readonly cooldownMs: number;
  readonly range: number;
  readonly telegraph: TelegraphDefinition;
  readonly knockback?: number;
  readonly projectileCount?: number;
  readonly projectileSpeed?: number;
  readonly projectileSpreadDeg?: number;
  readonly summonType?: string;
  readonly summonCount?: number;
  readonly shieldAmount?: number;
  readonly hazardDurationMs?: number;
  readonly weight?: number;
}

export type UniqueMechanicKind =
  | 'enrage_burst'
  | 'shadow_clones'
  | 'submerged_evasion'
  | 'whirlpool_hazard'
  | 'stone_shield'
  | 'earth_fissures'
  | 'ultimate_channel'
  | 'void_teleport';

export interface BossUniqueMechanic {
  readonly id: UniqueMechanicKind;
  readonly name: string;
  readonly description: string;
  readonly trigger: 'hp_threshold' | 'timer' | 'on_hit' | 'channel';
  readonly value: number;
}

export interface BossPhaseDefinition {
  readonly phaseIndex: number;
  readonly name: string;
  readonly subtitle?: string;
  readonly hpThresholdPercent: number;
  readonly speedMultiplier: number;
  readonly damageMultiplier: number;
  readonly defenseBonus: number;
  readonly attacks: readonly BossAttackDefinition[];
  readonly transitionNotice: string;
  readonly transitionDurationMs: number;
  readonly themeColor: number;
}

export interface BossDropItem {
  readonly itemId: string;
  readonly chance: number;
  readonly quantity: number;
}

export interface BossReward {
  readonly xp: number;
  readonly gold: number;
  readonly itemDrops: readonly BossDropItem[];
}

export interface BossDefinition {
  readonly id: BossId;
  readonly name: string;
  readonly title: string;
  readonly lore: string;
  readonly location: string;
  readonly maxHp: number;
  readonly baseSpeed: number;
  readonly baseAttack: number;
  readonly radius: number;
  readonly color: number;
  readonly spriteKey?: string;
  readonly phases: readonly BossPhaseDefinition[];
  readonly uniqueMechanics: readonly BossUniqueMechanic[];
  readonly reward: BossReward;
}

function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const propNames = Object.getOwnPropertyNames(obj) as Array<keyof T>;
  for (const name of propNames) {
    const value = obj[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

export const BOSS_IDS: readonly BossId[] = Object.freeze([
  'ho-yeu',
  'thuong-luong',
  'thach-tuong',
  'hac-an',
] as const);

export const BOSSES: readonly BossDefinition[] = deepFreeze([
  // 1. HỔ YÊU U MINH (Lord Tiger of the Nether / Misty Forest)
  {
    id: 'ho-yeu',
    name: 'Hổ Yêu U Minh',
    title: 'Chúa Tể Rừng Trúc U Minh',
    lore: 'Mãnh thú ngàn năm hấp thụ chướng khí rặng trúc u uất. Thoắt ẩn thoắt hiện với trảo phong sắc lẹm xé toạc sương mờ.',
    location: 'Rừng Trúc U Minh',
    maxHp: 320,
    baseSpeed: 78,
    baseAttack: 19,
    radius: 38,
    color: 0xd4a160,
    spriteKey: 'hoyer',
    phases: [
      {
        phaseIndex: 1,
        name: 'Mãnh Thú Rình Mồi',
        subtitle: 'Bản năng săn mồi hung bạo',
        hpThresholdPercent: 1.0,
        speedMultiplier: 1.0,
        damageMultiplier: 1.0,
        defenseBonus: 0,
        themeColor: 0xd4a160,
        transitionNotice: 'Hổ Yêu U Minh giáng thế!',
        transitionDurationMs: 800,
        attacks: [
          {
            id: 'ho-yeu-claw-swipe',
            name: 'Trảo Phong U Ám',
            kind: 'melee',
            damage: 18,
            windupMs: 420,
            recoveryMs: 450,
            cooldownMs: 1100,
            range: 68,
            telegraph: {
              shape: 'cone',
              radius: 75,
              angleDeg: 90,
              warningText: 'TRẢO PHONG',
              color: 0xf57670,
              alpha: 0.35,
            },
            knockback: 18,
            weight: 3,
          },
          {
            id: 'ho-yeu-pounce',
            name: 'Mãnh Hổ Vồ Mồi',
            kind: 'dash',
            damage: 26,
            windupMs: 650,
            recoveryMs: 600,
            cooldownMs: 3200,
            range: 220,
            telegraph: {
              shape: 'circle',
              radius: 95,
              warningText: 'VỒ MỒI',
              color: 0xffa055,
              alpha: 0.45,
            },
            knockback: 40,
            weight: 2,
          },
        ],
      },
      {
        phaseIndex: 2,
        name: 'U Minh Cuồng Nộ',
        subtitle: 'Bộc phát yêu khí u ám',
        hpThresholdPercent: 0.5,
        speedMultiplier: 1.35,
        damageMultiplier: 1.3,
        defenseBonus: 2,
        themeColor: 0xff7043,
        transitionNotice: 'CUỒNG NỘ! HỔ YÊU HÓA U MINH CUỒNG THÚ!',
        transitionDurationMs: 1300,
        attacks: [
          {
            id: 'ho-yeu-frenzy-swipes',
            name: 'Loạn Trảo Ma Quỷ',
            kind: 'melee',
            damage: 24,
            windupMs: 340,
            recoveryMs: 380,
            cooldownMs: 800,
            range: 80,
            telegraph: {
              shape: 'cone',
              radius: 88,
              angleDeg: 120,
              warningText: 'LOẠN TRẢO',
              color: 0xff3d00,
              alpha: 0.45,
            },
            knockback: 25,
            weight: 3,
          },
          {
            id: 'ho-yeu-roar-shockwave',
            name: 'Tiếng Gầm U Minh',
            kind: 'aoe',
            damage: 34,
            windupMs: 720,
            recoveryMs: 750,
            cooldownMs: 3800,
            range: 150,
            telegraph: {
              shape: 'ring',
              radius: 145,
              warningText: 'GẦM THÉP ĐỊA CHẤN',
              color: 0xff6d00,
              alpha: 0.5,
            },
            knockback: 65,
            weight: 2,
          },
          {
            id: 'ho-yeu-shadow-clones',
            name: 'Ảo Ảnh U Hồn',
            kind: 'summon',
            damage: 16,
            windupMs: 780,
            recoveryMs: 600,
            cooldownMs: 7500,
            range: 280,
            telegraph: {
              shape: 'circle',
              radius: 110,
              warningText: 'PHÂN THÂN YÊU ẢNH',
              color: 0x9c27b0,
              alpha: 0.4,
            },
            summonType: 'ho-yeu-clone',
            summonCount: 2,
            weight: 1,
          },
        ],
      },
    ],
    uniqueMechanics: [
      {
        id: 'enrage_burst',
        name: 'Cuồng Nộ U Minh',
        description: 'Khi máu dưới 50%, tốc độ và sức tấn công tăng mạnh; tiếng gầm gây chấn động diện rộng.',
        trigger: 'hp_threshold',
        value: 0.5,
      },
      {
        id: 'shadow_clones',
        name: 'Phân Thân Yêu Ảnh',
        description: 'Tạo ảo ảnh phân thân gây nhiễu loạn tầm nhìn và phối hợp tấn công người chơi.',
        trigger: 'timer',
        value: 2,
      },
    ],
    reward: {
      xp: 160,
      gold: 85,
      itemDrops: [
        { itemId: 'jade-charm', chance: 1.0, quantity: 1 },
        { itemId: 'spirit-stone', chance: 0.8, quantity: 3 },
      ],
    },
  },

  // 2. THUỒNG LUỒNG NHIỄM TÀ (Corrupted Water Dragon / Aquatic Fiend)
  {
    id: 'thuong-luong',
    name: 'Thuồng Luồng Nhiễm Tà',
    title: 'Thủy Thần Đọa Lạc Đầm Thiêng',
    lore: 'Thần thú bảo hộ đầm nước thuở hồng hoang, nay bị tà khí xâm chiếm tâm trí, dâng nước nhấn chìm xóm làng.',
    location: 'Đầm Thiêng',
    maxHp: 440,
    baseSpeed: 68,
    baseAttack: 21,
    radius: 46,
    color: 0x2e86ab,
    phases: [
      {
        phaseIndex: 1,
        name: 'Thủy Triều Dữ Dội',
        subtitle: 'Sóng ngầm vần vũ',
        hpThresholdPercent: 1.0,
        speedMultiplier: 1.0,
        damageMultiplier: 1.0,
        defenseBonus: 1,
        themeColor: 0x2e86ab,
        transitionNotice: 'Đầm nước sục sôi! Thuồng Luồng trồi lên!',
        transitionDurationMs: 900,
        attacks: [
          {
            id: 'thuong-luong-tail-sweep',
            name: 'Thần Vĩ Quét Sóng',
            kind: 'aoe',
            damage: 22,
            windupMs: 520,
            recoveryMs: 550,
            cooldownMs: 1400,
            range: 92,
            telegraph: {
              shape: 'circle',
              radius: 95,
              warningText: 'QUÉT ĐUÔI SÓNG NƯỚC',
              color: 0x00bcd4,
              alpha: 0.38,
            },
            knockback: 25,
            weight: 3,
          },
          {
            id: 'thuong-luong-water-spit',
            name: 'Thủy Tiễn Nhiễm Tà',
            kind: 'ranged',
            damage: 18,
            windupMs: 580,
            recoveryMs: 620,
            cooldownMs: 2700,
            range: 310,
            telegraph: {
              shape: 'line',
              length: 310,
              width: 44,
              warningText: 'THỦY TIỄN HÀNG LOẠT',
              color: 0x03a9f4,
              alpha: 0.42,
            },
            projectileCount: 3,
            projectileSpeed: 230,
            projectileSpreadDeg: 28,
            weight: 2,
          },
          {
            id: 'thuong-luong-submerge',
            name: 'Ẩn Thân Đáy Đầm',
            kind: 'channel',
            damage: 26,
            windupMs: 900,
            recoveryMs: 500,
            cooldownMs: 6200,
            range: 200,
            telegraph: {
              shape: 'circle',
              radius: 120,
              warningText: 'LẶN SÂU PHỤC KÍCH',
              color: 0x006064,
              alpha: 0.5,
            },
            hazardDurationMs: 1600,
            weight: 1,
          },
        ],
      },
      {
        phaseIndex: 2,
        name: 'Nộ Ba Thao Thiên',
        subtitle: 'Đại hồng thủy diệt thế',
        hpThresholdPercent: 0.5,
        speedMultiplier: 1.25,
        damageMultiplier: 1.28,
        defenseBonus: 3,
        themeColor: 0x00e5ff,
        transitionNotice: 'SÓNG DỮ CUỘN TRÀO! THUỒNG LUỒNG HÓA THỦY LONG!',
        transitionDurationMs: 1400,
        attacks: [
          {
            id: 'thuong-luong-whirlpool',
            name: 'Xoáy Nước Đầm Thiêng',
            kind: 'aoe',
            damage: 32,
            windupMs: 780,
            recoveryMs: 820,
            cooldownMs: 4600,
            range: 175,
            telegraph: {
              shape: 'ring',
              radius: 170,
              warningText: 'XOÁY NƯỚC HÚT SÂU',
              color: 0x00b0ff,
              alpha: 0.52,
            },
            hazardDurationMs: 3000,
            weight: 3,
          },
          {
            id: 'thuong-luong-tsunami-barrage',
            name: 'Bát Phương Thủy Nộ',
            kind: 'ranged',
            damage: 24,
            windupMs: 680,
            recoveryMs: 720,
            cooldownMs: 4200,
            range: 350,
            telegraph: {
              shape: 'circle',
              radius: 190,
              warningText: 'BÁT HƯỚNG THỦY TIỄN',
              color: 0x80d8ff,
              alpha: 0.46,
            },
            projectileCount: 8,
            projectileSpeed: 210,
            projectileSpreadDeg: 360,
            weight: 2,
          },
          {
            id: 'thuong-luong-dive-crush',
            name: 'Long Đằng Bạt Hải',
            kind: 'dash',
            damage: 38,
            windupMs: 640,
            recoveryMs: 680,
            cooldownMs: 3600,
            range: 240,
            telegraph: {
              shape: 'circle',
              radius: 115,
              warningText: 'GIÁNG THỦY TẬP KÍCH',
              color: 0x0091ea,
              alpha: 0.55,
            },
            knockback: 55,
            weight: 2,
          },
        ],
      },
    ],
    uniqueMechanics: [
      {
        id: 'submerged_evasion',
        name: 'Lặn Đáy Đầm Thiêng',
        description: 'Lặn sâu dưới mặt nước để né tránh sát thương, sau đó trồi lên tạo thủy bộc uy lực.',
        trigger: 'timer',
        value: 1600,
      },
      {
        id: 'whirlpool_hazard',
        name: 'Xoáy Nước Hút Sâu',
        description: 'Tạo vùng nước xoáy kéo người chơi vào tâm và gây sát thương liên tục.',
        trigger: 'timer',
        value: 3000,
      },
    ],
    reward: {
      xp: 220,
      gold: 120,
      itemDrops: [
        { itemId: 'bronze-spear', chance: 0.8, quantity: 1 },
        { itemId: 'spirit-stone', chance: 1.0, quantity: 4 },
      ],
    },
  },

  // 3. THẠCH TƯỚNG BỊ NGUYỀN (Cursed Stone General)
  {
    id: 'thach-tuong',
    name: 'Thạch Tướng Bị Nguyền',
    title: 'Hộ Vệ Cổ Núi Tản Viên',
    lore: 'Tượng đá linh thiêng nghìn năm trấn thủ đỉnh Tản Viên, bị tà phù phong ấn kích hoạt cơn cuồng nộ bất trị.',
    location: 'Núi Tản Viên',
    maxHp: 560,
    baseSpeed: 54,
    baseAttack: 27,
    radius: 52,
    color: 0x795548,
    phases: [
      {
        phaseIndex: 1,
        name: 'Bàn Thạch Trọng Kích',
        subtitle: 'Sức nặng ngàn cân',
        hpThresholdPercent: 1.0,
        speedMultiplier: 1.0,
        damageMultiplier: 1.0,
        defenseBonus: 4,
        themeColor: 0x8d6e63,
        transitionNotice: 'Mặt đất rung chuyển! Thạch Tướng thức tỉnh!',
        transitionDurationMs: 950,
        attacks: [
          {
            id: 'thach-tuong-hammer-slam',
            name: 'Chấn Địa Phá Nham',
            kind: 'melee',
            damage: 28,
            windupMs: 680,
            recoveryMs: 750,
            cooldownMs: 1900,
            range: 120,
            telegraph: {
              shape: 'rect',
              length: 135,
              width: 75,
              warningText: 'NỆN BÀN THẠCH',
              color: 0xff7043,
              alpha: 0.45,
            },
            knockback: 45,
            weight: 3,
          },
          {
            id: 'thach-tuong-boulder-throw',
            name: 'Ném Đá Cự Nham',
            kind: 'ranged',
            damage: 25,
            windupMs: 740,
            recoveryMs: 680,
            cooldownMs: 3100,
            range: 290,
            telegraph: {
              shape: 'circle',
              radius: 75,
              warningText: 'CỰ NHAM TẬP KÍCH',
              color: 0xa1887f,
              alpha: 0.42,
            },
            projectileCount: 1,
            projectileSpeed: 210,
            weight: 2,
          },
          {
            id: 'thach-tuong-stomp',
            name: 'Sơn Băng Khí Lãng',
            kind: 'aoe',
            damage: 22,
            windupMs: 580,
            recoveryMs: 620,
            cooldownMs: 2400,
            range: 110,
            telegraph: {
              shape: 'circle',
              radius: 110,
              warningText: 'DẬM CHÂN CHẤN ĐỘNG',
              color: 0xbcaaa4,
              alpha: 0.38,
            },
            knockback: 35,
            weight: 2,
          },
        ],
      },
      {
        phaseIndex: 2,
        name: 'Kim Cương Bất Hoại',
        subtitle: 'Giáp đá thần lực',
        hpThresholdPercent: 0.5,
        speedMultiplier: 1.18,
        damageMultiplier: 1.25,
        defenseBonus: 6,
        themeColor: 0xd7ccc8,
        transitionNotice: 'BÙA CHÚ PHÁT NỔ! THẠCH TƯỚNG KHỞI TẠO THẠCH GIÁP!',
        transitionDurationMs: 1500,
        attacks: [
          {
            id: 'thach-tuong-stone-shield',
            name: 'Thạch Giáp Hộ Thể',
            kind: 'shield',
            damage: 0,
            windupMs: 600,
            recoveryMs: 500,
            cooldownMs: 11000,
            range: 80,
            telegraph: {
              shape: 'circle',
              radius: 90,
              warningText: 'KẾT TỤ GIÁP ĐÁ',
              color: 0xffd54f,
              alpha: 0.5,
            },
            shieldAmount: 120,
            weight: 1,
          },
          {
            id: 'thach-tuong-fissure-cross',
            name: 'Địa Liệt Tứ Phương',
            kind: 'aoe',
            damage: 36,
            windupMs: 820,
            recoveryMs: 880,
            cooldownMs: 4400,
            range: 190,
            telegraph: {
              shape: 'line',
              length: 220,
              width: 55,
              warningText: 'NỨT ĐẤT TỨ HƯỚNG',
              color: 0xff5722,
              alpha: 0.52,
            },
            hazardDurationMs: 2200,
            weight: 3,
          },
          {
            id: 'thach-tuong-earthquake',
            name: 'Tản Viên Đại Chấn',
            kind: 'aoe',
            damage: 32,
            windupMs: 920,
            recoveryMs: 980,
            cooldownMs: 5600,
            range: 250,
            telegraph: {
              shape: 'ring',
              radius: 230,
              warningText: 'ĐẠI ĐỊA CHẤN TẢN VIÊN',
              color: 0xd84315,
              alpha: 0.58,
            },
            knockback: 70,
            weight: 2,
          },
        ],
      },
    ],
    uniqueMechanics: [
      {
        id: 'stone_shield',
        name: 'Thạch Giáp Hộ Thể',
        description: 'Tạo lớp giáp đá hấp thụ toàn bộ sát thương nhận vào trước khi ảnh hưởng đến máu thật.',
        trigger: 'hp_threshold',
        value: 120,
      },
      {
        id: 'earth_fissures',
        name: 'Vết Nứt Địa Chấn',
        description: 'Để lại các khe nứt địa chấn rực lửa trên mặt đất gây sát thương cho người chơi bước vào.',
        trigger: 'timer',
        value: 2200,
      },
    ],
    reward: {
      xp: 300,
      gold: 160,
      itemDrops: [
        { itemId: 'bamboo-armor', chance: 1.0, quantity: 1 },
        { itemId: 'bronze-scrap', chance: 1.0, quantity: 5 },
      ],
    },
  },

  // 4. HẮC ẤN VÔ DIỆN (Faceless Dark Sigil)
  {
    id: 'hac-an',
    name: 'Hắc Ấn Vô Diện',
    title: 'Thực Thể Hư Vô Tà Ấn',
    lore: 'Thực thể tà đạo ngưng tụ từ ngàn linh hồn ai oán và cổ thuật phong ấn bị lãng quên, không có dung mạo chỉ tỏa ra tử khí.',
    location: 'Phong Châu Thâm Cung',
    maxHp: 680,
    baseSpeed: 74,
    baseAttack: 30,
    radius: 46,
    color: 0x4a148c,
    phases: [
      {
        phaseIndex: 1,
        name: 'Hắc Vực Huyền Cơ',
        subtitle: 'Bóng tối vây hãm',
        hpThresholdPercent: 1.0,
        speedMultiplier: 1.0,
        damageMultiplier: 1.0,
        defenseBonus: 2,
        themeColor: 0x6a1b9a,
        transitionNotice: 'Hư không rách toạc! Hắc Ấn Vô Diện hiện hình!',
        transitionDurationMs: 1000,
        attacks: [
          {
            id: 'hac-an-sigil-beam',
            name: 'Tử Quang Hắc Tuyến',
            kind: 'ranged',
            damage: 30,
            windupMs: 620,
            recoveryMs: 680,
            cooldownMs: 2200,
            range: 330,
            telegraph: {
              shape: 'line',
              length: 330,
              width: 38,
              warningText: 'TỬ QUANG HẮC TUYẾN',
              color: 0xe040fb,
              alpha: 0.48,
            },
            weight: 3,
          },
          {
            id: 'hac-an-teleport-strike',
            name: 'Hư Không Thiểm Kích',
            kind: 'dash',
            damage: 28,
            windupMs: 480,
            recoveryMs: 560,
            cooldownMs: 3400,
            range: 190,
            telegraph: {
              shape: 'circle',
              radius: 85,
              warningText: 'HƯ KHÔNG THIỂM KÍCH',
              color: 0xab47bc,
              alpha: 0.45,
            },
            knockback: 35,
            weight: 2,
          },
          {
            id: 'hac-an-shadow-bolts',
            name: 'Hắc Vũ Tinh Phách',
            kind: 'ranged',
            damage: 16,
            windupMs: 660,
            recoveryMs: 720,
            cooldownMs: 3800,
            range: 340,
            telegraph: {
              shape: 'cone',
              radius: 260,
              angleDeg: 60,
              warningText: 'HẮC VŨ XẠ KÍCH',
              color: 0xba68c8,
              alpha: 0.4,
            },
            projectileCount: 5,
            projectileSpeed: 240,
            projectileSpreadDeg: 45,
            weight: 2,
          },
        ],
      },
      {
        phaseIndex: 2,
        name: 'Đại Diệt Tuyệt Trận',
        subtitle: 'Tận thế Hắc Ấn trảm',
        hpThresholdPercent: 0.5,
        speedMultiplier: 1.3,
        damageMultiplier: 1.38,
        defenseBonus: 4,
        themeColor: 0xd500f9,
        transitionNotice: 'HẮC VỰC THỨC TỈNH! HẮC ẤN VÔ DIỆN GIẢI TOẢ TOÀN PHẦN!',
        transitionDurationMs: 1600,
        attacks: [
          {
            id: 'hac-an-eclipse-eruption',
            name: 'Hắc Nhật Bộc Liệt',
            kind: 'aoe',
            damage: 42,
            windupMs: 860,
            recoveryMs: 920,
            cooldownMs: 5200,
            range: 220,
            telegraph: {
              shape: 'circle',
              radius: 175,
              warningText: 'HẮC NHẬT BỘC LIỆT',
              color: 0xd500f9,
              alpha: 0.58,
            },
            knockback: 50,
            weight: 3,
          },
          {
            id: 'hac-an-doomsday-channel',
            name: 'Đại Trận Hắc Ấn',
            kind: 'channel',
            damage: 65,
            windupMs: 2500,
            recoveryMs: 1100,
            cooldownMs: 13000,
            range: 300,
            telegraph: {
              shape: 'ring',
              radius: 280,
              warningText: 'NGUY HIỂM CỰC ĐỘ: ĐẠI TRẬN HẮC ẤN ĐANG VẬN LỰC!',
              color: 0xff1744,
              alpha: 0.65,
            },
            knockback: 80,
            weight: 2,
          },
          {
            id: 'hac-an-rift-summon',
            name: 'Hư Vô Triệu Hoán',
            kind: 'summon',
            damage: 20,
            windupMs: 720,
            recoveryMs: 680,
            cooldownMs: 6800,
            range: 250,
            telegraph: {
              shape: 'circle',
              radius: 105,
              warningText: 'KHE NỨT HƯ KHÔNG',
              color: 0x7c4dff,
              alpha: 0.44,
            },
            summonType: 'void-rift',
            summonCount: 2,
            hazardDurationMs: 3500,
            weight: 1,
          },
        ],
      },
    ],
    uniqueMechanics: [
      {
        id: 'ultimate_channel',
        name: 'Đại Trận Hắc Ấn',
        description: 'Vận nội lực trong 2.5s chuẩn bị tung đòn hủy diệt; có thể bị phá chiêu nếu người chơi dồn đủ sát thương.',
        trigger: 'channel',
        value: 65,
      },
      {
        id: 'void_teleport',
        name: 'Hư Không Dịch Chuyển',
        description: 'Dịch chuyển tức thời xuyên không gian để thoát hiểm và tập kích từ góc khuất.',
        trigger: 'timer',
        value: 3400,
      },
    ],
    reward: {
      xp: 500,
      gold: 300,
      itemDrops: [
        { itemId: 'bronze-spear', chance: 1.0, quantity: 1 },
        { itemId: 'bamboo-armor', chance: 1.0, quantity: 1 },
        { itemId: 'jade-charm', chance: 1.0, quantity: 1 },
      ],
    },
  },
]);

export const BOSSES_BY_ID: Readonly<Record<BossId, BossDefinition>> = deepFreeze(
  Object.fromEntries(BOSSES.map((boss) => [boss.id, boss])) as Record<BossId, BossDefinition>,
);

export function getBoss(bossId: BossId): BossDefinition | undefined {
  return BOSSES_BY_ID[bossId];
}

export function getAllBosses(): readonly BossDefinition[] {
  return BOSSES;
}
