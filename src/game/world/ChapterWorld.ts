import type { BossId } from '../../data/bosses';
import type { EnemyKind } from '../../data/config';
import { PALETTE, W, H } from '../../data/config';
import { COMMON_ENEMIES, ELITES } from '../../data/contentCatalog';
import type { Barrier } from './WorldBounds';

/**
 * Tiện ích đóng băng đệ quy để đảm bảo tính bất biến toàn diện (deep immutability).
 */
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

export interface ChapterPortalConfig {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly returnNotice: string;
  readonly triggerZone: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  };
}

export interface ChapterArenaConfig {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface ChapterThemePalette {
  readonly groundColor: number;
  readonly groundDetailColor: number;
  readonly arenaFloorColor: number;
  readonly arenaRuneColor: number;
  readonly arenaAccentColor: number;
  readonly bannerFill: number;
  readonly bannerBorder: number;
  readonly gateFill: number;
  readonly gateBorder: number;
  readonly ambientFogColor: number;
}

export interface ChapterThemeConfig {
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly areaName: string;
  readonly palette: ChapterThemePalette;
  readonly visualCues: readonly string[];
}

export interface ChapterSpawnEntry {
  readonly kind: EnemyKind;
  readonly weight: number;
}

export interface ChapterInitialSpawn {
  readonly kind: EnemyKind;
  readonly x: number;
  readonly y: number;
}

export interface ChapterSpawnPool {
  readonly initialSpawns: readonly ChapterInitialSpawn[];
  readonly wavePool: readonly ChapterSpawnEntry[];
  readonly maxConcurrentEnemies: number;
  readonly waveIntervalMs: number;
  readonly requiredKills: number;
}

export interface ChapterWorldConfig {
  readonly chapterId: number;
  readonly key: string;
  readonly name: string;
  readonly areaId: string;
  readonly subtitle: string;
  readonly bossId: BossId;
  readonly bossName: string;
  readonly playerSpawn: { readonly x: number; readonly y: number };
  readonly arenaCenter: ChapterArenaConfig;
  readonly portal: ChapterPortalConfig;
  readonly theme: ChapterThemeConfig;
  readonly enemySpawnPool: ChapterSpawnPool;
  readonly barriers: readonly Barrier[];
}

export const CHAPTER_IDS: readonly number[] = deepFreeze([1, 2, 3, 4]);

function createWavePool(areaId: string, legacy: readonly ChapterSpawnEntry[]): readonly ChapterSpawnEntry[] {
  const entries = [
    ...legacy.map(entry => ({ ...entry, weight: entry.weight * 0.2 })),
    ...COMMON_ENEMIES.filter(enemy => enemy.areaId === areaId).map(enemy => ({ kind: enemy.id as EnemyKind, weight: 1 })),
    ...ELITES.filter(enemy => enemy.areaId === areaId).map(enemy => ({ kind: enemy.id as EnemyKind, weight: 0.25 })),
  ];
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return entries.map(entry => ({ ...entry, weight: entry.weight / total }));
}

/**
 * Lọc và bảo đảm an toàn va chạm tuyệt đối cho các chướng ngại vật trong màn chơi:
 * - Giữ thông thoáng điểm xuất phát người chơi (138, 270)
 * - Giữ thông thoáng hành lang xuất phát (x < 210, Math.abs(y - 270) < 95)
 * - Giữ thông thoáng cổng dịch chuyển trở về (x <= 56, 195 <= y <= 345)
 * - Giữ thông thoáng toàn bộ vòng đấu trùm (tâm 752, 278, bán kính an toàn >= 105px)
 * - Nằm trọn vẹn trong biên thế giới di chuyển được
 */
function createSafeBarriers(
  candidates: readonly { readonly x: number; readonly y: number; readonly width?: number; readonly height?: number }[],
): readonly Barrier[] {
  const result: Barrier[] = [];
  const playerX = 138;
  const playerY = 270;
  const arenaX = 752;
  const arenaY = 278;

  for (const c of candidates) {
    const width = c.width ?? 12;
    const height = c.height ?? 16;
    const x = c.x;
    const y = c.y;
    const cx = x + width / 2;
    const cy = y + height / 2;

    // 1. Phải nằm trong ranh giới di chuyển hợp lệ
    if (x < 35 || x + width > W - 30 || y < 102 || y + height > H - 35) {
      continue;
    }

    // 2. Không được nằm trong hành lang xuất phát
    if (x < 215 && Math.abs(cy - playerY) < 95) {
      continue;
    }

    // 3. Không được va chạm với điểm xuất phát người chơi
    if (Math.hypot(cx - playerX, cy - playerY) < 55) {
      continue;
    }

    // 4. Không được chắn cổng trở về làng (x <= 60, y: 190..350)
    if (x <= 65 && y + height >= 190 && y <= 350) {
      continue;
    }

    // 5. Không được chắn vòng đấu trùm (giữ sàn đấu mượt mà cho chiêu lướt/ném/kỹ năng)
    if (Math.hypot(cx - arenaX, cy - arenaY) < 110) {
      continue;
    }

    result.push({ x, y, width, height });
  }

  return deepFreeze(result);
}

// ============================================================================
// BỐ CỤC CHƯỚNG NGẠI VẬT CHO TỪNG CHƯƠNG (DETERMINISTIC COLLISION LAYOUTS)
// ============================================================================

const CH1_RAW_BARRIERS = Array.from({ length: 16 }, (_, i) => ({
  x: 35 + ((i * 173) % 910) - 4,
  y: 110 + ((i * 139) % 380) + 8,
  width: 10,
  height: 14,
}));

const CH2_RAW_BARRIERS = Array.from({ length: 18 }, (_, i) => ({
  x: 45 + ((i * 181 + 30) % 900),
  y: 112 + ((i * 149 + 25) % 375),
  width: 14,
  height: 14,
}));

const CH3_RAW_BARRIERS = Array.from({ length: 18 }, (_, i) => ({
  x: 40 + ((i * 167 + 45) % 895),
  y: 115 + ((i * 157 + 35) % 370),
  width: 16,
  height: 16,
}));

const CH4_RAW_BARRIERS = Array.from({ length: 20 }, (_, i) => ({
  x: 50 + ((i * 179 + 20) % 890),
  y: 118 + ((i * 143 + 40) % 365),
  width: 14,
  height: 18,
}));

export const CHAPTER_BARRIERS: Readonly<Record<number, readonly Barrier[]>> = deepFreeze({
  1: createSafeBarriers(CH1_RAW_BARRIERS),
  2: createSafeBarriers(CH2_RAW_BARRIERS),
  3: createSafeBarriers(CH3_RAW_BARRIERS),
  4: createSafeBarriers(CH4_RAW_BARRIERS),
});

// ============================================================================
// DỮ LIỆU ĐẶC TẢ KHÔNG GIAN 4 CHƯƠNG (4 CHAPTER WORLD CONFIGURATIONS)
// ============================================================================

export const CHAPTER_WORLD_CONFIGS: Readonly<Record<number, ChapterWorldConfig>> = deepFreeze({
  1: {
    chapterId: 1,
    key: 'chuong-1',
    name: 'Rừng Trúc U Minh',
    areaId: 'rung-truc-u-minh',
    subtitle: 'Yêu khí bao phủ — Sào huyệt Hổ Yêu',
    bossId: 'ho-yeu',
    bossName: 'Hổ Yêu U Minh',
    playerSpawn: { x: 138, y: 270 },
    arenaCenter: { x: 752, y: 278, radius: 85 },
    portal: {
      label: '← VỀ LÀNG',
      x: 10,
      y: 205,
      width: 30,
      height: 175,
      returnNotice: 'Đã trở về làng Lạc Thủy an toàn.',
      triggerZone: { minX: 0, maxX: 56, minY: 195, maxY: 345 },
    },
    theme: {
      key: 'bamboo-forest',
      title: 'RỪNG TRÚC U MINH',
      subtitle: 'Yêu khí bao phủ — Sào huyệt Hổ Yêu',
      areaName: 'Rừng Trúc U Minh',
      palette: {
        groundColor: 0x162c21,
        groundDetailColor: 0x224231,
        arenaFloorColor: 0x213a2d,
        arenaRuneColor: 0x7c4987,
        arenaAccentColor: 0x9b59b6,
        bannerFill: 0x142c26,
        bannerBorder: PALETTE.bronze,
        gateFill: 0x274938,
        gateBorder: PALETTE.bronze,
        ambientFogColor: 0x1c382a,
      },
      visualCues: ['bamboo_stalks', 'miasma_fog', 'runic_stones', 'demonic_altar'],
    },
    enemySpawnPool: {
      initialSpawns: [
        { kind: 'moc-tinh', x: 490, y: 238 },
        { kind: 'ma-troi', x: 650, y: 338 },
        { kind: 'moc-tinh', x: 790, y: 190 },
      ],
      wavePool: createWavePool('rung-truc-u-minh', [
        { kind: 'moc-tinh', weight: 0.54 },
        { kind: 'ma-troi', weight: 0.46 },
      ]),
      maxConcurrentEnemies: 7,
      waveIntervalMs: 3600,
      requiredKills: 6,
    },
    barriers: CHAPTER_BARRIERS[1],
  },
  2: {
    chapterId: 2,
    key: 'chuong-2',
    name: 'Đầm Thiêng Ba Vì',
    areaId: 'dam-thieng',
    subtitle: 'Nộ ba cuộn trào — Sào huyệt Thuồng Luồng',
    bossId: 'thuong-luong',
    bossName: 'Thuồng Luồng Nhiễm Tà',
    playerSpawn: { x: 138, y: 270 },
    arenaCenter: { x: 752, y: 278, radius: 85 },
    portal: {
      label: '← BẾN NƯỚC VỀ LÀNG',
      x: 10,
      y: 205,
      width: 30,
      height: 175,
      returnNotice: 'Đã rút lui qua bến nước về làng Lạc Thủy.',
      triggerZone: { minX: 0, maxX: 56, minY: 195, maxY: 345 },
    },
    theme: {
      key: 'swamp-water',
      title: 'ĐẦM THIÊNG BA VÌ',
      subtitle: 'Nộ ba cuộn trào — Sào huyệt Thuồng Luồng',
      areaName: 'Đầm Thiêng',
      palette: {
        groundColor: 0x0f2924,
        groundDetailColor: 0x163f37,
        arenaFloorColor: 0x173a38,
        arenaRuneColor: 0x2ca0b0,
        arenaAccentColor: 0x5cd0de,
        bannerFill: 0x122c2a,
        bannerBorder: PALETTE.blue,
        gateFill: 0x1a3f3b,
        gateBorder: PALETTE.blue,
        ambientFogColor: 0x18443e,
      },
      visualCues: ['swamp_water_ripples', 'lotus_pads', 'water_reeds', 'sunken_totems'],
    },
    enemySpawnPool: {
      initialSpawns: [
        { kind: 'ma-troi', x: 510, y: 230 },
        { kind: 'ma-troi', x: 670, y: 340 },
        { kind: 'moc-tinh', x: 800, y: 190 },
      ],
      wavePool: createWavePool('dam-thieng', [
        { kind: 'ma-troi', weight: 0.72 },
        { kind: 'moc-tinh', weight: 0.28 },
      ]),
      maxConcurrentEnemies: 7,
      waveIntervalMs: 3600,
      requiredKills: 6,
    },
    barriers: CHAPTER_BARRIERS[2],
  },
  3: {
    chapterId: 3,
    key: 'chuong-3',
    name: 'Núi Tản Viên',
    areaId: 'nui-tan-vien',
    subtitle: 'Linh sơn hộ quốc — Đỉnh thiêng Thạch Tướng',
    bossId: 'thach-tuong',
    bossName: 'Thạch Tướng Cổ',
    playerSpawn: { x: 138, y: 270 },
    arenaCenter: { x: 752, y: 278, radius: 85 },
    portal: {
      label: '← ĐƯỜNG ĐÈO VỀ LÀNG',
      x: 10,
      y: 205,
      width: 30,
      height: 175,
      returnNotice: 'Đã xuống núi trở về làng Lạc Thủy.',
      triggerZone: { minX: 0, maxX: 56, minY: 195, maxY: 345 },
    },
    theme: {
      key: 'mountain-temple',
      title: 'NÚI TẢN VIÊN',
      subtitle: 'Linh sơn hộ quốc — Đỉnh thiêng Thạch Tướng',
      areaName: 'Núi Tản Viên',
      palette: {
        groundColor: 0x23282b,
        groundDetailColor: 0x333a3d,
        arenaFloorColor: 0x353a3c,
        arenaRuneColor: 0xd4af37,
        arenaAccentColor: 0xf6d365,
        bannerFill: 0x222629,
        bannerBorder: PALETTE.gold,
        gateFill: 0x31373a,
        gateBorder: PALETTE.gold,
        ambientFogColor: 0x30363a,
      },
      visualCues: ['mountain_crags', 'temple_lanterns', 'sacred_steles', 'stone_pillars'],
    },
    enemySpawnPool: {
      initialSpawns: [
        { kind: 'moc-tinh', x: 480, y: 220 },
        { kind: 'moc-tinh', x: 680, y: 330 },
        { kind: 'ma-troi', x: 790, y: 200 },
      ],
      wavePool: createWavePool('nui-tan-vien', [
        { kind: 'moc-tinh', weight: 0.74 },
        { kind: 'ma-troi', weight: 0.26 },
      ]),
      maxConcurrentEnemies: 7,
      waveIntervalMs: 3600,
      requiredKills: 6,
    },
    barriers: CHAPTER_BARRIERS[3],
  },
  4: {
    chapterId: 4,
    key: 'chuong-4',
    name: 'Hoàng Thành Phong Châu',
    areaId: 'phong-chau',
    subtitle: 'Cấm địa kinh đô — Huyết chiến Hắc Ấn',
    bossId: 'hac-an',
    bossName: 'Hắc Ấn Vô Diện',
    playerSpawn: { x: 138, y: 270 },
    arenaCenter: { x: 752, y: 278, radius: 90 },
    portal: {
      label: '← HẬU TUYẾN VỀ LÀNG',
      x: 10,
      y: 205,
      width: 30,
      height: 175,
      returnNotice: 'Đã rút về hậu tuyến làng Lạc Thủy.',
      triggerZone: { minX: 0, maxX: 56, minY: 195, maxY: 345 },
    },
    theme: {
      key: 'phong-chau-arena',
      title: 'HOÀNG THÀNH PHONG CHÂU',
      subtitle: 'Cấm địa kinh đô — Huyết chiến Hắc Ấn',
      areaName: 'Phong Châu',
      palette: {
        groundColor: 0x24181c,
        groundDetailColor: 0x3b242a,
        arenaFloorColor: 0x3d2024,
        arenaRuneColor: 0xda3737,
        arenaAccentColor: 0xf3c66f,
        bannerFill: 0x29181c,
        bannerBorder: PALETTE.red,
        gateFill: 0x3a1f24,
        gateBorder: PALETTE.red,
        ambientFogColor: 0x2f1b21,
      },
      visualCues: ['citadel_flagstones', 'imperial_banners', 'ceremonial_braziers', 'void_rift_spires'],
    },
    enemySpawnPool: {
      initialSpawns: [
        { kind: 'ma-troi', x: 490, y: 225 },
        { kind: 'moc-tinh', x: 660, y: 340 },
        { kind: 'ma-troi', x: 810, y: 195 },
      ],
      wavePool: createWavePool('phong-chau', [
        { kind: 'moc-tinh', weight: 0.5 },
        { kind: 'ma-troi', weight: 0.5 },
      ]),
      maxConcurrentEnemies: 7,
      waveIntervalMs: 3600,
      requiredKills: 6,
    },
    barriers: CHAPTER_BARRIERS[4],
  },
});

export const FALLBACK_CHAPTER_CONFIG: ChapterWorldConfig = CHAPTER_WORLD_CONFIGS[1];

/**
 * Lấy cấu hình không gian thế giới theo Chapter ID.
 * Tự động fallback an toàn về Chương 1 nếu chapterId không hợp lệ (null, undefined, ngoài khoảng 1..4).
 */
export function getChapterWorldConfig(chapterId: number | unknown): ChapterWorldConfig {
  if (typeof chapterId !== 'number' || !Number.isInteger(chapterId)) {
    return FALLBACK_CHAPTER_CONFIG;
  }
  const config = CHAPTER_WORLD_CONFIGS[chapterId];
  return config ?? FALLBACK_CHAPTER_CONFIG;
}

/**
 * Lấy danh sách chướng ngại vật an toàn theo Chapter ID.
 */
export function getChapterBarriers(chapterId: number | unknown): readonly Barrier[] {
  return getChapterWorldConfig(chapterId).barriers;
}

/**
 * Chọn loại quái tiếp theo từ wave pool dựa vào trọng số ngẫu nhiên hoặc giá trị truyền vào.
 */
export function pickNextEnemyKind(chapterId: number | unknown, roll = Math.random()): EnemyKind {
  const config = getChapterWorldConfig(chapterId);
  const pool = config.enemySpawnPool.wavePool;
  const clampedRoll = Number.isFinite(roll) ? Math.max(0, Math.min(1 - Number.EPSILON, roll)) : 0;
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);

  let accumulated = 0;
  for (const entry of pool) {
    accumulated += entry.weight / totalWeight;
    if (clampedRoll <= accumulated) {
      return entry.kind;
    }
  }

  return pool[0]?.kind ?? 'moc-tinh';
}

/**
 * Kiểm tra xem một vị trí (x, y) với bán kính radius có an toàn không bị kẹt vào chướng ngại vật hay ngoài biên.
 */
export function isPositionSafe(chapterId: number | unknown, x: number, y: number, radius = 21): boolean {
  if (x < 33 + radius || x > W - 28 - radius || y < 99 + radius || y > H - 32 - radius) {
    return false;
  }

  const barriers = getChapterBarriers(chapterId);
  for (const b of barriers) {
    const closestX = Math.max(b.x, Math.min(x, b.x + b.width));
    const closestY = Math.max(b.y, Math.min(y, b.y + b.height));
    const distSq = (x - closestX) * (x - closestX) + (y - closestY) * (y - closestY);
    if (distSq < radius * radius) {
      return false;
    }
  }

  return true;
}

/**
 * Kiểm tra tính hợp lệ toàn diện của bố cục chương:
 * - Điểm xuất phát an toàn
 * - Cổng trở về làng không bị chắn
 * - Hành lang vào thông thoáng
 * - Đấu trường trùm không bị chướng ngại vật xâm lấn
 * - Tất cả chướng ngại vật nằm trong biên
 */
export function validateChapterLayout(chapterId: number | unknown): { readonly valid: boolean; readonly errors: readonly string[] } {
  const config = getChapterWorldConfig(chapterId);
  const errors: string[] = [];

  // 1. Kiểm tra điểm xuất phát
  if (!isPositionSafe(config.chapterId, config.playerSpawn.x, config.playerSpawn.y, 21)) {
    errors.push(`Điểm xuất phát người chơi (${config.playerSpawn.x}, ${config.playerSpawn.y}) bị kẹt va chạm.`);
  }

  // 2. Kiểm tra đấu trường trùm
  const arena = config.arenaCenter;
  for (const b of config.barriers) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    if (Math.hypot(cx - arena.x, cy - arena.y) < arena.radius + 15) {
      errors.push(`Chướng ngại vật tại (${b.x}, ${b.y}) xâm lấn vào đấu trường trùm.`);
    }
  }

  // 3. Kiểm tra cổng trở về làng
  const tz = config.portal.triggerZone;
  for (const b of config.barriers) {
    if (b.x <= tz.maxX + 10 && b.y + b.height >= tz.minY && b.y <= tz.maxY) {
      errors.push(`Chướng ngại vật tại (${b.x}, ${b.y}) chắn cổng dịch chuyển trở về làng.`);
    }
  }

  // 4. Kiểm tra hành lang xuất phát
  for (const b of config.barriers) {
    const cy = b.y + b.height / 2;
    if (b.x < 210 && Math.abs(cy - config.playerSpawn.y) < 90) {
      errors.push(`Chướng ngại vật tại (${b.x}, ${b.y}) nằm trong hành lang xuất phát.`);
    }
  }

  // 5. Kiểm tra biên thế giới
  for (const b of config.barriers) {
    if (b.x < 33 || b.x + b.width > W - 28 || b.y < 99 || b.y + b.height > H - 32) {
      errors.push(`Chướng ngại vật (${b.x}, ${b.y}, ${b.width}, ${b.height}) vượt khỏi biên thế giới.`);
    }
    if (b.width <= 0 || b.height <= 0) {
      errors.push(`Chướng ngại vật kích thước không hợp lệ (${b.width}x${b.height}).`);
    }
  }

  // 6. Kiểm tra các điểm sinh quái ban đầu
  for (const spawn of config.enemySpawnPool.initialSpawns) {
    if (!isPositionSafe(config.chapterId, spawn.x, spawn.y, 20)) {
      errors.push(`Điểm sinh quái ban đầu (${spawn.x}, ${spawn.y}) bị kẹt chướng ngại vật hoặc ra ngoài biên.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getAllChapterWorldConfigs(): readonly ChapterWorldConfig[] {
  return [
    CHAPTER_WORLD_CONFIGS[1],
    CHAPTER_WORLD_CONFIGS[2],
    CHAPTER_WORLD_CONFIGS[3],
    CHAPTER_WORLD_CONFIGS[4],
  ];
}
