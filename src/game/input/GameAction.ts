/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * GameAction & GameplayInput: Hệ thống hành động trừu tượng tách biệt khỏi phần cứng.
 */

export type GameAction =
  | 'MOVE_UP'
  | 'MOVE_DOWN'
  | 'MOVE_LEFT'
  | 'MOVE_RIGHT'
  | 'ATTACK'
  | 'DODGE'
  | 'INTERACT'
  | 'PAUSE'
  | 'INVENTORY'
  | 'QUEST_JOURNAL'
  | 'CHARACTER'
  | 'SKILL_TREE'
  | 'MAP'
  | 'SKILL_1'
  | 'SKILL_2'
  | 'SKILL_3'
  | 'SKILL_4'
  | 'QUICK_ITEM_1'
  | 'QUICK_ITEM_2'
  | 'QUICK_ITEM_3'
  | 'QUICK_ITEM_4';

export interface GameplayInput {
  moveX: number;
  moveY: number;
  aimWorldX?: number;
  aimWorldY?: number;
  pressed: ReadonlySet<GameAction>;
  held: ReadonlySet<GameAction>;
  released: ReadonlySet<GameAction>;
}

export const ALL_GAME_ACTIONS: readonly GameAction[] = Object.freeze([
  'MOVE_UP',
  'MOVE_DOWN',
  'MOVE_LEFT',
  'MOVE_RIGHT',
  'ATTACK',
  'DODGE',
  'INTERACT',
  'PAUSE',
  'INVENTORY',
  'QUEST_JOURNAL',
  'CHARACTER',
  'SKILL_TREE',
  'MAP',
  'SKILL_1',
  'SKILL_2',
  'SKILL_3',
  'SKILL_4',
  'QUICK_ITEM_1',
  'QUICK_ITEM_2',
  'QUICK_ITEM_3',
  'QUICK_ITEM_4',
]);

export const MOVEMENT_ACTIONS: readonly GameAction[] = Object.freeze([
  'MOVE_UP',
  'MOVE_DOWN',
  'MOVE_LEFT',
  'MOVE_RIGHT',
]);

export const COMBAT_ACTIONS: readonly GameAction[] = Object.freeze([
  'ATTACK',
  'DODGE',
  'SKILL_1',
  'SKILL_2',
  'SKILL_3',
  'SKILL_4',
]);

export const QUICK_ITEM_ACTIONS: readonly GameAction[] = Object.freeze([
  'QUICK_ITEM_1',
  'QUICK_ITEM_2',
  'QUICK_ITEM_3',
  'QUICK_ITEM_4',
]);

export const UI_ACTIONS: readonly GameAction[] = Object.freeze([
  'PAUSE',
  'INVENTORY',
  'QUEST_JOURNAL',
  'CHARACTER',
  'SKILL_TREE',
  'MAP',
]);
