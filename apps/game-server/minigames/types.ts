/**
 * Authoritative Minigame Engine Types
 * Thần Mệnh: Hậu Duệ Văn Lang
 */

export type MinigameId = '7321' | 'lucky_dice' | 'animal_guess';

export type SessionStatus =
  | 'created'
  | 'active'
  | 'resolved'
  | 'rewarded'
  | 'cancelled'
  | 'expired';

export type GameOutcome =
  | 'player_won'
  | 'dealer_won'
  | 'tie'
  | 'special_triple'
  | 'match_1'
  | 'match_2'
  | 'match_3'
  | 'no_match';

// --- Card definitions (7321) ---
export const CARD_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type CardSuit = (typeof CARD_SUITS)[number];

export const CARD_RANKS = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
] as const;
export type CardRank = (typeof CARD_RANKS)[number];

export interface Card {
  suit: CardSuit;
  rank: CardRank;
  value: number; // 2..10 for numbers, 10 for J/Q/K, 1 or 11 for Ace
}

export type PublicCard = Card | { hidden: true };

export interface HandScore {
  total: number;
  isSoft: boolean;
  isBust: boolean;
  isNatural21: boolean;
}

export interface SevenThreeTwoOnePublicState {
  playerHand: Card[];
  playerScore: HandScore;
  dealerHand: PublicCard[];
  dealerScore?: HandScore;
  turn: 'player_turn' | 'dealer_turn' | 'resolved';
  outcome?: GameOutcome;
  message?: string;
}

export interface SevenThreeTwoOneSecretState {
  deck: Card[];
  dealerHiddenCard: Card;
  dealerAllCards: Card[];
}

// --- Lucky Dice definitions ---
export type DiceChoice = 'tai' | 'xiu';
export type DiceCategory = 'tai' | 'xiu' | 'triple';

export interface LuckyDicePublicState {
  choice?: DiceChoice;
  dice?: [number, number, number];
  total?: number;
  isTriple?: boolean;
  category?: DiceCategory;
  outcome?: GameOutcome;
  message?: string;
}

// --- Animal Guess definitions ---
export const ANIMAL_SYMBOLS = ['bau', 'cua', 'ca', 'cop', 'ga', 'nai'] as const;
export type AnimalSymbol = (typeof ANIMAL_SYMBOLS)[number];

export interface AnimalGuessPublicState {
  chosenSymbol?: AnimalSymbol;
  rolledSymbols?: [AnimalSymbol, AnimalSymbol, AnimalSymbol];
  matchCount?: number;
  outcome?: GameOutcome;
  message?: string;
}

// --- Unified Action Types ---
export type CardAction = { type: 'hit' } | { type: 'stand' };
export type DiceAction = { type: 'choose_dice'; choice: DiceChoice };
export type AnimalAction = { type: 'choose_symbol'; symbol: AnimalSymbol };

export type MinigameActionInput = CardAction | DiceAction | AnimalAction;

export interface MinigameActionRecord {
  actionId: string;
  type: string;
  payload?: unknown;
  timestamp: number;
}

// --- Session & Result Types ---
export interface MinigameResult {
  outcome: GameOutcome;
  won: boolean;
  detail: string;
  timestamp: number;
}

export interface RewardReceipt {
  receiptId: string;
  sessionId: string;
  userId: string;
  gameId: MinigameId;
  participationPoints: number;
  bonusPoints: number;
  totalPoints: number;
  claimedAt: number;
}

export interface MinigamePublicSession {
  sessionId: string;
  gameId: MinigameId;
  userId: string;
  characterId: string;
  status: SessionStatus;
  rulesVersion: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  publicState: SevenThreeTwoOnePublicState | LuckyDicePublicState | AnimalGuessPublicState | Record<string, unknown>;
  remainingDailyPlays: number;
  result?: MinigameResult;
  reward?: RewardReceipt;
}

export interface MinigameSession {
  sessionId: string;
  gameId: MinigameId;
  userId: string;
  characterId: string;
  status: SessionStatus;
  rulesVersion: string;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  publicState: SevenThreeTwoOnePublicState | LuckyDicePublicState | AnimalGuessPublicState | Record<string, unknown>;
  secretState?: SevenThreeTwoOneSecretState | Record<string, unknown>;
  actions: MinigameActionRecord[];
  result?: MinigameResult;
  reward?: RewardReceipt;
}

export interface RewardTier {
  condition: string;
  participationPoints: number;
  bonusPoints: number;
  totalPoints: number;
  probabilityDesc: string;
}

export interface GameMetadata {
  id: MinigameId;
  title: string;
  npcId: string;
  npcName: string;
  description: string;
  dailyLimit: number;
  rulesVersion: string;
  oddsDescription: string;
  rewardTiers: RewardTier[];
}
