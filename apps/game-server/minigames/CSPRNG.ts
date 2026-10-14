/**
 * Cryptographically Secure Pseudo-Random Number Generator (CSPRNG)
 * Uses node:crypto for server-authoritative, unbiased randomness.
 */

import { randomInt, randomBytes, createHash } from 'node:crypto';
import {
  type Card,
  type CardRank,
  type CardSuit,
  CARD_RANKS,
  CARD_SUITS,
  type AnimalSymbol,
  ANIMAL_SYMBOLS
} from './types.js';

/**
 * Returns an unbiased cryptographically secure random integer in range [min, max).
 * min is inclusive, max is exclusive.
 */
export function getRandomInt(min: number, max: number): number {
  if (min >= max) {
    throw new Error(`Invalid range: min (${min}) must be less than max (${max})`);
  }
  return randomInt(min, max);
}

/**
 * Unbiased Fisher-Yates shuffle algorithm.
 * Operates on a shallow copy of the array and returns the shuffled array.
 */
export function shuffleDeck<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

/**
 * Creates a standard 52-card deck without jokers.
 */
export function createStandardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      let value: number;
      if (rank === 'A') {
        value = 11; // base value, evaluated dynamically as 1 or 11
      } else if (['K', 'Q', 'J'].includes(rank)) {
        value = 10;
      } else {
        value = Number.parseInt(rank, 10);
      }
      deck.push({ suit, rank, value });
    }
  }
  return deck;
}

/**
 * Generates and shuffles a fresh standard 52-card deck.
 */
export function createShuffledDeck(): Card[] {
  return shuffleDeck(createStandardDeck());
}

/**
 * Rolls three independent 6-sided dice [1..6] using CSPRNG.
 */
export function rollThreeDice(): [number, number, number] {
  return [
    randomInt(1, 7),
    randomInt(1, 7),
    randomInt(1, 7),
  ];
}

/**
 * Draws three independent symbols from the 6 mascots using CSPRNG.
 */
export function rollThreeAnimals(): [AnimalSymbol, AnimalSymbol, AnimalSymbol] {
  return [
    ANIMAL_SYMBOLS[randomInt(0, ANIMAL_SYMBOLS.length)],
    ANIMAL_SYMBOLS[randomInt(0, ANIMAL_SYMBOLS.length)],
    ANIMAL_SYMBOLS[randomInt(0, ANIMAL_SYMBOLS.length)],
  ];
}

/**
 * Generates a unique, secure session ID.
 */
export function generateSessionId(): string {
  return `ses_${Date.now()}_${randomBytes(12).toString('hex')}`;
}

/**
 * Generates a unique, secure reward receipt ID.
 */
export function generateReceiptId(sessionId: string): string {
  return `rcpt_${sessionId.slice(0, 16)}_${randomBytes(8).toString('hex')}`;
}

/**
 * Computes a SHA-256 hash for commitment or verification.
 */
export function hashCommit(data: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${data}`).digest('hex');
}
