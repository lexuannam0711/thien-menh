import { QUESTS } from '../../data/quests';
import type { SaveData } from '../systems/GameState';
import { getQuestChapter } from '../rpg/QuestSystem';
import { constrainToWorld, type Barrier } from './WorldBounds';

export function getQuestInteractions(save: SaveData, barriers: readonly Barrier[]) {
  return QUESTS.filter(quest => quest.id !== 'hunt-ho-yeu' && (getQuestChapter(quest) === save.chapter || getQuestChapter(quest) < save.chapter && save.rpg.quests[quest.id]?.stage === 'active'))
    .flatMap(quest => quest.objectives.filter(objective => objective.kind === 'flag').map(objective => ({ quest, objective })))
    .map(({ quest, objective }, index) => {
      const position = constrainToWorld({ x: 325 + index % 3 * 180, y: 155 + Math.floor(index / 3) * 80 }, 22, barriers);
      return { questId: quest.id, flag: objective.target, title: quest.title, ...position };
    });
}

export function questInteractionReady(save: SaveData, questId: string, flag: string): boolean {
  const quest = QUESTS.find(entry => entry.id === questId && getQuestChapter(entry) <= save.chapter);
  const progress = save.rpg.quests[questId];
  return Boolean(quest && progress?.stage === 'active' && !progress.flags[quest.objectives.find(objective => objective.target === flag)?.id ?? ''] &&
    quest.objectives.filter(objective => objective.kind === 'kill').every(objective => (progress.counts[objective.id] ?? 0) >= objective.required));
}
