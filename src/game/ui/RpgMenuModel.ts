/**
 * RpgMenuModel.ts
 * Mô hình dữ liệu và nghiệp vụ cho Bảng Menu RPG trong Làng.
 *
 * Hỗ trợ các thẻ:
 * 1. Kho đồ (inventory)
 * 2. Trang bị (equipment)
 * 3. Kỹ năng & Thần lực (skills)
 * 4. Nhật ký nhiệm vụ (quests)
 * 5. Cửa hàng (shop)
 * 6. Chế tác & Nâng cấp (crafting)
 *
 * Bảo toàn các chốt chặn giao dịch (transaction guards) nghiêm ngặt:
 * - Kiểm tra số dư tiền vàng
 * - Kiểm tra sức chứa túi đồ
 * - Kiểm tra nguyên liệu chế tác
 * - Không gây tác dụng phụ khi giao dịch thất bại (atomicity)
 */

import { BALANCE } from '../../data/config';
import {
  ITEMS,
  ITEM_CRAFTING_RECIPES,
  getItem,
  type ItemDefinition,
  type ItemKind,
  type EquipmentSlot,
  type ItemStats,
} from '../../data/items';
import {
  QUESTS,
  getQuest,
  type QuestDefinition,
} from '../../data/quests';
import {
  DIVINE_POWERS,
  getDivinePower,
  getActiveSkills,
  getSkill,
  type DivinePowerId,
  type DivinePowerDefinition,
  type SkillDefinition,
} from '../../data/skills';
import {
  addItem,
  consumeItem,
  countItem,
  hasItem,
  removeItem,
  type InventorySlot,
  type InventoryState,
} from '../rpg/InventorySystem';
import {
  calculateEquipmentStats,
  equipItem,
  unequipItem,
  type EquipmentState,
} from '../rpg/EquipmentSystem';
import {
  canUnlockSkill,
  equipSkill,
  isSkillUnlocked,
  setActiveDivinePower,
  unequipSkill,
  unlockSkill,
  type CasterSnapshot,
  type SkillProgress,
  type SkillSlot,
} from '../rpg/SkillSystem';
import {
  progressFromSave,
  getQuestChapter,
  type QuestProgress,
} from '../rpg/QuestSystem';
import { gameState, getPlayerStats, type SaveData } from '../systems/GameState';
import { getWeapon } from '../../data/weapons';

export type RpgMenuTab =
  | 'inventory'
  | 'equipment'
  | 'skills'
  | 'quests'
  | 'shop'
  | 'crafting';

export interface TabInfo {
  readonly id: RpgMenuTab;
  readonly label: string;
}

export const RPG_MENU_TABS: readonly TabInfo[] = [
  { id: 'inventory', label: 'Kho Đồ' },
  { id: 'equipment', label: 'Trang Bị' },
  { id: 'skills', label: 'Kỹ Năng' },
  { id: 'quests', label: 'Nhiệm Vụ' },
  { id: 'shop', label: 'Cửa Hàng' },
  { id: 'crafting', label: 'Chế Tác' },
];

export interface ActionResult {
  readonly success: boolean;
  readonly message: string;
}

export interface CraftingMaterialReq {
  readonly itemId: string;
  readonly quantity: number;
}

export interface CraftingRecipe {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly goldCost: number;
  readonly materials: readonly CraftingMaterialReq[];
  readonly outputItemId: string;
  readonly outputQuantity: number;
}

export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [
  {
    id: 'craft-herbal-balm',
    name: 'Luyện Đan Hồi Sinh',
    description: 'Nghiền ngẫm đá linh khí thành bột dược hồi phục 35 sinh lực.',
    goldCost: 2,
    materials: [{ itemId: 'spirit-stone', quantity: 1 }],
    outputItemId: 'herbal-balm',
    outputQuantity: 1,
  },
  {
    id: 'craft-spirit-tea',
    name: 'Nấu Trà Thần Lực',
    description: 'Chưng cất đá linh khí lấy tinh hoa hồi phục 35 thần lực.',
    goldCost: 3,
    materials: [{ itemId: 'spirit-stone', quantity: 2 }],
    outputItemId: 'spirit-tea',
    outputQuantity: 1,
  },
  {
    id: 'craft-bamboo-armor',
    name: 'Rèn Giáp Tre Bọc Đồng',
    description: 'Gia cố giáp tre bằng các mảnh đồng cổ bền chắc (+18 Máu).',
    goldCost: 25,
    materials: [{ itemId: 'bronze-scrap', quantity: 4 }],
    outputItemId: 'bamboo-armor',
    outputQuantity: 1,
  },
  ...ITEM_CRAFTING_RECIPES,
  {
    id: 'craft-jade-charm',
    name: 'Chế Tác Ngọc Bội Lạc Việt',
    description: 'Khắc ngọc bội gia trì tốc độ và thần lực (+15 MP, +8 Tốc độ).',
    goldCost: 35,
    materials: [
      { itemId: 'spirit-stone', quantity: 4 },
      { itemId: 'bronze-scrap', quantity: 3 },
    ],
    outputItemId: 'jade-charm',
    outputQuantity: 1,
  },
];

export interface InventoryViewSlot {
  readonly index: number;
  readonly itemId: string;
  readonly quantity: number;
  readonly item?: ItemDefinition;
}

export type InventoryCategory = 'all' | ItemKind;
export type InventorySort = 'original' | 'name' | 'quantity';

export interface InventoryView {
  readonly capacity: number;
  readonly usedSlots: number;
  readonly freeSlots: number;
  readonly slots: readonly InventoryViewSlot[];
}

export interface EquipmentView {
  readonly weapon?: ItemDefinition;
  readonly armor?: ItemDefinition;
  readonly accessory?: ItemDefinition;
  readonly stats: ItemStats;
  readonly equippableInventoryItems: readonly {
    readonly itemId: string;
    readonly quantity: number;
    readonly item: ItemDefinition;
  }[];
}

export interface SkillEntryView {
  readonly skill: SkillDefinition;
  readonly isUnlocked: boolean;
  readonly isEquipped: boolean;
  readonly equippedSlot?: SkillSlot;
  readonly canUnlock: boolean;
  readonly unlockReason?: string;
}

export interface SkillsView {
  readonly activeDivinePower?: DivinePowerDefinition;
  readonly divinePowers: readonly DivinePowerDefinition[];
  readonly equippedSlots: Readonly<Partial<Record<SkillSlot, SkillDefinition>>>;
  readonly skills: readonly SkillEntryView[];
}

export interface QuestEntryView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly stage: QuestProgress['stage'];
  readonly stageLabel: string;
  readonly objectives: readonly {
    readonly text: string;
    readonly current: number;
    readonly required: number;
    readonly done: boolean;
  }[];
  readonly rewardGold: number;
  readonly rewardXp: number;
  readonly rewardItems: readonly { itemId: string; name: string; quantity: number }[];
}

export interface QuestsView {
  readonly currentChapter: number;
  readonly quests: readonly QuestEntryView[];
}

export interface ShopItemView {
  readonly item: ItemDefinition;
  readonly price: number;
  readonly canAfford: boolean;
  readonly hasInventorySpace: boolean;
}

export interface ShopView {
  readonly playerGold: number;
  readonly items: readonly ShopItemView[];
  readonly sellableItems: readonly {
    readonly itemId: string;
    readonly quantity: number;
    readonly item: ItemDefinition;
    readonly sellPrice: number;
  }[];
}

export interface CraftingRecipeView {
  readonly recipe: CraftingRecipe;
  readonly outputItem?: ItemDefinition;
  readonly canAffordGold: boolean;
  readonly hasMaterials: boolean;
  readonly hasInventorySpace: boolean;
  readonly canCraft: boolean;
  readonly materialStatus: readonly {
    readonly itemId: string;
    readonly name: string;
    readonly required: number;
    readonly available: number;
    readonly satisfied: boolean;
  }[];
}

export interface CraftingView {
  readonly playerGold: number;
  readonly weaponUpgrades: number;
  readonly currentAttack: number;
  readonly upgradeCost: number;
  readonly canUpgradeWeapon: boolean;
  readonly recipes: readonly CraftingRecipeView[];
}

export class RpgMenuModel {
  constructor(
    public readonly save: SaveData = gameState.data,
    private readonly onPersist?: () => void,
  ) {}

  private persist(): void {
    if (this.onPersist) {
      this.onPersist();
    } else {
      gameState.save();
    }
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------

  getCasterSnapshot(): CasterSnapshot {
    return {
      level: this.save.level,
      hp: this.save.hp,
      mp: this.save.mp,
      maxHp: getPlayerStats(this.save).maxHp,
      maxMp: getPlayerStats(this.save).maxMp,
      attack: this.save.attack,
      gold: this.save.gold,
      equippedWeaponId: this.save.rpg.equipment.slots.weapon,
    };
  }

  // -------------------------------------------------------------
  // 1. Tab: Kho Đồ (Inventory)
  // -------------------------------------------------------------

  getInventoryView(category: InventoryCategory = 'all', sort: InventorySort = 'original'): InventoryView {
    const inv = this.save.rpg.inventory;
    const slots: InventoryViewSlot[] = inv.slots.map((slot, index) => ({
      index,
      itemId: slot.itemId,
      quantity: slot.quantity,
      item: getItem(slot.itemId),
    })).filter(slot => category === 'all' || slot.item?.kind === category)
      .sort((left, right) => {
        const order = sort === 'quantity' ? right.quantity - left.quantity
          : sort === 'name' ? (left.item?.name ?? left.itemId).localeCompare(right.item?.name ?? right.itemId, 'vi')
          : 0;
        return order || left.index - right.index;
      });
    return {
      capacity: inv.capacity,
      usedSlots: inv.slots.length,
      freeSlots: Math.max(0, inv.capacity - inv.slots.length),
      slots,
    };
  }

  useItem(itemId: string): ActionResult {
    const inv = this.save.rpg.inventory;
    if (!hasItem(inv, itemId, 1)) {
      return { success: false, message: 'Vật phẩm không có trong kho đồ.' };
    }
    const item = getItem(itemId);
    if (!item) {
      return { success: false, message: 'Vật phẩm không hợp lệ.' };
    }
    if (item.kind !== 'consumable') {
      return { success: false, message: 'Chỉ có thể sử dụng trực tiếp các loại đan dược, trà linh khí.' };
    }

    const change = consumeItem(inv, itemId);
    if (change.changed !== 1) {
      return { success: false, message: 'Không thể sử dụng vật phẩm.' };
    }

    // Áp dụng hồi máu / thần lực
    if (item.restoreHp) {
      this.save.hp = Math.min(getPlayerStats(this.save).maxHp, this.save.hp + item.restoreHp);
    }
    if (item.restoreMp) {
      this.save.mp = Math.min(getPlayerStats(this.save).maxMp, this.save.mp + item.restoreMp);
    }

    this.save.rpg.inventory = change.state;
    this.persist();

    return {
      success: true,
      message: `Đã dùng ${item.name}! HP: ${Math.ceil(this.save.hp)}/${getPlayerStats(this.save).maxHp}, MP: ${Math.ceil(this.save.mp)}/${getPlayerStats(this.save).maxMp}.`,
    };
  }

  // -------------------------------------------------------------
  // 2. Tab: Trang Bị (Equipment)
  // -------------------------------------------------------------

  getEquipmentView(): EquipmentView {
    const eq = this.save.rpg.equipment;
    const inv = this.save.rpg.inventory;

    const equippableInventoryItems = inv.slots.flatMap((slot) => {
      const it = getItem(slot.itemId);
      if (it && it.slot) {
        return [{ itemId: slot.itemId, quantity: slot.quantity, item: it }];
      }
      return [];
    });

    return {
      weapon: eq.slots.weapon ? getItem(eq.slots.weapon) : undefined,
      armor: eq.slots.armor ? getItem(eq.slots.armor) : undefined,
      accessory: eq.slots.accessory ? getItem(eq.slots.accessory) : undefined,
      stats: calculateEquipmentStats(eq, this.save.level),
      equippableInventoryItems,
    };
  }

  equip(itemId: string): ActionResult {
    const weapon = getWeapon(itemId);
    if (weapon && this.save.level < weapon.requiredLevel) return { success: false, message: 'Cần cấp ' + weapon.requiredLevel + ' để trang bị vũ khí.' };
    const item = getItem(itemId);
    if (!item || !item.slot) {
      return { success: false, message: 'Vật phẩm không phải là trang bị có thể mặc.' };
    }
    if (!hasItem(this.save.rpg.inventory, itemId, 1)) {
      return { success: false, message: 'Không tìm thấy trang bị trong kho đồ.' };
    }

    const change = equipItem(this.save.rpg.inventory, this.save.rpg.equipment, itemId);
    if (!change) {
      return {
        success: false,
        message: 'Kho đồ đầy, không thể tháo trang bị cũ đang mặc để đổi chỗ.',
      };
    }

    this.save.rpg.inventory = change.inventory;
    this.save.rpg.equipment = change.equipment;
    const caps = getPlayerStats(this.save);
    this.save.hp = Math.min(this.save.hp, caps.maxHp);
    this.save.mp = Math.min(this.save.mp, caps.maxMp);
    this.persist();

    return {
      success: true,
      message: `Đã trang bị ${item.name} vào ô ${item.slot}.`,
    };
  }

  unequip(slot: EquipmentSlot): ActionResult {
    const currentItemId = this.save.rpg.equipment.slots[slot];
    if (!currentItemId) {
      return { success: false, message: `Ô ${slot} hiện đang để trống.` };
    }

    const change = unequipItem(this.save.rpg.inventory, this.save.rpg.equipment, slot);
    if (!change) {
      return { success: false, message: 'Kho đồ đã đầy, không thể tháo trang bị.' };
    }

    this.save.rpg.inventory = change.inventory;
    this.save.rpg.equipment = change.equipment;
    const caps = getPlayerStats(this.save);
    this.save.hp = Math.min(this.save.hp, caps.maxHp);
    this.save.mp = Math.min(this.save.mp, caps.maxMp);
    this.persist();

    const item = getItem(currentItemId);
    return {
      success: true,
      message: `Đã tháo ${item?.name ?? currentItemId} về kho đồ.`,
    };
  }

  // -------------------------------------------------------------
  // 3. Tab: Kỹ Năng & Thần Lực (Skills)
  // -------------------------------------------------------------

  getSkillsView(): SkillsView {
    const skillsProg = this.save.rpg.skills;
    const activeDivinePower = skillsProg.activeDivinePower
      ? getDivinePower(skillsProg.activeDivinePower)
      : undefined;

    const equippedSlots: Partial<Record<SkillSlot, SkillDefinition>> = {};
    for (const [slot, skillId] of Object.entries(skillsProg.equippedSlots)) {
      if (skillId) {
        const def = getSkill(skillId);
        if (def) equippedSlots[slot as SkillSlot] = def;
      }
    }

    const caster = this.getCasterSnapshot();
    const allSkills = getActiveSkills();

    const skillEntries: SkillEntryView[] = allSkills.map((sk) => {
      const isUnlocked = isSkillUnlocked(skillsProg, sk.id);
      let equippedSlot: SkillSlot | undefined;
      for (const [sKey, sId] of Object.entries(skillsProg.equippedSlots)) {
        if (sId === sk.id) {
          equippedSlot = sKey as SkillSlot;
          break;
        }
      }
      const isEquipped = Boolean(equippedSlot);

      const unlockCheck = canUnlockSkill(skillsProg, caster, sk.id);
      let unlockReason: string | undefined;
      if (!unlockCheck.canUnlock) {
        if (unlockCheck.reason === 'insufficient_level') {
          unlockReason = `Cần cấp độ ${sk.requiredLevel} (hiện tại: ${caster.level})`;
        } else if (unlockCheck.reason === 'insufficient_gold') {
          unlockReason = `Cần ${sk.unlockCostGold} đồng (hiện tại: ${caster.gold})`;
        } else if (unlockCheck.reason === 'already_unlocked') {
          unlockReason = 'Đã mở khóa';
        }
      }

      return {
        skill: sk,
        isUnlocked,
        isEquipped,
        equippedSlot,
        canUnlock: unlockCheck.canUnlock,
        unlockReason,
      };
    });

    return {
      activeDivinePower,
      divinePowers: DIVINE_POWERS,
      equippedSlots,
      skills: skillEntries,
    };
  }

  selectDivinePower(powerId: DivinePowerId): ActionResult {
    const power = getDivinePower(powerId);
    if (!power) {
      return { success: false, message: 'Thần lực không hợp lệ.' };
    }
    this.save.rpg.skills = setActiveDivinePower(this.save.rpg.skills, powerId);
    this.persist();
    return {
      success: true,
      message: `Đã chọn thần lực hộ mệnh: ${power.vietnameseName}.`,
    };
  }

  unlockSkillAction(skillId: string): ActionResult {
    const sk = getSkill(skillId);
    if (!sk) {
      return { success: false, message: 'Không tìm thấy kỹ năng.' };
    }

    const caster = this.getCasterSnapshot();
    const result = unlockSkill(this.save.rpg.skills, caster, skillId);
    if (!result.success) {
      let failMsg = 'Không thể mở khóa kỹ năng.';
      if (result.reason === 'insufficient_level') {
        failMsg = `Cấp độ chưa đủ (yêu cầu cấp ${sk.requiredLevel}).`;
      } else if (result.reason === 'insufficient_gold') {
        failMsg = `Chưa đủ tiền đồng (yêu cầu ${sk.unlockCostGold} đồng).`;
      } else if (result.reason === 'already_unlocked') {
        failMsg = 'Kỹ năng này đã được mở khóa trước đó.';
      }
      return { success: false, message: failMsg };
    }

    this.save.rpg.skills = result.progress;
    this.save.gold = result.caster.gold;
    this.persist();

    return {
      success: true,
      message: `Mở khóa thành công kỹ năng: ${sk.vietnameseName}!`,
    };
  }

  equipSkillAction(slot: SkillSlot, skillId: string): ActionResult {
    const result = equipSkill(this.save.rpg.skills, slot, skillId);
    if (!result.success) {
      const msg =
        result.reason === 'not_unlocked'
          ? 'Kỹ năng chưa mở khóa, không thể gán vào ô thi triển.'
          : 'Kỹ năng không tồn tại.';
      return { success: false, message: msg };
    }

    this.save.rpg.skills = result.progress;
    this.persist();

    const sk = getSkill(skillId);
    return {
      success: true,
      message: `Đã gắn ${sk?.vietnameseName ?? skillId} vào ô ${slot}.`,
    };
  }

  unequipSkillAction(slot: SkillSlot): ActionResult {
    this.save.rpg.skills = unequipSkill(this.save.rpg.skills, slot);
    this.persist();
    return {
      success: true,
      message: `Đã tháo kỹ năng khỏi ô ${slot}.`,
    };
  }

  // -------------------------------------------------------------
  // 4. Tab: Nhật Ký Nhiệm Vụ (Quests)
  // -------------------------------------------------------------

  getQuestsView(): QuestsView {
    const stageLabels: Record<QuestProgress['stage'], string> = { new: 'Chưa nhận', active: 'Đang làm', return: 'Sẵn sàng nộp', complete: 'Hoàn thành' };
    const quests = QUESTS.filter(quest => getQuestChapter(quest) === this.save.chapter || Boolean(this.save.rpg.quests[quest.id] && quest.id !== 'hunt-ho-yeu'));
    return {
      currentChapter: this.save.chapter,
      quests: quests.map(quest => {
        const progress = progressFromSave(this.save, quest.id);
        return {
          id: quest.id, title: quest.title, description: quest.description, stage: progress.stage, stageLabel: stageLabels[progress.stage],
          objectives: quest.objectives.map(objective => {
            const current = objective.kind === 'flag' ? Number(progress.flags[objective.id] === true) : progress.counts[objective.id] ?? 0;
            return { text: objective.description ?? (objective.kind === 'kill' ? 'Hạ mục tiêu' : 'Tương tác vật thiêng'), current, required: objective.required, done: current >= objective.required };
          }),
          rewardGold: quest.reward.gold, rewardXp: quest.reward.xp,
          rewardItems: quest.reward.items.map(item => ({ itemId: item.itemId, name: getItem(item.itemId)?.name ?? item.itemId, quantity: item.quantity })),
        };
      }),
    };
  }

  // -------------------------------------------------------------
  // 5. Tab: Cửa Hàng (Shop)
  // -------------------------------------------------------------

  getShopView(): ShopView {
    const inv = this.save.rpg.inventory;
    const playerGold = this.save.gold;

    const items: ShopItemView[] = ITEMS.map((item) => {
      const testAdd = addItem(inv, item.id, 1);
      return {
        item,
        price: item.price,
        canAfford: playerGold >= item.price,
        hasInventorySpace: testAdd.remainder === 0,
      };
    });

    const sellableItems = inv.slots.flatMap((slot) => {
      const it = getItem(slot.itemId);
      if (!it) return [];
      const unitSellPrice = Math.max(1, Math.floor(it.price / 2));
      return [
        {
          itemId: slot.itemId,
          quantity: slot.quantity,
          item: it,
          sellPrice: unitSellPrice,
        },
      ];
    });

    return {
      playerGold,
      items,
      sellableItems,
    };
  }

  buyItem(itemId: string, quantity = 1): ActionResult {
    if (quantity <= 0) {
      return { success: false, message: 'Số lượng mua không hợp lệ.' };
    }
    const item = getItem(itemId);
    if (!item) {
      return { success: false, message: 'Vật phẩm không tồn tại trong cửa hàng.' };
    }

    const totalCost = item.price * quantity;

    // Chốt chặn tiền vàng
    if (this.save.gold < totalCost) {
      return {
        success: false,
        message: `Chưa đủ tiền đồng (${this.save.gold}/${totalCost}). Hãy săn quái hoặc làm nhiệm vụ.`,
      };
    }

    // Chốt chặn sức chứa kho đồ
    const change = addItem(this.save.rpg.inventory, itemId, quantity);
    if (change.remainder > 0) {
      return {
        success: false,
        message: 'Kho đồ không đủ chỗ trống để chứa số lượng vật phẩm này.',
      };
    }

    // Cam kết giao dịch nguyên tử
    this.save.gold -= totalCost;
    this.save.rpg.inventory = change.state;
    this.persist();

    return {
      success: true,
      message: `Đã mua ${quantity}x ${item.name} (-${totalCost} đồng).`,
    };
  }

  sellItem(itemId: string, quantity = 1): ActionResult {
    if (quantity <= 0) {
      return { success: false, message: 'Số lượng bán không hợp lệ.' };
    }
    const item = getItem(itemId);
    if (!item) {
      return { success: false, message: 'Vật phẩm không tồn tại.' };
    }

    // Chốt chặn có vật phẩm
    if (!hasItem(this.save.rpg.inventory, itemId, quantity)) {
      return {
        success: false,
        message: 'Không đủ số lượng vật phẩm trong kho đồ để bán.',
      };
    }

    const change = removeItem(this.save.rpg.inventory, itemId, quantity);
    if (change.remainder > 0) {
      return { success: false, message: 'Lỗi trừ vật phẩm khỏi kho đồ.' };
    }

    const unitSellPrice = Math.max(1, Math.floor(item.price / 2));
    const totalEarned = unitSellPrice * quantity;

    this.save.gold += totalEarned;
    this.save.rpg.inventory = change.state;
    this.persist();

    return {
      success: true,
      message: `Đã bán ${quantity}x ${item.name} (+${totalEarned} đồng).`,
    };
  }

  // -------------------------------------------------------------
  // 6. Tab: Chế Tác & Nâng Cấp (Crafting & Upgrades)
  // -------------------------------------------------------------

  getCraftingView(): CraftingView {
    const playerGold = this.save.gold;
    const inv = this.save.rpg.inventory;
    const weaponUpgrades = this.save.upgrades;
    const currentAttack = this.save.attack;
    const upgradeCost = BALANCE.smithCost * (weaponUpgrades + 1);
    const canUpgradeWeapon = playerGold >= upgradeCost;

    const recipes: CraftingRecipeView[] = CRAFTING_RECIPES.map((recipe) => {
      const outputItem = getItem(recipe.outputItemId);
      const canAffordGold = playerGold >= recipe.goldCost;

      let hasMaterials = true;
      const materialStatus = recipe.materials.map((mat) => {
        const matDef = getItem(mat.itemId);
        const available = countItem(inv, mat.itemId);
        const satisfied = available >= mat.quantity;
        if (!satisfied) hasMaterials = false;
        return {
          itemId: mat.itemId,
          name: matDef?.name ?? mat.itemId,
          required: mat.quantity,
          available,
          satisfied,
        };
      });

      // Thử nghiệm mô phỏng việc trừ nguyên liệu và cộng sản phẩm để kiểm tra sức chứa
      let simulatedInv = inv;
      if (hasMaterials) {
        for (const mat of recipe.materials) {
          simulatedInv = removeItem(simulatedInv, mat.itemId, mat.quantity).state;
        }
      }
      const testAdd = addItem(simulatedInv, recipe.outputItemId, recipe.outputQuantity);
      const hasInventorySpace = testAdd.remainder === 0;

      const canCraft = canAffordGold && hasMaterials && hasInventorySpace;

      return {
        recipe,
        outputItem,
        canAffordGold,
        hasMaterials,
        hasInventorySpace,
        canCraft,
        materialStatus,
      };
    });

    return {
      playerGold,
      weaponUpgrades,
      currentAttack,
      upgradeCost,
      canUpgradeWeapon,
      recipes,
    };
  }

  upgradeWeapon(): ActionResult {
    const price = BALANCE.smithCost * (this.save.upgrades + 1);

    // Chốt chặn tiền vàng
    if (this.save.gold < price) {
      return {
        success: false,
        message: `Chưa đủ tiền đồng để nâng cấp (${this.save.gold}/${price}). Hãy kiếm thêm tiền đồng.`,
      };
    }

    // Cam kết nguyên tử
    this.save.gold -= price;
    this.save.attack += BALANCE.smithAttackGain;
    this.save.upgrades += 1;
    this.persist();

    return {
      success: true,
      message: `Giáo đồng được tôi luyện nâng cấp! Sức công hiện tại: ${this.save.attack} (+${BALANCE.smithAttackGain}).`,
    };
  }

  craft(recipeId: string): ActionResult {
    const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) {
      return { success: false, message: 'Công thức chế tác không tồn tại.' };
    }

    // Chốt chặn 1: Tiền vàng
    if (this.save.gold < recipe.goldCost) {
      return {
        success: false,
        message: `Chưa đủ tiền đồng (${this.save.gold}/${recipe.goldCost}).`,
      };
    }

    // Chốt chặn 2: Nguyên liệu
    for (const mat of recipe.materials) {
      if (!hasItem(this.save.rpg.inventory, mat.itemId, mat.quantity)) {
        const matName = getItem(mat.itemId)?.name ?? mat.itemId;
        const currentCount = countItem(this.save.rpg.inventory, mat.itemId);
        return {
          success: false,
          message: `Thiếu nguyên liệu: ${matName} (${currentCount}/${mat.quantity}).`,
        };
      }
    }

    // Chốt chặn 3: Sức chứa kho đồ mô phỏng sau khi trừ nguyên liệu
    let simulatedInv = this.save.rpg.inventory;
    for (const mat of recipe.materials) {
      simulatedInv = removeItem(simulatedInv, mat.itemId, mat.quantity).state;
    }
    const testAdd = addItem(simulatedInv, recipe.outputItemId, recipe.outputQuantity);
    if (testAdd.remainder > 0) {
      return {
        success: false,
        message: 'Kho đồ không đủ chỗ chứa sản phẩm sau khi chế tạo.',
      };
    }

    // Cam kết nguyên tử
    this.save.gold -= recipe.goldCost;
    this.save.rpg.inventory = testAdd.state;
    this.persist();

    const outputName = getItem(recipe.outputItemId)?.name ?? recipe.outputItemId;
    return {
      success: true,
      message: `Chế tạo thành công ${recipe.outputQuantity}x ${outputName}!`,
    };
  }
}
