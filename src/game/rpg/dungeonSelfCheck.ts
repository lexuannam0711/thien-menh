import { COMMON_ENEMIES, DUNGEONS } from '../../data/contentCatalog';
import { ENEMIES, type EnemyKind } from '../../data/config';
import type { SaveData } from '../systems/GameState';
import { getChapterWorldConfig } from '../world/ChapterWorld';
import { countItem, createInventory } from './InventorySystem';
import { createInitialSkillProgress } from './SkillSystem';
import {
  claimDungeonReward, clearDungeonFloor, dungeonEntryError, getChapterDungeon,
  getDungeonFloor, getDungeonFloorEnemies, grantDungeonKey,
} from './DungeonSystem';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('Dungeon self-check failed: ' + message);
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function fixture(chapter: number, level: number): SaveData {
  return freeze({
    version: 1, hp: 100, mp: 100, maxHp: 100, maxMp: 100,
    attack: 12, level, xp: 17, gold: 29, chapter, kills: 0,
    quest: 'new', bossDead: false, storyFlags: {}, checkpoint: 'village',
    playtimeSeconds: 0, upgrades: 0,
    rpg: { inventory: createInventory(), equipment: { slots: {} }, quests: {}, skills: createInitialSkillProgress() },
  });
}

export function runDungeonSelfCheck(): true {
  assert(DUNGEONS.length === 3, 'all three catalog dungeons covered');
  assert(getChapterDungeon(fixture(3, 10)) === undefined, 'chapter without a dungeon');
  for (const candidate of [0, -1, 5, 1.5, NaN, Infinity, '__proto__', 'constructor', null, undefined, Object.create(null), Symbol('chapter')]) {
    const chapter = candidate as unknown as number;
    assert(getChapterDungeon(fixture(chapter, 10)) === undefined, 'invalid chapter cannot use world fallback');
  }
  for (const dungeon of DUNGEONS) {
    const chapter = [1, 2, 3, 4].find(id => getChapterWorldConfig(id).areaId === dungeon.areaId);
    assert(chapter !== undefined, 'dungeon has a chapter');
    const initial = fixture(chapter, dungeon.minLevel);
    const snapshot = JSON.stringify(initial);
    const keyFlag = 'dungeon-key:' + dungeon.id;
    const rewardFlag = 'dungeon-reward:' + dungeon.id;
    assert(getChapterDungeon(initial) === dungeon, 'chapter maps by area');
    assert(dungeonEntryError(initial, dungeon.id) !== null, 'missing key rejects entry');
    assert(clearDungeonFloor(initial, dungeon.id, 0) === initial, 'missing key rejects clearing');
    const key = freeze(grantDungeonKey(initial, dungeon.keyDropEnemyId as EnemyKind));
    assert(key.storyFlags[keyFlag] === true, 'canonical kill grants reusable key');
    assert(key.rpg === initial.rpg, 'key is not an inventory item');
    assert(grantDungeonKey(key, dungeon.keyDropEnemyId as EnemyKind) === key, 'key grant idempotent');
    assert(grantDungeonKey(initial, 'ho-yeu') === initial, 'unrelated kill grants no key');
    assert(grantDungeonKey(initial, '__proto__' as EnemyKind) === initial, 'unknown enemy fails closed');
    assert(dungeonEntryError(key, dungeon.id) === null, 'key permits entry');
    const revisited = freeze({ ...key, chapter: 4, quest: 'active' as const, kills: 5, bossDead: true,
      storyFlags: { ...key.storyFlags, 'unrelated-progress': true },
      rpg: { ...key.rpg, skills: { ...key.rpg.skills, cooldownUntil: { 'earth-shockwave': 12345 } } },
    });
    const revisitSnapshot = JSON.stringify(revisited);
    assert(dungeonEntryError(revisited, dungeon.id, chapter) === null, 'explicit visited chapter permits old dungeon entry');
    if (chapter < revisited.chapter) {
      assert(dungeonEntryError(revisited, dungeon.id) !== null, 'default still rejects wrong current area');
      assert(clearDungeonFloor(revisited, dungeon.id, 0) === revisited, 'default cannot clear old dungeon');
      assert(claimDungeonReward(revisited, dungeon.id).blocked, 'default cannot claim old dungeon');
    }
    if (chapter > 1) {
      const future = freeze({ ...key, chapter: chapter - 1 });
      assert(dungeonEntryError(future, dungeon.id, chapter) !== null, 'future matching dungeon rejected');
      assert(clearDungeonFloor(future, dungeon.id, 0, chapter) === future, 'future dungeon cannot clear');
      const denied = claimDungeonReward(future, dungeon.id, chapter);
      assert(denied.save === future && !denied.claimed && denied.blocked, 'future dungeon cannot award');
    }
    let visitedProgress: SaveData = revisited;
    for (let index = 0; index < dungeon.floorCount; index += 1) {
      const next = freeze(clearDungeonFloor(visitedProgress, dungeon.id, index, chapter));
      assert(next !== visitedProgress && getDungeonFloor(next, dungeon.id) === index + 1, 'visited dungeon clears sequentially');
      assert(next.chapter === 4 && next.quest === 'active' && next.kills === 5 && next.bossDead, 'visited clear preserves campaign');
      visitedProgress = next;
    }
    for (const candidate of [0, -1, 1.5, NaN, Infinity, -Infinity, 5, chapter === 1 ? 2 : 1, '1', null, {}, Symbol('area')]) {
      const area = candidate as unknown as number;
      assert(dungeonEntryError(revisited, dungeon.id, area) !== null, 'invalid or mismatched visited area rejected');
      assert(clearDungeonFloor(revisited, dungeon.id, 0, area) === revisited, 'invalid visited area cannot clear');
      const denied = claimDungeonReward(visitedProgress, dungeon.id, area);
      assert(denied.save === visitedProgress && !denied.claimed && denied.blocked, 'invalid visited area cannot award completed dungeon');
    }
    const visitedReward = claimDungeonReward(visitedProgress, dungeon.id, chapter);
    assert(visitedReward.claimed && !visitedReward.blocked, 'visited dungeon awards rewards');
    assert(visitedReward.save.chapter === 4 && visitedReward.save.quest === 'active'
      && visitedReward.save.kills === 5 && visitedReward.save.bossDead, 'visited reward preserves campaign');
    assert(visitedReward.save.rpg.skills === revisited.rpg.skills && visitedReward.save.rpg.quests === revisited.rpg.quests,
      'visited dungeon preserves cooldowns and authored quest progress');
    assert(visitedReward.save.storyFlags[keyFlag] && visitedReward.save.storyFlags[rewardFlag]
      && visitedReward.save.storyFlags['unrelated-progress'] && getDungeonFloor(visitedReward.save, dungeon.id) === dungeon.floorCount,
      'visited reward retains key, floors, unrelated progress');
    assert(dungeonEntryError(visitedReward.save, dungeon.id, chapter) === null, 'visited key remains reusable');
    for (const itemId of dungeon.rewardItemIds) assert(countItem(visitedReward.save.rpg.inventory, itemId) === 1, 'visited catalog reward once');
    const visitedRepeat = claimDungeonReward(freeze(visitedReward.save), dungeon.id, chapter);
    assert(!visitedRepeat.claimed && !visitedRepeat.blocked && visitedRepeat.save === visitedReward.save, 'visited reward cannot repeat');
    assert(JSON.stringify(revisited) === revisitSnapshot, 'visited dungeon never mutates input');
    for (const flags of [null, undefined, true, [], 'invalid']) {
      const malformed = freeze({ ...key, storyFlags: flags as unknown as SaveData['storyFlags'] });
      assert(dungeonEntryError(malformed, dungeon.id) !== null, 'malformed flags deny entry');
      assert(clearDungeonFloor(malformed, dungeon.id, 0) === malformed, 'malformed flags return original without throwing');
      assert(getDungeonFloor(malformed, dungeon.id) === 0, 'malformed flags have no progress');
      assert(grantDungeonKey(malformed, dungeon.keyDropEnemyId as EnemyKind) === malformed, 'malformed flags cannot grant keys');
      const denied = claimDungeonReward(malformed, dungeon.id);
      assert(denied.save === malformed && !denied.claimed && denied.blocked, 'malformed flags deny rewards');
    }
    const inheritedKey = freeze({ ...key, storyFlags: Object.create({ [keyFlag]: true }) });
    assert(dungeonEntryError(inheritedKey, dungeon.id) !== null, 'prototype key cannot unlock');
    assert(clearDungeonFloor(inheritedKey, dungeon.id, 0) === inheritedKey, 'prototype key cannot clear');
    for (const kind of [null, undefined, NaN, {}, Object.create(null), Symbol('enemy')]) {
      assert(grantDungeonKey(initial, kind as unknown as EnemyKind) === initial, 'malformed enemy cannot grant a key or throw');
    }
    const underlevel = freeze({ ...key, level: dungeon.minLevel - 1 });
    const wrongChapter = freeze({ ...key, chapter: chapter === 1 ? 2 : 1 });
    const invalidLevel = freeze({ ...key, level: NaN });
    for (const invalid of [underlevel, wrongChapter, invalidLevel]) {
      assert(dungeonEntryError(invalid, dungeon.id) !== null, 'level and chapter gate entry');
      assert(clearDungeonFloor(invalid, dungeon.id, 0) === invalid, 'entry gate protects progress');
    }
    assert(getDungeonFloor(key, dungeon.id) === 0, 'initial floor is zero');
    assert(clearDungeonFloor(key, dungeon.id, 1) === key, 'cannot skip first floor');
    const incomplete = claimDungeonReward(key, dungeon.id);
    assert(!incomplete.claimed && incomplete.blocked && incomplete.save === key, 'incomplete reward denied');
    for (const candidate of ['missing-dungeon', '__proto__', 'constructor', 'toString', null, undefined, NaN, {}, Object.create(null), Symbol('dungeon')]) {
      const id = candidate as unknown as string;
      assert(dungeonEntryError(key, id) !== null, 'unknown ID rejects entry');
      assert(getDungeonFloor(key, id) === 0, 'unknown ID has no progress');
      assert(getDungeonFloorEnemies(id, 0).length === 0, 'unknown ID spawns nothing');
      assert(clearDungeonFloor(key, id, 0) === key, 'unknown ID cannot clear');
      const denied = claimDungeonReward(key, id);
      assert(denied.save === key && !denied.claimed && denied.blocked, 'unknown ID cannot claim');
    }
    for (const candidate of [-1, 0.5, NaN, Infinity, dungeon.floorCount, dungeon.floorCount + 1, '0', null, undefined, {}, Symbol('floor')]) {
      const index = candidate as unknown as number;
      assert(getDungeonFloorEnemies(dungeon.id, index).length === 0, 'invalid floor spawns nothing');
      assert(clearDungeonFloor(key, dungeon.id, index) === key, 'invalid floor cannot clear');
    }
    const outOfOrder = freeze({ ...key, storyFlags: { ...key.storyFlags, ['dungeon-floor:' + dungeon.id + ':1']: true } });
    assert(getDungeonFloor(outOfOrder, dungeon.id) === 0, 'first hole remains current floor');
    let progress = key;
    for (let index = 0; index < dungeon.floorCount; index += 1) {
      const enemies = getDungeonFloorEnemies(dungeon.id, index);
      if (index === dungeon.floorCount - 1) {
        assert(enemies.length === 1 && enemies[0] === dungeon.eliteId, 'final floor only its elite');
      } else {
        assert(enemies.length >= 2 && enemies.length <= 3, 'early floors bounded');
        assert(enemies.every(kind => Object.hasOwn(ENEMIES, kind)
          && ENEMIES[kind].areaId === dungeon.areaId
          && COMMON_ENEMIES.some(enemy => enemy.id === kind)), 'canonical area enemies only');
      }
      assert(getDungeonFloor(progress, dungeon.id) === index, 'sequential floor progress');
      const next = freeze(clearDungeonFloor(progress, dungeon.id, index));
      assert(next !== progress && next.storyFlags['dungeon-floor:' + dungeon.id + ':' + index] === true, 'clear marks floor');
      assert(next.rpg === progress.rpg && next.gold === initial.gold && next.xp === initial.xp, 'clear grants no rewards');
      assert(clearDungeonFloor(next, dungeon.id, index) === next, 'clear cannot repeat');
      progress = next;
    }
    assert(getDungeonFloor(progress, dungeon.id) === dungeon.floorCount, 'all floors complete');
    const inheritedFloors = freeze({ ...progress, storyFlags: Object.create(progress.storyFlags, { [keyFlag]: { value: true, enumerable: true } }) });
    assert(getDungeonFloor(inheritedFloors, dungeon.id) === 0, 'prototype floors cannot advance');
    assert(claimDungeonReward(inheritedFloors, dungeon.id).blocked, 'prototype floors cannot award');
    assert(clearDungeonFloor(progress, dungeon.id, dungeon.floorCount) === progress, 'no extra floor');
    for (const invalid of [
      freeze({ ...progress, level: dungeon.minLevel - 1 }),
      freeze({ ...progress, chapter: wrongChapter.chapter }),
      freeze({ ...progress, storyFlags: { ...progress.storyFlags, [keyFlag]: false } }),
    ]) {
      const denied = claimDungeonReward(invalid, dungeon.id);
      assert(denied.save === invalid && !denied.claimed && denied.blocked, 'claim revalidates entry');
    }
    const tight = freeze({ ...progress, rpg: { ...progress.rpg, inventory: createInventory(dungeon.rewardItemIds.length - 1) } });
    const tightSnapshot = JSON.stringify(tight);
    const partial = claimDungeonReward(tight, dungeon.id);
    assert(partial.save === tight && !partial.claimed && partial.blocked, 'partial reward atomically rolls back');
    assert(JSON.stringify(tight) === tightSnapshot && !tight.storyFlags[rewardFlag], 'rollback preserves input');
    const full = freeze({ ...progress, rpg: { ...progress.rpg, inventory: { capacity: 1, slots: [{ itemId: 'bronze-sword', quantity: 1 }] } } });
    const blocked = claimDungeonReward(full, dungeon.id);
    assert(blocked.save === full && !blocked.claimed && blocked.blocked, 'full inventory preserves original');
    const retry = freeze({ ...blocked.save, rpg: { ...blocked.save.rpg, inventory: createInventory() } });
    const claimed = claimDungeonReward(retry, dungeon.id);
    assert(claimed.claimed && !claimed.blocked && claimed.save.storyFlags[rewardFlag] === true, 'retry claims successfully');
    assert(claimed.save.storyFlags[keyFlag] === true, 'claim does not consume key');
    assert(dungeonEntryError(claimed.save, dungeon.id) === null, 'claimed dungeon can be entered again with same key');
    for (const itemId of dungeon.rewardItemIds) {
      assert(countItem(claimed.save.rpg.inventory, itemId) === 1, 'one of every catalog reward');
    }
    assert(claimed.save.gold === initial.gold && claimed.save.xp === initial.xp, 'no gold or XP awarded');
    const repeat = claimDungeonReward(freeze(claimed.save), dungeon.id);
    assert(!repeat.claimed && !repeat.blocked && repeat.save === claimed.save, 'reward once only');
    assert(JSON.stringify(initial) === snapshot, 'original save unchanged');
  }
  return true;
}
