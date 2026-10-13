const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('./check-campaign.cjs'), 'utf8');
const match = source.match(/const waitScene = async key => \{([\s\S]*?)\n  \};/);
assert.ok(match, 'Actual waitScene unavailable');

async function check(scenes, target, failure) {
  const clicks = [];
  const context = vm.createContext({
    deaths: 0,
    readScene: async () => ({ key: scenes.length > 1 ? scenes.shift() : scenes[0] }),
    click: async (...coordinates) => clicks.push(coordinates),
    delay: async () => {},
  });
  const waitScene = vm.runInContext('(async key => {' + match[1] + '})', context);
  if (failure) await assert.rejects(waitScene(target), /Scene did not start/);
  else await waitScene(target);
  return { clicks, deaths: context.deaths };
}

(async () => {
  const hydrationCheck = source.match(/  assert\.deepEqual\(restored\.result\.value,.*save hydration.*\);/);
  assert.ok(hydrationCheck, 'Actual hydration assertion unavailable');
  const finalSave = { chapter: 4, gold: 900, playtimeSeconds: 510.45, storyFlags: { 'boss:hac-an': true } };
  const hydration = vm.createContext({ assert });
  vm.runInContext('var finalSave = ' + JSON.stringify(finalSave) + '; var restored = { result: { value: { ...finalSave, playtimeSeconds: 510 } } };', hydration);
  vm.runInContext(hydrationCheck[0], hydration);
  vm.runInContext('restored.result.value = { ...restored.result.value, gold: 899 };', hydration);
  assert.throws(() => vm.runInContext(hydrationCheck[0], hydration), /save hydration/);
  vm.runInContext('restored.result.value = { ...finalSave, playtimeSeconds: 509 };', hydration);
  assert.throws(() => vm.runInContext(hydrationCheck[0], hydration), /save hydration/);
  const moveBody = source.match(/const move = async \(dx, dy, duration\) => \{([\s\S]*?)\n  \};/);
  assert.ok(moveBody, 'Actual move unavailable');
  for (const [targetX, targetY] of [[100, 10], [10, 100], [-100, 10], [10, -100], [100, 100], [0, 100], [0, 0]]) {
    const keys = new Set();
    const position = { x: 0, y: 0 };
    const context = vm.createContext({
      send: async (method, event) => event.type === 'keyDown' ? keys.add(event.code) : keys.delete(event.code),
      delay: async milliseconds => {
        const horizontal = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
        const vertical = Number(keys.has('KeyS')) - Number(keys.has('KeyW'));
        const magnitude = Math.hypot(horizontal, vertical);
        if (magnitude === 0) return;
        position.x += horizontal / magnitude * milliseconds / 1000 * 190;
        position.y += vertical / magnitude * milliseconds / 1000 * 190;
      },
    });
    const move = vm.runInContext('(async (dx, dy, duration) => {' + moveBody[1] + '})', context);
    await move(targetX, targetY, Math.hypot(targetX, targetY) / 190 * 1000);
    assert.ok(Math.hypot(position.x - targetX, position.y - targetY) < 0.001, 'Movement deviates from waypoint');
    assert.equal(keys.size, 0, 'Movement leaves held keys');
  }
  assert.deepEqual(await check(['Forest', 'GameOver', 'Village'], 'Village'),
    { clicks: [[480, 300]], deaths: 1 });
  assert.deepEqual(await check(['Village'], 'Village'), { clicks: [], deaths: 0 });
  assert.deepEqual(await check(['GameOver'], 'Victory', true), { clicks: [], deaths: 0 });
  assert.deepEqual(await check(['Forest'], 'Village', true), { clicks: [], deaths: 0 });
  const markerBody = source.match(/const interactMarker = async marker => \{([\s\S]*?)\n  \};/);
  assert.ok(markerBody, 'Actual interactMarker unavailable');
  let key = 'Forest';
  let questStage = 'active';
  let markerAttempts = 0;
  let revived = 0;
  const markerClicks = [];
  let transient = true;
  const markerContext = vm.createContext({
    assert, deadline: Date.now() + 1000, delay: async () => {},
    readSave: async () => ({ rpg: { quests: { target: { stage: questStage } } } }),
    readScene: async () => {
      if (transient) { transient = false; return { key: null }; }
      if (key === null) { key = 'GameOver'; return { key: null }; }
      return { key, player: { dead: key === 'GameOver' } };
    },
    combatStep: async () => { revived++; key = 'Village'; },
    waitScene: async expected => assert.equal(key, expected),
    moveTo: async target => {
      if (target.x === 926) { key = 'Forest'; return true; }
      if (++markerAttempts === 1) { key = 'GameOver'; return false; }
      return true;
    },
    click: async (...coordinates) => {
      markerClicks.push(coordinates);
      if (markerClicks.length === 1) key = null;
      else questStage = 'return';
    },
  });
  const interactMarker = vm.runInContext('(async marker => {' + markerBody[1] + '})', markerContext);
  await interactMarker({ questId: 'target', flag: 'yeast-gathered', x: 325, y: 395 });
  assert.equal(revived, 2);
  assert.equal(markerAttempts, 3);
  assert.deepEqual(markerClicks, [[325, 395], [325, 395]]);
  console.log('campaign-control selfcheck: PASS (actual waitScene recovery, normal, wrong scene, timeout)');
})().catch(error => { console.error(error); process.exitCode = 1; });
