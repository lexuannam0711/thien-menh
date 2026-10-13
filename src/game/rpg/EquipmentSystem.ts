import { getItem, type EquipmentSlot, type ItemStats } from '../../data/items';
import { addItem, removeItem, type InventoryState } from './InventorySystem';
import { getWeapon } from '../../data/weapons';

export interface Equipment {
  readonly weaponId?: string;
  readonly armorId?: string;
  readonly accessoryId?: string;
}

export type EquipmentSlots = Readonly<Partial<Record<EquipmentSlot, string>>>;
export interface EquipmentState { readonly slots: EquipmentSlots; }
export interface EquipmentChange { readonly inventory: InventoryState; readonly equipment: EquipmentState; }

export function createEquipment(): EquipmentState { return { slots: {} }; }

export function equipItem(inventory: InventoryState, equipment: EquipmentState, itemId: string): EquipmentChange | undefined {
  const item = getItem(itemId);
  if (!item?.slot) return undefined;
  const removed = removeItem(inventory, itemId, 1);
  if (removed.changed !== 1) return undefined;
  const previous = equipment.slots[item.slot];
  const nextEquipment: EquipmentState = { slots: { ...equipment.slots, [item.slot]: itemId } };
  const nextInventory = previous ? addItem(removed.state, previous, 1) : { state: removed.state, changed: 0, remainder: 0 };
  return nextInventory.remainder === 0 ? { inventory: nextInventory.state, equipment: nextEquipment } : undefined;
}

export function unequipItem(inventory: InventoryState, equipment: EquipmentState, slot: EquipmentSlot): EquipmentChange | undefined {
  const itemId = equipment.slots[slot];
  if (!itemId) return undefined;
  const added = addItem(inventory, itemId, 1);
  if (added.changed !== 1) return undefined;
  const slots = { ...equipment.slots };
  delete slots[slot];
  return { inventory: added.state, equipment: { slots } };
}

export function calculateEquipmentStats(equipment: EquipmentState, level = Infinity): ItemStats {
  return Object.values(equipment.slots).reduce<ItemStats>((total, itemId) => {
    const weapon = getWeapon(itemId ?? '');
    const stats = !weapon || level >= weapon.requiredLevel ? getItem(itemId ?? '')?.stats : undefined;
    return {
      attack: (total.attack ?? 0) + (stats?.attack ?? 0),
      maxHp: (total.maxHp ?? 0) + (stats?.maxHp ?? 0),
      maxMp: (total.maxMp ?? 0) + (stats?.maxMp ?? 0),
      speed: (total.speed ?? 0) + (stats?.speed ?? 0),
    };
  }, {});
}
