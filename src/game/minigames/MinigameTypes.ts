/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * Minigames Shared Types & Contracts
 * 
 * Định nghĩa hợp đồng dữ liệu cho 3 minigame:
 * 1. '7321' — Trò thẻ bài đối kháng với nhà cái (lấy cảm hứng từ Blackjack)
 * 2. 'lucky_dice' — Xúc Xắc May Mắn (lấy cảm hứng từ Tài/Xỉu)
 * 3. 'animal_guess' — Nhìn Hình Đoán Thú (lấy cảm hứng từ Bầu Cua Việt Nam)
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

// ============================================================================
// 1. GAME 1: 7321 (Card Game)
// ============================================================================

export const CARD_SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type CardSuit = (typeof CARD_SUITS)[number];

export const CARD_RANKS = [
  '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'
] as const;
export type CardRank = (typeof CARD_RANKS)[number];

export interface Card {
  suit: CardSuit;
  rank: CardRank;
  value: number; // 2..10, 10 cho J/Q/K, 1 hoặc 11 cho A
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

export type CardAction = { type: 'hit' } | { type: 'stand' };

// ============================================================================
// 2. GAME 2: XÚC XẮC MAY MẮN (Lucky Dice)
// ============================================================================

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

export type DiceAction = { type: 'choose_dice'; choice: DiceChoice };

// ============================================================================
// 3. GAME 3: NHÌN HÌNH ĐOÁN THÚ (Animal Guess)
// ============================================================================

export const ANIMAL_SYMBOLS = ['bau', 'cua', 'ca', 'cop', 'ga', 'nai'] as const;
export type AnimalSymbol = (typeof ANIMAL_SYMBOLS)[number];

export interface MascotInfo {
  symbol: AnimalSymbol;
  nameVi: string;
  subtitle: string;
  description: string;
  color: number;
  hex: string;
}

export const ANIMAL_DEFINITIONS: Readonly<Record<AnimalSymbol, MascotInfo>> = Object.freeze({
  bau: {
    symbol: 'bau',
    nameVi: 'Bầu',
    subtitle: 'Hồ Lô Linh Khí',
    description: 'Bầu hồ lô chứa linh đơn, biểu tượng của sự trường sinh và no đủ.',
    color: 0xd4a034,
    hex: '#D4A034',
  },
  cua: {
    symbol: 'cua',
    nameVi: 'Cua',
    subtitle: 'Thần Giáp Đỏ Thắm',
    description: 'Cua đồng rắn rỏi, mai giáp hộ thân, biểu tượng của sự vững chãi.',
    color: 0xd9533f,
    hex: '#D9533F',
  },
  ca: {
    symbol: 'ca',
    nameVi: 'Cá',
    subtitle: 'Ngư Lạc Thủy Cung',
    description: 'Cá chép sông Hồng vẫy sóng, biểu tượng của sự linh hoạt và hanh thông.',
    color: 0x3d9cb8,
    hex: '#3D9CB8',
  },
  cop: {
    symbol: 'cop',
    nameVi: 'Cọp',
    subtitle: 'Mãnh Hổ Hoàng Kim',
    description: 'Chúa tể rừng thiêng oai phong lẫm liệt, tượng trưng cho dũng khí vô song.',
    color: 0xdf8428,
    hex: '#DF8428',
  },
  ga: {
    symbol: 'ga',
    nameVi: 'Gà',
    subtitle: 'Thần Kê Gáy Sáng',
    description: 'Gà trống đón bình minh, xua tan bóng tối và tà khí u uất.',
    color: 0xb53c3c,
    hex: '#B53C3C',
  },
  nai: {
    symbol: 'nai',
    nameVi: 'Nai',
    subtitle: 'Hươu Sao Trường Thọ',
    description: 'Linh thú thanh tao nơi rừng sâu ngút ngàn, biểu tượng của sự cát tường.',
    color: 0x9e6c43,
    hex: '#9E6C43',
  },
});

export interface AnimalGuessPublicState {
  chosenSymbol?: AnimalSymbol;
  rolledSymbols?: [AnimalSymbol, AnimalSymbol, AnimalSymbol];
  matchCount?: number;
  outcome?: GameOutcome;
  message?: string;
}

export type AnimalAction = { type: 'choose_symbol'; symbol: AnimalSymbol };

// ============================================================================
// 4. UNIFIED ACTIONS & PROTOCOL
// ============================================================================

export type MinigameActionInput = CardAction | DiceAction | AnimalAction;

export interface MinigameActionRecord {
  actionId: string;
  type: string;
  payload?: unknown;
  timestamp: number;
}

// ============================================================================
// 5. SESSION, RESULT & REWARDS
// ============================================================================

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
  publicState:
    | SevenThreeTwoOnePublicState
    | LuckyDicePublicState
    | AnimalGuessPublicState
    | Record<string, unknown>;
  remainingDailyPlays: number;
  result?: MinigameResult;
  reward?: RewardReceipt;
}

export interface MinigameSessionHistoryItem {
  sessionId: string;
  gameId: MinigameId;
  status: SessionStatus;
  outcome?: GameOutcome;
  won?: boolean;
  detail?: string;
  totalPoints?: number;
  createdAt: number;
  resolvedAt?: number;
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
  remainingDailyPlays?: number;
}

// ============================================================================
// 6. NPC INTEGRATION REGISTRY
// ============================================================================

export interface MinigameNpcInfo {
  npcId: string;
  gameId: MinigameId;
  npcName: string;
  gameTitle: string;
  tagline: string;
  greeting: string;
  portraitKey: string;
}

export const MINIGAME_NPCS: Readonly<Record<MinigameId, MinigameNpcInfo>> = Object.freeze({
  '7321': {
    npcId: 'npc_thay_the_lac',
    gameId: '7321',
    npcName: 'Thầy Thẻ Lạc',
    gameTitle: '7321',
    tagline: 'Trò chơi thẻ đồng trí tuệ & bản lĩnh Văn Lang',
    greeting: 'Thử vận may với những lá thẻ Văn Lang chứ? Hãy nhớ: tham thêm một lá có thể mất cả lượt!',
    portraitKey: 'minigame_npc_thay_the_lac',
  },
  'lucky_dice': {
    npcId: 'npc_lao_dong_xuc',
    gameId: 'lucky_dice',
    npcName: 'Lão Đồng Xúc',
    gameTitle: 'Xúc Xắc May Mắn',
    tagline: 'Dự đoán biến hóa của ba viên xúc xắc đồng',
    greeting: 'Ba viên xúc xắc, một lần dự đoán. Chọn theo cách của ngươi!',
    portraitKey: 'minigame_npc_lao_dong_xuc',
  },
  'animal_guess': {
    npcId: 'npc_nang_hoa_linh',
    gameId: 'animal_guess',
    npcName: 'Nàng Họa Linh',
    gameTitle: 'Nhìn Hình Đoán Thú',
    tagline: 'Nghệ thuật linh thú Bách Việt — Dự đoán linh hình cát tường',
    greeting: 'Hãy chọn hình mà ngươi tin sẽ xuất hiện. Ba viên linh hình sẽ trả lời!',
    portraitKey: 'minigame_npc_nang_hoa_linh',
  },
});

export function getNpcForMinigame(gameId: MinigameId): MinigameNpcInfo {
  return MINIGAME_NPCS[gameId];
}

export function getMinigameByNpcId(npcId: string): MinigameNpcInfo | undefined {
  return Object.values(MINIGAME_NPCS).find(n => n.npcId === npcId);
}
