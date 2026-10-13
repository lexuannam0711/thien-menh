const assert = require('node:assert/strict');

async function clearNaturalDungeon(dungeon, controls) {
  const { readSave, readScene, moveTo, press, combatStep, waitScene, deadline } = controls;
  const before = await readSave();
  const chapter = before.chapter;
  assert.equal(before.storyFlags['dungeon-key:' + dungeon.id], true, 'Natural key missing: ' + dungeon.id);
  assert.ok(before.level >= dungeon.minLevel, 'Natural level too low: ' + dungeon.id);
  assert.notEqual(before.storyFlags['dungeon-reward:' + dungeon.id], true, 'Dungeon already rewarded');
  const floors = new Set();
  while (Date.now() < deadline) {
    const save = await readSave();
    assert.equal(save.chapter, chapter, 'Dungeon changed campaign chapter');
    for (let floor = 0; floor < dungeon.floorCount; floor++) if (save.storyFlags['dungeon-floor:' + dungeon.id + ':' + floor]) floors.add(floor);
    if (save.storyFlags['dungeon-reward:' + dungeon.id]) {
      assert.equal(floors.size, dungeon.floorCount, 'Reward granted before every floor cleared');
      for (const itemId of dungeon.rewardItemIds) {
        const quantity = data => data.rpg.inventory.slots.filter(slot => slot?.itemId === itemId)
          .reduce((total, slot) => total + slot.quantity, 0);
        assert.ok(quantity(save) > quantity(before), 'Natural dungeon reward missing: ' + itemId);
      }
      await waitScene('Forest');
      assert.equal((await readScene()).key, 'Forest');
      return { id: dungeon.id, entryLevel: before.level, naturalKey: true, floors: [...floors], rewardClaimed: true };
    }
    const scene = await readScene();
    if (scene.key === 'Village') {
      if (await moveTo({ x: 926, y: 270 }, 8)) await waitScene('Forest');
    } else if (scene.key === 'Forest') {
      if (await moveTo({ x: 245, y: 165 }, 35)) { await press('KeyF', 70); }
    } else if (scene.key === 'Dungeon' && scene.enemies.length === 0
      && save.storyFlags['dungeon-floor:' + dungeon.id + ':' + scene.dungeon.floor]) {
      if (await moveTo({ x: 480, y: 140 }, 45)) await press('KeyF', 70);
    } else await combatStep();
  }
  throw new Error('Natural dungeon exceeded deadline: ' + dungeon.id);
}

module.exports = clearNaturalDungeon;

if (require.main === module) {
  (async () => {
    const dungeon = { id: 'sample', minLevel: 2, floorCount: 2, rewardItemIds: ['stone'] };
    let save = { chapter: 1, level: 2, storyFlags: { 'dungeon-key:sample': true }, rpg: { inventory: { slots: [] } } };
    let scene = { key: 'Village' };
    let floor = 0;
    let deaths = 0;
    const controls = {
      deadline: Date.now() + 1000,
      readSave: async () => structuredClone(save),
      readScene: async () => ({ ...scene, dungeon: { floor },
        enemies: scene.key === 'Dungeon' && !save.storyFlags['dungeon-floor:sample:' + floor] ? [{}] : [] }),
      moveTo: async target => { if (target.x === 926) scene = { key: 'Forest' }; return true; },
      waitScene: async key => assert.equal(scene.key, key),
      press: async () => {
        if (scene.key === 'Forest') scene = { key: 'Dungeon' };
        else if (floor === 0) floor = 1;
        else {
          save = { ...save, storyFlags: { ...save.storyFlags, 'dungeon-reward:sample': true },
            rpg: { inventory: { slots: [{ itemId: 'stone', quantity: 1 }] } } };
          scene = { key: 'Forest' };
        }
      },
      combatStep: async () => {
        if (!deaths) { deaths++; scene = { key: 'Village' }; }
        else save = { ...save, storyFlags: { ...save.storyFlags, ['dungeon-floor:sample:' + floor]: true } };
      },
    };
    const result = await clearNaturalDungeon(dungeon, controls);
    assert.deepEqual(result.floors, [0, 1]);
    assert.equal(result.rewardClaimed, true);
    assert.equal(deaths, 1);
    await assert.rejects(clearNaturalDungeon(dungeon, controls), /already rewarded/);
    save = { ...save, storyFlags: {} };
    await assert.rejects(clearNaturalDungeon(dungeon, controls), /Natural key missing/);
    console.log('campaign-dungeon selfcheck: PASS (natural entry, death retry, every floor, item reward, duplicate gate)');
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
