/**
 * Authoritative SessionManager
 * Manages minigame session lifecycles, state machine, idempotency,
 * daily limits (Vietnam Asia/Ho_Chi_Minh reset), and history.
 */

import {
  type MinigameId,
  type MinigameSession,
  type MinigamePublicSession,
  type DiceChoice,
  type AnimalSymbol,
  type SevenThreeTwoOnePublicState,
  type SevenThreeTwoOneSecretState,
  ANIMAL_SYMBOLS
} from './types.js';
import { generateSessionId } from './CSPRNG.js';
import { dealInitialCards, executeAction7321 } from './games/SevenThreeTwoOneRules.js';
import { playLuckyDice } from './games/LuckyDiceRules.js';
import { playAnimalGuess } from './games/AnimalGuessRules.js';
import { rewardService } from './RewardService.js';
import { rulesRegistry } from './RulesRegistry.js';

/**
 * Returns date string in YYYY-MM-DD for Asia/Ho_Chi_Minh timezone.
 */
export function getVietnamDate(timestamp: number = Date.now()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(new Date(timestamp));
}

export class SessionManager {
  private sessions = new Map<string, MinigameSession>();
  private userHistory = new Map<string, string[]>(); // userId -> sessionId[]
  private dailyUsage = new Map<string, number>(); // `${userId}:${gameId}:${date}` -> count
  private idempotencyCache = new Map<string, MinigamePublicSession>(); // `${sessionId}:${actionId}` -> cached response

  /**
   * Returns remaining daily plays for a given user and game.
   */
  getRemainingDailyPlays(userId: string, gameId: MinigameId, dateStr?: string): number {
    const meta = rulesRegistry.getGameMetadata(gameId);
    const date = dateStr ?? getVietnamDate();
    const key = `${userId}:${gameId}:${date}`;
    const used = this.dailyUsage.get(key) ?? 0;
    return Math.max(0, meta.dailyLimit - used);
  }

  /**
   * Consumes one daily play for a user and game.
   */
  private consumeDailyPlay(userId: string, gameId: MinigameId): void {
    const meta = rulesRegistry.getGameMetadata(gameId);
    const date = getVietnamDate();
    const key = `${userId}:${gameId}:${date}`;
    const used = this.dailyUsage.get(key) ?? 0;

    if (used >= meta.dailyLimit) {
      throw new Error(`DAILY_LIMIT_EXCEEDED: User ${userId} has exhausted the daily limit of ${meta.dailyLimit} plays for ${gameId} on ${date}.`);
    }

    this.dailyUsage.set(key, used + 1);
  }

  /**
   * Starts a new authoritative minigame session.
   */
  startSession(params: {
    userId: string;
    characterId?: string;
    gameId: MinigameId;
    requestId?: string;
  }): MinigamePublicSession {
    const { userId, characterId = 'default', gameId } = params;

    if (!rulesRegistry.isValidGameId(gameId)) {
      throw new Error(`INVALID_GAME_ID: Game ${gameId} is not supported.`);
    }

    // Verify and consume daily limit
    this.consumeDailyPlay(userId, gameId);

    const sessionId = generateSessionId();
    const now = Date.now();
    const meta = rulesRegistry.getGameMetadata(gameId);

    let session: MinigameSession;

    switch (gameId) {
      case '7321': {
        const initial = dealInitialCards();
        session = {
          sessionId,
          gameId,
          userId,
          characterId,
          status: initial.isResolved ? 'resolved' : 'active',
          rulesVersion: meta.rulesVersion,
          createdAt: now,
          updatedAt: now,
          resolvedAt: initial.isResolved ? now : undefined,
          publicState: initial.publicState,
          secretState: initial.secretState,
          actions: [],
          result: initial.result
        };
        break;
      }

      case 'lucky_dice': {
        session = {
          sessionId,
          gameId,
          userId,
          characterId,
          status: 'active',
          rulesVersion: meta.rulesVersion,
          createdAt: now,
          updatedAt: now,
          publicState: {
            message: 'Hãy chọn Tài (11..17) hoặc Xỉu (4..10) để bắt đầu lắc xúc xắc!'
          },
          actions: []
        };
        break;
      }

      case 'animal_guess': {
        session = {
          sessionId,
          gameId,
          userId,
          characterId,
          status: 'active',
          rulesVersion: meta.rulesVersion,
          createdAt: now,
          updatedAt: now,
          publicState: {
            message: 'Hãy chọn 1 trong 6 linh vật (Bầu, Cua, Cá, Cọp, Gà, Nai) để mở quẻ!'
          },
          actions: []
        };
        break;
      }
    }

    this.sessions.set(sessionId, session);

    // Track user history list
    const historyList = this.userHistory.get(userId) ?? [];
    historyList.push(sessionId);
    this.userHistory.set(userId, historyList);

    return this.toPublicSession(session);
  }

  /**
   * Processes a player action authoritatively.
   * Enforces idempotency via actionId.
   */
  processAction(params: {
    sessionId: string;
    userId: string;
    actionId: string;
    type: string;
    payload?: unknown;
  }): MinigamePublicSession {
    const { sessionId, userId, actionId, type, payload } = params;

    if (!actionId || typeof actionId !== 'string') {
      throw new Error('MALFORMED_ACTION: actionId is required.');
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`SESSION_NOT_FOUND: Session ${sessionId} does not exist.`);
    }

    if (session.userId !== userId) {
      throw new Error(`FORBIDDEN: User ${userId} is not authorized for session ${sessionId}.`);
    }

    // Idempotency: return cached response if action was already applied
    const idempotencyKey = `${sessionId}:${actionId}`;
    const cached = this.idempotencyCache.get(idempotencyKey);
    if (cached) {
      return cached;
    }

    if (session.status !== 'active') {
      throw new Error(`INVALID_STATE: Cannot execute action '${type}' on session in '${session.status}' status.`);
    }

    const now = Date.now();
    session.updatedAt = now;

    switch (session.gameId) {
      case '7321': {
        if (type !== 'hit' && type !== 'stand') {
          throw new Error(`INVALID_ACTION_TYPE: Action '${type}' is invalid for 7321.`);
        }
        const currentPublic = session.publicState as SevenThreeTwoOnePublicState;
        const currentSecret = session.secretState as SevenThreeTwoOneSecretState;

        const actionResult = executeAction7321(currentPublic, currentSecret, type);
        session.publicState = actionResult.publicState;
        session.secretState = actionResult.secretState;

        if (actionResult.isResolved) {
          session.status = 'resolved';
          session.resolvedAt = now;
          session.result = actionResult.result;
        }
        break;
      }

      case 'lucky_dice': {
        if (type !== 'choose_dice') {
          throw new Error(`INVALID_ACTION_TYPE: Action '${type}' is invalid for Lucky Dice.`);
        }
        const input = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
        const choice = (input.choice ?? (payload as string)) as DiceChoice;

        if (choice !== 'tai' && choice !== 'xiu') {
          throw new Error(`INVALID_PAYLOAD: choice must be 'tai' or 'xiu', got '${String(choice)}'.`);
        }

        const roundResult = playLuckyDice(choice);
        session.publicState = roundResult.publicState;
        session.status = 'resolved';
        session.resolvedAt = now;
        session.result = roundResult.result;
        break;
      }

      case 'animal_guess': {
        if (type !== 'choose_symbol') {
          throw new Error(`INVALID_ACTION_TYPE: Action '${type}' is invalid for Animal Guess.`);
        }
        const input = (payload && typeof payload === 'object') ? (payload as Record<string, unknown>) : {};
        const symbol = (input.symbol ?? (payload as string)) as AnimalSymbol;

        if (!ANIMAL_SYMBOLS.includes(symbol)) {
          throw new Error(`INVALID_PAYLOAD: symbol must be one of [${ANIMAL_SYMBOLS.join(', ')}], got '${String(symbol)}'.`);
        }

        const roundResult = playAnimalGuess(symbol);
        session.publicState = roundResult.publicState;
        session.status = 'resolved';
        session.resolvedAt = now;
        session.result = roundResult.result;
        break;
      }

      default:
        throw new Error(`Unsupported game: ${session.gameId}`);
    }

    session.actions.push({
      actionId,
      type,
      payload,
      timestamp: now
    });

    const publicSession = this.toPublicSession(session);
    this.idempotencyCache.set(idempotencyKey, publicSession);
    return publicSession;
  }

  /**
   * Resolves a session and issues the reward receipt atomically.
   */
  resolveSession(params: {
    sessionId: string;
    userId: string;
    actionId?: string;
  }): { session: MinigamePublicSession; reward: MinigamePublicSession['reward'] } {
    const { sessionId, userId, actionId } = params;

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`SESSION_NOT_FOUND: Session ${sessionId} does not exist.`);
    }

    if (session.userId !== userId) {
      throw new Error(`FORBIDDEN: User ${userId} is not authorized for session ${sessionId}.`);
    }

    if (session.status === 'rewarded') {
      // Already rewarded: return cached state and reward receipt idempotently
      return {
        session: this.toPublicSession(session),
        reward: session.reward
      };
    }

    if (session.status !== 'resolved') {
      throw new Error(`SESSION_NOT_RESOLVED: Session ${sessionId} must be resolved before claiming rewards (current status: ${session.status}).`);
    }

    const receipt = rewardService.issueReward(session);
    session.reward = receipt;
    session.status = 'rewarded';
    session.updatedAt = Date.now();

    const publicSession = this.toPublicSession(session);

    if (actionId) {
      this.idempotencyCache.set(`${sessionId}:${actionId}`, publicSession);
    }

    return {
      session: publicSession,
      reward: receipt
    };
  }

  /**
   * Retrieves the raw session object.
   */
  getSession(sessionId: string): MinigameSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Retrieves the sanitized public session.
   */
  getPublicSession(sessionId: string): MinigamePublicSession | undefined {
    const session = this.sessions.get(sessionId);
    return session ? this.toPublicSession(session) : undefined;
  }

  /**
   * Retrieves paginated session history for a user.
   */
  getUserHistory(params: {
    userId: string;
    page?: number;
    limit?: number;
    gameId?: MinigameId;
  }): { history: MinigamePublicSession[]; total: number; page: number; limit: number } {
    const { userId, page = 1, limit = 10, gameId } = params;
    const sessionIds = this.userHistory.get(userId) ?? [];

    let list = sessionIds
      .map((id) => this.sessions.get(id))
      .filter((s): s is MinigameSession => s !== undefined)
      .filter((s) => s.status === 'resolved' || s.status === 'rewarded');

    if (gameId) {
      list = list.filter((s) => s.gameId === gameId);
    }

    // Sort descending by creation time
    list.sort((a, b) => b.createdAt - a.createdAt);

    const total = list.length;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    return {
      history: paginated.map((s) => this.toPublicSession(s)),
      total,
      page,
      limit
    };
  }

  /**
   * Converts a private MinigameSession to a secure, sanitized MinigamePublicSession.
   * Strips secretState and includes remaining daily plays.
   */
  private toPublicSession(session: MinigameSession): MinigamePublicSession {
    const remainingPlays = this.getRemainingDailyPlays(session.userId, session.gameId);

    return {
      sessionId: session.sessionId,
      gameId: session.gameId,
      userId: session.userId,
      characterId: session.characterId,
      status: session.status,
      rulesVersion: session.rulesVersion,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      resolvedAt: session.resolvedAt,
      publicState: session.publicState,
      remainingDailyPlays: remainingPlays,
      result: session.result,
      reward: session.reward
    };
  }

  /**
   * Resets all internal stores (useful for testing).
   */
  resetForTesting(): void {
    this.sessions.clear();
    this.userHistory.clear();
    this.dailyUsage.clear();
    this.idempotencyCache.clear();
  }
}

export const sessionManager = new SessionManager();
