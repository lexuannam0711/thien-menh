export type ItemKind = 'consumable' | 'weapon' | 'armor' | 'accessory' | 'material';
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';

export interface ItemStats {
  readonly attack?: number;
  readonly maxHp?: number;
  readonly maxMp?: number;
  readonly speed?: number;
}

export interface ItemRecipeRequirement {
  readonly itemId: string;
  readonly quantity: number;
}

export interface ItemCraftingRecipe {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly goldCost: number;
  readonly materials: readonly ItemRecipeRequirement[];
  readonly outputItemId: string;
  readonly outputQuantity: number;
}

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly kind: ItemKind;
  readonly maxStack: number;
  readonly price: number;
  readonly slot?: EquipmentSlot;
  readonly stats?: ItemStats;
  readonly restoreHp?: number;
  readonly restoreMp?: number;
  readonly recipe?: ItemCraftingRecipe;
}

export const ITEM_CRAFTING_RECIPES: readonly ItemCraftingRecipe[] = [
  {
    id: 'craft-bronze-spear',
    name: 'Đúc Giáo Đồng Cổ',
    description: 'Tôi luyện giáo đồng cổ linh ứng thần lực (+4 Sức công).',
    goldCost: 30,
    materials: [
      { itemId: 'bronze-scrap', quantity: 5 },
      { itemId: 'spirit-stone', quantity: 2 },
    ],
    outputItemId: 'bronze-spear',
    outputQuantity: 1,
  },
  {
    id: 'craft-battle-axe',
    name: 'Rèn Rìu Chiến Đông Sơn',
    description: 'Đúc rìu chiến Đông Sơn uy lực trảm sơn phá thạch (+8 Sức công, +20 Máu).',
    goldCost: 45,
    materials: [
      { itemId: 'bronze-scrap', quantity: 8 },
      { itemId: 'spirit-stone', quantity: 3 },
    ],
    outputItemId: 'battle-axe',
    outputQuantity: 1,
  },
  {
    id: 'craft-lac-sword',
    name: 'Rèn Gươm Thiêng Lạc Long',
    description: 'Gia trì linh đồng đúc gươm báu Lạc Long Quân (+6 Sức công, +15 MP, +10 Tốc độ).',
    goldCost: 60,
    materials: [
      { itemId: 'bronze-scrap', quantity: 10 },
      { itemId: 'spirit-stone', quantity: 5 },
    ],
    outputItemId: 'lac-sword',
    outputQuantity: 1,
  },
];

export const ITEM_RECIPES_BY_OUTPUT_ID: Readonly<Record<string, ItemCraftingRecipe>> = Object.fromEntries(
  ITEM_CRAFTING_RECIPES.map((recipe) => [recipe.outputItemId, recipe]),
);

export const ITEMS: readonly ItemDefinition[] = [
  { id: 'herbal-balm', name: 'Thảo dược hồi sinh', kind: 'consumable', maxStack: 20, price: 8, restoreHp: 35 },
  { id: 'spirit-tea', name: 'Trà thần lực', kind: 'consumable', maxStack: 20, price: 10, restoreMp: 35 },
  {
    id: 'bronze-spear',
    name: 'Giáo đồng Văn Lang',
    kind: 'weapon',
    maxStack: 1,
    price: 60,
    slot: 'weapon',
    stats: { attack: 4 },
    recipe: ITEM_RECIPES_BY_OUTPUT_ID['bronze-spear'],
  },
  {
    id: 'battle-axe',
    name: 'Rìu chiến Đông Sơn',
    kind: 'weapon',
    maxStack: 1,
    price: 85,
    slot: 'weapon',
    stats: { attack: 8, maxHp: 20 },
    recipe: ITEM_RECIPES_BY_OUTPUT_ID['battle-axe'],
  },
  {
    id: 'lac-sword',
    name: 'Gươm thiêng Lạc Long',
    kind: 'weapon',
    maxStack: 1,
    price: 110,
    slot: 'weapon',
    stats: { attack: 6, maxMp: 15, speed: 10 },
    recipe: ITEM_RECIPES_BY_OUTPUT_ID['lac-sword'],
  },
  { id: 'bamboo-armor', name: 'Giáp tre sơn son', kind: 'armor', maxStack: 1, price: 55, slot: 'armor', stats: { maxHp: 18 } },
  { id: 'jade-charm', name: 'Ngọc bội Lạc Việt', kind: 'accessory', maxStack: 1, price: 70, slot: 'accessory', stats: { maxMp: 15, speed: 8 } },
  { id: 'spirit-stone', name: 'Đá linh khí', kind: 'material', maxStack: 99, price: 4 },
  { id: 'bronze-scrap', name: 'Mảnh đồng cổ', kind: 'material', maxStack: 99, price: 3 },
];

export const ITEMS_BY_ID: Readonly<Record<string, ItemDefinition>> = Object.fromEntries(
  ITEMS.map((item) => [item.id, item]),
);

export function getItem(itemId: string): ItemDefinition | undefined {
  return Object.hasOwn(ITEMS_BY_ID, itemId) ? ITEMS_BY_ID[itemId] : undefined;
}

export function getItemRecipe(itemId: string): ItemCraftingRecipe | undefined {
  return Object.hasOwn(ITEM_RECIPES_BY_OUTPUT_ID, itemId) ? ITEM_RECIPES_BY_OUTPUT_ID[itemId] : undefined;
}