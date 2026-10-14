/**
 * Comprehensive Minigames World & Village Integration QA Test Suite
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 *
 * Kiểm tra độc lập 5 ma trận:
 * 1. Festival NPC Registry Validation (3 NPCs, metadata, gameId, lore, dialogues).
 * 2. World Bounds, Barriers & Collision Safety (x: 50..950, y: 150..550, không kẹt vật cản).
 * 3. Story NPC Isolation & Content Catalog Invariance (NAMED_NPCS đúng 15 story NPCs).
 * 4. VillageScene Integration & Control Wiring (F: CHƠI, zone 78x90, lock condition, shutdown).
 * 5. Texture & MinigameOverlay Wiring (textures tồn tại, modal menu 5 lựa chọn, navigation).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = process.cwd();

console.log('================================================================');
console.log('THẦN MỆNH: MINIGAMES WORLD & VILLAGE INTEGRATION QA SUITE');
console.log('================================================================\n');

function transpileCode(filePath) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const code = fs.readFileSync(fullPath, 'utf8');
  return ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
}

function loadModule(filePath, customDependencies = {}, customGlobals = {}) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const transpiled = transpileCode(fullPath);
  const moduleResult = { exports: {} };
  const context = {
    exports: moduleResult.exports,
    module: moduleResult,
    require: (id) => {
      if (customDependencies[id]) return customDependencies[id];
      try {
        return require(id);
      } catch {
        return {};
      }
    },
    ...customGlobals,
  };
  vm.runInNewContext(transpiled, context);
  return moduleResult.exports;
}

// ============================================================================
// SUITE 1: FESTIVAL NPC REGISTRY VALIDATION
// ============================================================================
console.log('--- Suite 1: Festival NPC Registry Validation ---');
{
  const artworkMod = loadModule('src/game/minigames/MinigameArtwork.ts');
  const registryMod = loadModule('src/game/minigames/MinigameNpcRegistry.ts', {
    './MinigameArtwork': artworkMod,
    './MinigameTypes': {},
  });

  const { FESTIVAL_NPCS, getFestivalNpcs, getFestivalNpcById, getFestivalNpcByGameId } = registryMod;

  assert.ok(Array.isArray(FESTIVAL_NPCS), 'FESTIVAL_NPCS must be an array');
  assert.equal(FESTIVAL_NPCS.length, 3, 'Must define exactly 3 festival minigame NPCs');
  assert.ok(Object.isFrozen(FESTIVAL_NPCS), 'FESTIVAL_NPCS array should be frozen (immutable)');

  const npcs = getFestivalNpcs();
  assert.equal(npcs.length, 3, 'getFestivalNpcs() must return 3 NPCs');

  // 1. Thầy Thẻ Lạc
  const thayTheLac = npcs.find((n) => n.id === 'thay-the-lac');
  assert.ok(thayTheLac, 'NPC "thay-the-lac" must exist');
  assert.equal(thayTheLac.name, 'Thầy Thẻ Lạc');
  assert.equal(thayTheLac.title, 'Người Giữ Thẻ Cổ Văn Lang');
  assert.equal(thayTheLac.gameId, '7321');
  assert.equal(thayTheLac.x, 380, 'Thầy Thẻ Lạc x position must be 380');
  assert.equal(thayTheLac.y, 220, 'Thầy Thẻ Lạc y position must be 220');
  assert.equal(thayTheLac.position.x, 380);
  assert.equal(thayTheLac.position.y, 220);
  assert.ok(
    thayTheLac.dialogues[0].includes('Thử vận may với những lá thẻ Văn Lang chứ'),
    'Thầy Thẻ Lạc dialogue matches spec'
  );
  assert.ok(
    thayTheLac.lore.includes('Ẩn sĩ nắm giữ bộ thẻ bài đồng cổ 52 lá'),
    'Thầy Thẻ Lạc lore matches spec'
  );
  assert.equal(thayTheLac.portraitKey, 'minigame_npc_thay_the_lac');

  // 2. Lão Đồng Xúc
  const laoDongXuc = npcs.find((n) => n.id === 'lao-dong-xuc');
  assert.ok(laoDongXuc, 'NPC "lao-dong-xuc" must exist');
  assert.equal(laoDongXuc.name, 'Lão Đồng Xúc');
  assert.equal(laoDongXuc.title, 'Chủ Sạp Xúc Xắc Đồng');
  assert.equal(laoDongXuc.gameId, 'lucky_dice');
  assert.equal(laoDongXuc.x, 620, 'Lão Đồng Xúc x position must be 620');
  assert.equal(laoDongXuc.y, 225, 'Lão Đồng Xúc y position must be 225');
  assert.equal(laoDongXuc.position.x, 620);
  assert.equal(laoDongXuc.position.y, 225);
  assert.ok(
    laoDongXuc.dialogues[0].includes('Ba viên xúc xắc, một lần dự đoán'),
    'Lão Đồng Xúc dialogue matches spec'
  );
  assert.ok(
    laoDongXuc.lore.includes('Thợ đúc đồng rành nghề'),
    'Lão Đồng Xúc lore matches spec'
  );
  assert.equal(laoDongXuc.portraitKey, 'minigame_npc_lao_dong_xuc');

  // 3. Nàng Họa Linh
  const nangHoaLinh = npcs.find((n) => n.id === 'nang-hoa-linh');
  assert.ok(nangHoaLinh, 'NPC "nang-hoa-linh" must exist');
  assert.equal(nangHoaLinh.name, 'Nàng Họa Linh');
  assert.equal(nangHoaLinh.title, 'Nghệ Nhân Linh Vật Dân Gian');
  assert.equal(nangHoaLinh.gameId, 'animal_guess');
  assert.equal(nangHoaLinh.x, 740, 'Nàng Họa Linh x position must be 740');
  assert.equal(nangHoaLinh.y, 360, 'Nàng Họa Linh y position must be 360');
  assert.equal(nangHoaLinh.position.x, 740);
  assert.equal(nangHoaLinh.position.y, 360);
  assert.ok(
    nangHoaLinh.dialogues[0].includes('Hãy chọn hình mà ngươi tin sẽ xuất hiện'),
    'Nàng Họa Linh dialogue matches spec'
  );
  assert.ok(
    nangHoaLinh.lore.includes('Nghệ nhân tài hoa vẽ 6 linh vật Bách Việt'),
    'Nàng Họa Linh lore matches spec'
  );
  assert.equal(nangHoaLinh.portraitKey, 'minigame_npc_nang_hoa_linh');

  // Helper functions
  assert.equal(getFestivalNpcById('thay-the-lac')?.name, 'Thầy Thẻ Lạc');
  assert.equal(getFestivalNpcByGameId('lucky_dice')?.name, 'Lão Đồng Xúc');
  assert.equal(getFestivalNpcByGameId('animal_guess')?.name, 'Nàng Họa Linh');

  console.log('✓ Suite 1: Festival NPC Registry Validation Passed\n');
}

// ============================================================================
// SUITE 2: WORLD BOUNDS, BARRIERS & COLLISION SAFETY
// ============================================================================
console.log('--- Suite 2: World Bounds, Barriers & Collision Safety ---');
{
  const boundsMod = loadModule('src/game/world/WorldBounds.ts', {
    '../../data/config': { W: 960, H: 540 },
  });
  const artworkMod = loadModule('src/game/minigames/MinigameArtwork.ts');
  const registryMod = loadModule('src/game/minigames/MinigameNpcRegistry.ts', {
    './MinigameArtwork': artworkMod,
    './MinigameTypes': {},
  });

  const { VILLAGE_BARRIERS } = boundsMod;
  const { FESTIVAL_NPCS } = registryMod;

  assert.ok(Array.isArray(VILLAGE_BARRIERS), 'VILLAGE_BARRIERS must be defined');

  // Function checking whether a circle overlaps a rectangular barrier
  function circleOverlapsBarrier(px, py, radius, barrier) {
    const closestX = Math.max(barrier.x, Math.min(barrier.x + barrier.width, px));
    const closestY = Math.max(barrier.y, Math.min(barrier.y + barrier.height, py));
    const dx = px - closestX;
    const dy = py - closestY;
    return dx * dx + dy * dy < radius * radius;
  }

  for (const npc of FESTIVAL_NPCS) {
    // 2.1 Bounds check: within village walkable boundaries (x: 50..950, y: 150..550)
    assert.ok(
      npc.x >= 50 && npc.x <= 950,
      `NPC ${npc.name} x coordinate (${npc.x}) must be within 50..950`
    );
    assert.ok(
      npc.y >= 150 && npc.y <= 550,
      `NPC ${npc.name} y coordinate (${npc.y}) must be within 150..550`
    );

    // 2.2 Barrier collision check: NPC point coordinate must not be inside any barrier
    for (const barrier of VILLAGE_BARRIERS) {
      const insideBarrier =
        npc.x >= barrier.x &&
        npc.x <= barrier.x + barrier.width &&
        npc.y >= barrier.y &&
        npc.y <= barrier.y + barrier.height;
      assert.ok(
        !insideBarrier,
        `NPC ${npc.name} at (${npc.x}, ${npc.y}) must not be inside barrier [x:${barrier.x}, y:${barrier.y}, w:${barrier.width}, h:${barrier.height}]`
      );

      // Verify clearance from barrier edge (clearance >= 10px)
      const collides = circleOverlapsBarrier(npc.x, npc.y, 10, barrier);
      assert.ok(
        !collides,
        `NPC ${npc.name} at (${npc.x}, ${npc.y}) must maintain clearance from barrier [x:${barrier.x}, y:${barrier.y}, w:${barrier.width}, h:${barrier.height}]`
      );
    }
  }

  // 2.3 NPC Mutual Distance: NPCs should not overlap each other (> 100px apart)
  for (let i = 0; i < FESTIVAL_NPCS.length; i++) {
    for (let j = i + 1; j < FESTIVAL_NPCS.length; j++) {
      const a = FESTIVAL_NPCS[i];
      const b = FESTIVAL_NPCS[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(dist >= 100, `NPCs ${a.name} and ${b.name} must be spaced apart (dist: ${dist.toFixed(1)}px)`);
    }
  }

  // 2.4 Spawn point & Gate clear check
  const playerSpawn = { x: 406, y: 347 };
  for (const npc of FESTIVAL_NPCS) {
    const distToSpawn = Math.hypot(npc.x - playerSpawn.x, npc.y - playerSpawn.y);
    assert.ok(distToSpawn > 80, `NPC ${npc.name} must not spawn on top of player (dist: ${distToSpawn}px)`);
  }

  console.log('✓ Suite 2: World Bounds, Barriers & Collision Safety Passed\n');
}

// ============================================================================
// SUITE 3: STORY NPC ISOLATION & CONTENT CATALOG INVARIANCE
// ============================================================================
console.log('--- Suite 3: Story NPC Isolation & Content Catalog Invariance ---');
{
  const catalogContent = fs.readFileSync(path.join(root, 'src/data/contentCatalog.ts'), 'utf8');
  assert.ok(
    catalogContent.includes('export const NAMED_NPCS:'),
    'contentCatalog.ts must contain NAMED_NPCS definition'
  );

  const section = catalogContent.split('export const NAMED_NPCS:')[1].split(']);')[0];
  const ids = [...section.matchAll(/\bid: '([^']+)'/g)].map((m) => m[1]);

  // Requirement: exactly 15 story NPCs must remain intact to preserve check:npcs
  assert.equal(ids.length, 15, 'NAMED_NPCS must contain exactly 15 story NPCs');

  // Verify festival minigame IDs are NOT in NAMED_NPCS
  const festivalIds = ['thay-the-lac', 'lao-dong-xuc', 'nang-hoa-linh'];
  for (const fId of festivalIds) {
    assert.ok(
      !ids.includes(fId),
      `Festival NPC '${fId}' must not be injected into NAMED_NPCS in contentCatalog.ts`
    );
  }

  console.log('✓ Suite 3: Story NPC Isolation & Content Catalog Invariance Passed\n');
}

// ============================================================================
// SUITE 4: VILLAGESCENE INTEGRATION & CONTROL WIRING
// ============================================================================
console.log('--- Suite 4: VillageScene Integration & Control Wiring ---');
{
  const villageSceneContent = fs.readFileSync(
    path.join(root, 'src/game/scenes/VillageScene.ts'),
    'utf8'
  );

  // 4.1 Required Imports
  assert.ok(
    villageSceneContent.includes("from '../minigames/MinigameArtwork'"),
    'VillageScene.ts must import from MinigameArtwork'
  );
  assert.ok(
    villageSceneContent.includes('ensureMinigameTextures'),
    'VillageScene.ts must import ensureMinigameTextures'
  );
  assert.ok(
    villageSceneContent.includes("from '../minigames/MinigameNpcRegistry'"),
    'VillageScene.ts must import from MinigameNpcRegistry'
  );
  assert.ok(
    villageSceneContent.includes('getFestivalNpcs'),
    'VillageScene.ts must import getFestivalNpcs'
  );
  assert.ok(
    villageSceneContent.includes("from '../minigames/MinigameOverlay'"),
    'VillageScene.ts must import from MinigameOverlay'
  );
  assert.ok(
    villageSceneContent.includes('MinigameOverlay'),
    'VillageScene.ts must reference MinigameOverlay'
  );

  // 4.2 Preload textures call
  assert.ok(
    villageSceneContent.includes('ensureMinigameTextures(this)'),
    'VillageScene.preload() must invoke ensureMinigameTextures(this)'
  );

  // 4.3 Create call to getFestivalNpcs
  assert.ok(
    villageSceneContent.includes('getFestivalNpcs()'),
    'VillageScene.create() must fetch festival NPCs via getFestivalNpcs()'
  );

  // 4.4 Rendering & Tooltip
  assert.ok(
    villageSceneContent.includes("'F: CHƠI'"),
    'VillageScene.create() must render "F: CHƠI" tooltip for festival minigame NPCs'
  );

  // 4.5 Interactive Zone (78, 90) & Click handling
  assert.ok(
    villageSceneContent.includes('78, 90'),
    'VillageScene must register 78x90 interactive touch zone for NPCs'
  );
  assert.ok(
    villageSceneContent.includes('118'),
    'VillageScene must enforce distance threshold < 118 for interaction'
  );
  assert.ok(
    villageSceneContent.includes('interactFestivalNpc'),
    'VillageScene must wire interactFestivalNpc on click and F key'
  );

  // 4.6 Player Movement Lock Predicate
  assert.ok(
    villageSceneContent.includes('Boolean(this.minigameOverlay)'),
    'VillageScene must lock player controls while minigameOverlay is active'
  );

  // 4.7 Shutdown cleanup
  assert.ok(
    villageSceneContent.includes('this.minigameOverlay?.destroy()'),
    'VillageScene shutdown handler must cleanly destroy minigameOverlay'
  );

  // 4.8 Modal Menu Options Verification
  const requiredMenuOptions = [
    'Vào chơi ngay',
    'Tìm hiểu luật',
    'Xem phần thưởng',
    'Lịch sử chơi',
    'Rời đi',
  ];
  for (const option of requiredMenuOptions) {
    assert.ok(
      villageSceneContent.includes(`'${option}'`) || villageSceneContent.includes(`"${option}"`),
      `VillageScene festival NPC dialogue menu must contain option '${option}'`
    );
  }

  console.log('✓ Suite 4: VillageScene Integration & Control Wiring Passed\n');
}

// ============================================================================
// SUITE 5: TEXTURE KEYS & MINIGAMEOVERLAY WIRING
// ============================================================================
console.log('--- Suite 5: Texture Keys & MinigameOverlay Wiring ---');
{
  const artworkMod = loadModule('src/game/minigames/MinigameArtwork.ts');
  const { MINIGAME_TEXTURE_KEYS } = artworkMod;

  assert.equal(MINIGAME_TEXTURE_KEYS.npcThayTheLac, 'minigame_npc_thay_the_lac');
  assert.equal(MINIGAME_TEXTURE_KEYS.npcLaoDongXuc, 'minigame_npc_lao_dong_xuc');
  assert.equal(MINIGAME_TEXTURE_KEYS.npcNangHoaLinh, 'minigame_npc_nang_hoa_linh');

  // Verify MinigameOverlay can be constructed with flexible signatures
  const overlayMod = loadModule('src/game/minigames/MinigameOverlay.ts', {
    phaser: {},
    '../../data/config': { W: 960, H: 540, UI_DEPTH: 500 },
    './MinigameTypes': {
      MINIGAME_NPCS: {
        '7321': { portraitKey: 'p1', gameTitle: '7321', npcName: 'Thầy Thẻ Lạc', tagline: '' },
        lucky_dice: { portraitKey: 'p2', gameTitle: 'Xúc Xắc', npcName: 'Lão Đồng Xúc', tagline: '' },
        animal_guess: { portraitKey: 'p3', gameTitle: 'Đoán Thú', npcName: 'Nàng Họa Linh', tagline: '' },
      },
      getNpcForMinigame: (id) => ({ portraitKey: 'p', gameTitle: 'T', npcName: 'N', tagline: '' }),
    },
    './MinigameArtwork': artworkMod,
    './MinigameClient': { minigameClient: {} },
    './games/SevenThreeTwoOneUI': { SevenThreeTwoOneUI: class {} },
    './games/LuckyDiceUI': { LuckyDiceUI: class {} },
    './games/AnimalGuessUI': { AnimalGuessUI: class {} },
    './MinigameRewardsUI': { MinigameRewardsUI: class {} },
    './MinigameHistoryUI': { MinigameHistoryUI: class {} },
    '../input/InputContext': { InputContext: { MODAL: 'MODAL' } },
    '../ui/design-tokens': {
      uiTokens: {},
      uiTypography: { fontFamilies: { display: 'serif', body: 'sans-serif' } },
    },
  });

  const { MinigameOverlay } = overlayMod;
  const mockScene = { add: {}, textures: {} };

  // Test constructor with object options
  const overlay1 = new MinigameOverlay({ scene: mockScene });
  assert.ok(overlay1 instanceof MinigameOverlay, 'Construct with options object succeeds');

  // Test constructor with (scene, gameId, npcId)
  const overlay2 = new MinigameOverlay(mockScene, 'lucky_dice', 'lao-dong-xuc');
  assert.ok(overlay2 instanceof MinigameOverlay, 'Construct with (scene, gameId, npcId) succeeds');
  assert.equal(overlay2.getCurrentGameId(), 'lucky_dice');

  console.log('✓ Suite 5: Texture Keys & MinigameOverlay Wiring Passed\n');
}

console.log('================================================================');
console.log('ALL 5 MINIGAMES WORLD & VILLAGE QA SUITES PASSED SUCCESSFULLY!');
console.log('================================================================\n');
