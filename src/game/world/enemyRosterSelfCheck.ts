import { COMMON_ENEMIES, ELITES } from '../../data/contentCatalog';
import * as config from '../../data/config';
import { BOSS_IDS } from '../../data/bosses';
import { QUESTS } from '../../data/quests';
import { getAllChapterWorldConfigs, pickNextEnemyKind } from './ChapterWorld';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('[EnemyRosterSelfCheck] ' + message);
}

export function runEnemyRosterSelfCheck(): true {
  const worlds = getAllChapterWorldConfigs();
  const roster = [...COMMON_ENEMIES, ...ELITES];
  assert(COMMON_ENEMIES.length === 12 && ELITES.length === 4, 'Expected 12 common enemies and 4 elites');
  for (const source of roster) {
    const stats = config.ENEMIES[source.id as config.EnemyKind];
    assert(stats, 'Missing runtime enemy: ' + source.id);
    assert(stats.hp === source.hp && stats.attack === source.attack && stats.speed === source.speed && stats.defense === source.defense &&
      stats.xp === source.xpReward && stats.reward === source.goldReward, 'Canonical stats: ' + source.id);
    assert(['melee', 'ranged', 'charge', 'ambush'].includes(stats.role), 'AI role: ' + source.id);
    assert(stats.elite === ELITES.some(enemy => enemy.id === source.id), 'Elite flag: ' + source.id);
    assert(stats.scale > 0 && Number.isInteger(stats.color), 'Visual metadata: ' + source.id);
    const world = worlds.find(chapter => chapter.areaId === source.areaId);
    assert(world, 'Missing chapter for ' + source.id);
    assert(world.enemySpawnPool.wavePool.some(entry => entry.kind === source.id), 'Unreachable: ' + source.id);
  }
  for (const world of worlds) {
    const pool = world.enemySpawnPool;
    assert(pool.maxConcurrentEnemies > 0 && pool.maxConcurrentEnemies <= 7, 'Concurrency bound');
    assert(pool.initialSpawns.length <= pool.maxConcurrentEnemies, 'Initial concurrency bound');
    const total = pool.wavePool.reduce((sum, entry) => sum + entry.weight, 0);
    let accumulated = 0;
    for (const entry of pool.wavePool) {
      assert(Number.isFinite(entry.weight) && entry.weight > 0, 'Weight: ' + entry.kind);
      assert(config.ENEMIES[entry.kind] && entry.kind !== 'ho-yeu', 'No fake bosses: ' + entry.kind);
      if (entry.kind !== 'moc-tinh' && entry.kind !== 'ma-troi') {
        assert(config.ENEMIES[entry.kind].areaId === world.areaId, 'Wrong chapter: ' + entry.kind);
      }
      const roll = (accumulated + entry.weight / 2) / total;
      assert(pickNextEnemyKind(world.chapterId, roll) === entry.kind, 'Weighted reachability: ' + entry.kind);
      accumulated += entry.weight;
    }
    for (const roll of [-1, 0, 1, 2, NaN, Infinity]) {
      assert(pool.wavePool.some(entry => entry.kind === pickNextEnemyKind(world.chapterId, roll)), 'Safe roll: ' + roll);
    }
  }
  const sideChapters: readonly (readonly string[])[] = [
    ['forest-spider', 'wild-crow', 'copper-thief', 'cave-beast', 'ma-troi', 'field-pest', 'moc-tinh', 'forest-badger'],
    ['poison-toad', 'river-monster', 'water-fiend'],
    ['golem-scout', 'ruin-guardian', 'mourning-wraith'],
    ['drum-ambusher', 'citadel-looter'],
  ];
  for (const quest of QUESTS) {
    const firstKill = quest.objectives.find(objective => objective.kind === 'kill')?.target;
    const assignedChapter = quest.category === 'side' && firstKill
      ? sideChapters.findIndex(aliases => aliases.includes(firstKill)) + 1 : quest.chapter;
    assert(quest.category !== 'side' || Boolean(assignedChapter), 'Missing side quest chapter: ' + quest.id);
    for (const objective of quest.objectives) {
      if (objective.kind !== 'kill' || BOSS_IDS.some(id => id === objective.target)) continue;
      const pools = worlds.filter(world => assignedChapter === undefined || world.chapterId === assignedChapter);
      assert(pools.some(world => world.enemySpawnPool.wavePool.some(entry =>
        config.getEnemyKillTargets(entry.kind).includes(objective.target))), 'Unsatisfied quest: ' + quest.id + '/' + objective.target);
    }
  }
  for (const kind of Object.keys(config.ENEMIES) as config.EnemyKind[]) {
    const targets = config.getEnemyKillTargets(kind);
    assert(targets[0] === kind && targets.includes('forest-enemy'), 'Kill targets: ' + kind);
    assert(new Set(targets).size === targets.length, 'Duplicate targets: ' + kind);
    assert(Object.isFrozen(targets) && Object.isFrozen(config.ENEMIES[kind]), 'Immutable metadata: ' + kind);
    assert(config.ENEMIES[kind].questTags.every(tag => targets.includes(tag)), 'Missing tags: ' + kind);
  }
  assert(config.ENEMIES['moc-tinh'].hp === config.ENEMIES['moc-tinh-con'].hp, 'Legacy Mộc Tinh');
  assert(config.ENEMIES['ma-troi'].hp === config.ENEMIES['ma-troi-u-am'].hp, 'Legacy Ma Trơi');
  assert(config.ENEMIES['ho-yeu'].hp === 285, 'Legacy Hổ Yêu');
  let rejected = false;
  try { config.getEnemyKillTargets('unknown-enemy' as config.EnemyKind); } catch { rejected = true; }
  assert(rejected, 'Unknown enemy IDs fail closed');
  console.log('Enemy roster self-check: PASS (12 common, 4 elites, chapter-local quest aliases, concurrency <=7)');
  return true;
}
