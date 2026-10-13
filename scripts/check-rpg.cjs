const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = process.cwd();
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'than-menh-rpg-'));
try {
  const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tsc, 'src/game/rpg/skillSelfCheck.ts', 'src/game/rpg/bossSelfCheck.ts', 'src/game/rpg/selfCheck.ts', 'src/game/rpg/questRuntimeSelfCheck.ts', 'src/game/rpg/dungeonSelfCheck.ts', '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--skipLibCheck', '--esModuleInterop', '--outDir', output], { cwd: root, stdio: 'inherit' });
  fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');
  require(path.join(output, 'game', 'rpg', 'skillSelfCheck.js')).runSkillSelfCheck();
  require(path.join(output, 'game', 'rpg', 'bossSelfCheck.js')).runBossSelfCheck();
  require(path.join(output, 'game', 'rpg', 'selfCheck.js')).runSelfCheck();
  require(path.join(output, 'game', 'rpg', 'questRuntimeSelfCheck.js')).runQuestRuntimeSelfCheck();
  require(path.join(output, 'game', 'rpg', 'dungeonSelfCheck.js')).runDungeonSelfCheck();
  const assert = require('node:assert/strict');
  const ts = require('typescript');
  const { newSave } = require(path.join(output, 'game', 'systems', 'GameState.js'));
  const questSystem = require(path.join(output, 'game', 'rpg', 'QuestSystem.js'));
  const interactions = require(path.join(output, 'game', 'world', 'QuestInteractions.js'));
  const { QUESTS } = require(path.join(output, 'data', 'quests.js'));
  const historical = QUESTS.filter(quest => quest.category === 'side' && questSystem.getQuestChapter(quest) === 1 && quest.objectives.some(objective => objective.kind === 'flag')).slice(0, 2);
  const state = { data: { ...newSave(), chapter: 2, rpg: { ...newSave().rpg, quests: Object.fromEntries(historical.map(quest => [quest.id, { questId: quest.id, stage: 'active', rewardClaimed: false, flags: {}, counts: Object.fromEntries(quest.objectives.filter(objective => objective.kind === 'kill').map(objective => [objective.id, objective.required])) }])) } }, save() {} };
  const dependencies = { phaser: { Scene: class {} }, '../systems/GameState': { gameState: state }, '../rpg/QuestSystem': questSystem,
    '../world/QuestInteractions': interactions, '../ui/Hud': { toast() {} }, '../audio/AudioManager': { audioManager: { playCue() {} } } };
  const forestModule = { exports: {} };
  const javascript = ts.transpileModule(fs.readFileSync('src/game/scenes/ForestScene.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', javascript)(id => dependencies[id] ?? {}, forestModule.exports);
  const markers = interactions.getQuestInteractions({ ...state.data, chapter: 1 }, []);
  const forest = { areaChapter: 1, pause: { isOpen: () => false }, questMarkers: markers, player: { x: 0, y: 0 } };
  for (const quest of historical) {
    const marker = markers.find(entry => entry.questId === quest.id);
    forest.player = { x: marker.x, y: marker.y };
    forestModule.exports.ForestScene.prototype.interactQuestObject.call(forest, marker.flag);
    assert.equal(state.data.rpg.quests[quest.id].stage, 'return', 'Historical marker keeps rendered position after previous completion');
    assert.equal(state.data.chapter, 2, 'Revisit marker preserves campaign chapter');
    assert.equal(state.data.storyFlags['chapter:1:' + marker.flag], true, 'Revisit marker stamps origin area');
    assert.equal(state.data.storyFlags['chapter:2:' + marker.flag], undefined, 'Revisit cannot stamp current area');
  }
  console.log('RPG, boss, quest, and dungeon self-checks: PASS');
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
