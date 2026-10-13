import { QUESTS } from '../../data/quests';
import { newSave } from '../systems/GameState';
import { startNpcQuests, recordQuestKills, recordQuestFlag, claimNpcQuests, chapterQuestsReady, getQuestChapter, getHistoricalQuestEnemies, applyProgressToSave, startQuest, progressFromSave } from './QuestSystem';
import { NAMED_NPCS } from '../../data/contentCatalog';
import { getVillageNpcs } from '../world/NpcRoster';
import { getQuestInteractions, questInteractionReady } from '../world/QuestInteractions';
import { getChapterWorldConfig } from '../world/ChapterWorld';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('Quest runtime check: ' + message);
}

export function runQuestRuntimeSelfCheck(): true {
  let save = newSave();
  save = startNpcQuests(save, 'village-chief');
  assert(save.quest === 'new', 'side/main task acceptance does not silently start the campaign hunt');
  assert(save.rpg.quests['main-c1-02-mo-duong-rung-truc']?.stage === 'active', 'chief actually starts chapter 1 tasks');
  save = recordQuestKills(save, ['moc-tinh', 'moc-tinh', 'forest-enemy']);
  assert(save.rpg.quests['main-c1-02-mo-duong-rung-truc'].counts['c1-kill-moc-tinh'] === 1, 'duplicate kill aliases cannot double count');
  assert(!chapterQuestsReady(save), 'missing chapter tasks cannot allow advancement');
  const npcIds = new Set([1, 2, 3, 4].flatMap(chapter => getVillageNpcs(chapter).map(npc => npc.id)));
  assert(NAMED_NPCS.every(npc => npcIds.has(npc.id)), 'all named NPCs exist in reachable chapter hubs');
  const markers = getQuestInteractions(save, getChapterWorldConfig(1).barriers);
  assert(markers.some(marker => marker.flag === 'beacon-lit'), 'main quest beacon has a world interaction');
  assert(!questInteractionReady(save, 'main-c1-02-mo-duong-rung-truc', 'beacon-lit'), 'flag cannot be activated before kill objectives');
  for (let count = 0; count < 3; count++) save = recordQuestKills(save, ['moc-tinh']);
  assert(questInteractionReady(save, 'main-c1-02-mo-duong-rung-truc', 'beacon-lit'), 'world interaction unlocks after actual kills');
  for (const chapter of [1, 2, 3, 4]) {
    let campaign = { ...newSave(), chapter };
    const tasks = QUESTS.filter(quest => quest.id !== 'hunt-ho-yeu' && getQuestChapter(quest) === chapter);
    for (const quest of tasks) campaign = startNpcQuests(campaign, quest.giverNpcId);
    for (const quest of tasks) {
      for (const objective of quest.objectives) {
        if (objective.kind === 'flag') campaign = recordQuestFlag(campaign, objective.target);
        else for (let count = 0; count < objective.required; count++) campaign = recordQuestKills(campaign, [objective.target]);
      }
    }
    assert(!chapterQuestsReady(campaign), 'unclaimed main rewards block chapter advancement: ' + chapter);
    const result = claimNpcQuests(campaign, tasks[0].giverNpcId);
    assert(result.claimed > 0 && result.gold > 0 && result.xp > 0, 'NPC reward transaction completes: ' + chapter);
    const repeated = claimNpcQuests(result.save, tasks[0].giverNpcId);
    assert(repeated.claimed === 0 && repeated.gold === 0 && repeated.xp === 0, 'rewards cannot repeat');
    let settled = result.save;
    for (const quest of tasks) settled = claimNpcQuests(settled, quest.giverNpcId).save;
    assert(chapterQuestsReady(settled), 'all claimed chapter quests allow advancement: ' + chapter);
    const full = { ...campaign, rpg: { ...campaign.rpg, inventory: { capacity: 0, slots: [] } } };
    const blocked = claimNpcQuests(full, tasks[0].giverNpcId);
    assert(blocked.claimed === 0 && blocked.gold === 0 && blocked.blocked > 0, 'full inventory prevents reward loss');
  }
  const aliased = startNpcQuests({ ...newSave(), chapter: 2 }, 'ngu-ong-ba-vi');
  assert(aliased.rpg.quests['main-c2-01-song-du-da-trach']?.stage === 'active', 'canonical NPC ID reaches authored quest giver');
  for (const chapter of [2, 3, 4]) {
    const quest = QUESTS.find(entry => entry.chapter === chapter && entry.objectives.some(objective => objective.kind === 'kill' && objective.target === getChapterWorldConfig(chapter).bossId))!;
    const restored = startNpcQuests({ ...newSave(), chapter, bossDead: true }, quest.giverNpcId);
    const objective = quest.objectives.find(entry => entry.kind === 'kill')!;
    assert(restored.rpg.quests[quest.id].counts[objective.id] === objective.required, 'legacy boss completion survives newly accepted quest: ' + chapter);
  }
  let side = startNpcQuests(newSave(), 'village-healer');
  const sideQuest = QUESTS.find(entry => entry.id === 'side-01-thuoc-tri-chuong-khi')!;
  for (const objective of sideQuest.objectives) {
    if (objective.kind === 'flag') side = recordQuestFlag(side, objective.target);
    else for (let count = 0; count < objective.required; count++) side = recordQuestKills(side, [objective.target]);
  }
  const late = claimNpcQuests({ ...side, chapter: 2 }, 'village-healer');
  assert(late.save.rpg.quests[sideQuest.id].rewardClaimed, 'previous chapter ready rewards remain claimable');
  const completedMain = Object.fromEntries(QUESTS.filter(quest => quest.category === 'main' && quest.chapter === 1).map(quest => [quest.id, { questId: quest.id, stage: 'complete' as const, counts: {}, flags: {}, rewardClaimed: true }]));
  const pendingSide = { ...side, rpg: { ...side.rpg, quests: { ...side.rpg.quests, ...completedMain } } };
  assert(!chapterQuestsReady(pendingSide), 'accepted side quests cannot be stranded by chapter advancement');
  const mainReady = { ...newSave(), rpg: { ...newSave().rpg, quests: completedMain } };
  assert(chapterQuestsReady(mainReady), 'unaccepted side quests and unopened dungeon remain optional');
  assert(!chapterQuestsReady({ ...mainReady, storyFlags: { 'dungeon-floor:dong-am-hon:0': true } }), 'started dungeon reward cannot be stranded');
  const historical = { ...side, chapter: 4 };
  const sideFlag = sideQuest.objectives.find(objective => objective.kind === 'flag')!;
  const unfinished = { ...historical, rpg: { ...historical.rpg, quests: { ...historical.rpg.quests, [sideQuest.id]: { ...historical.rpg.quests[sideQuest.id], stage: 'active' as const, flags: {} } } } };
  assert(getQuestInteractions(unfinished, []).some(marker => marker.questId === sideQuest.id), 'historical active quest retains world interaction');
  assert(questInteractionReady(unfinished, sideQuest.id, sideFlag.target), 'historical interaction unlocks after completed kills');
  const hermitQuest = QUESTS.find(quest => quest.id === 'side-15-hon-da-vong-phu')!;
  let hermitSave = startNpcQuests({ ...newSave(), chapter: 3 }, 'tu-si-tan-vien');
  for (const objective of hermitQuest.objectives) {
    if (objective.kind === 'flag') hermitSave = recordQuestFlag(hermitSave, objective.target);
    else for (let count = 0; count < objective.required; count++) hermitSave = recordQuestKills(hermitSave, [objective.target]);
  }
  assert(claimNpcQuests({ ...hermitSave, chapter: 4 }, 'village-chief').save.rpg.quests[hermitQuest.id].rewardClaimed, 'chief settles historical rewards when original giver is absent');
  const historicalHunt = { ...startNpcQuests(newSave(), 'village-chief'), chapter: 2 };
  assert(getHistoricalQuestEnemies(historicalHunt).includes('moc-tinh-con'), 'historical unfinished kills remain farmable');
  const reusedHunt = applyProgressToSave({ ...newSave(), chapter: 2 }, startQuest(progressFromSave(newSave())));
  assert(getHistoricalQuestEnemies(reusedHunt).length === 0, 'reusable campaign hunt never overrides chapter-local waves');
  const revisitedFlag = recordQuestFlag(historicalHunt, 'herbs-gathered', 1);
  assert(revisitedFlag.chapter === 2 && revisitedFlag.storyFlags['chapter:1:herbs-gathered'] === true && !revisitedFlag.storyFlags['chapter:2:herbs-gathered'], 'revisit flags retain origin chapter without moving campaign');
  for (const chapter of [0, -1, 3, 1.5, NaN, Infinity]) assert(recordQuestFlag(historicalHunt, 'herbs-gathered', chapter) === historicalHunt, 'invalid or undiscovered area cannot record flags');
  return true;
}
