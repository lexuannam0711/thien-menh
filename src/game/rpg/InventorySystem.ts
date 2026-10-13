import { getItem, type ItemDefinition } from '../../data/items';

export interface InventorySlot {
  readonly itemId: string;
  readonly quantity: number;
}

export type InventoryStack = InventorySlot;

export interface InventoryState {
  readonly capacity: number;
  readonly slots: readonly InventorySlot[];
}

export interface InventoryChange {
  readonly state: InventoryState;
  readonly changed: number;
  readonly remainder: number;
}

export const DEFAULT_INVENTORY_CAPACITY = 24;

export function createInventory(capacity = DEFAULT_INVENTORY_CAPACITY): InventoryState {
  return { capacity: Math.max(0, Math.floor(capacity)), slots: [] };
}

function copy(state: InventoryState, slots: readonly InventorySlot[]): InventoryState {
  return { capacity: state.capacity, slots: slots.map((slot) => ({ ...slot })) };
}

export function countItem(state: InventoryState, itemId: string): number {
  return state.slots.reduce((total, slot) => total + (slot.itemId === itemId ? slot.quantity : 0), 0);
}

export function hasItem(state: InventoryState, itemId: string, quantity = 1): boolean {
  return quantity > 0 && countItem(state, itemId) >= quantity;
}

export function addItem(state: InventoryState, itemId: string, quantity: number): InventoryChange {
  const item = getItem(itemId);
  const requested = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  if (!item || requested === 0) return { state: copy(state, state.slots), changed: 0, remainder: requested };
  let remaining = requested;
  const slots = state.slots.map((slot) => ({ ...slot }));
  for (const slot of slots) {
    if (slot.itemId !== itemId || remaining === 0) continue;
    const space = Math.max(0, item.maxStack - slot.quantity);
    const added = Math.min(space, remaining);
    slot.quantity += added;
    remaining -= added;
  }
  while (remaining > 0 && slots.length < state.capacity) {
    const added = Math.min(item.maxStack, remaining);
    slots.push({ itemId, quantity: added });
    remaining -= added;
  }
  return { state: copy(state, slots), changed: requested - remaining, remainder: remaining };
}

export function removeItem(state: InventoryState, itemId: string, quantity: number): InventoryChange {
  const requested = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  if (requested === 0 || !hasItem(state, itemId, requested)) {
    return { state: copy(state, state.slots), changed: 0, remainder: requested };
  }
  let remaining = requested;
  const slots = state.slots.map((slot) => ({ ...slot }));
  for (let index = slots.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const slot = slots[index];
    if (slot.itemId !== itemId) continue;
    const removed = Math.min(slot.quantity, remaining);
    slot.quantity -= removed;
    remaining -= removed;
  }
  return { state: copy(state, slots.filter((slot) => slot.quantity > 0)), changed: requested, remainder: 0 };
}

export function consumeItem(state: InventoryState, itemId: string): InventoryChange {
  const item = getItem(itemId);
  return item?.kind === 'consumable' ? removeItem(state, itemId, 1) : { state: copy(state, state.slots), changed: 0, remainder: 1 };
}

export function listItems(state: InventoryState): readonly ItemDefinition[] {
  return state.slots.flatMap((slot) => {
    const item = getItem(slot.itemId);
    return item ? [item] : [];
  });
}