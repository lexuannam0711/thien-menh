/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * MinigameClient: Authoritative API Client with Offline Simulation Fallback
 * 
 * Cung cấp kết nối tới API Express backend:
 * - GET /api/minigames/list
 * - POST /api/minigames/start
 * - POST /api/minigames/action
 * - POST /api/minigames/resolve
 * - GET /api/minigames/history
 * - GET /api/minigames/rewards
 * 
 * Đi kèm cơ chế Fallback Ngoại Tuyến (Offline Authoritative Simulation)
 * đầy đủ chuẩn xác theo luật trò chơi nếu backend không khả dụng.
 */

import {
  type MinigameId,
  type MinigamePublicSession,
  type MinigameActionInput,
  type GameMetadata,
  type RewardTier,
  type RewardReceipt,
  type MinigameSessionHistoryItem,
  type Card,
  type PublicCard,
  type HandScore,
  type SevenThreeTwoOnePublicState,
  type LuckyDicePublicState,
  type AnimalGuessPublicState,
  type AnimalSymbol,
  type DiceChoice,
  CARD_SUITS,
  CARD_RANKS,
  ANIMAL_SYMBOLS,
} from './MinigameTypes';

export interface MinigameClientOptions {
  baseUrl?: string;
  getAuthToken?: () => string | null;
  userId?: string;
  characterId?: string;
  forceOffline?: boolean;
}

export class MinigameClient {
  private baseUrl: string;
  private getAuthToken?: () => string | null;
  private userId: string;
  private characterId: string;
  private offlineMode: boolean;

  // Offline simulation state store
  private offlineDailyPlays: Map<string, number> = new Map(); // key: gameId, value: used
  private offlineSessions: Map<string, MinigamePublicSession> = new Map();
  private offlineSecretStates: Map<string, unknown> = new Map();
  private offlineHistory: MinigameSessionHistoryItem[] = [];

  constructor(options: MinigameClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    this.getAuthToken = options.getAuthToken;
    this.userId = options.userId ?? 'player_offline';
    this.characterId = options.characterId ?? 'hero_default';
    this.offlineMode = Boolean(options.forceOffline);
  }

  public setOfflineMode(enabled: boolean): void {
    this.offlineMode = enabled;
  }

  public isOfflineMode(): boolean {
    return this.offlineMode;
  }

  public setUserId(userId: string, characterId?: string): void {
    this.userId = userId;
    if (characterId) this.characterId = characterId;
  }

  private generateActionId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-Id': this.userId,
    };
    const token = this.getAuthToken ? this.getAuthToken() : null;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * GET /api/minigames/list
   */
  public async list(): Promise<{ ok: boolean; games: GameMetadata[]; vietnamDate?: string }> {
    if (this.offlineMode) {
      return this.offlineList();
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/minigames/list`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch {
      // Fallback ngoại tuyến an toàn
      this.offlineMode = true;
      return this.offlineList();
    }
  }

  /**
   * GET /api/minigames/rewards
   */
  public async rewards(gameId?: MinigameId): Promise<{
    ok: boolean;
    rewards?: any;
    gameId?: MinigameId;
    title?: string;
    description?: string;
    oddsDescription?: string;
    rewardTiers?: RewardTier[];
  }> {
    if (this.offlineMode) {
      return this.offlineRewards(gameId);
    }

    try {
      const url = gameId
        ? `${this.baseUrl}/api/minigames/rewards?gameId=${encodeURIComponent(gameId)}`
        : `${this.baseUrl}/api/minigames/rewards`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch {
      this.offlineMode = true;
      return this.offlineRewards(gameId);
    }
  }

  /**
   * POST /api/minigames/start
   */
  public async start(
    gameId: MinigameId,
    npcId?: string
  ): Promise<{ ok: boolean; session: MinigamePublicSession }> {
    if (this.offlineMode) {
      return this.offlineStart(gameId);
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/minigames/start`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          gameId,
          npcId,
          characterId: this.characterId,
          requestId: this.generateActionId(),
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch {
      this.offlineMode = true;
      return this.offlineStart(gameId);
    }
  }

  /**
   * POST /api/minigames/action
   */
  public async action(
    sessionId: string,
    actionInput: MinigameActionInput
  ): Promise<{ ok: boolean; session: MinigamePublicSession }> {
    if (this.offlineMode) {
      return this.offlineAction(sessionId, actionInput);
    }

    try {
      const actionId = this.generateActionId();
      const res = await fetch(`${this.baseUrl}/api/minigames/action`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          sessionId,
          actionId,
          type: actionInput.type,
          payload: actionInput,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch {
      this.offlineMode = true;
      return this.offlineAction(sessionId, actionInput);
    }
  }

  /**
   * POST /api/minigames/resolve
   */
  public async resolve(
    sessionId: string
  ): Promise<{ ok: boolean; session: MinigamePublicSession; reward?: RewardReceipt }> {
    if (this.offlineMode) {
      return this.offlineResolve(sessionId);
    }

    try {
      const actionId = this.generateActionId();
      const res = await fetch(`${this.baseUrl}/api/minigames/resolve`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          sessionId,
          actionId,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      return data;
    } catch {
      this.offlineMode = true;
      return this.offlineResolve(sessionId);
    }
  }

  /**
   * GET /api/minigames/history
   */
  public async history(
    gameId?: MinigameId,
    page: number = 1,
    limit: number = 10
  ): Promise<{ ok: boolean; items: MinigameSessionHistoryItem[]; total: number; page: number }> {
    if (this.offlineMode) {
      return this.offlineGetHistory(gameId, page, limit);
    }

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (gameId) params.append('gameId', gameId);

      const res = await fetch(`${this.baseUrl}/api/minigames/history?${params.toString()}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch {
      this.offlineMode = true;
      return this.offlineGetHistory(gameId, page, limit);
    }
  }

  // ==========================================================================
  // OFFLINE AUTHORITATIVE SIMULATION ENGINE
  // ==========================================================================

  private offlineList(): { ok: boolean; games: GameMetadata[]; vietnamDate: string } {
    const defaultGames: GameMetadata[] = [
      {
        id: '7321',
        title: '7321',
        npcId: 'npc_thay_the_lac',
        npcName: 'Thầy Thẻ Lạc',
        description: 'Trò chơi so tài rút thẻ mục tiêu 21 điểm với Thầy Thẻ Lạc.',
        dailyLimit: 3,
        rulesVersion: '1.0.0',
        oddsDescription: 'Thắng ~42.4%, Hòa ~8.5%, Dealer rút đến >= 17.',
        rewardTiers: [
          { condition: 'Tham gia', participationPoints: 5, bonusPoints: 0, totalPoints: 5, probabilityDesc: '100%' },
          { condition: 'Hòa', participationPoints: 5, bonusPoints: 0, totalPoints: 5, probabilityDesc: '~8.5%' },
          { condition: 'Thắng', participationPoints: 5, bonusPoints: 10, totalPoints: 15, probabilityDesc: '~42.4%' },
        ],
      },
      {
        id: 'lucky_dice',
        title: 'Xúc Xắc May Mắn',
        npcId: 'npc_lao_dong_xuc',
        npcName: 'Lão Đồng Xúc',
        description: 'Dự đoán tổng điểm 3 viên xúc xắc đồng: Tài (11–17) hoặc Xỉu (4–10).',
        dailyLimit: 3,
        rulesVersion: '1.0.0',
        oddsDescription: 'Tài ~48.61%, Xỉu ~48.61%, Bộ ba đồng số ~2.78% (Hòa đặc biệt).',
        rewardTiers: [
          { condition: 'Tham gia', participationPoints: 5, bonusPoints: 0, totalPoints: 5, probabilityDesc: '100%' },
          { condition: 'Bộ Ba Đồng Số', participationPoints: 5, bonusPoints: 0, totalPoints: 5, probabilityDesc: '2.78% (6/216)' },
          { condition: 'Đoán Đúng Tài/Xỉu', participationPoints: 5, bonusPoints: 5, totalPoints: 10, probabilityDesc: '48.61% (105/216)' },
        ],
      },
      {
        id: 'animal_guess',
        title: 'Nhìn Hình Đoán Thú',
        npcId: 'npc_nang_hoa_linh',
        npcName: 'Nàng Họa Linh',
        description: 'Dự đoán 1 trong 6 linh thú Văn Lang xuất hiện trong 3 viên xúc xắc.',
        dailyLimit: 3,
        rulesVersion: '1.0.0',
        oddsDescription: 'Xác suất trúng ít nhất một lần là ~42.13% (1 - (5/6)^3).',
        rewardTiers: [
          { condition: 'Tham gia', participationPoints: 5, bonusPoints: 0, totalPoints: 5, probabilityDesc: '100%' },
          { condition: 'Trúng 1 hình', participationPoints: 5, bonusPoints: 3, totalPoints: 8, probabilityDesc: '34.72% (75/216)' },
          { condition: 'Trúng 2 hình', participationPoints: 5, bonusPoints: 15, totalPoints: 20, probabilityDesc: '6.94% (15/216)' },
          { condition: 'Trúng 3 hình', participationPoints: 5, bonusPoints: 40, totalPoints: 45, probabilityDesc: '0.46% (1/216)' },
        ],
      },
    ];

    const gamesWithRemaining = defaultGames.map((g) => ({
      ...g,
      remainingDailyPlays: Math.max(0, g.dailyLimit - (this.offlineDailyPlays.get(g.id) ?? 0)),
    }));

    return {
      ok: true,
      games: gamesWithRemaining,
      vietnamDate: new Date().toISOString().slice(0, 10),
    };
  }

  private offlineRewards(gameId?: MinigameId): {
    ok: boolean;
    rewards?: any;
    gameId?: MinigameId;
    title?: string;
    description?: string;
    oddsDescription?: string;
    rewardTiers?: RewardTier[];
  } {
    const list = this.offlineList().games;
    if (gameId) {
      const g = list.find((item) => item.id === gameId);
      return {
        ok: true,
        gameId: g?.id,
        title: g?.title,
        description: g?.description,
        oddsDescription: g?.oddsDescription,
        rewardTiers: g?.rewardTiers ?? [],
      };
    }
    return {
      ok: true,
      rewards: list.map((g) => ({
        gameId: g.id,
        title: g.title,
        description: g.description,
        oddsDescription: g.oddsDescription,
        rewardTiers: g.rewardTiers,
      })),
    };
  }

  private offlineStart(gameId: MinigameId): { ok: boolean; session: MinigamePublicSession } {
    const used = this.offlineDailyPlays.get(gameId) ?? 0;
    if (used >= 3) {
      throw new Error('DAILY_LIMIT_EXCEEDED: Đã sử dụng hết 3 lượt hôm nay.');
    }
    this.offlineDailyPlays.set(gameId, used + 1);

    const sessionId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const remainingPlays = 3 - (used + 1);

    let publicState: any = {};
    let secretState: any = {};

    if (gameId === '7321') {
      const deck = this.createShuffledDeck();
      const p1 = deck.pop()!;
      const d1 = deck.pop()!;
      const p2 = deck.pop()!;
      const d2 = deck.pop()!; // Hidden dealer card

      const playerHand = [p1, p2];
      const pScore = this.calculateHandScore(playerHand);

      publicState = {
        playerHand,
        playerScore: pScore,
        dealerHand: [d1, { hidden: true } as PublicCard],
        turn: pScore.isNatural21 ? 'dealer_turn' : 'player_turn',
        message: pScore.isNatural21 ? 'Natural 21 điểm!' : 'Chọn Rút hoặc Dừng.',
      };

      secretState = {
        deck,
        dealerCards: [d1, d2],
      };
    } else if (gameId === 'lucky_dice') {
      publicState = {
        message: 'Hãy chọn TÀI (11–17) hoặc XỈU (4–10) rồi lắc xúc xắc.',
      };
    } else if (gameId === 'animal_guess') {
      publicState = {
        message: 'Chọn một linh vật Bách Việt rồi nhấn Mở Linh Hình.',
      };
    }

    const session: MinigamePublicSession = {
      sessionId,
      gameId,
      userId: this.userId,
      characterId: this.characterId,
      status: 'active',
      rulesVersion: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      publicState,
      remainingDailyPlays: remainingPlays,
    };

    this.offlineSessions.set(sessionId, session);
    this.offlineSecretStates.set(sessionId, secretState);

    // Xử lý nếu 7321 vừa vào đã Natural 21
    if (gameId === '7321' && publicState.playerScore.isNatural21) {
      return this.offlineResolve7321(session, secretState);
    }

    return { ok: true, session };
  }

  private offlineAction(
    sessionId: string,
    action: MinigameActionInput
  ): { ok: boolean; session: MinigamePublicSession } {
    const session = this.offlineSessions.get(sessionId);
    if (!session) throw new Error('SESSION_NOT_FOUND: Phiên chơi không tồn tại.');
    if (session.status !== 'active') throw new Error('SESSION_INACTIVE: Phiên đã kết thúc.');

    const secret = this.offlineSecretStates.get(sessionId) as any;

    if (session.gameId === '7321') {
      const state = session.publicState as SevenThreeTwoOnePublicState;
      if (action.type === 'hit') {
        const nextCard = secret.deck.pop();
        if (!nextCard) throw new Error('DECK_EMPTY');
        state.playerHand.push(nextCard);
        state.playerScore = this.calculateHandScore(state.playerHand);

        if (state.playerScore.isBust) {
          state.turn = 'resolved';
          state.outcome = 'dealer_won';
          state.message = 'Quắc bài! Tổng điểm vượt quá 21.';
          return this.finalizeSession(session, 'dealer_won', false, state.message, 0);
        } else if (state.playerScore.total === 21) {
          state.turn = 'dealer_turn';
          state.message = 'Đạt 21 điểm! Chuyển lượt sang nhà cái.';
          return this.offlineResolve7321(session, secret);
        } else {
          state.message = `Đang có ${state.playerScore.total} điểm. Rút tiếp hoặc Dừng.`;
        }
      } else if (action.type === 'stand') {
        state.turn = 'dealer_turn';
        state.message = 'Bạn đã chọn Dừng. Nhà cái tiến hành mở bài.';
        return this.offlineResolve7321(session, secret);
      }
    } else if (session.gameId === 'lucky_dice') {
      if (action.type === 'choose_dice') {
        const choice = action.choice as DiceChoice;
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const d3 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2 + d3;
        const isTriple = d1 === d2 && d2 === d3;

        let category: 'tai' | 'xiu' | 'triple';
        if (isTriple) category = 'triple';
        else category = total >= 11 ? 'tai' : 'xiu';

        let outcome: any;
        let won = false;
        let bonus = 0;
        let detail = '';

        if (isTriple) {
          outcome = 'special_triple';
          won = false;
          bonus = 0;
          detail = `Bộ Ba Đồng Số (${d1}-${d2}-${d3})! Hòa đặc biệt nhận 5 điểm tham gia.`;
        } else if (choice === category) {
          outcome = 'player_won';
          won = true;
          bonus = 5;
          detail = `Dự đoán đúng ${choice.toUpperCase()} (${d1}-${d2}-${d3} = ${total})! +10 điểm.`;
        } else {
          outcome = 'dealer_won';
          won = false;
          bonus = 0;
          detail = `Kết quả ${category.toUpperCase()} (${d1}-${d2}-${d3} = ${total}). Nhận 5 điểm tham gia.`;
        }

        const state: LuckyDicePublicState = {
          choice,
          dice: [d1, d2, d3],
          total,
          isTriple,
          category,
          outcome,
          message: detail,
        };
        session.publicState = state;
        return this.finalizeSession(session, outcome, won, detail, bonus);
      }
    } else if (session.gameId === 'animal_guess') {
      if (action.type === 'choose_symbol') {
        const symbol = action.symbol as AnimalSymbol;
        const roll1 = ANIMAL_SYMBOLS[Math.floor(Math.random() * ANIMAL_SYMBOLS.length)];
        const roll2 = ANIMAL_SYMBOLS[Math.floor(Math.random() * ANIMAL_SYMBOLS.length)];
        const roll3 = ANIMAL_SYMBOLS[Math.floor(Math.random() * ANIMAL_SYMBOLS.length)];

        let matches = 0;
        if (roll1 === symbol) matches++;
        if (roll2 === symbol) matches++;
        if (roll3 === symbol) matches++;

        let outcome: any;
        let won = matches > 0;
        let bonus = 0;
        let detail = '';

        if (matches === 1) {
          outcome = 'match_1';
          bonus = 3;
          detail = `Trúng 1 linh vật! Nhận 8 FestivalPoints.`;
        } else if (matches === 2) {
          outcome = 'match_2';
          bonus = 15;
          detail = `Trúng 2 linh vật xuất sắc! Nhận 20 FestivalPoints.`;
        } else if (matches === 3) {
          outcome = 'match_3';
          bonus = 40;
          detail = `Trúng cả 3 linh vật tuyệt đỉnh! Nhận 45 FestivalPoints.`;
        } else {
          outcome = 'no_match';
          bonus = 0;
          detail = `Không trúng linh vật. Nhận 5 điểm tham gia.`;
        }

        const state: AnimalGuessPublicState = {
          chosenSymbol: symbol,
          rolledSymbols: [roll1, roll2, roll3],
          matchCount: matches,
          outcome,
          message: detail,
        };
        session.publicState = state;
        return this.finalizeSession(session, outcome, won, detail, bonus);
      }
    }

    session.updatedAt = Date.now();
    return { ok: true, session };
  }

  private offlineResolve(sessionId: string): {
    ok: boolean;
    session: MinigamePublicSession;
    reward?: RewardReceipt;
  } {
    const session = this.offlineSessions.get(sessionId);
    if (!session) throw new Error('SESSION_NOT_FOUND: Phiên chơi không tồn tại.');
    return { ok: true, session, reward: session.reward };
  }

  private offlineResolve7321(
    session: MinigamePublicSession,
    secret: { deck: Card[]; dealerCards: Card[] }
  ): { ok: boolean; session: MinigamePublicSession } {
    const state = session.publicState as SevenThreeTwoOnePublicState;
    // Reveal dealer cards
    while (true) {
      const dScore = this.calculateHandScore(secret.dealerCards);
      if (dScore.total >= 17) {
        break;
      }
      const next = secret.deck.pop();
      if (!next) break;
      secret.dealerCards.push(next);
    }

    const dScore = this.calculateHandScore(secret.dealerCards);
    const pScore = state.playerScore;

    state.dealerHand = [...secret.dealerCards];
    state.dealerScore = dScore;
    state.turn = 'resolved';

    let outcome: any;
    let won = false;
    let bonus = 0;
    let detail = '';

    if (pScore.isNatural21 && !dScore.isNatural21) {
      outcome = 'player_won';
      won = true;
      bonus = 10;
      detail = `Natural 21 điểm thắng tuyệt đối! +15 FestivalPoints.`;
    } else if (dScore.isBust) {
      outcome = 'player_won';
      won = true;
      bonus = 10;
      detail = `Nhà cái quắc (${dScore.total} điểm)! Bạn thắng +15 FestivalPoints.`;
    } else if (pScore.total > dScore.total) {
      outcome = 'player_won';
      won = true;
      bonus = 10;
      detail = `Bạn (${pScore.total}) cao điểm hơn Nhà cái (${dScore.total})! +15 FestivalPoints.`;
    } else if (pScore.total === dScore.total) {
      outcome = 'tie';
      won = false;
      bonus = 0;
      detail = `Hòa điểm (${pScore.total})! Nhận 5 FestivalPoints.`;
    } else {
      outcome = 'dealer_won';
      won = false;
      bonus = 0;
      detail = `Nhà cái (${dScore.total}) cao hơn bạn (${pScore.total}). Nhận 5 điểm tham gia.`;
    }

    state.outcome = outcome;
    state.message = detail;

    return this.finalizeSession(session, outcome, won, detail, bonus);
  }

  private finalizeSession(
    session: MinigamePublicSession,
    outcome: any,
    won: boolean,
    detail: string,
    bonusPoints: number
  ): { ok: boolean; session: MinigamePublicSession } {
    const timestamp = Date.now();
    session.status = 'rewarded';
    session.resolvedAt = timestamp;
    session.updatedAt = timestamp;
    session.result = { outcome, won, detail, timestamp };

    const participation = 5;
    const totalPoints = participation + bonusPoints;

    session.reward = {
      receiptId: `rcpt_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      sessionId: session.sessionId,
      userId: session.userId,
      gameId: session.gameId,
      participationPoints: participation,
      bonusPoints,
      totalPoints,
      claimedAt: timestamp,
    };

    // Ghi vào offline history
    this.offlineHistory.unshift({
      sessionId: session.sessionId,
      gameId: session.gameId,
      status: session.status,
      outcome,
      won,
      detail,
      totalPoints,
      createdAt: session.createdAt,
      resolvedAt: session.resolvedAt,
    });

    return { ok: true, session };
  }

  private offlineGetHistory(
    gameId?: MinigameId,
    page: number = 1,
    limit: number = 10
  ): { ok: boolean; items: MinigameSessionHistoryItem[]; total: number; page: number } {
    const filtered = gameId
      ? this.offlineHistory.filter((item) => item.gameId === gameId)
      : this.offlineHistory;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);
    return {
      ok: true,
      items,
      total: filtered.length,
      page,
    };
  }

  // Card helpers
  private createShuffledDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of CARD_SUITS) {
      for (const rank of CARD_RANKS) {
        let value = 10;
        if (rank === 'A') value = 11;
        else if (['J', 'Q', 'K'].includes(rank)) value = 10;
        else value = parseInt(rank, 10);
        deck.push({ suit, rank, value });
      }
    }
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }
    return deck;
  }

  private calculateHandScore(cards: Card[]): HandScore {
    let total = 0;
    let aceCount = 0;

    for (const card of cards) {
      if (card.rank === 'A') {
        aceCount++;
        total += 11;
      } else {
        total += card.value;
      }
    }

    let isSoft = false;
    while (total > 21 && aceCount > 0) {
      total -= 10;
      aceCount--;
    }

    if (aceCount > 0) {
      isSoft = true;
    }

    const isBust = total > 21;
    const isNatural21 = cards.length === 2 && total === 21;

    return { total, isSoft, isBust, isNatural21 };
  }
}

export const minigameClient = new MinigameClient();
