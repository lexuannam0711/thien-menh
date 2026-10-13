import type { QuestStage, SaveData } from '../systems/GameState';
import { QUESTS, getQuest, type QuestDefinition, type QuestObjective } from '../../data/quests';
import { addItem } from './InventorySystem';
import { getChapterWorldConfig } from '../world/ChapterWorld';
import { ENEMIES, getEnemyKillTargets, type EnemyKind } from '../../data/config';
import { getChapterDungeon, getDungeonFloor } from './DungeonSystem';

export interface QuestProgress {
  readonly questId: string;
  readonly stage: QuestStage;
  readonly counts: Readonly<Record<string, number>>;
  readonly flags: Readonly<Record<string, boolean>>;
  readonly rewardClaimed: boolean;
}

const NPC_QUEST_ALIASES: Readonly<Record<string, string>> = {
  'ngu-ong-ba-vi': 'fisherman-da-trach',
  'dao-si-truc-lam': 'shaman-au-co',
  'tu-si-tan-vien': 'hermit-tan-vien',
  'quan-thi-ve-phong-chau': 'messenger-phong-chau',
};
const SIDE_QUEST_CHAPTERS: Readonly<Record<string, number>> = {
  'poison-toad': 2, 'river-monster': 2, 'water-fiend': 2,
  'golem-scout': 3, 'ruin-guardian': 3, 'mourning-wraith': 3,
  'drum-ambusher': 4, 'citadel-looter': 4,
};

export function getQuestChapter(quest: QuestDefinition): number {
  const target = quest.objectives.find(objective => objective.kind === 'kill')?.target ?? '';
  return quest.chapter ?? (Object.hasOwn(SIDE_QUEST_CHAPTERS, target) ? SIDE_QUEST_CHAPTERS[target] : 1);
}

export function getNpcQuestGiverId(npcId: string): string {
  return Object.hasOwn(NPC_QUEST_ALIASES, npcId) ? NPC_QUEST_ALIASES[npcId] : npcId;
}

export function getNpcQuests(save: SaveData, npcId: string): readonly QuestDefinition[] {
  return QUESTS.filter(quest => {
    if (quest.id === 'hunt-ho-yeu') return false;
    const chapter = getQuestChapter(quest);
    const stage = save.rpg.quests[quest.id]?.stage;
    const giverMatches = quest.giverNpcId === getNpcQuestGiverId(npcId) || npcId === 'village-healer' && quest.giverNpcId === 'shaman-au-co';
    return giverMatches && (chapter === save.chapter || stage === 'return') || npcId === 'village-chief' && chapter < save.chapter && (stage === 'active' || stage === 'return');
  });
}

export function getHistoricalQuestEnemies(save: SaveData): readonly EnemyKind[] {
  const targets = QUESTS.filter(quest => quest.id !== 'hunt-ho-yeu' && getQuestChapter(quest) < save.chapter && save.rpg.quests[quest.id]?.stage === 'active')
    .flatMap(quest => quest.objectives.filter(objective => objective.kind === 'kill' && (save.rpg.quests[quest.id].counts[objective.id] ?? 0) < objective.required).map(objective => objective.target));
  return (Object.keys(ENEMIES) as EnemyKind[]).filter(kind => kind !== 'ho-yeu' && getEnemyKillTargets(kind).some(target => targets.includes(target)));
}

export function startNpcQuests(save: SaveData, npcId: string): SaveData {
  let next = save;
  if (save.bossDead) next = { ...save, storyFlags: { ...save.storyFlags, ['boss:' + getChapterWorldConfig(save.chapter).bossId]: true } };
  for (const quest of getNpcQuests(save, npcId)) {
    let progress = startQuest(progressFromSave(next, quest.id));
    for (const objective of quest.objectives) {
      if (objective.kind === 'flag' && next.storyFlags['chapter:' + getQuestChapter(quest) + ':' + objective.target]) progress = setQuestFlag(progress, objective.target);
      if (objective.kind === 'kill' && (next.storyFlags['boss:' + objective.target] || getQuestChapter(quest) < save.chapter && objective.target === getChapterWorldConfig(getQuestChapter(quest)).bossId)) progress = recordKill(progress, objective.target);
    }
    next = applyProgressToSave(next, progress);
  }
  return next;
}

export function recordQuestKills(save: SaveData, targets: readonly string[]): SaveData {
  let next = save;
  const unique = [...new Set(targets)];
  const bossFlags = Object.fromEntries(unique.filter(target => ['ho-yeu', 'thuong-luong', 'thach-tuong', 'hac-an'].includes(target)).map(target => ['boss:' + target, true]));
  next = { ...next, storyFlags: { ...next.storyFlags, ...bossFlags } };
  for (const progress of Object.values(save.rpg.quests)) {
    if (progress.questId === 'hunt-ho-yeu' || progress.stage !== 'active') continue;
    let updated = progress;
    for (const target of unique) updated = recordKill(updated, target);
    next = applyProgressToSave(next, updated);
  }
  return next;
}

export function recordQuestFlag(save: SaveData, flag: string, chapter = save.chapter): SaveData {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > save.chapter) return save;
  let next = { ...save, storyFlags: { ...save.storyFlags, ['chapter:' + chapter + ':' + flag]: true } };
  for (const progress of Object.values(save.rpg.quests)) {
    if (progress.questId !== 'hunt-ho-yeu' && progress.stage === 'active') next = applyProgressToSave(next, setQuestFlag(progress, flag));
  }
  return next;
}

export function claimNpcQuests(save: SaveData, npcId: string) {
  let next = save;
  let gold = 0;
  let xp = 0;
  let claimed = 0;
  let blocked = 0;
  for (const quest of getNpcQuests(save, npcId)) {
    const reward = claimQuest(progressFromSave(next, quest.id));
    if (!reward) continue;
    let inventory = next.rpg.inventory;
    let fits = true;
    for (const item of reward.reward.items) {
      const added = addItem(inventory, item.itemId, item.quantity);
      if (added.remainder > 0) { fits = false; break; }
      inventory = added.state;
    }
    if (!fits) { blocked++; continue; }
    next = applyProgressToSave({ ...next, rpg: { ...next.rpg, inventory } }, reward.progress);
    gold += reward.reward.gold;
    xp += reward.reward.xp;
    claimed++;
  }
  return { save: next, gold, xp, claimed, blocked };
}

export function chapterQuestsReady(save: SaveData): boolean {
  const pendingSideQuest = QUESTS.some(quest => quest.category === 'side' && getQuestChapter(quest) === save.chapter && ['active', 'return'].includes(save.rpg.quests[quest.id]?.stage ?? 'new'));
  const dungeon = getChapterDungeon(save);
  const pendingDungeon = dungeon && getDungeonFloor(save, dungeon.id) > 0 && !save.storyFlags['dungeon-reward:' + dungeon.id];
  return !pendingSideQuest && !pendingDungeon && QUESTS.filter(quest => quest.id !== 'hunt-ho-yeu' && quest.category === 'main' && quest.chapter === save.chapter)
    .every(quest => save.rpg.quests[quest.id]?.stage === 'complete');
}

export interface QuestRewardResult {
  readonly progress: QuestProgress;
  readonly reward: QuestDefinition['reward'];
}

export function createQuestProgress(questId: string): QuestProgress {
  return { questId, stage: 'new', counts: {}, flags: {}, rewardClaimed: false };
}

function objectiveDone(objective: QuestObjective, progress: QuestProgress): boolean {
  return objective.kind === 'kill'
    ? (progress.counts[objective.id] ?? 0) >= objective.required
    : (progress.flags[objective.id] === true || progress.flags[objective.target] === true);
}

function ready(quest: QuestDefinition, progress: QuestProgress): boolean {
  return quest.objectives.length > 0 && quest.objectives.every((objective) => objectiveDone(objective, progress));
}

export function isQuestActive(progress: QuestProgress): boolean {
  return progress.stage === 'active';
}

export function isQuestReady(progress: QuestProgress): boolean {
  return progress.stage === 'return';
}

export function isQuestComplete(progress: QuestProgress): boolean {
  return progress.stage === 'complete' && progress.rewardClaimed;
}

export function startQuest(progress: QuestProgress): QuestProgress {
  return progress.stage === 'new' ? { ...progress, stage: 'active' } : { ...progress };
}

export function resetQuestForChapter(progress: QuestProgress): QuestProgress {
  return { ...progress, stage: 'new', counts: {}, flags: {}, rewardClaimed: false };
}

export function recordKill(progress: QuestProgress, target: string): QuestProgress {
  if (progress.stage !== 'active') return { ...progress };
  const quest = getQuest(progress.questId);
  if (!quest) return { ...progress };
  const counts = { ...progress.counts };
  let modified = false;
  for (const objective of quest.objectives) {
    if (objective.kind === 'kill' && objective.target === target) {
      counts[objective.id] = Math.min(objective.required, (counts[objective.id] ?? 0) + 1);
      modified = true;
    }
  }
  if (!modified) return { ...progress };
  const next = { ...progress, counts };
  return ready(quest, next) ? { ...next, stage: 'return' } : next;
}

export function setQuestFlag(progress: QuestProgress, flag: string, value = true): QuestProgress {
  if (progress.stage !== 'active') return { ...progress };
  const quest = getQuest(progress.questId);
  if (!quest) return { ...progress };
  const flags = { ...progress.flags, [flag]: value };
  for (const objective of quest.objectives) {
    if (objective.kind === 'flag' && (objective.target === flag || objective.id === flag)) {
      flags[objective.id] = value;
    }
  }
  const next = { ...progress, flags };
  return ready(quest, next) ? { ...next, stage: 'return' } : next;
}

export function claimQuest(progress: QuestProgress): QuestRewardResult | undefined {
  const quest = getQuest(progress.questId);
  if (!quest || progress.stage !== 'return' || progress.rewardClaimed) return undefined;
  return { progress: { ...progress, stage: 'complete', rewardClaimed: true }, reward: quest.reward };
}

export function progressFromSave(save: SaveData, questId = 'hunt-ho-yeu'): QuestProgress {
  const existing = save.rpg?.quests?.[questId];
  if (existing) {
    if (questId === 'hunt-ho-yeu') {
      const counts = {
        ...existing.counts,
        'forest-kills': Math.max(existing.counts['forest-kills'] ?? 0, save.kills ?? 0),
        'ho-yeu': Math.max(existing.counts['ho-yeu'] ?? 0, save.bossDead ? 1 : 0),
      };
      let stage = existing.stage;
      if (save.quest === 'complete') stage = 'complete';
      else if (save.quest === 'return' && stage !== 'complete') stage = 'return';
      else if (save.quest === 'active' && stage === 'new') stage = 'active';

      const questDef = getQuest('hunt-ho-yeu');
      const candidate: QuestProgress = {
        ...existing,
        stage,
        counts,
        rewardClaimed: existing.rewardClaimed || save.quest === 'complete',
      };
      if (questDef && stage === 'active' && ready(questDef, candidate)) {
        return { ...candidate, stage: 'return' };
      }
      return candidate;
    }
    return existing;
  }

  // Not yet tracked in save.rpg.quests:
  if (questId === 'hunt-ho-yeu') {
    const counts: Record<string, number> = {
      'forest-kills': Math.max(0, save.kills ?? 0),
      'ho-yeu': save.bossDead ? 1 : 0,
    };
    const stage = save.quest ?? 'new';
    const questDef = getQuest('hunt-ho-yeu');
    const candidate: QuestProgress = {
      questId: 'hunt-ho-yeu',
      stage,
      counts,
      flags: {},
      rewardClaimed: save.quest === 'complete',
    };
    if (questDef && stage === 'active' && ready(questDef, candidate)) {
      return { ...candidate, stage: 'return' };
    }
    return candidate;
  }

  return createQuestProgress(questId);
}

export function getQuestProgress(save: SaveData, questId: string): QuestProgress {
  return progressFromSave(save, questId);
}

export function applyProgressToSave(save: SaveData, progress: QuestProgress): SaveData {
  const nextQuests = {
    ...(save.rpg?.quests ?? {}),
    [progress.questId]: progress,
  };
  const nextRpg = {
    ...(save.rpg ?? {
      inventory: { capacity: 24, slots: [] },
      equipment: { slots: {} },
      quests: {},
      skills: {
        unlockedSkillIds: [],
        equippedSlots: {},
        cooldownUntil: {},
        activeDivinePower: undefined,
        unlockedDivinePowers: [],
      },
    }),
    quests: nextQuests,
  };

  if (progress.questId === 'hunt-ho-yeu') {
    const counts = progress.counts;
    return {
      ...save,
      quest: progress.stage,
      kills: Math.max(0, Math.floor(counts['forest-kills'] ?? save.kills)),
      bossDead: (counts['ho-yeu'] ?? (save.bossDead ? 1 : 0)) > 0,
      rpg: nextRpg,
    };
  }

  return {
    ...save,
    rpg: nextRpg,
  };
}
