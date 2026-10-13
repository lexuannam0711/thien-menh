import { COMMON_ENEMIES, DUNGEONS, getDungeon, type ContentDungeon } from '../../data/contentCatalog';
import { ENEMIES, getEnemyKillTargets, type EnemyKind } from '../../data/config';
import type { SaveData } from '../systems/GameState';
import { getChapterWorldConfig } from '../world/ChapterWorld';
import { addItem } from './InventorySystem';

function hasFlag(save: SaveData, flag: string): boolean {
  return validFlags(save.storyFlags) && Object.hasOwn(save.storyFlags, flag) && save.storyFlags[flag] === true;
}

function validFlags(flags: unknown): flags is SaveData['storyFlags'] {
  return flags !== null && typeof flags === 'object' && !Array.isArray(flags);
}

function validFloor(dungeon: ContentDungeon | undefined, index: number): dungeon is ContentDungeon {
  return dungeon !== undefined && Number.isInteger(index) && index >= 0 && index < dungeon.floorCount;
}

export function getChapterDungeon(save: SaveData): ContentDungeon | undefined {
  if (!Number.isInteger(save.chapter)) return undefined;
  const world = getChapterWorldConfig(save.chapter);
  return world.chapterId === save.chapter ? DUNGEONS.find(dungeon => dungeon.areaId === world.areaId) : undefined;
}

export function dungeonEntryError(save: SaveData, dungeonId: string, chapter = save.chapter): string | null {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) return 'Không tìm thấy dungeon.';
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > save.chapter
    || getChapterDungeon({ ...save, chapter })?.id !== dungeon.id) return 'Dungeon không thuộc chương hiện tại.';
  if (!Number.isFinite(save.level) || save.level < dungeon.minLevel) return 'Cần đạt cấp ' + dungeon.minLevel + ' để vào dungeon.';
  if (!hasFlag(save, 'dungeon-key:' + dungeon.id)) return 'Hạ quái giữ chìa khóa để mở dungeon.';
  return null;
}

export function grantDungeonKey(save: SaveData, kind: EnemyKind): SaveData {
  if (typeof kind !== 'string' || !Object.hasOwn(ENEMIES, kind) || !validFlags(save.storyFlags)) return save;
  const targets = getEnemyKillTargets(kind);
  const flags = DUNGEONS.filter(dungeon => targets.includes(dungeon.keyDropEnemyId)
    && !hasFlag(save, 'dungeon-key:' + dungeon.id)).map(dungeon => ['dungeon-key:' + dungeon.id, true]);
  return flags.length === 0 ? save : { ...save, storyFlags: { ...save.storyFlags, ...Object.fromEntries(flags) } };
}

export function getDungeonFloor(save: SaveData, id: string): number {
  const dungeon = getDungeon(id);
  if (!dungeon) return 0;
  for (let index = 0; index < dungeon.floorCount; index += 1) {
    if (!hasFlag(save, 'dungeon-floor:' + id + ':' + index)) return index;
  }
  return dungeon.floorCount;
}

export function getDungeonFloorEnemies(id: string, index: number): readonly EnemyKind[] {
  const dungeon = getDungeon(id);
  if (!validFloor(dungeon, index)) return [];
  if (index === dungeon.floorCount - 1) {
    const elite = dungeon.eliteId as EnemyKind;
    return Object.hasOwn(ENEMIES, elite) && ENEMIES[elite].areaId === dungeon.areaId ? [elite] : [];
  }
  const enemies = COMMON_ENEMIES.filter(enemy => enemy.areaId === dungeon.areaId)
    .map(enemy => enemy.id as EnemyKind)
    .filter(kind => Object.hasOwn(ENEMIES, kind) && ENEMIES[kind].areaId === dungeon.areaId);
  return enemies.length === 0 ? [] : Array.from({ length: 2 + index % 2 },
    (_, offset) => enemies[(index + offset) % enemies.length]);
}

/** Invalid entry, floor index, or floor order returns the original save without throwing. */
export function clearDungeonFloor(save: SaveData, id: string, index: number, chapter = save.chapter): SaveData {
  if (!validFloor(getDungeon(id), index) || dungeonEntryError(save, id, chapter) !== null
    || index !== getDungeonFloor(save, id)) return save;
  return { ...save, storyFlags: { ...save.storyFlags, ['dungeon-floor:' + id + ':' + index]: true } };
}

export function claimDungeonReward(save: SaveData, id: string, chapter = save.chapter): { save: SaveData; claimed: boolean; blocked: boolean } {
  const dungeon = getDungeon(id);
  if (!dungeon || dungeonEntryError(save, id, chapter) !== null || getDungeonFloor(save, id) !== dungeon.floorCount) {
    return { save, claimed: false, blocked: true };
  }
  const rewardFlag = 'dungeon-reward:' + id;
  if (hasFlag(save, rewardFlag)) return { save, claimed: false, blocked: false };
  let inventory = save.rpg.inventory;
  for (const itemId of dungeon.rewardItemIds) {
    const added = addItem(inventory, itemId, 1);
    if (added.remainder !== 0) return { save, claimed: false, blocked: true };
    inventory = added.state;
  }
  return {
    save: { ...save, rpg: { ...save.rpg, inventory }, storyFlags: { ...save.storyFlags, [rewardFlag]: true } },
    claimed: true,
    blocked: false,
  };
}
