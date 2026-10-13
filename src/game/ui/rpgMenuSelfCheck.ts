/**
 * rpgMenuSelfCheck.ts
 * Kiểm tra tất định độc lập cho RpgMenuModel:
 * - Dữ liệu các thẻ (tabs): inventory, equipment, skills, quests, shop, crafting
 * - Các chốt chặn giao dịch (transaction guards):
 *   + Chốt chặn tiền vàng (insufficient gold)
 *   + Chốt chặn sức chứa kho đồ (capacity limit)
 *   + Chốt chặn nguyên liệu chế tác (insufficient materials)
 *   + Chốt chặn cấp độ & mở khóa kỹ năng (level / unlock constraints)
 *   + Tính nguyên tử (atomicity) không gây tác dụng phụ khi thất bại
 */

import { BALANCE } from '../../data/config';
import { getSkill } from '../../data/skills';
import { getItem, type ItemKind } from '../../data/items';
import { newSave, normalizeSave } from '../systems/GameState';
import { WEAPONS, getWeapon, getWeaponsByType, getEquippedWeaponOrDefault, calculateWeaponDamage, calculateWeaponKnockback, calculateWeaponAttackTiming, calculateWeaponReach } from '../../data/weapons';
import { getChapterDungeon, dungeonEntryError, grantDungeonKey, getDungeonFloor, getDungeonFloorEnemies, clearDungeonFloor, claimDungeonReward } from '../rpg/DungeonSystem';
import { addItem, type InventorySlot } from '../rpg/InventorySystem';
import {
  RpgMenuModel,
  RPG_MENU_TABS,
  CRAFTING_RECIPES,
} from './RpgMenuModel';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[RPG Menu Self-Check Failed]: ${message}`);
  }
}

export function runRpgMenuSelfCheck(): true {
  // =============================================================
  // Suite 1: Cấu trúc các Thẻ (Tab Info & Model Views)
  // =============================================================
  assert(RPG_MENU_TABS.length === 6, 'Menu must define exactly 6 tabs');
  const tabIds = RPG_MENU_TABS.map((t) => t.id);
  assert(tabIds.includes('inventory'), 'Tab inventory exists');
  assert(tabIds.includes('equipment'), 'Tab equipment exists');
  assert(tabIds.includes('skills'), 'Tab skills exists');
  assert(tabIds.includes('quests'), 'Tab quests exists');
  assert(tabIds.includes('shop'), 'Tab shop exists');
  assert(tabIds.includes('crafting'), 'Tab crafting exists');

  const save1 = newSave();
  const model1 = new RpgMenuModel(save1);

  // 1.1 Kiểm tra view Kho đồ ban đầu
  const invView = model1.getInventoryView();
  assert(invView.capacity === 24, 'Default inventory capacity is 24');
  assert(invView.usedSlots === 0, 'New save starts with empty inventory');
  assert(invView.freeSlots === 24, 'All 24 slots are free initially');

  const inventorySlots = Object.freeze([
    { itemId: 'spirit-tea', quantity: 2 }, { itemId: 'bronze-spear', quantity: 1 },
    { itemId: 'herbal-balm', quantity: 4 }, { itemId: 'bronze-scrap', quantity: 4 },
    { itemId: 'bamboo-armor', quantity: 1 }, { itemId: 'jade-charm', quantity: 1 },
    { itemId: 'unknown-item', quantity: 3 }, { itemId: 'herbal-balm', quantity: 2 },
    { itemId: 'spirit-stone', quantity: 5 }, { itemId: 'spirit-tea', quantity: 1 },
  ].map(slot => Object.freeze(slot)));
  const inventorySave = newSave();
  const inventoryModel = new RpgMenuModel({ ...inventorySave,
    rpg: { ...inventorySave.rpg, inventory: Object.freeze({ capacity: 24, slots: inventorySlots }) },
  }, () => { throw new Error('Views must not persist'); });
  const snapshot = JSON.stringify(inventoryModel.save);
  const inventoryView = inventoryModel.getInventoryView.bind(inventoryModel);
  assert(inventoryView('all', 'quantity').slots.map(slot => slot.index).join(',') === '8,2,3,6,0,7,1,4,5,9',
    'Quantity sort descends with stable ties and original indices across pages');
  const names = inventoryView('all', 'name').slots;
  assert(names.every((slot, index) => index === 0 ||
    (names[index - 1].item?.name ?? names[index - 1].itemId).localeCompare(slot.item?.name ?? slot.itemId, 'vi') <= 0),
    'Name sort uses Vietnamese names and unknown ID fallback');
  assert(names.filter(slot => slot.itemId === 'herbal-balm').map(slot => slot.index).join(',') === '2,7',
    'Duplicate names retain source order');
  const categories: readonly ItemKind[] = ['consumable', 'weapon', 'armor', 'accessory', 'material'];
  categories.forEach(category => {
    const filtered = inventoryView(category, 'quantity');
    assert(filtered.slots.length === inventorySlots.filter(slot => getItem(slot.itemId)?.kind === category).length &&
      filtered.slots.every(slot => slot.item?.kind === category && inventorySlots[slot.index].itemId === slot.itemId),
      'Filter preserves matching slots, source indices and IDs: ' + category);
    assert(filtered.usedSlots === 10 && filtered.freeSlots === 14 && filtered.capacity === 24,
      'Filtered view reports full inventory capacity');
  });
  assert(inventoryView().slots.map(slot => slot.index).join(',') === '0,1,2,3,4,5,6,7,8,9', 'Default order unchanged');
  assert(JSON.stringify(inventoryModel.save) === snapshot && inventoryModel.save.rpg.inventory.slots === inventorySlots,
    'View never mutates or replaces frozen inventory');
  const emptyView: typeof inventoryView = model1.getInventoryView.bind(model1);
  assert(emptyView('weapon', 'name').slots.length === 0, 'Empty filtered inventory is safe');
  const actionSave = newSave();
  const actionModel = new RpgMenuModel({ ...actionSave, hp: 20,
    rpg: { ...actionSave.rpg, inventory: { capacity: 24, slots: inventorySlots } },
  }, () => {});
  const actionView: typeof inventoryView = actionModel.getInventoryView.bind(actionModel);
  const consumable = actionView('consumable', 'quantity').slots[0];
  assert(consumable.itemId === 'herbal-balm' && actionModel.useItem(consumable.itemId).success &&
    actionModel.save.rpg.inventory.slots[0].quantity === 2 && actionModel.save.rpg.inventory.slots[7].quantity === 1,
    'Sorted use consumes selected balm, not first source slot tea');
  const weapon = actionView('weapon', 'name').slots[0];
  assert(weapon.index === 1 && actionModel.equip(weapon.itemId).success &&
    actionModel.save.rpg.equipment.slots.weapon === 'bronze-spear', 'Filtered equip uses original item ID');
  assert(actionView('weapon').slots.length === 0, 'No matches yields empty filtered view');

  // 1.2 Kiểm tra view Trang bị ban đầu
  const eqView = model1.getEquipmentView();
  assert(eqView.weapon === undefined, 'No weapon initially');
  assert(eqView.armor === undefined, 'No armor initially');
  assert(eqView.accessory === undefined, 'No accessory initially');
  assert((eqView.stats.attack ?? 0) === 0, 'Initial eq attack bonus is 0');

  // 1.3 Kiểm tra view Kỹ năng
  const skView = model1.getSkillsView();
  assert(Boolean(skView.activeDivinePower), 'Active divine power exists');
  assert(skView.divinePowers.length >= 3, 'At least 3 divine powers defined');
  assert(skView.skills.length > 0, 'Skills list is populated');

  // 1.4 Kiểm tra view Nhiệm vụ
  const qView = model1.getQuestsView();
  assert(qView.quests.length > 0, 'Quest journal contains quests');
  const mainQ = qView.quests.find((q) => q.id === 'hunt-ho-yeu');
  assert(Boolean(mainQ), 'Main quest hunt-ho-yeu exists');
  assert(mainQ?.objectives.length === 2, 'Main quest has 2 objectives');

  // 1.5 Kiểm tra view Cửa hàng
  const shopView = model1.getShopView();
  assert(shopView.items.length >= 5, 'Shop catalog has goods');
  assert(shopView.playerGold === 0, 'New save has 0 gold');

  // 1.6 Kiểm tra view Chế tác & Nâng cấp
  const craftView = model1.getCraftingView();
  assert(craftView.weaponUpgrades === 0, 'Initial upgrades = 0');
  assert(craftView.currentAttack === BALANCE.attack, 'Attack matches balance initial');
  assert(craftView.upgradeCost === BALANCE.smithCost, 'Upgrade cost matches smith cost');
  assert(craftView.recipes.length === CRAFTING_RECIPES.length, 'Recipes count matches');
  const lowLevel = newSave();
  lowLevel.rpg = { ...lowLevel.rpg, inventory: { capacity: 24, slots: [{ itemId: 'battle-axe', quantity: 1 }, { itemId: 'lac-sword', quantity: 1 }] } };
  const lowLevelModel = new RpgMenuModel(lowLevel, () => {});
  assert(!lowLevelModel.equip('battle-axe').success, 'Level 1 cannot equip level 2 axe');
  assert(!lowLevelModel.equip('lac-sword').success, 'Level 1 cannot equip level 3 sword');
  const gearSave = { ...newSave(), level: 3 };
  gearSave.rpg = { ...gearSave.rpg, inventory: { capacity: 24, slots: [{ itemId: 'battle-axe', quantity: 1 }, { itemId: 'lac-sword', quantity: 1 }] } };
  const gearModel = new RpgMenuModel(gearSave, () => {});
  assert(gearModel.equip('battle-axe').success, 'Eligible player equips axe');
  assert(gearModel.getCasterSnapshot().maxHp === 120, 'Axe grants effective HP');
  assert(gearModel.unequip('weapon').success && gearModel.equip('battle-axe').success, 'Axe can be reequipped');
  assert(gearSave.maxHp === 100 && gearModel.getCasterSnapshot().maxHp === 120, 'Reequip does not stack base stats');
  assert(gearModel.equip('lac-sword').success && gearModel.getCasterSnapshot().maxMp === 115, 'Sword grants effective MP');
  for (const weaponId of ['bronze-spear', 'battle-axe', 'lac-sword']) {
    const weaponSave = { ...newSave(), gold: 1000 };
    weaponSave.rpg = { ...weaponSave.rpg, inventory: { capacity: 24, slots: [{ itemId: 'bronze-scrap', quantity: 20 }, { itemId: 'spirit-stone', quantity: 20 }] } };
    const weaponModel = new RpgMenuModel(weaponSave, () => {});
    assert(weaponModel.craft('craft-' + weaponId).success, 'Actual model can craft ' + weaponId);
    assert(weaponModel.getInventoryView().slots.some(slot => slot.itemId === weaponId), 'Crafted weapon reaches inventory: ' + weaponId);
  }

  // =============================================================
  // Suite 2: Kho Đồ — Sử Dụng & Giới Hạn Hồi Phục
  // =============================================================
  const save2 = newSave();
  save2.hp = 20;
  save2.maxHp = 100;
  save2.mp = 15;
  save2.maxMp = 60;
  const model2 = new RpgMenuModel(save2);

  // Thử dùng khi chưa có vật phẩm
  const failUse = model2.useItem('herbal-balm');
  assert(!failUse.success, 'Cannot use item not in inventory');

  // Thêm thảo dược và dùng
  save2.rpg.inventory = addItem(save2.rpg.inventory, 'herbal-balm', 2).state;
  const use1 = model2.useItem('herbal-balm');
  assert(use1.success, 'Consuming herbal-balm succeeds');
  assert((save2.hp as number) === 55, 'HP increased by 35 (from 20 to 55)');
  assert(save2.rpg.inventory.slots[0].quantity === 1, '1 balm remaining');

  // Thêm trà thần lực và dùng
  save2.rpg.inventory = addItem(save2.rpg.inventory, 'spirit-tea', 1).state;
  const use2 = model2.useItem('spirit-tea');
  assert(use2.success, 'Consuming spirit-tea succeeds');
  assert((save2.mp as number) === 50, 'MP increased by 35 (from 15 to 50)');

  // Dùng thêm lần nữa kiểm tra tăng thêm
  const use3 = model2.useItem('herbal-balm');
  assert(use3.success, 'Consuming second balm succeeds');
  assert((save2.hp as number) === 90, 'HP increased to 90');

  // Thử dùng trang bị dưới dạng consumable -> phải bị từ chối
  save2.rpg.inventory = addItem(save2.rpg.inventory, 'bronze-spear', 1).state;
  const useInvalid = model2.useItem('bronze-spear');
  assert(!useInvalid.success, 'Cannot consume equipment directly as consumable');
  assert(save2.rpg.inventory.slots.some((s) => s.itemId === 'bronze-spear'), 'Spear remained untouched');

  // =============================================================
  // Suite 3: Trang Bị — Mặc, Đổi Chỗ, Tháo & Chặn Đầy Túi
  // =============================================================
  const save3 = newSave();
  const model3 = new RpgMenuModel(save3);

  // Đưa giáo vào kho đồ rồi trang bị
  save3.rpg.inventory = addItem(save3.rpg.inventory, 'bronze-spear', 1).state;
  save3.rpg.inventory = addItem(save3.rpg.inventory, 'bamboo-armor', 1).state;
  save3.rpg.inventory = addItem(save3.rpg.inventory, 'jade-charm', 1).state;

  const eqSpear = model3.equip('bronze-spear');
  assert(eqSpear.success, 'Equipping spear succeeds');
  assert(save3.rpg.equipment.slots.weapon === 'bronze-spear', 'Weapon slot is bronze-spear');
  assert(save3.rpg.inventory.slots.every((s) => s.itemId !== 'bronze-spear'), 'Spear moved out of inventory');

  const eqArmor = model3.equip('bamboo-armor');
  assert(eqArmor.success, 'Equipping armor succeeds');
  assert(save3.rpg.equipment.slots.armor === 'bamboo-armor', 'Armor slot is bamboo-armor');

  const eqCharm = model3.equip('jade-charm');
  assert(eqCharm.success, 'Equipping charm succeeds');
  assert(save3.rpg.equipment.slots.accessory === 'jade-charm', 'Accessory slot is jade-charm');

  // Kiểm tra thống kê trang bị tổng hợp
  const eqStats = model3.getEquipmentView().stats;
  assert(eqStats.attack === 4, 'Aggregate attack bonus is +4 from spear');
  assert(eqStats.maxHp === 18, 'Aggregate maxHp bonus is +18 from armor');
  assert(eqStats.maxMp === 15, 'Aggregate maxMp bonus is +15 from charm');
  assert(eqStats.speed === 8, 'Aggregate speed bonus is +8 from charm');

  // Tháo trang bị
  const unequipWeapon = model3.unequip('weapon');
  assert(unequipWeapon.success, 'Unequipping weapon succeeds');
  assert(save3.rpg.equipment.slots.weapon === undefined, 'Weapon slot is now empty');
  assert(save3.rpg.inventory.slots.some((s) => s.itemId === 'bronze-spear'), 'Spear returned to inventory');

  // Kiểm tra chốt chặn tháo trang bị khi kho đồ đầy (capacity limit)
  // Lấp đầy 24 ô kho đồ
  const fullSave = newSave();
  fullSave.rpg.equipment = { slots: { weapon: 'bronze-spear' } };
  const fullSlots: InventorySlot[] = [];
  for (let i = 0; i < 24; i++) {
    fullSlots.push({ itemId: 'jade-charm', quantity: 1 });
  }
  fullSave.rpg.inventory = { capacity: 24, slots: fullSlots };

  const fullModel = new RpgMenuModel(fullSave);
  const failUnequip = fullModel.unequip('weapon');
  assert(!failUnequip.success, 'Unequipping weapon must fail when inventory is full');
  assert(fullSave.rpg.equipment.slots.weapon === 'bronze-spear', 'Spear remains safely equipped');

  // =============================================================
  // Suite 4: Cửa Hàng — Mua, Bán & Chốt Chặn Tiền / Kho Đồ
  // =============================================================
  const save4 = newSave();
  save4.gold = 100;
  const model4 = new RpgMenuModel(save4);

  // Mua thảo dược (giá 8 đồng)
  const buy1 = model4.buyItem('herbal-balm', 2);
  assert(buy1.success, 'Buying 2 balms succeeds');
  assert((save4.gold as number) === 84, 'Gold deducted: 100 - 16 = 84');
  assert(save4.rpg.inventory.slots[0].quantity === 2, '2 balms in inventory');

  // Chốt chặn 4.1: Thiếu tiền
  const failBuyGold = model4.buyItem('jade-charm', 2); // 70 * 2 = 140 > 84
  assert(!failBuyGold.success, 'Cannot afford 2 jade charms with 84 gold');
  assert((save4.gold as number) === 84, 'Gold remains intact after failed purchase');

  // Chốt chặn 4.2: Kho đồ đầy
  const shopFullSave = newSave();
  shopFullSave.gold = 500;
  const shopFullSlots: InventorySlot[] = [];
  for (let i = 0; i < 24; i++) {
    shopFullSlots.push({ itemId: 'bamboo-armor', quantity: 1 });
  }
  shopFullSave.rpg.inventory = { capacity: 24, slots: shopFullSlots };

  const shopFullModel = new RpgMenuModel(shopFullSave);
  const failBuyFull = shopFullModel.buyItem('bronze-spear', 1);
  assert(!failBuyFull.success, 'Cannot buy when inventory is full of unstackable items');
  assert(shopFullSave.gold === 500, 'Gold is NOT deducted when inventory is full');

  // Bán vật phẩm
  const sellResult = model4.sellItem('herbal-balm', 1);
  assert(sellResult.success, 'Selling 1 balm succeeds');
  assert((save4.rpg.inventory.slots[0].quantity as number) === 1, '1 balm left');
  assert((save4.gold as number) === 88, 'Gold increased: 84 + floor(8/2) = 88');

  // Bán quá số lượng sở hữu
  const failSell = model4.sellItem('herbal-balm', 5);
  assert(!failSell.success, 'Cannot sell more items than available');
  assert((save4.gold as number) === 88, 'Gold untouched after failed sell');

  // =============================================================
  // Suite 5: Chế Tác & Nâng Cấp — Công Thức & Chốt Chặn
  // =============================================================
  const save5 = newSave();
  save5.gold = 50;
  save5.upgrades = 0;
  save5.attack = BALANCE.attack;
  const model5 = new RpgMenuModel(save5);

  // Nâng cấp vũ khí (Thợ rèn đúc trong menu)
  const up1Cost = BALANCE.smithCost * 1;
  const up1 = model5.upgradeWeapon();
  assert(up1.success, 'Weapon upgrade succeeds');
  assert((save5.gold as number) === 50 - up1Cost, 'Gold deducted for upgrade');
  assert(save5.upgrades === 1, 'Upgrades incremented to 1');
  assert(save5.attack === BALANCE.attack + BALANCE.smithAttackGain, 'Attack gained');

  // Chốt chặn nâng cấp khi không đủ tiền
  save5.gold = 5;
  const failUp = model5.upgradeWeapon();
  assert(!failUp.success, 'Weapon upgrade fails when lacking gold');
  assert(save5.gold === 5, 'Gold untouched');
  assert(save5.upgrades === 1, 'Upgrades untouched');

  // Chế tác: Luyện Đan Hồi Sinh (1 spirit-stone + 2 gold -> 1 herbal-balm)
  save5.gold = 20;
  // Thiếu nguyên liệu
  const failCraftMat = model5.craft('craft-herbal-balm');
  assert(!failCraftMat.success, 'Crafting fails without materials');
  assert(save5.gold === 20, 'Gold untouched');

  // Thêm nguyên liệu và chế tạo thành công
  save5.rpg.inventory = addItem(save5.rpg.inventory, 'spirit-stone', 5).state;
  const craftSuccess = model5.craft('craft-herbal-balm');
  assert(craftSuccess.success, 'Crafting herbal-balm succeeds');
  assert((save5.gold as number) === 18, 'Gold deducted: 20 - 2 = 18');
  assert(save5.rpg.inventory.slots.some((s) => s.itemId === 'herbal-balm'), 'Herbal balm added to inventory');
  assert(save5.rpg.inventory.slots.find((s) => s.itemId === 'spirit-stone')?.quantity === 4, '1 stone consumed');

  // Chế tạo khi thiếu tiền vàng
  save5.gold = 1;
  const failCraftGold = model5.craft('craft-herbal-balm');
  assert(!failCraftGold.success, 'Crafting fails when lacking gold');
  assert(save5.gold === 1, 'Gold untouched');
  assert(save5.rpg.inventory.slots.find((s) => s.itemId === 'spirit-stone')?.quantity === 4, 'Materials untouched');

  // =============================================================
  // Suite 6: Kỹ Năng & Thần Lực — Chuyển Đổi, Mở Khóa, Gán Ô
  // =============================================================
  const save6 = newSave();
  save6.level = 1;
  save6.gold = 10;
  const model6 = new RpgMenuModel(save6);

  // Chọn thần lực
  const divRes = model6.selectDivinePower('flame');
  assert(divRes.success, 'Selecting flame divine power succeeds');
  assert(save6.rpg.skills.activeDivinePower === 'flame', 'Active divine power is flame');

  // Mở khóa kỹ năng khi không đủ cấp độ
  const highSkill = getSkill('solar-flare') ?? getSkill('boulder-crash');
  if (highSkill && highSkill.requiredLevel > save6.level) {
    const failSkillLevel = model6.unlockSkillAction(highSkill.id);
    assert(!failSkillLevel.success, 'Unlocking high level skill fails');
    assert(save6.gold === 10, 'Gold untouched');
  }

  // Mở khóa kỹ năng khi đủ cấp nhưng thiếu tiền
  save6.level = 10;
  save6.gold = 0;
  if (highSkill) {
    const failSkillGold = model6.unlockSkillAction(highSkill.id);
    assert(!failSkillGold.success, 'Unlocking skill fails without gold');
  }

  // Mở khóa kỹ năng khi đủ mọi điều kiện
  save6.gold = 1000;
  if (highSkill && !save6.rpg.skills.unlockedSkillIds.includes(highSkill.id)) {
    const unlockOk = model6.unlockSkillAction(highSkill.id);
    assert(unlockOk.success, 'Unlocking skill succeeds when criteria met');
    assert(save6.rpg.skills.unlockedSkillIds.includes(highSkill.id), 'Skill is now in unlocked list');
    assert(save6.gold === 1000 - highSkill.unlockCostGold, 'Gold deducted for skill unlock');

    // Thử mở khóa lại kỹ năng đã mở khóa -> chốt chặn
    const failReunlock = model6.unlockSkillAction(highSkill.id);
    assert(!failReunlock.success, 'Re-unlocking already unlocked skill fails');

    // Gán kỹ năng vào ô 4
    const equipOk = model6.equipSkillAction('slot-4', highSkill.id);
    assert(equipOk.success, 'Equipping skill to slot-4 succeeds');
    assert(save6.rpg.skills.equippedSlots['slot-4'] === highSkill.id, 'Slot-4 has highSkill');

    // Tháo kỹ năng khỏi ô 4
    const unequipOk = model6.unequipSkillAction('slot-4');
    assert(unequipOk.success, 'Unequipping skill succeeds');
    assert(save6.rpg.skills.equippedSlots['slot-4'] === undefined, 'Slot-4 cleared');
  }

  // =============================================================
  // Suite 7: Tính Nguyên Tử & Bảo Vệ Trạng Thái (State Immutability)
  // =============================================================
  const save7 = newSave();
  save7.gold = 30;
  const snapshotJson = JSON.stringify(save7);
  const model7 = new RpgMenuModel(save7);

  // Thực hiện một loạt thao tác lỗi có chủ đích
  model7.buyItem('invalid-item', 1);
  model7.buyItem('jade-charm', 10);
  model7.useItem('non-existent');
  model7.unequip('weapon');
  model7.craft('non-existent-recipe');
  model7.unlockSkillAction('fake-skill');

  // Trạng thái dữ liệu sau các thất bại phải giống hệt ban đầu
  assert(JSON.stringify(save7) === snapshotJson, 'State remained 100% atomic and unaltered after failed transactions');

  
  // =============================================================
  // Suite 8: V? Kh? ? Tra c?u, T?nh S?t Th??ng, ??y L?i, T?m ??nh
  // =============================================================
  for (const weapon of WEAPONS) {
    assert(getWeapon(weapon.id)?.id === weapon.id, 'Found weapon ' + weapon.id);
    const byType = getWeaponsByType(weapon.weaponType);
    assert(byType.some(w => w.id === weapon.id), 'Found weapon by type');
    assert(getEquippedWeaponOrDefault(weapon.id, 99).id === weapon.id, 'Equipped weapon valid');
    const dmg = calculateWeaponDamage(weapon, 0, 10, false);
    assert(dmg > 0, 'Damage is positive');
    const critDmg = calculateWeaponDamage(weapon, 0, 10, true);
    assert(critDmg >= dmg, 'Critical damage verified');
    const kb = calculateWeaponKnockback(weapon, 1);
    assert(kb > 0, 'Knockback is positive');
    const timing = calculateWeaponAttackTiming(weapon, 1);
    assert(timing > 0, 'Attack duration is positive');
    const reach = calculateWeaponReach(weapon, 1);
    assert(reach > 0, 'Reach is positive');
  }
  assert(getWeapon('unknown') === undefined, 'Unknown weapon returns undefined');
  assert(getEquippedWeaponOrDefault('unknown').id === 'bronze-spear', 'Fallback to default spear');

  // =============================================================
  // Suite 9: Chu?n H?a Save (normalizeSave) & An To?n D? Li?u
  // =============================================================
  assert(normalizeSave(null).version === 1, 'Null save normalizes to defaults');
  assert(normalizeSave({}).version === 1, 'Empty object normalizes to defaults');
  assert(normalizeSave({ version: 99 }).version === 1, 'Wrong version resets to defaults');
  const validCandidate: Record<string, unknown> = {
    version: 1,
    hp: 50,
    mp: 30,
    gold: 100,
    level: 5,
    rpg: {
      inventory: {
        capacity: 24,
        slots: [{ itemId: 'herbal-balm', quantity: 2 }],
      },
      equipment: {
        slots: { weapon: 'bronze-spear', armor: 'bamboo-armor', accessory: 'jade-charm' },
      },
      skills: {
        unlockedSkillIds: ['earth-shockwave', 'flame-beam'],
        equippedSlots: { 'slot-1': 'earth-shockwave', 'slot-2': 'flame-beam' },
        cooldownUntil: { 'earth-shockwave': 5000 },
      },
      quests: {
        'ch1-m01': { questId: 'ch1-m01', stage: 'complete', counts: {}, flags: {}, rewardClaimed: false },
      },
    },
    storyFlags: { 'talked-chief': true },
  };
  const normalizedValid = normalizeSave(validCandidate);
  assert(normalizedValid.hp === 50, 'Preserves valid hp');
  assert(normalizedValid.gold === 100, 'Preserves valid gold');
  assert(normalizedValid.rpg.inventory.slots.length === 1, 'Preserves valid inventory');
  assert(normalizedValid.rpg.equipment.slots.weapon === 'bronze-spear', 'Preserves valid equipment');
  assert(normalizedValid.rpg.skills.unlockedSkillIds.length === 2, 'Preserves valid skills');
  assert(normalizedValid.rpg.skills.equippedSlots['slot-1'] === 'earth-shockwave', 'Preserves equipped slot');
  assert(normalizedValid.rpg.skills.cooldownUntil['earth-shockwave'] === 5000, 'Preserves cooldown');

  // Corrupted data normalization
  const corrupted = {
    version: 1,
    hp: -50,
    mp: 'invalid',
    gold: -10,
    level: 999,
    chapter: -2,
    kills: 'lots',
    quest: 'invalid-stage',
    bossDead: 'yes',
    rpg: {
      inventory: { capacity: -5, slots: [{ itemId: 123, quantity: -2 }, { itemId: 'invalid-item', quantity: 1 }] },
      equipment: { slots: { weapon: 'non-existent-weapon', invalid_slot: 'fake' } },
      skills: { unlockedSkillIds: 'not-an-array', equippedSlots: 'bad', cooldownUntil: { bad: 'not-number' } },
      quests: { 'invalid': { stage: 'bogus' } }
    },
    storyFlags: 'not-an-object'
  };
  const fixedCorrupted = normalizeSave(corrupted);
  assert(fixedCorrupted.version === 1, 'Fixed corrupted retains version');
  assert(fixedCorrupted.hp >= 0, 'Fixed negative hp');
  assert(fixedCorrupted.gold === 0, 'Fixed negative gold');
  assert(fixedCorrupted.rpg.inventory.capacity === 0, 'Fixed negative capacity clamped to 0');

  // =============================================================
  // Suite 10: DungeonSystem ? Kh?a, T?ng, Qu?i V?t, Th??ng
  // =============================================================
  const dSave = newSave();
  dSave.chapter = 1;
  dSave.level = 1;
  const d1 = getChapterDungeon(dSave);
  assert(d1 !== undefined && d1.id === 'dong-am-hon', 'Chapter 1 dungeon is dong-am-hon');
  assert(dungeonEntryError(dSave, 'non-existent') !== null, 'Invalid dungeon ID returns error');
  assert(dungeonEntryError(dSave, 'thuy-cung-phe-tich') !== null, 'Wrong chapter dungeon returns error');
  assert(dungeonEntryError(dSave, 'dong-am-hon') !== null, 'Level requirement blocks entry');
  dSave.level = 10;
  assert(dungeonEntryError(dSave, 'dong-am-hon') !== null, 'Key requirement blocks entry without key');
  const withWrongKey = grantDungeonKey(dSave, 'unknown' as any);
  assert(withWrongKey.storyFlags['dungeon-key:dong-am-hon'] === undefined, 'Unknown enemy does not grant key');
  const withKey = grantDungeonKey(dSave, 'soi-rung-hac-am');
  assert(withKey.storyFlags['dungeon-key:dong-am-hon'] === true, 'Killing key enemy grants dungeon key');
  assert(dungeonEntryError(withKey, 'dong-am-hon') === null, 'Dungeon entry allowed with key and level');
  assert(getDungeonFloor(withKey, 'dong-am-hon') === 0, 'Starts at floor 0');
  const f0Enemies = getDungeonFloorEnemies('dong-am-hon', 0);
  assert(f0Enemies.length > 0, 'Floor 0 has enemies');
  const f1Enemies = getDungeonFloorEnemies('dong-am-hon', 1);
  assert(f1Enemies.includes('bach-trao-ho-ma'), 'Final floor has elite');
  assert(getDungeonFloorEnemies('dong-am-hon', 99).length === 0, 'Invalid floor has no enemies');
  const clearedF0 = clearDungeonFloor(withKey, 'dong-am-hon', 0);
  assert(getDungeonFloor(clearedF0, 'dong-am-hon') === 1, 'Advanced to floor 1');
  const clearedF1 = clearDungeonFloor(clearedF0, 'dong-am-hon', 1);
  assert(getDungeonFloor(clearedF1, 'dong-am-hon') === 2, 'Completed all floors');
  const rewardRes = claimDungeonReward(clearedF1, 'dong-am-hon');
  assert(rewardRes.claimed === true, 'Claiming dungeon reward succeeds');
  assert(rewardRes.save.storyFlags['dungeon-reward:dong-am-hon'] === true, 'Reward flag set');
  const repeatReward = claimDungeonReward(rewardRes.save, 'dong-am-hon');
  assert(repeatReward.claimed === false && repeatReward.blocked === false, 'Cannot claim reward twice');
  const earlyReward = claimDungeonReward(withKey, 'dong-am-hon');
  assert(earlyReward.blocked === true, 'Cannot claim reward before completing floors');

  return true;
}

// Chạy tự kiểm tra tất định an toàn ở cấp module
export const RPG_MENU_SELF_CHECK_PASSED: true = runRpgMenuSelfCheck();
