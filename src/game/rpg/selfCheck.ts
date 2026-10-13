import { ITEMS_BY_ID } from '../../data/items';
import {
  QUESTS,
  QUESTS_BY_ID,
  getMainQuests,
  getSideQuests,
  getQuestsByChapter,
  getQuest,
} from '../../data/quests';
import type { SaveData } from '../systems/GameState';
import { advanceAfterVictory, isFinalChapter } from '../systems/CampaignFlow';
import { addItem, consumeItem, countItem, createInventory, removeItem } from './InventorySystem';
import { calculateEquipmentStats, createEquipment, equipItem, unequipItem } from './EquipmentSystem';
import {
  claimQuest,
  createQuestProgress,
  recordKill,
  setQuestFlag,
  startQuest,
  progressFromSave,
  applyProgressToSave,
  resetQuestForChapter,
} from './QuestSystem';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`RPG self-check failed: ${message}`);
}

function checkInventoryAndEquipment(): void {
  let inventory = createInventory(3);
  inventory = addItem(inventory, 'herbal-balm', 2).state;
  assert(countItem(inventory, 'herbal-balm') === 2, 'stack add');
  const consumed = consumeItem(inventory, 'herbal-balm');
  assert(consumed.changed === 1 && countItem(consumed.state, 'herbal-balm') === 1, 'consume');
  const insufficient = removeItem(createInventory(), 'spirit-stone', 1);
  assert(insufficient.changed === 0 && insufficient.remainder === 1, 'no negative removal');

  inventory = addItem(createInventory(4), 'bronze-spear', 1).state;
  inventory = addItem(inventory, 'bamboo-armor', 1).state;
  const equipped = equipItem(inventory, createEquipment(), 'bronze-spear');
  assert(Boolean(equipped) && calculateEquipmentStats(equipped!.equipment).attack === 4, 'equip stats');
  const unequipped = unequipItem(equipped!.inventory, equipped!.equipment, 'weapon');
  assert(Boolean(unequipped) && countItem(unequipped!.inventory, 'bronze-spear') === 1, 'unequip');
  assert(ITEMS_BY_ID['jade-charm']?.slot === 'accessory', 'item registry');
}

function checkCatalogCountsAndIntegrity(): void {
  // 1. Minimum catalog counts
  const mainQuests = getMainQuests();
  const sideQuests = getSideQuests();
  assert(QUESTS.length >= 27, `Total quests must be >= 27, received ${QUESTS.length}`);
  assert(mainQuests.length >= 12, `Main quests must be >= 12, received ${mainQuests.length}`);
  assert(sideQuests.length >= 15, `Side quests must be >= 15, received ${sideQuests.length}`);

  // 2. Main quests distributed across 4 chapters
  for (let chapter = 1; chapter <= 4; chapter += 1) {
    const chapterQuests = getQuestsByChapter(chapter);
    assert(chapterQuests.length >= 3, `Chapter ${chapter} must have at least 3 main quests, received ${chapterQuests.length}`);
    for (const q of chapterQuests) {
      assert(q.category === 'main', `Chapter quest ${q.id} must be category main`);
      assert(q.chapter === chapter, `Chapter quest ${q.id} must specify chapter ${chapter}`);
    }
  }

  // 3. Unique IDs across the entire catalog
  const ids = QUESTS.map((q) => q.id);
  const uniqueIds = new Set(ids);
  assert(uniqueIds.size === QUESTS.length, `Duplicate quest ID detected! Total: ${QUESTS.length}, unique: ${uniqueIds.size}`);

  // 4. Validate all entries for complete data and no placeholder text
  const placeholderPattern = /\b(todo|placeholder|test|dummy|lorem|tmp)\b/i;
  for (const quest of QUESTS) {
    assert(quest.id.trim().length > 0, `Quest ID cannot be empty`);
    assert(quest.title.trim().length > 0, `Quest ${quest.id} title cannot be empty`);
    assert(quest.description.trim().length > 0, `Quest ${quest.id} description cannot be empty`);
    assert(quest.giverNpcId.trim().length > 0, `Quest ${quest.id} giverNpcId cannot be empty`);

    // No placeholder text
    assert(!placeholderPattern.test(quest.id), `Quest ID '${quest.id}' contains placeholder text`);
    assert(!placeholderPattern.test(quest.title), `Quest '${quest.id}' title contains placeholder text`);
    assert(!placeholderPattern.test(quest.description), `Quest '${quest.id}' description contains placeholder text`);

    // Objectives validity
    assert(quest.objectives.length > 0, `Quest ${quest.id} must have at least 1 objective`);
    for (const obj of quest.objectives) {
      assert(obj.id.trim().length > 0, `Quest ${quest.id} objective ID must not be empty`);
      assert(obj.target.trim().length > 0, `Quest ${quest.id} objective target must not be empty`);
      assert(obj.kind === 'kill' || obj.kind === 'flag', `Quest ${quest.id} objective kind must be kill or flag`);
      assert(obj.required > 0, `Quest ${quest.id} objective required must be > 0`);
      assert(!placeholderPattern.test(obj.id), `Quest ${quest.id} objective ID contains placeholder text`);
      assert(!placeholderPattern.test(obj.target), `Quest ${quest.id} objective target contains placeholder text`);
    }

    // Rewards validity
    assert(quest.reward.gold >= 0, `Quest ${quest.id} reward gold must be >= 0`);
    assert(quest.reward.xp >= 0, `Quest ${quest.id} reward xp must be >= 0`);
    assert(Array.isArray(quest.reward.items), `Quest ${quest.id} reward items must be an array`);
    for (const item of quest.reward.items) {
      assert(item.quantity > 0, `Quest ${quest.id} reward item quantity must be > 0`);
      assert(Boolean(ITEMS_BY_ID[item.itemId]), `Quest ${quest.id} reward item '${item.itemId}' not found in ITEMS_BY_ID`);
    }

    // Lookup consistency
    assert(getQuest(quest.id) === quest, `getQuest(${quest.id}) must return exact quest`);
    assert(QUESTS_BY_ID[quest.id] === quest, `QUESTS_BY_ID[${quest.id}] must match quest`);
  }

  // 5. Verify backwards-compatible legacy quest
  const legacyQuest = getQuest('hunt-ho-yeu');
  assert(Boolean(legacyQuest), 'hunt-ho-yeu must exist in QUESTS');
  assert(legacyQuest!.giverNpcId === 'village-chief', 'hunt-ho-yeu giverNpcId must be village-chief');
  assert(legacyQuest!.objectives.some((o) => o.id === 'forest-kills' && o.required === 6), 'hunt-ho-yeu must have forest-kills objective');
  assert(legacyQuest!.objectives.some((o) => o.id === 'ho-yeu' && o.required === 1), 'hunt-ho-yeu must have ho-yeu objective');
}

function checkObjectiveProgression(): void {
  // Test 1: Single and multi-objective kill progression
  let quest = startQuest(createQuestProgress('hunt-ho-yeu'));
  assert(quest.stage === 'active', 'startQuest sets stage to active');

  // Ignored kill on non-matching target
  const unchanged = recordKill(quest, 'unrelated-monster');
  assert(unchanged === quest || (unchanged.counts['forest-kills'] ?? 0) === 0, 'unrelated target does not increment counts');

  // Incremental kills
  for (let index = 0; index < 6; index += 1) {
    quest = recordKill(quest, 'forest-enemy');
    assert(quest.stage === 'active', 'quest remains active until all objectives done');
  }
  assert((quest.counts['forest-kills'] ?? 0) === 6, 'forest-kills count reached 6');

  // Clamping at required
  const overKilled = recordKill(quest, 'forest-enemy');
  assert((overKilled.counts['forest-kills'] ?? 0) === 6, 'counts do not exceed required count');

  // Boss kill triggers transition to return
  quest = recordKill(quest, 'ho-yeu');
  assert(quest.stage === 'return', 'quest reaches return stage when all kill objectives complete');

  // Cannot record kills when not in active stage
  const postReturn = recordKill(quest, 'ho-yeu');
  assert(postReturn.stage === 'return', 'recordKill ignored when stage is return');

  // Test 2: Flag objective progression (e.g. main-c1-02-mo-duong-rung-truc)
  let flagQuest = startQuest(createQuestProgress('main-c1-02-mo-duong-rung-truc'));
  for (let i = 0; i < 4; i += 1) {
    flagQuest = recordKill(flagQuest, 'moc-tinh');
  }
  assert(flagQuest.stage === 'active', 'quest with remaining flag objective remains active');

  // Set flag by objective id or target
  flagQuest = setQuestFlag(flagQuest, 'beacon-lit');
  assert(flagQuest.stage === 'return', 'quest completes when both kill and flag objectives are satisfied');

  // Flag ignored when not active
  const unstarted = createQuestProgress('main-c1-02-mo-duong-rung-truc');
  const flagIgnored = setQuestFlag(unstarted, 'beacon-lit');
  assert(flagIgnored.stage === 'new', 'setQuestFlag ignored when quest is new');
}

function checkRewardClaim(): void {
  // 1. Cannot claim when stage is 'new' or 'active'
  const newQuest = createQuestProgress('hunt-ho-yeu');
  assert(claimQuest(newQuest) === undefined, 'cannot claim quest with new stage');

  const activeQuest = startQuest(newQuest);
  assert(claimQuest(activeQuest) === undefined, 'cannot claim quest with active stage');

  // 2. Cannot claim non-existent quest
  const invalidQuest = { questId: 'non-existent-quest-xyz', stage: 'return' as const, counts: {}, flags: {}, rewardClaimed: false };
  assert(claimQuest(invalidQuest) === undefined, 'cannot claim invalid quest');

  // 3. Claiming at stage 'return' succeeds
  let readyQuest = startQuest(createQuestProgress('hunt-ho-yeu'));
  for (let index = 0; index < 6; index += 1) readyQuest = recordKill(readyQuest, 'forest-enemy');
  readyQuest = recordKill(readyQuest, 'ho-yeu');
  assert(readyQuest.stage === 'return', 'readyQuest is in return stage');

  const claimResult = claimQuest(readyQuest);
  assert(Boolean(claimResult), 'claimQuest returns reward result');
  assert(claimResult!.progress.stage === 'complete', 'progress stage transitions to complete');
  assert(claimResult!.progress.rewardClaimed === true, 'rewardClaimed flag is set to true');
  assert(claimResult!.reward.gold === 100, 'gold reward matches definition');
  assert(claimResult!.reward.xp === 140, 'xp reward matches definition');
  assert(claimResult!.reward.items.length === 1 && claimResult!.reward.items[0].itemId === 'jade-charm', 'item reward matches definition');

  // 4. Cannot claim a second time (idempotent / one-time reward)
  assert(claimQuest(claimResult!.progress) === undefined, 'cannot claim reward a second time');
}

function checkLegacySaveMapping(): void {
  const createMockSave = (): SaveData => ({
    version: 1,
    hp: 100,
    mp: 100,
    maxHp: 100,
    maxMp: 100,
    attack: 12,
    level: 1,
    xp: 0,
    gold: 0,
    chapter: 1,
    kills: 0,
    quest: 'new',
    bossDead: false,
    storyFlags: {},
    checkpoint: 'village-gate',
    playtimeSeconds: 0,
    upgrades: 0,
    rpg: {
      inventory: { capacity: 24, slots: [] },
      equipment: { slots: {} },
      quests: {},
      skills: {
        unlockedSkillIds: ['skill-earth-quake'],
        equippedSlots: { 'slot-1': 'skill-earth-quake' },
        cooldownUntil: {},
        activeDivinePower: undefined,
        unlockedDivinePowers: [],
      },
    },
  });

  // 1. Legacy save with hunt-ho-yeu (default parameter)
  const legacySave = createMockSave();
  legacySave.quest = 'active';
  legacySave.kills = 4;
  legacySave.bossDead = false;

  const defaultProgress = progressFromSave(legacySave);
  assert(defaultProgress.questId === 'hunt-ho-yeu', 'default progressFromSave targets hunt-ho-yeu');
  assert(defaultProgress.stage === 'active', 'inherits active stage from legacy save.quest');
  assert(defaultProgress.counts['forest-kills'] === 4, 'maps legacy save.kills to forest-kills');
  assert(defaultProgress.counts['ho-yeu'] === 0, 'maps legacy save.bossDead to ho-yeu');
  assert(!defaultProgress.rewardClaimed, 'rewardClaimed is false when stage is active');

  // 2. Legacy save completed state
  const completedSave = createMockSave();
  completedSave.quest = 'complete';
  completedSave.kills = 6;
  completedSave.bossDead = true;
  const completedProgress = progressFromSave(completedSave);
  assert(completedProgress.stage === 'complete', 'maps complete stage');
  assert(completedProgress.rewardClaimed === true, 'maps rewardClaimed true on complete');

  const chapterTwoProgress = startQuest(resetQuestForChapter(completedProgress));
  assert(chapterTwoProgress.stage === 'active', 'new chapter resets completed legacy quest');
  assert(Object.keys(chapterTwoProgress.counts).length === 0, 'new chapter clears legacy quest counts');
  assert(!chapterTwoProgress.rewardClaimed, 'new chapter clears legacy reward state');

  // 3. Generalization: Non-hunt-ho-yeu quest does NOT inherit hunt-ho-yeu counts or stage
  const sideProgress = progressFromSave(legacySave, 'side-01-thuoc-tri-chuong-khi');
  assert(sideProgress.questId === 'side-01-thuoc-tri-chuong-khi', 'targets requested questId');
  assert(sideProgress.stage === 'new', 'fresh quest stage is new, not corrupted by legacy save.quest');
  assert(sideProgress.counts['forest-kills'] === undefined || sideProgress.counts['forest-kills'] === 0, 'no hunt-ho-yeu counts leaked');
  assert(!sideProgress.rewardClaimed, 'fresh quest has rewardClaimed false');

  // 4. applyProgressToSave backward compatibility for hunt-ho-yeu
  let save = createMockSave();
  let huntProgress = startQuest(progressFromSave(save));
  save = applyProgressToSave(save, huntProgress);
  assert(save.quest === 'active', 'save.quest updated to active');
  assert(Boolean(save.rpg.quests['hunt-ho-yeu']), 'hunt-ho-yeu stored in save.rpg.quests');

  huntProgress = recordKill(huntProgress, 'forest-enemy');
  save = applyProgressToSave(save, huntProgress);
  assert(save.kills === 1, 'save.kills synced from hunt-ho-yeu progress');

  // 5. applyProgressToSave for side quest does NOT overwrite root save.quest or save.kills
  let sideQuestProgress = startQuest(createQuestProgress('side-01-thuoc-tri-chuong-khi'));
  sideQuestProgress = recordKill(sideQuestProgress, 'forest-spider');
  save = applyProgressToSave(save, sideQuestProgress);
  assert(save.quest === 'active', 'root save.quest unchanged by side quest');
  assert(save.kills === 1, 'root save.kills unchanged by side quest');
  assert(save.rpg.quests['side-01-thuoc-tri-chuong-khi']?.counts['side-kill-spiders'] === 1, 'side quest stored in rpg.quests');

  // 6. Roundtrip: progressFromSave retrieves saved side quest progress
  const restoredSide = progressFromSave(save, 'side-01-thuoc-tri-chuong-khi');
  assert(restoredSide.stage === 'active', 'retrieved side quest preserves active stage');
  assert(restoredSide.counts['side-kill-spiders'] === 1, 'retrieved side quest preserves objective counts');
}

function checkCampaignFlow(): void {
  const save = createCampaignSave();
  let current = save;
  for (const chapter of [2, 3, 4]) {
    current = advanceAfterVictory(current);
    assert(current.chapter === chapter, `campaign advances to chapter ${chapter}`);
    assert(current.quest === 'new' && current.kills === 0 && !current.bossDead, `chapter ${chapter} resets combat state`);
  }
  assert(isFinalChapter(current), 'chapter 4 is final');
  assert(advanceAfterVictory(current) === current, 'final chapter does not advance');
}

function createCampaignSave(): SaveData {
  return {
    version: 1, hp: 100, mp: 100, maxHp: 100, maxMp: 100, attack: 12,
    level: 1, xp: 0, gold: 0, chapter: 1, kills: 6, quest: 'return', bossDead: true,
    storyFlags: {}, checkpoint: 'forest-portal', playtimeSeconds: 0, upgrades: 0,
    rpg: { inventory: { capacity: 24, slots: [] }, equipment: { slots: {} }, quests: {},
      skills: { unlockedSkillIds: [], equippedSlots: {}, cooldownUntil: {}, activeDivinePower: undefined, unlockedDivinePowers: [] }, },
  };
}

export function runSelfCheck(): true {
  checkInventoryAndEquipment();
  checkCatalogCountsAndIntegrity();
  checkObjectiveProgression();
  checkRewardClaim();
  checkLegacySaveMapping();
  checkCampaignFlow();
  return true;
}
