import { BOSS_IDS } from '../../data/bosses';
import { ENEMIES } from '../../data/config';
import {
  CHAPTER_IDS,
  CHAPTER_WORLD_CONFIGS,
  FALLBACK_CHAPTER_CONFIG,
  getChapterWorldConfig,
  getChapterBarriers,
  pickNextEnemyKind,
  isPositionSafe,
  validateChapterLayout,
  getAllChapterWorldConfigs,
} from './ChapterWorld';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[ChapterWorldSelfCheck Failure] ${message}`);
  }
}

function containsVietnameseChars(text: string): boolean {
  const vnRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
  return vnRegex.test(text);
}

export function runChapterWorldSelfCheck(): true {
  console.log('--- Running Chapter World Self-Check ---');

  // ==========================================================================
  // Suite 1: Tính toàn vẹn dữ liệu & Tính bất biến (Data Integrity & Immutability)
  // ==========================================================================
  assert(CHAPTER_IDS.length === 4, `Phải có đúng 4 chương thần thoại (hiện có ${CHAPTER_IDS.length})`);
  assert(Object.isFrozen(CHAPTER_IDS), 'CHAPTER_IDS phải được đóng băng (frozen)');
  assert(Object.isFrozen(CHAPTER_WORLD_CONFIGS), 'CHAPTER_WORLD_CONFIGS phải được đóng băng');

  const allConfigs = getAllChapterWorldConfigs();
  assert(allConfigs.length === 4, `getAllChapterWorldConfigs trả về đúng 4 cấu hình`);

  const registeredKeys = new Set<string>();
  const registeredNames = new Set<string>();
  const registeredAreas = new Set<string>();
  const registeredBosses = new Set<string>();

  for (let chId = 1; chId <= 4; chId++) {
    const cfg = getChapterWorldConfig(chId);
    assert(Boolean(cfg), `Cấu hình Chương ${chId} không được rỗng`);
    assert(cfg.chapterId === chId, `ID chương phải khớp ${chId}`);
    assert(Object.isFrozen(cfg), `Cấu hình Chương ${chId} phải được đóng băng`);
    assert(Object.isFrozen(cfg.theme), `Chủ đề Chương ${chId} phải được đóng băng`);
    assert(Object.isFrozen(cfg.theme.palette), `Bảng màu Chương ${chId} phải được đóng băng`);
    assert(Object.isFrozen(cfg.portal), `Cổng dịch chuyển Chương ${chId} phải được đóng băng`);
    assert(Object.isFrozen(cfg.enemySpawnPool), `Pool quái Chương ${chId} phải được đóng băng`);
    assert(Object.isFrozen(cfg.barriers), `Chướng ngại vật Chương ${chId} phải được đóng băng`);

    // Đảm bảo không trùng lặp các định danh
    assert(!registeredKeys.has(cfg.key), `Trùng lặp key chương: ${cfg.key}`);
    assert(!registeredNames.has(cfg.name), `Trùng lặp tên chương: ${cfg.name}`);
    assert(!registeredAreas.has(cfg.areaId), `Trùng lặp areaId chương: ${cfg.areaId}`);
    assert(!registeredBosses.has(cfg.bossId), `Trùng lặp bossId chương: ${cfg.bossId}`);
    registeredKeys.add(cfg.key);
    registeredNames.add(cfg.name);
    registeredAreas.add(cfg.areaId);
    registeredBosses.add(cfg.bossId);

    // Trùm phải thuộc BOSS_IDS đã đăng ký trong hệ thống RPG
    assert(BOSS_IDS.includes(cfg.bossId), `Boss ${cfg.bossId} phải thuộc BOSS_IDS`);
    assert(containsVietnameseChars(cfg.name), `Tên vùng ${cfg.name} phải chứa tiếng Việt có dấu`);
    assert(containsVietnameseChars(cfg.subtitle), `Phụ đề ${cfg.subtitle} phải chứa tiếng Việt có dấu`);
  }

  // Khớp chính xác 4 trùm truyền thuyết
  assert(getChapterWorldConfig(1).bossId === 'ho-yeu', 'Chương 1 phải là Hổ Yêu');
  assert(getChapterWorldConfig(2).bossId === 'thuong-luong', 'Chương 2 phải là Thuồng Luồng');
  assert(getChapterWorldConfig(3).bossId === 'thach-tuong', 'Chương 3 phải là Thạch Tướng');
  assert(getChapterWorldConfig(4).bossId === 'hac-an', 'Chương 4 phải là Hắc Ấn');

  console.log('✓ Suite 1: Data Integrity & Immutability Passed');

  // ==========================================================================
  // Suite 2: Tín hiệu thị giác & Bảng màu chủ đề (Presentation & Theming Cues)
  // ==========================================================================
  const ch1Theme = getChapterWorldConfig(1).theme;
  const ch2Theme = getChapterWorldConfig(2).theme;
  const ch3Theme = getChapterWorldConfig(3).theme;
  const ch4Theme = getChapterWorldConfig(4).theme;

  // Chương 1: Rừng trúc u minh
  assert(ch1Theme.visualCues.includes('bamboo_stalks'), 'Chương 1 phải có tín hiệu tre trúc (bamboo_stalks)');
  assert(ch1Theme.visualCues.includes('miasma_fog'), 'Chương 1 phải có tín hiệu sương mù yêu khí (miasma_fog)');

  // Chương 2: Đầm thiêng sông nước
  assert(ch2Theme.visualCues.includes('swamp_water_ripples'), 'Chương 2 phải có tín hiệu sóng nước đầm lầy (swamp_water_ripples)');
  assert(ch2Theme.visualCues.includes('lotus_pads'), 'Chương 2 phải có tín hiệu lá sen/hoa sen (lotus_pads)');
  assert(ch2Theme.visualCues.includes('water_reeds'), 'Chương 2 phải có tín hiệu lau sậy ven nước (water_reeds)');

  // Chương 3: Núi Tản Viên & đền thờ linh sơn
  assert(ch3Theme.visualCues.includes('mountain_crags'), 'Chương 3 phải có tín hiệu vách đá núi non (mountain_crags)');
  assert(ch3Theme.visualCues.includes('temple_lanterns'), 'Chương 3 phải có tín hiệu đèn đá đền thờ (temple_lanterns)');
  assert(ch3Theme.visualCues.includes('sacred_steles'), 'Chương 3 phải có tín hiệu bia đá/thạch bích (sacred_steles)');

  // Chương 4: Hoàng thành Phong Châu & Đấu trường thiên mệnh
  assert(ch4Theme.visualCues.includes('citadel_flagstones'), 'Chương 4 phải có tín hiệu gạch lát hoàng thành (citadel_flagstones)');
  assert(ch4Theme.visualCues.includes('imperial_banners'), 'Chương 4 phải có tín hiệu cờ lệnh hoàng triều (imperial_banners)');
  assert(ch4Theme.visualCues.includes('ceremonial_braziers'), 'Chương 4 phải có tín hiệu vạc đồng nghi lễ (ceremonial_braziers)');

  // Các bảng màu nền đất và vòng đấu phải phân biệt rõ rệt giữa 4 chương
  const groundColors = new Set([
    ch1Theme.palette.groundColor,
    ch2Theme.palette.groundColor,
    ch3Theme.palette.groundColor,
    ch4Theme.palette.groundColor,
  ]);
  assert(groundColors.size === 4, 'Bảng màu nền đất phải riêng biệt cho cả 4 chương');

  const arenaRuneColors = new Set([
    ch1Theme.palette.arenaRuneColor,
    ch2Theme.palette.arenaRuneColor,
    ch3Theme.palette.arenaRuneColor,
    ch4Theme.palette.arenaRuneColor,
  ]);
  assert(arenaRuneColors.size === 4, 'Màu phù ấn tế đàn phải riêng biệt cho cả 4 chương');

  console.log('✓ Suite 2: Presentation & Theming Cues Passed');

  // ==========================================================================
  // Suite 3: An toàn va chạm & Bố cục không gian (Collision Safety & Bounds)
  // ==========================================================================
  for (let chId = 1; chId <= 4; chId++) {
    const cfg = getChapterWorldConfig(chId);
    const validation = validateChapterLayout(chId);
    assert(validation.valid, `Bố cục Chương ${chId} không đạt chuẩn: ${validation.errors.join('; ')}`);

    // Điểm sinh người chơi phải an toàn
    assert(isPositionSafe(chId, cfg.playerSpawn.x, cfg.playerSpawn.y, 21), `Chương ${chId}: Người chơi bị kẹt khi spawn`);

    // Đấu trường trùm phải hoàn toàn thông thoáng
    const arena = cfg.arenaCenter;
    assert(arena.x === 752 && arena.y === 278, `Chương ${chId}: Tọa độ tâm đấu trường chuẩn 752, 278`);
    for (const b of cfg.barriers) {
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const distToArena = Math.hypot(cx - arena.x, cy - arena.y);
      assert(
        distToArena >= arena.radius + 15,
        `Chương ${chId}: Chướng ngại vật tại (${b.x}, ${b.y}) xâm lấn vào sàn đấu trùm (cách ${distToArena.toFixed(1)}px < ${arena.radius + 15}px)`,
      );
    }

    // Hành lang lối vào (entrance corridor) không được có chướng ngại vật
    for (const b of cfg.barriers) {
      const cy = b.y + b.height / 2;
      assert(
        !(b.x < 210 && Math.abs(cy - cfg.playerSpawn.y) < 90),
        `Chương ${chId}: Hành lang xuất phát bị cản trở bởi chướng ngại vật tại (${b.x}, ${b.y})`,
      );
    }

    // Cổng trở về làng (x <= 56, y: 195..345) không được bị cản trở
    const tz = cfg.portal.triggerZone;
    for (const b of cfg.barriers) {
      assert(
        !(b.x <= tz.maxX + 10 && b.y + b.height >= tz.minY && b.y <= tz.maxY),
        `Chương ${chId}: Cổng về làng bị cản bởi chướng ngại vật tại (${b.x}, ${b.y})`,
      );
    }

    // Số lượng chướng ngại vật hợp lý (tạo không khí môi trường nhưng không làm tắc nghẽn bản đồ)
    assert(cfg.barriers.length >= 6 && cfg.barriers.length <= 20, `Chương ${chId}: Số lượng chướng ngại vật hợp lý (${cfg.barriers.length})`);
  }

  console.log('✓ Suite 3: Collision Safety & Bounds Passed');

  // ==========================================================================
  // Suite 4: Pool quái & Cổng dịch chuyển (Spawn Pools & Portal Progression)
  // ==========================================================================
  for (let chId = 1; chId <= 4; chId++) {
    const cfg = getChapterWorldConfig(chId);
    const pool = cfg.enemySpawnPool;
    assert(pool.maxConcurrentEnemies <= 7 && pool.initialSpawns.length <= pool.maxConcurrentEnemies,
      'Chapter enemy concurrency must remain bounded');
    assert(pool.wavePool.every(entry => entry.kind !== 'ho-yeu' && entry.weight > 0),
      'Wave pools contain positive-weight non-boss enemies only');

    // Phải có ít nhất 3 vị trí spawn ban đầu
    assert(pool.initialSpawns.length >= 3, `Chương ${chId}: Cần ít nhất 3 quái ban đầu`);
    for (const spawn of pool.initialSpawns) {
      assert(Boolean(ENEMIES[spawn.kind]), `Chương ${chId}: Loại quái ${spawn.kind} phải hợp lệ`);
      assert(
        isPositionSafe(chId, spawn.x, spawn.y, 20),
        `Chương ${chId}: Điểm spawn quái ban đầu (${spawn.x}, ${spawn.y}) phải an toàn không kẹt vật cản`,
      );
      const distToPlayer = Math.hypot(spawn.x - cfg.playerSpawn.x, spawn.y - cfg.playerSpawn.y);
      assert(distToPlayer >= 160, `Chương ${chId}: Điểm spawn quái ban đầu phải cách xa người chơi (>= 160px)`);
    }

    // Wave pool phải có tổng trọng số > 0
    assert(pool.wavePool.length >= 2, `Chương ${chId}: Wave pool phải có ít nhất 2 loại quái`);
    const totalWeight = pool.wavePool.reduce((sum, e) => sum + e.weight, 0);
    assert(totalWeight > 0.99 && totalWeight < 1.01, `Chương ${chId}: Tổng trọng số wave pool xấp xỉ 1.0`);

    // Kiểm tra hàm pickNextEnemyKind
    const enemyAtLow = pickNextEnemyKind(chId, 0.01);
    const enemyAtHigh = pickNextEnemyKind(chId, 0.99);
    assert(Boolean(ENEMIES[enemyAtLow]), `Chương ${chId}: pickNextEnemyKind trả về quái hợp lệ`);
    assert(Boolean(ENEMIES[enemyAtHigh]), `Chương ${chId}: pickNextEnemyKind trả về quái hợp lệ`);

    // Cổng dịch chuyển phải có nhãn và thông báo tiếng Việt
    assert(Boolean(cfg.portal.label && cfg.portal.label.length >= 5), `Chương ${chId}: Nhãn cổng dịch chuyển hợp lệ`);
    assert(containsVietnameseChars(cfg.portal.label), `Chương ${chId}: Nhãn cổng dịch chuyển có tiếng Việt`);
    assert(containsVietnameseChars(cfg.portal.returnNotice), `Chương ${chId}: Thông báo hồi hương có tiếng Việt`);
  }

  // So sánh trọng số đặc thù từng vùng:
  // Chương 2 (Đầm Thiêng): Trọng số Ma Trơi (linh hỏa đáy nước) cao hơn Mộc Tinh
  const ch2MaTroi = getChapterWorldConfig(2).enemySpawnPool.wavePool.find((e) => e.kind === 'ma-troi')?.weight ?? 0;
  const ch2MocTinh = getChapterWorldConfig(2).enemySpawnPool.wavePool.find((e) => e.kind === 'moc-tinh')?.weight ?? 0;
  assert(ch2MaTroi > ch2MocTinh, 'Chương 2 Đầm Thiêng ưu tiên sinh Ma Trơi hơn Mộc Tinh');

  // Chương 3 (Núi Tản Viên): Trọng số Mộc Tinh (dị thảo bàn thạch) cao hơn Ma Trơi
  const ch3MocTinh = getChapterWorldConfig(3).enemySpawnPool.wavePool.find((e) => e.kind === 'moc-tinh')?.weight ?? 0;
  const ch3MaTroi = getChapterWorldConfig(3).enemySpawnPool.wavePool.find((e) => e.kind === 'ma-troi')?.weight ?? 0;
  assert(ch3MocTinh > ch3MaTroi, 'Chương 3 Núi Tản Viên ưu tiên sinh Mộc Tinh hơn Ma Trơi');

  console.log('✓ Suite 4: Enemy Spawn Pool & Portal Logic Passed');

  // ==========================================================================
  // Suite 5: Fallback an toàn & Tính tất định (Safe Fallback & Determinism)
  // ==========================================================================
  // Thử nghiệm các đầu vào bất thường / ngoài khoảng
  const fallback0 = getChapterWorldConfig(0);
  const fallback5 = getChapterWorldConfig(5);
  const fallbackNeg = getChapterWorldConfig(-99);
  const fallbackNaN = getChapterWorldConfig(NaN);
  const fallbackUndefined = getChapterWorldConfig(undefined as unknown as number);
  const fallbackString = getChapterWorldConfig('invalid' as unknown as number);

  assert(fallback0 === FALLBACK_CHAPTER_CONFIG, 'Chapter 0 fallback an toàn về Chương 1');
  assert(fallback5 === FALLBACK_CHAPTER_CONFIG, 'Chapter 5 fallback an toàn về Chương 1');
  assert(fallbackNeg === FALLBACK_CHAPTER_CONFIG, 'Chapter âm fallback an toàn về Chương 1');
  assert(fallbackNaN === FALLBACK_CHAPTER_CONFIG, 'Chapter NaN fallback an toàn về Chương 1');
  assert(fallbackUndefined === FALLBACK_CHAPTER_CONFIG, 'Chapter undefined fallback an toàn về Chương 1');
  assert(fallbackString === FALLBACK_CHAPTER_CONFIG, 'Chapter string fallback an toàn về Chương 1');

  // getChapterBarriers cũng phải fallback an toàn
  const fallbackBarriers = getChapterBarriers(999);
  assert(fallbackBarriers === FALLBACK_CHAPTER_CONFIG.barriers, 'getChapterBarriers fallback an toàn');

  // Tính tất định: gọi 50 lần liên tiếp luôn trả về cùng đối tượng bất biến
  for (let i = 0; i < 50; i++) {
    const c1 = getChapterWorldConfig(1);
    const c2 = getChapterWorldConfig(2);
    assert(c1 === CHAPTER_WORLD_CONFIGS[1], 'Tính tất định cho Chương 1');
    assert(c2 === CHAPTER_WORLD_CONFIGS[2], 'Tính tất định cho Chương 2');
    assert(pickNextEnemyKind(2, 0.2) === pickNextEnemyKind(2, 0.2), 'Tính tất định khi pick quái cùng roll');
  }

  console.log('✓ Suite 5: Safe Fallback & Determinism Passed');
  console.log('--- Chapter World Self-Check Complete: All 5 Suites Passed Successfully! ---');

  return true;
}

// Auto-run when executed directly via Node / tsx
const proc = (
  globalThis as unknown as {
    process?: {
      argv?: string[];
      exit?: (code?: number) => void;
    };
  }
).process;

if (
  proc?.argv &&
  proc.argv.some((arg: string) => typeof arg === 'string' && arg.includes('chapterWorldSelfCheck'))
) {
  try {
    runChapterWorldSelfCheck();
    proc.exit?.(0);
  } catch (err) {
    console.error(err);
    proc.exit?.(1);
  }
}
