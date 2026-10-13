import { BALANCE } from '../../data/config';
import type { QuestProgress } from '../rpg/QuestSystem';
import { calculateEquipmentStats, type EquipmentState } from '../rpg/EquipmentSystem';
import type { InventoryState } from '../rpg/InventorySystem';
import { createInitialSkillProgress, type SkillProgress } from '../rpg/SkillSystem';
import { getSkill, getDivinePower, type DivinePowerId } from '../../data/skills';
import { getItem } from '../../data/items';

export type QuestStage = 'new' | 'active' | 'return' | 'complete';
export interface SaveData {
  version: 1;
  hp: number; mp: number; maxHp: number; maxMp: number;
  attack: number; level: number; xp: number; gold: number; chapter: number;
  kills: number; quest: QuestStage; bossDead: boolean;
  storyFlags: Readonly<Record<string, boolean>>; checkpoint: string; playtimeSeconds: number;
  upgrades: number;
  rpg: RpgSaveData;
}

export interface RpgSaveData {
  inventory: InventoryState;
  equipment: EquipmentState;
  quests: Record<string, QuestProgress>;
  skills: SkillProgress;
}
export function getPlayerStats(save: SaveData) {
  const bonuses = calculateEquipmentStats(save.rpg.equipment, save.level);
  return { maxHp: save.maxHp + (bonuses.maxHp ?? 0), maxMp: save.maxMp + (bonuses.maxMp ?? 0), speed: BALANCE.speed + (bonuses.speed ?? 0) };
}
const SAVE_KEY = 'than-menh-van-lang-mvp-v1';
const QUEST_STAGES: readonly QuestStage[] = ['new', 'active', 'return', 'complete'];
const defaultRpg = (): RpgSaveData => ({ inventory: { capacity: 24, slots: [] }, equipment: { slots: {} }, quests: {}, skills: createInitialSkillProgress() });

function normalizeSkillProgress(candidate: unknown): SkillProgress {
  if (!candidate || typeof candidate !== 'object') return createInitialSkillProgress();
  const value = candidate as Record<string, unknown>;
  const unlocked = Array.isArray(value.unlockedSkillIds)
    ? value.unlockedSkillIds.filter((id): id is string => typeof id === 'string' && Boolean(getSkill(id)))
    : [];
  const sourceSlots = value.equippedSlots && typeof value.equippedSlots === 'object' ? value.equippedSlots as Record<string, unknown> : {};
  const equippedSlots = Object.fromEntries(['slot-1', 'slot-2', 'slot-3', 'slot-4'].flatMap((slot) => {
    const id = sourceSlots[slot];
    return typeof id === 'string' && unlocked.includes(id) ? [[slot, id]] : [];
  }));
  const cooldownValue = value.cooldownUntil && typeof value.cooldownUntil === 'object' ? value.cooldownUntil as Record<string, unknown> : {};
  const cooldownUntil = Object.fromEntries(Object.entries(cooldownValue).flatMap(([id, expiry]) =>
    unlocked.includes(id) && typeof expiry === 'number' && Number.isFinite(expiry) && expiry > 0 ? [[id, expiry]] : []));
  const defaults = createInitialSkillProgress();
  const unlockedDivinePowers = Array.isArray(value.unlockedDivinePowers)
    ? [...new Set(value.unlockedDivinePowers.filter((id): id is DivinePowerId => typeof id === 'string' && Boolean(getDivinePower(id as DivinePowerId))))]
    : defaults.unlockedDivinePowers;
  const active = value.activeDivinePower as DivinePowerId;
  return {
    unlockedSkillIds: Array.isArray(value.unlockedSkillIds) ? unlocked : defaults.unlockedSkillIds,
    equippedSlots,
    cooldownUntil,
    activeDivinePower: unlockedDivinePowers.includes(active) ? active : unlockedDivinePowers[0],
    unlockedDivinePowers,
  };
}
export const newSave = (): SaveData => ({
  version: 1, hp: BALANCE.hp, mp: BALANCE.mp,
  maxHp: BALANCE.hp, maxMp: BALANCE.mp, attack: BALANCE.attack,
  level: 1, xp: 0, gold: 0, chapter: 1, kills: 0, quest: 'new',
  bossDead: false, storyFlags: {}, checkpoint: 'village-gate', playtimeSeconds: 0,
  upgrades: 0, rpg: defaultRpg(),
});

const finite = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

export function normalizeSave(candidate: unknown): SaveData {
  const defaults = newSave();
  if (!candidate || typeof candidate !== 'object') return defaults;
  const value = candidate as Record<string, unknown>;
  if (value.version !== 1) return defaults;
  const rpgValue = value.rpg && typeof value.rpg === 'object' ? value.rpg as Record<string, unknown> : {};
  const inventoryValue = rpgValue.inventory && typeof rpgValue.inventory === 'object' ? rpgValue.inventory as Record<string, unknown> : {};
  const slots = Array.isArray(inventoryValue.slots) ? inventoryValue.slots.filter((entry): entry is { itemId: string; quantity: number } =>
    Boolean(entry) && typeof entry === 'object' && typeof (entry as Record<string, unknown>).itemId === 'string' &&
    Number.isInteger((entry as Record<string, unknown>).quantity) && Number((entry as Record<string, unknown>).quantity) > 0
  ).map((entry) => ({ itemId: entry.itemId, quantity: entry.quantity })) : [];
  const inventory = { capacity: Math.round(finite(inventoryValue.capacity, 24, 0, 999)), slots };
  const equipmentValue = rpgValue.equipment && typeof rpgValue.equipment === 'object' ? rpgValue.equipment as Record<string, unknown> : {};
  const slotValue = equipmentValue.slots && typeof equipmentValue.slots === 'object' ? equipmentValue.slots as Record<string, unknown> : {};
  const equipment = { slots: Object.fromEntries(Object.entries(slotValue).filter(([slot, item]) =>
    ['weapon', 'armor', 'accessory'].includes(slot) && typeof item === 'string' && getItem(item)?.slot === slot)) };
  const questsValue = rpgValue.quests && typeof rpgValue.quests === 'object' ? rpgValue.quests as Record<string, unknown> : {};
  const stages: QuestProgress['stage'][] = ['new', 'active', 'return', 'complete'];
  const quests = Object.fromEntries(Object.entries(questsValue).flatMap(([id, entry]) => {
    if (!entry || typeof entry !== 'object') return [];
    const progress = entry as Record<string, unknown>;
    if (typeof progress.questId !== 'string' || !stages.includes(progress.stage as QuestProgress['stage'])) return [];
    const countsValue = progress.counts && typeof progress.counts === 'object' ? progress.counts as Record<string, unknown> : {};
    const flagsValue = progress.flags && typeof progress.flags === 'object' ? progress.flags as Record<string, unknown> : {};
    return [[id, { questId: progress.questId, stage: progress.stage as QuestProgress['stage'], counts: Object.fromEntries(Object.entries(countsValue).map(([key, count]) => [key, Math.round(finite(count, 0, 0, 999999))])), flags: Object.fromEntries(Object.entries(flagsValue).map(([key, flag]) => [key, flag === true])), rewardClaimed: progress.rewardClaimed === true }]];
  }));
  const skills = normalizeSkillProgress(rpgValue.skills);
  const storyFlagsValue = value.storyFlags && typeof value.storyFlags === 'object' ? value.storyFlags as Record<string, unknown> : {};
  const storyFlags = Object.fromEntries(Object.entries(storyFlagsValue).flatMap(([key, flag]) =>
    typeof flag === 'boolean' ? [[key, flag]] : []));
  const maxHp = finite(value.maxHp, defaults.maxHp, BALANCE.hp, 10000);
  const maxMp = finite(value.maxMp, defaults.maxMp, BALANCE.mp, 10000);
  const level = Math.round(finite(value.level, defaults.level, 1, 99));
  const bonuses = calculateEquipmentStats(equipment, level);
  const quest = typeof value.quest === 'string' && QUEST_STAGES.includes(value.quest as QuestStage)
    ? value.quest as QuestStage : defaults.quest;
  return {
    version: 1,
    hp: finite(value.hp, defaults.hp, 0, maxHp + (bonuses.maxHp ?? 0)),
    mp: finite(value.mp, defaults.mp, 0, maxMp + (bonuses.maxMp ?? 0)),
    maxHp, maxMp,
    attack: finite(value.attack, defaults.attack, BALANCE.attack, 1000),
    level,
    chapter: Math.round(finite(value.chapter, defaults.chapter, 1, 4)),
    xp: finite(value.xp, defaults.xp, 0, 1000000),
    gold: finite(value.gold, defaults.gold, 0, 999999),
    kills: Math.round(finite(value.kills, defaults.kills, 0, 999999)),
    quest,
    bossDead: typeof value.bossDead === 'boolean' ? value.bossDead : defaults.bossDead,
    storyFlags,
    checkpoint: typeof value.checkpoint === 'string' && value.checkpoint.length <= 80 ? value.checkpoint : defaults.checkpoint,
    playtimeSeconds: Math.round(finite(value.playtimeSeconds, defaults.playtimeSeconds, 0, 315360000)),
    upgrades: Math.round(finite(value.upgrades, defaults.upgrades, 0, 100)),
    rpg: {
      inventory,
      equipment,
      quests,
      skills,
    },
  };
}

class GameState {
  data: SaveData = newSave();
  hasSave = false;
  loadError: string | null = null;
  saveError: string | null = null;

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      const candidate: unknown = raw === null ? newSave() : JSON.parse(raw);
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)
        || (candidate as Record<string, unknown>).version !== 1) throw new Error('Unsupported save');
      this.data = normalizeSave(candidate);
      this.hasSave = raw !== null;
      this.loadError = null;
      this.saveError = null;
    } catch {
      this.hasSave = false;
      this.loadError = 'Không đọc được bản lưu. Chơi tạm không ghi đè; chọn “Chơi lại” để xóa tiến trình cũ.';
    }
  }

  save(): void {
    if (this.loadError) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.hasSave = true;
      this.saveError = null;
    } catch {
      this.saveError = 'Không thể lưu tiến trình: bộ nhớ trình duyệt đầy hoặc bị chặn.';
    }
  }

  reset(): void {
    this.data = newSave();
    this.hasSave = false;
    this.loadError = null;
    this.save();
  }

  tickPlaytime(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0 || typeof document !== 'undefined' && document.hidden) return;
    this.data = { ...this.data, playtimeSeconds: this.data.playtimeSeconds + Math.min(delta, 1000) / 1000 };
  }

  earn(reward: number, xp: number): boolean {
    const s = this.data;
    s.gold += reward;
    s.xp += xp;
    let levelled = false;
    while (s.xp >= 45 + s.level * 15) {
      s.xp -= 45 + s.level * 15;
      s.level++;
      s.maxHp += 10;
      s.maxMp += 5;
      s.attack += 2;
      s.hp = getPlayerStats(s).maxHp;
      s.mp = getPlayerStats(s).maxMp;
      levelled = true;
    }
    this.save();
    return levelled;
  }
}

export const gameState = new GameState();
