import { BOSS_IDS } from './bosses';
import { ITEMS_BY_ID } from './items';
import { SKILLS_BY_ID } from './skills';
import {
  CONTENT_CATALOG,
  CHAPTERS,
  MAIN_AREAS,
  DUNGEONS,
  NAMED_NPCS,
  COMMON_ENEMIES,
  ELITES,
  MAIN_QUESTS,
  SIDE_QUESTS,
  ALL_QUESTS,
  getChapter,
  getArea,
  getDungeon,
  getNpc,
  getEnemy,
  getElite,
  getQuest,
  getMainQuests,
  getSideQuests,
  getQuestsByChapter,
  getQuestsByArea,
  getQuestsByNpc,
  getEnemiesByArea,
  getDungeonsByArea,
  getNpcsByArea,
} from './contentCatalog';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[ContentSelfCheck Failure] ${message}`);
  }
}

/**
 * Kiểm tra chuỗi văn bản không được chứa từ khóa placeholder / lorem và phải có nội dung thực chất.
 */
function assertNoPlaceholder(text: string, context: string): void {
  assert(Boolean(text && text.trim().length > 0), `${context}: chuỗi không được để trống`);
  const lower = text.toLowerCase();
  const bannedKeywords = ['lorem', 'ipsum', 'placeholder', 'todo', 'tbd', 'temp text', 'chưa có', 'xxx'];
  for (const banned of bannedKeywords) {
    assert(!lower.includes(banned), `${context}: phát hiện từ khóa placeholder cấm "${banned}" trong "${text}"`);
  }
}

/**
 * Kiểm tra chuỗi chứa ký tự tiếng Việt có dấu đặc trưng của thần thoại Việt Nam.
 */
function containsVietnameseChars(text: string): boolean {
  const vnRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
  return vnRegex.test(text);
}

export function runContentSelfCheck(): true {
  // ==========================================================================
  // Suite 1: Định lượng danh mục nội dung 1.0 (Required Counts Assertion)
  // ==========================================================================
  assert(CHAPTERS.length === 4, `Yêu cầu chính xác 4 chapters (hiện có ${CHAPTERS.length})`);
  assert(MAIN_AREAS.length === 5, `Yêu cầu chính xác 5 main areas (hiện có ${MAIN_AREAS.length})`);
  assert(DUNGEONS.length === 3, `Yêu cầu chính xác 3 dungeons (hiện có ${DUNGEONS.length})`);
  assert(NAMED_NPCS.length === 15, `Yêu cầu chính xác 15 named NPCs (hiện có ${NAMED_NPCS.length})`);
  assert(COMMON_ENEMIES.length === 12, `Yêu cầu chính xác 12 common enemies (hiện có ${COMMON_ENEMIES.length})`);
  assert(ELITES.length === 4, `Yêu cầu chính xác 4 elites (hiện có ${ELITES.length})`);
  assert(MAIN_QUESTS.length === 12, `Yêu cầu chính xác 12 main quests (hiện có ${MAIN_QUESTS.length})`);
  assert(SIDE_QUESTS.length === 15, `Yêu cầu chính xác 15 side quests (hiện có ${SIDE_QUESTS.length})`);
  assert(ALL_QUESTS.length === 27, `Yêu cầu tổng cộng 27 quests (12 main + 15 side, hiện có ${ALL_QUESTS.length})`);

  // ==========================================================================
  // Suite 2: Tính độc nhất của định danh (Unique IDs) & Không Placeholder
  // ==========================================================================
  const chapterIds = new Set<number>();
  const chapterKeys = new Set<string>();
  for (const ch of CHAPTERS) {
    assert(!chapterIds.has(ch.id), `Trùng lặp chapter id: ${ch.id}`);
    assert(!chapterKeys.has(ch.key), `Trùng lặp chapter key: ${ch.key}`);
    chapterIds.add(ch.id);
    chapterKeys.add(ch.key);
    assertNoPlaceholder(ch.title, `Chapter ${ch.id} title`);
    assertNoPlaceholder(ch.subtitle, `Chapter ${ch.id} subtitle`);
    assertNoPlaceholder(ch.objective, `Chapter ${ch.id} objective`);
    assertNoPlaceholder(ch.narrativeSummary, `Chapter ${ch.id} narrativeSummary`);
    assert(containsVietnameseChars(ch.title), `Chapter ${ch.id} tiêu đề phải có tiếng Việt`);
  }

  const areaIds = new Set<string>();
  for (const area of MAIN_AREAS) {
    assert(!areaIds.has(area.id), `Trùng lặp area id: ${area.id}`);
    areaIds.add(area.id);
    assertNoPlaceholder(area.name, `Area ${area.id} name`);
    assertNoPlaceholder(area.vietnameseTitle, `Area ${area.id} vietnameseTitle`);
    assertNoPlaceholder(area.description, `Area ${area.id} description`);
    assert(area.description.length >= 30, `Area ${area.id} mô tả phải chi tiết (>= 30 ký tự)`);
    assert(containsVietnameseChars(area.name), `Area ${area.id} tên phải có tiếng Việt`);
    assert(area.landmarks.length >= 3, `Area ${area.id} phải có ít nhất 3 địa danh đặc trưng`);
  }

  const dungeonIds = new Set<string>();
  for (const dg of DUNGEONS) {
    assert(!dungeonIds.has(dg.id), `Trùng lặp dungeon id: ${dg.id}`);
    dungeonIds.add(dg.id);
    assertNoPlaceholder(dg.name, `Dungeon ${dg.id} name`);
    assertNoPlaceholder(dg.vietnameseTitle, `Dungeon ${dg.id} vietnameseTitle`);
    assertNoPlaceholder(dg.description, `Dungeon ${dg.id} description`);
    assert(dg.floorCount >= 2, `Dungeon ${dg.id} phải có ít nhất 2 tầng`);
    assert(containsVietnameseChars(dg.name), `Dungeon ${dg.id} tên phải có tiếng Việt`);
  }

  const npcIds = new Set<string>();
  for (const npc of NAMED_NPCS) {
    assert(!npcIds.has(npc.id), `Trùng lặp npc id: ${npc.id}`);
    npcIds.add(npc.id);
    assertNoPlaceholder(npc.name, `NPC ${npc.id} name`);
    assertNoPlaceholder(npc.role, `NPC ${npc.id} role`);
    assertNoPlaceholder(npc.lore, `NPC ${npc.id} lore`);
    assert(npc.dialogues.length >= 2, `NPC ${npc.id} phải có ít nhất 2 câu thoại đối thoại`);
    for (const d of npc.dialogues) {
      assertNoPlaceholder(d, `NPC ${npc.id} thoại`);
      assert(containsVietnameseChars(d), `NPC ${npc.id} thoại phải có tiếng Việt`);
    }
  }

  const enemyIds = new Set<string>();
  for (const en of COMMON_ENEMIES) {
    assert(!enemyIds.has(en.id), `Trùng lặp common enemy id: ${en.id}`);
    enemyIds.add(en.id);
    assertNoPlaceholder(en.name, `Enemy ${en.id} name`);
    assertNoPlaceholder(en.vietnameseTitle, `Enemy ${en.id} vietnameseTitle`);
    assertNoPlaceholder(en.description, `Enemy ${en.id} description`);
    assert(en.hp > 0 && en.attack > 0 && en.defense >= 0, `Enemy ${en.id} chỉ số phải hợp lệ`);
    assert(containsVietnameseChars(en.name), `Enemy ${en.id} tên phải có tiếng Việt`);
  }

  const eliteIds = new Set<string>();
  for (const el of ELITES) {
    assert(!eliteIds.has(el.id), `Trùng lặp elite id: ${el.id}`);
    assert(!enemyIds.has(el.id), `Elite id không được trùng với common enemy id: ${el.id}`);
    eliteIds.add(el.id);
    assertNoPlaceholder(el.name, `Elite ${el.id} name`);
    assertNoPlaceholder(el.title, `Elite ${el.id} title`);
    assertNoPlaceholder(el.specialMechanic, `Elite ${el.id} specialMechanic`);
    assertNoPlaceholder(el.lore, `Elite ${el.id} lore`);
    assert(el.hp >= 200, `Elite ${el.id} phải có lượng máu tương xứng mini-boss (>= 200)`);
    assert(containsVietnameseChars(el.name), `Elite ${el.id} tên phải có tiếng Việt`);
  }

  const questIds = new Set<string>();
  for (const q of ALL_QUESTS) {
    assert(!questIds.has(q.id), `Trùng lặp quest id: ${q.id}`);
    questIds.add(q.id);
    assertNoPlaceholder(q.title, `Quest ${q.id} title`);
    assertNoPlaceholder(q.description, `Quest ${q.id} description`);
    assert(q.objectives.length >= 1, `Quest ${q.id} phải có ít nhất 1 mục tiêu`);
    for (const obj of q.objectives) {
      assertNoPlaceholder(obj.description, `Quest ${q.id} objective ${obj.id}`);
      assert(obj.requiredCount > 0, `Quest ${q.id} mục tiêu count > 0`);
    }
    assert(q.reward.gold > 0 && q.reward.xp > 0, `Quest ${q.id} phần thưởng phải có gold và xp`);
  }

  // ==========================================================================
  // Suite 3: Đảm bảo tính bất biến toàn diện (Full Deep Immutability)
  // ==========================================================================
  assert(Object.isFrozen(CONTENT_CATALOG), 'CONTENT_CATALOG phải được đóng băng (frozen)');
  assert(Object.isFrozen(CONTENT_CATALOG.chapters), 'CONTENT_CATALOG.chapters phải được đóng băng');
  assert(Object.isFrozen(CONTENT_CATALOG.areas), 'CONTENT_CATALOG.areas phải được đóng băng');
  assert(Object.isFrozen(CONTENT_CATALOG.dungeons), 'CONTENT_CATALOG.dungeons phải được đóng băng');
  assert(Object.isFrozen(CONTENT_CATALOG.npcs), 'CONTENT_CATALOG.npcs phải được đóng băng');
  assert(Object.isFrozen(CONTENT_CATALOG.commonEnemies), 'CONTENT_CATALOG.commonEnemies phải được đóng băng');
  assert(Object.isFrozen(CONTENT_CATALOG.elites), 'CONTENT_CATALOG.elites phải được đóng băng');
  assert(Object.isFrozen(CONTENT_CATALOG.mainQuests), 'CONTENT_CATALOG.mainQuests phải được đóng băng');
  assert(Object.isFrozen(CONTENT_CATALOG.sideQuests), 'CONTENT_CATALOG.sideQuests phải được đóng băng');
  assert(Object.isFrozen(CONTENT_CATALOG.quests), 'CONTENT_CATALOG.quests phải được đóng băng');

  for (const ch of CHAPTERS) assert(Object.isFrozen(ch), `Chapter ${ch.id} phải được đóng băng`);
  for (const area of MAIN_AREAS) assert(Object.isFrozen(area), `Area ${area.id} phải được đóng băng`);
  for (const dg of DUNGEONS) assert(Object.isFrozen(dg), `Dungeon ${dg.id} phải được đóng băng`);
  for (const npc of NAMED_NPCS) assert(Object.isFrozen(npc), `NPC ${npc.id} phải được đóng băng`);
  for (const en of COMMON_ENEMIES) assert(Object.isFrozen(en), `Enemy ${en.id} phải được đóng băng`);
  for (const el of ELITES) assert(Object.isFrozen(el), `Elite ${el.id} phải được đóng băng`);
  for (const q of ALL_QUESTS) assert(Object.isFrozen(q), `Quest ${q.id} phải được đóng băng`);

  // ==========================================================================
  // Suite 4: Toàn vẹn tham chiếu chéo (Referential Integrity & Cross-References)
  // ==========================================================================
  // 4.1. Chapters -> Bosses & Areas
  for (const ch of CHAPTERS) {
    assert(BOSS_IDS.includes(ch.bossId), `Chapter ${ch.id} bossId "${ch.bossId}" phải thuộc BOSS_IDS`);
    assert(areaIds.has(ch.areaId), `Chapter ${ch.id} areaId "${ch.areaId}" phải tồn tại trong MAIN_AREAS`);
  }

  // 4.2. Main Areas -> Dungeons & Bosses & Connected Areas
  for (const area of MAIN_AREAS) {
    if (area.bossId !== null) {
      assert(BOSS_IDS.includes(area.bossId), `Area ${area.id} bossId "${area.bossId}" phải thuộc BOSS_IDS`);
    }
    for (const connId of area.connectedAreaIds) {
      assert(areaIds.has(connId), `Area ${area.id} kết nối tới area không tồn tại: ${connId}`);
    }
    for (const dgId of area.dungeonIds) {
      assert(dungeonIds.has(dgId), `Area ${area.id} chứa dungeon không tồn tại: ${dgId}`);
    }
  }

  // 4.3. Dungeons -> Main Areas & Elites & Enemies
  for (const dg of DUNGEONS) {
    assert(areaIds.has(dg.areaId), `Dungeon ${dg.id} trỏ tới areaId không hợp lệ: ${dg.areaId}`);
    assert(eliteIds.has(dg.eliteId), `Dungeon ${dg.id} trỏ tới eliteId không hợp lệ: ${dg.eliteId}`);
    assert(enemyIds.has(dg.keyDropEnemyId), `Dungeon ${dg.id} trỏ tới keyDropEnemyId không hợp lệ: ${dg.keyDropEnemyId}`);
    for (const rItemId of dg.rewardItemIds) {
      assert(Boolean(ITEMS_BY_ID[rItemId]), `Dungeon ${dg.id} reward itemId "${rItemId}" phải thuộc ITEMS_BY_ID`);
    }
  }

  // 4.4. NPCs -> Areas & Quests
  for (const npc of NAMED_NPCS) {
    assert(areaIds.has(npc.areaId), `NPC ${npc.id} thuộc areaId không hợp lệ: ${npc.areaId}`);
    for (const qId of npc.questIds) {
      assert(questIds.has(qId), `NPC ${npc.id} liên kết tới questId không tồn tại: ${qId}`);
    }
  }

  // 4.5. Common Enemies -> Areas & Drops
  for (const en of COMMON_ENEMIES) {
    assert(areaIds.has(en.areaId), `Enemy ${en.id} thuộc areaId không hợp lệ: ${en.areaId}`);
    for (const dItemId of en.dropItemIds) {
      assert(Boolean(ITEMS_BY_ID[dItemId]), `Enemy ${en.id} drop itemId "${dItemId}" phải thuộc ITEMS_BY_ID`);
    }
  }

  // 4.6. Elites -> Areas & Dungeons & Associated Bosses
  for (const el of ELITES) {
    assert(areaIds.has(el.areaId), `Elite ${el.id} thuộc areaId không hợp lệ: ${el.areaId}`);
    if (el.dungeonId !== null) {
      assert(dungeonIds.has(el.dungeonId), `Elite ${el.id} trỏ tới dungeonId không hợp lệ: ${el.dungeonId}`);
    }
    assert(BOSS_IDS.includes(el.associatedBossId), `Elite ${el.id} associatedBossId "${el.associatedBossId}" phải thuộc BOSS_IDS`);
    for (const dItemId of el.dropItemIds) {
      assert(Boolean(ITEMS_BY_ID[dItemId]), `Elite ${el.id} drop itemId "${dItemId}" phải thuộc ITEMS_BY_ID`);
    }
  }

  // 4.7. Quests -> Chapters, Areas, NPCs, Prerequisites, Skills, Items, Objectives
  for (const q of ALL_QUESTS) {
    assert(chapterIds.has(q.chapterId), `Quest ${q.id} chapterId ${q.chapterId} không hợp lệ`);
    assert(areaIds.has(q.areaId), `Quest ${q.id} areaId ${q.areaId} không hợp lệ`);
    assert(npcIds.has(q.giverNpcId), `Quest ${q.id} giverNpcId "${q.giverNpcId}" không tồn tại trong NAMED_NPCS`);
    assert(npcIds.has(q.turnInNpcId), `Quest ${q.id} turnInNpcId "${q.turnInNpcId}" không tồn tại trong NAMED_NPCS`);

    if (q.prerequisiteQuestId) {
      assert(questIds.has(q.prerequisiteQuestId), `Quest ${q.id} prerequisiteQuestId "${q.prerequisiteQuestId}" không tồn tại`);
    }

    if (q.reward.unlockedSkillId) {
      assert(
        Boolean(SKILLS_BY_ID[q.reward.unlockedSkillId]),
        `Quest ${q.id} unlockedSkillId "${q.reward.unlockedSkillId}" phải tồn tại trong SKILLS_BY_ID`,
      );
    }

    for (const rItem of q.reward.items) {
      assert(Boolean(ITEMS_BY_ID[rItem.itemId]), `Quest ${q.id} reward itemId "${rItem.itemId}" phải thuộc ITEMS_BY_ID`);
    }

    // Verify objective targets
    for (const obj of q.objectives) {
      if (obj.kind === 'kill') {
        const isCommonEnemy = enemyIds.has(obj.targetId);
        const isElite = eliteIds.has(obj.targetId);
        const isBoss = BOSS_IDS.includes(obj.targetId as any);
        assert(
          isCommonEnemy || isElite || isBoss,
          `Quest ${q.id} mục tiêu tiêu diệt targetId "${obj.targetId}" phải là common enemy, elite, hoặc boss`,
        );
      } else if (obj.kind === 'talk') {
        assert(npcIds.has(obj.targetId), `Quest ${q.id} mục tiêu đối thoại targetId "${obj.targetId}" phải là NPC`);
      } else if (obj.kind === 'collect') {
        assert(Boolean(ITEMS_BY_ID[obj.targetId]), `Quest ${q.id} mục tiêu thu thập targetId "${obj.targetId}" phải là Item`);
      }
    }
  }

  // 4.8. Phân bổ Main Quests theo 4 Chapters (Mỗi chương đúng 3 main quests)
  for (let chId = 1; chId <= 4; chId++) {
    const chapterMainQuests = MAIN_QUESTS.filter((mq) => mq.chapterId === chId);
    assert(chapterMainQuests.length === 3, `Chương ${chId} phải có chính xác 3 main quests (hiện có ${chapterMainQuests.length})`);
  }

  // ==========================================================================
  // Suite 5: Kiểm tra các hàm truy vấn tiện ích (Query Helpers Validation)
  // ==========================================================================
  assert(getChapter(1)?.key === 'chuong-1', 'getChapter(1) trả về chương 1');
  assert(getChapter(99) === undefined, 'getChapter(99) trả về undefined');

  assert(getArea('lang-lac-thuy')?.name === 'Làng Lạc Thủy', 'getArea(lang-lac-thuy) trả về đúng tên');
  assert(getDungeon('dong-am-hon')?.areaId === 'rung-truc-u-minh', 'getDungeon(dong-am-hon) trỏ đúng area');
  assert(getNpc('village-chief')?.role === 'Người giữ lời thề Văn Lang', 'getNpc(village-chief) trả về Trưởng làng Hùng');
  assert(getEnemy('moc-tinh-con')?.level === 1, 'getEnemy(moc-tinh-con) level 1');
  assert(getElite('bach-trao-ho-ma')?.associatedBossId === 'ho-yeu', 'getElite(bach-trao-ho-ma) liên kết Hổ Yêu');
  assert(getQuest('mq-01-tieng-goi-to-tien')?.kind === 'main', 'getQuest(mq-01) là main quest');

  assert(getMainQuests().length === 12, 'getMainQuests() trả về 12');
  assert(getSideQuests().length === 15, 'getSideQuests() trả về 15');
  assert(getQuestsByChapter(1).length >= 3, 'getQuestsByChapter(1) có ít nhất 3 quests');
  assert(getQuestsByArea('lang-lac-thuy').length >= 3, 'getQuestsByArea(lang-lac-thuy) có ít nhất 3 quests');
  assert(getQuestsByNpc('village-chief').length >= 2, 'getQuestsByNpc(village-chief) có ít nhất 2 quests');

  assert(getEnemiesByArea('rung-truc-u-minh').length === 4, 'Rừng trúc có 4 common enemies');
  assert(getDungeonsByArea('dam-thieng').length === 1, 'Đầm thiêng có 1 dungeon');
  assert(getNpcsByArea('lang-lac-thuy').length === 4, 'Làng Lạc Thủy có 4 NPCs');

  return true;
}

// Auto-run when executed directly via Node / tsx
const proc = (globalThis as unknown as { process?: { argv?: string[]; exit?: (code: number) => void } }).process;
if (proc?.argv && proc.argv.some((arg) => typeof arg === 'string' && arg.includes('contentSelfCheck'))) {
  try {
    runContentSelfCheck();
    // eslint-disable-next-line no-console
    console.log('--- Content Catalog Self-Check: All 5 Suites Passed Successfully! ---');
    proc.exit?.(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    proc.exit?.(1);
  }
}
