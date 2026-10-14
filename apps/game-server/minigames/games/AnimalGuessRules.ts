/**
 * AnimalGuessRules (Game ID: 'animal_guess')
 * Ancient mascot prediction game (inspired by Vietnamese Bầu Cua).
 * 6 mascots: Bầu, Cua, Cá, Cọp, Gà, Nai.
 * Theoretical probability of >= 1 match: 1 - (5/6)^3 = 91/216 ≈ 42.1296%.
 */

import {
  type AnimalSymbol,
  ANIMAL_SYMBOLS,
  type AnimalGuessPublicState,
  type GameOutcome,
  type MinigameResult
} from '../types.js';
import { rollThreeAnimals } from '../CSPRNG.js';

export const RULES_VERSION_ANIMAL_GUESS = '1.0.0';

export const ANIMAL_NAMES_VI: Record<AnimalSymbol, string> = {
  bau: 'Bầu',
  cua: 'Cua',
  ca: 'Cá',
  cop: 'Cọp',
  ga: 'Gà',
  nai: 'Nai'
};

export interface EvaluatedAnimalGuess {
  chosenSymbol: AnimalSymbol;
  rolledSymbols: [AnimalSymbol, AnimalSymbol, AnimalSymbol];
  matchCount: number;
  outcome: GameOutcome;
  won: boolean;
  message: string;
  detail: string;
}

/**
 * Authoritatively evaluates the 3 rolled symbols against player's chosen mascot.
 */
export function evaluateAnimalGuess(
  chosenSymbol: AnimalSymbol,
  rolledSymbols: [AnimalSymbol, AnimalSymbol, AnimalSymbol]
): EvaluatedAnimalGuess {
  if (!ANIMAL_SYMBOLS.includes(chosenSymbol)) {
    throw new Error(`Invalid symbol: '${chosenSymbol}'. Must be one of ${ANIMAL_SYMBOLS.join(', ')}`);
  }

  for (const s of rolledSymbols) {
    if (!ANIMAL_SYMBOLS.includes(s)) {
      throw new Error(`Invalid rolled symbol: '${s}'`);
    }
  }

  let matchCount = 0;
  for (const s of rolledSymbols) {
    if (s === chosenSymbol) {
      matchCount++;
    }
  }

  const chosenName = ANIMAL_NAMES_VI[chosenSymbol];
  const rolledNames = rolledSymbols.map((s) => ANIMAL_NAMES_VI[s]).join(' - ');

  let outcome: GameOutcome;
  let won: boolean;
  let message: string;
  let detail: string;

  if (matchCount === 3) {
    outcome = 'match_3';
    won = true;
    message = `Đại Cát! Xuất hiện cả 3 linh vật [${chosenName}] (${rolledNames})! Thưởng tối đa 45 điểm!`;
    detail = `Đoán ${chosenName}, ra 3 con (${rolledNames}). Thắng rực rỡ!`;
  } else if (matchCount === 2) {
    outcome = 'match_2';
    won = true;
    message = `Song Hỷ! Xuất hiện 2 linh vật [${chosenName}] (${rolledNames})! Thưởng 20 điểm!`;
    detail = `Đoán ${chosenName}, ra 2 con (${rolledNames}). Thắng!`;
  } else if (matchCount === 1) {
    outcome = 'match_1';
    won = true;
    message = `Khai Vận! Xuất hiện 1 linh vật [${chosenName}] (${rolledNames})! Thưởng 8 điểm!`;
    detail = `Đoán ${chosenName}, ra 1 con (${rolledNames}). Thắng!`;
  } else {
    outcome = 'no_match';
    won = false;
    message = `Tiếc quá! Kết quả mở ra (${rolledNames}) không có linh vật [${chosenName}].`;
    detail = `Đoán ${chosenName}, ra 0 con (${rolledNames}). Không trúng.`;
  }

  return {
    chosenSymbol,
    rolledSymbols,
    matchCount,
    outcome,
    won,
    message,
    detail
  };
}

export interface RoundResultAnimalGuess {
  publicState: AnimalGuessPublicState;
  result: MinigameResult;
}

/**
 * Rolls 3 animal mascots authoritatively using CSPRNG and resolves the round.
 */
export function playAnimalGuess(
  chosenSymbol: AnimalSymbol,
  customRoll?: [AnimalSymbol, AnimalSymbol, AnimalSymbol]
): RoundResultAnimalGuess {
  const rolled = customRoll ?? rollThreeAnimals();
  const evaluation = evaluateAnimalGuess(chosenSymbol, rolled);

  return {
    publicState: {
      chosenSymbol,
      rolledSymbols: evaluation.rolledSymbols,
      matchCount: evaluation.matchCount,
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
