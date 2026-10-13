const assert = require('node:assert/strict');

function assertQuestRewards(before, after, quests) {
  const nonnegative = (value, label) => assert.ok(Number.isSafeInteger(value) && value >= 0, label + ' invalid');
  for (const save of [before, after]) {
    nonnegative(save.gold, 'gold');
    nonnegative(save.xp, 'XP');
    assert.ok(Number.isSafeInteger(save.level) && save.level >= 1, 'level invalid');
  }
  const claimed = Object.entries(after.rpg.quests).filter(([id, progress]) =>
    progress.rewardClaimed && !before.rpg.quests[id]?.rewardClaimed);
  const definitions = claimed.map(([id]) => quests.find(quest => quest.id === id));
  assert.ok(definitions.every(Boolean), 'Rewarded quest definition missing');
  for (const quest of definitions) {
    nonnegative(quest.reward.gold, 'reward gold');
    nonnegative(quest.reward.xp, 'reward XP');
    for (const item of quest.reward.items) nonnegative(item.quantity, 'reward quantity');
  }
  const gold = definitions.reduce((total, quest) => total + quest.reward.gold, 0);
  const xp = definitions.reduce((total, quest) => total + quest.reward.xp, 0);
  nonnegative(gold, 'Total reward gold');
  nonnegative(xp, 'Total reward XP');
  assert.equal(after.gold - before.gold, gold, 'Exact reward gold delta mismatch');
  const totalXp = save => {
    const total = save.xp + 45 * (save.level - 1) + 15 * save.level * (save.level - 1) / 2;
    nonnegative(total, 'Cumulative XP');
    return total;
  };
  assert.equal(totalXp(after) - totalXp(before), xp, 'Exact reward XP delta mismatch');
  const quantities = save => save.rpg.inventory.slots.reduce((totals, slot) => {
    if (!slot) return totals;
    assert.ok(typeof slot.itemId === 'string' && slot.itemId.length > 0, 'Inventory itemId invalid');
    nonnegative(slot.quantity, 'Inventory quantity');
    const total = (Object.hasOwn(totals, slot.itemId) ? totals[slot.itemId] : 0) + slot.quantity;
    nonnegative(total, 'Inventory total quantity');
    return { ...totals, [slot.itemId]: total };
  }, {});
  const beforeItems = quantities(before);
  const afterItems = quantities(after);
  const expectedItems = quantities({ rpg: { inventory: { slots: definitions.flatMap(quest => quest.reward.items) } } });
  const itemIds = new Set([...Object.keys(beforeItems), ...Object.keys(afterItems), ...Object.keys(expectedItems)]);
  const quantity = (items, itemId) => Object.hasOwn(items, itemId) ? items[itemId] : 0;
  for (const itemId of itemIds) assert.equal(quantity(afterItems, itemId) - quantity(beforeItems, itemId),
    quantity(expectedItems, itemId), 'Exact reward item delta mismatch: ' + itemId);
  return { questIds: claimed.map(([id]) => id), gold, xp, items: expectedItems };
}

module.exports = assertQuestRewards;

if (require.main === module) {
  const quests = [
    { id: 'main-authored', reward: { gold: 10, xp: 6, items: [{ itemId: 'stone', quantity: 2 }] } },
    { id: 'side-authored', reward: { gold: 20, xp: 10, items: [{ itemId: 'stone', quantity: 3 }, { itemId: 'tea', quantity: 1 }] } },
    { id: 'already-claimed', reward: { gold: 99, xp: 99, items: [{ itemId: 'stone', quantity: 99 }] } },
    { id: 'hunt-ho-yeu', reward: { gold: 100, xp: 140, items: [{ itemId: 'charm', quantity: 1 }] } },
  ];
  const before = {
    gold: 7, level: 1, xp: 59,
    rpg: { quests: { 'already-claimed': { rewardClaimed: true }, 'hunt-ho-yeu': { rewardClaimed: true } },
      inventory: { slots: [null, { itemId: 'stone', quantity: 4 }, { itemId: 'relic', quantity: 1 }] } },
  };
  const after = {
    gold: 37, level: 2, xp: 15,
    rpg: { quests: { ...before.rpg.quests, 'main-authored': { rewardClaimed: true },
      'side-authored': { rewardClaimed: true }, 'hunt-ho-yeu': { rewardClaimed: true } },
      inventory: { slots: [{ itemId: 'stone', quantity: 3 }, { itemId: 'stone', quantity: 6 },
        { itemId: 'tea', quantity: 1 }, { itemId: 'relic', quantity: 1 }] } },
  };
  const original = structuredClone({ before, after, quests });
  assertQuestRewards(before, after, quests);
  const legacyBefore = { ...before, rpg: { ...before.rpg, quests: { ...before.rpg.quests, 'hunt-ho-yeu': { rewardClaimed: false } } } };
  const legacyAfter = { ...before, gold: before.gold + 100, level: 3, xp: 64, rpg: { ...before.rpg,
    inventory: { slots: [...before.rpg.inventory.slots, { itemId: 'charm', quantity: 1 }] } } };
  assertQuestRewards(legacyBefore, legacyAfter, quests);
  assert.throws(() => assertQuestRewards(legacyBefore, { ...legacyAfter, gold: before.gold }, quests), /gold/i);
  assertQuestRewards(before, structuredClone(before), quests);
  assert.throws(() => assertQuestRewards(before, { ...after, gold: 36 }, quests), /gold/i);
  assert.throws(() => assertQuestRewards(before, { ...after, xp: 14 }, quests), /XP/);
  assert.throws(() => assertQuestRewards(before, { ...after, level: 1 }, quests), /XP/);
  const inventoryAfter = slots => ({ ...after, rpg: { ...after.rpg, inventory: { slots } } });
  const slots = after.rpg.inventory.slots;
  assert.throws(() => assertQuestRewards(before, inventoryAfter(slots.filter(slot => slot.itemId !== 'tea')), quests), /tea/);
  assert.throws(() => assertQuestRewards(before, inventoryAfter(slots.map(slot => slot.itemId === 'stone'
    ? { ...slot, quantity: slot.quantity - 1 } : slot)), quests), /stone/);
  assert.throws(() => assertQuestRewards(before, inventoryAfter(slots.filter(slot => slot.itemId !== 'relic')), quests), /relic/);
  assert.throws(() => assertQuestRewards(before, inventoryAfter([...slots, { itemId: 'extra', quantity: 1 }]), quests), /extra/);
  assert.throws(() => assertQuestRewards(before, { ...after, gold: 38 }, quests), /gold/i);
  assert.throws(() => assertQuestRewards(before, { ...after, xp: NaN }, quests), /XP/);
  assert.throws(() => assertQuestRewards(before, inventoryAfter([{ itemId: 'stone', quantity: -1 }]), quests), /quantity/);
  assert.throws(() => assertQuestRewards(before, { ...after, gold: NaN }, quests.map(quest =>
    ({ ...quest, reward: { ...quest.reward, gold: NaN } }))), /gold/i);
  assert.throws(() => assertQuestRewards(before, { ...after, xp: NaN }, quests.map(quest =>
    ({ ...quest, reward: { ...quest.reward, xp: NaN } }))), /XP/);
  assert.throws(() => assertQuestRewards(before, { ...after, level: 0 }, quests), /level/);
  assert.throws(() => assertQuestRewards(before, { ...after, level: Number.MAX_SAFE_INTEGER }, quests), /Cumulative XP/);
  assert.throws(() => assertQuestRewards(before, after, quests.map(quest => ({ ...quest,
    reward: { ...quest.reward, gold: Infinity } }))), /gold/i);
  assert.throws(() => assertQuestRewards(before, inventoryAfter([{ itemId: 'stone', quantity: NaN }]), quests), /quantity/);
  assert.throws(() => assertQuestRewards({ ...before, rpg: { ...before.rpg,
    inventory: { slots: [{ itemId: 'stone', quantity: Infinity }] } } }, after, quests), /quantity/);
  assert.throws(() => assertQuestRewards(before, { ...before, gold: 6 }, quests), /gold/i);
  assert.throws(() => assertQuestRewards(before, { ...before, xp: 58 }, quests), /XP/);
  assert.throws(() => assertQuestRewards(before, { ...before, rpg: { ...before.rpg,
    inventory: { slots: [] } } }, quests), /stone/);
  assert.deepEqual({ before, after, quests }, original, 'Inputs remain unchanged');
  console.log('campaign-rewards selfcheck: PASS (exact gold/XP/items, missing rewards, losses, aggregation, level-up, unchanged inputs)');
}
