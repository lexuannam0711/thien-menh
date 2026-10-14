/**
 * LuckyDiceRules (Game ID: 'lucky_dice')
 * Ancient dice prediction game (inspired by Tai Xiu, 3d6).
 * No real money, purely festival tokens.
 */

import {
  type DiceChoice,
  type DiceCategory,
  type LuckyDicePublicState,
  type GameOutcome,
  type MinigameResult
} from '../types.js';
import { rollThreeDice } from '../CSPRNG.js';

export const RULES_VERSION_LUCKY_DICE = '1.0.0';

export interface EvaluatedDice {
  dice: [number, number, number];
  total: number;
  isTriple: boolean;
  category: DiceCategory;
  outcome: GameOutcome;
  won: boolean;
  message: string;
  detail: string;
}

/**
 * Authoritatively evaluates the 3 dice roll against the player's choice ('tai' or 'xiu').
 * - Xỉu: 4..10, excluding triples.
 * - Tài: 11..17, excluding triples.
 * - Bộ ba đồng số (triples): 1-1-1, 2-2-2, ..., 6-6-6. Special result "Hòa đặc biệt", not Tai or Xiu.
 */
export function evaluateDice(
  d1: number,
  d2: number,
  d3: number,
  choice: DiceChoice
): EvaluatedDice {
  if (
    !Number.isInteger(d1) || d1 < 1 || d1 > 6 ||
    !Number.isInteger(d2) || d2 < 1 || d2 > 6 ||
    !Number.isInteger(d3) || d3 < 1 || d3 > 6
  ) {
    throw new Error(`Invalid dice values: [${d1}, ${d2}, ${d3}] must be integers 1..6`);
  }

  const dice: [number, number, number] = [d1, d2, d3];
  const total = d1 + d2 + d3;
  const isTriple = d1 === d2 && d2 === d3;

  let category: DiceCategory;
  if (isTriple) {
    category = 'triple';
  } else if (total >= 4 && total <= 10) {
    category = 'xiu';
  } else if (total >= 11 && total <= 17) {
    category = 'tai';
  } else {
    // Total 3 (1-1-1) and Total 18 (6-6-6) are caught by isTriple
    category = 'triple';
  }

  let outcome: GameOutcome;
  let won: boolean;
  let message: string;
  let detail: string;

  if (isTriple) {
    outcome = 'special_triple';
    won = false;
    message = `Bộ ba đồng số đặc biệt (${d1}-${d2}-${d3})! Kết quả Hòa Đặc Biệt nhận thưởng bảo lưu!`;
    detail = `Bộ ba đồng số ${d1}-${d2}-${d3} (Tổng ${total}), Hòa đặc biệt.`;
  } else if (choice === category) {
    outcome = 'player_won';
    won = true;
    const catName = category === 'tai' ? 'Tài' : 'Xỉu';
    message = `Chúc mừng! Bạn đã đoán đúng cửa ${catName} với tổng điểm ${total} (${d1}-${d2}-${d3})!`;
    detail = `Đoán ${choice.toUpperCase()}, ra ${category.toUpperCase()} (${d1}+${d2}+${d3}=${total}). Thắng!`;
  } else {
    outcome = 'dealer_won';
    won = false;
    const catName = category === 'tai' ? 'Tài' : 'Xỉu';
    message = `Rất tiếc! Kết quả về ${catName} với tổng điểm ${total} (${d1}-${d2}-${d3}).`;
    detail = `Đoán ${choice.toUpperCase()}, ra ${category.toUpperCase()} (${d1}+${d2}+${d3}=${total}). Thua.`;
  }

  return {
    dice,
    total,
    isTriple,
    category,
    outcome,
    won,
    message,
    detail
  };
}

export interface RoundResultLuckyDice {
  publicState: LuckyDicePublicState;
  result: MinigameResult;
}

/**
 * Rolls the 3 dice authoritatively using CSPRNG and resolves the round.
 */
export function playLuckyDice(
  choice: DiceChoice,
  customRoll?: [number, number, number]
): RoundResultLuckyDice {
  const [d1, d2, d3] = customRoll ?? rollThreeDice();
  const evaluation = evaluateDice(d1, d2, d3, choice);

  return {
    publicState: {
      choice,
      dice: evaluation.dice,
      total: evaluation.total,
      isTriple: evaluation.isTriple,
      category: evaluation.category,
      outcome: evaluation.outcome,
      message: evaluation.message
    },
    result: {
      outcome: evaluation.outcome,
      won: evaluation.won,
      detail: evaluation.detail,
      timestamp: Date.now()
    }
  };
}
