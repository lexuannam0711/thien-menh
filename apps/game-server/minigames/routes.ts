/**
 * Minigames Express Router
 * Authoritative API endpoints for 7321, Lucky Dice, and Animal Guess.
 */

import { Router, type Request, type Response } from 'express';
import { type MinigameId } from './types.js';
import { sessionManager, getVietnamDate } from './SessionManager.js';
import { rulesRegistry } from './RulesRegistry.js';

export type AuthVerifier = (authorization: unknown) => Promise<{ sub: string }>;

/**
 * Extracts userId from JWT Authorization header or X-User-Id header (for dev/testing).
 */
export async function authenticateRequest(
  req: Request,
  verifier?: AuthVerifier
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (authHeader && verifier) {
    try {
      const claims = await verifier(authHeader);
      return claims.sub;
    } catch {
      return null;
    }
  }

  // Fallback for development/testing environments
  const xUserId = req.headers['x-user-id'];
  if (typeof xUserId === 'string' && xUserId.trim().length > 0) {
    return xUserId.trim();
  }

  return null;
}

export function createMinigameRouter(verifier?: AuthVerifier): Router {
  const router = Router();

  /**
   * GET /api/minigames/list
   * Returns list of games, metadata, and user remaining daily plays.
   */
  router.get('/list', async (req: Request, res: Response) => {
    try {
      const userId = await authenticateRequest(req, verifier);
      const games = rulesRegistry.getAllGames().map((game) => {
        const remaining = userId
          ? sessionManager.getRemainingDailyPlays(userId, game.id)
          : game.dailyLimit;
        return {
          ...game,
          remainingDailyPlays: remaining
        };
      });

      res.status(200).json({
        ok: true,
        serverTime: Date.now(),
        vietnamDate: getVietnamDate(),
        games
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message });
    }
  });

  /**
   * GET /api/minigames/rewards
   * Returns payout tables, probabilities, and rules description.
   */
  router.get('/rewards', (req: Request, res: Response) => {
    try {
      const gameId = req.query.gameId as string | undefined;
      if (gameId) {
        if (!rulesRegistry.isValidGameId(gameId)) {
          res.status(400).json({ ok: false, error: 'INVALID_GAME_ID', message: `Unknown game ID: ${gameId}` });
          return;
        }
        const meta = rulesRegistry.getGameMetadata(gameId);
        res.status(200).json({
          ok: true,
          gameId: meta.id,
          title: meta.title,
          description: meta.description,
          oddsDescription: meta.oddsDescription,
          rewardTiers: meta.rewardTiers
        });
        return;
      }

      const allRewards = rulesRegistry.getAllGames().map((g) => ({
        gameId: g.id,
        title: g.title,
        description: g.description,
        oddsDescription: g.oddsDescription,
        rewardTiers: g.rewardTiers
      }));

      res.status(200).json({ ok: true, rewards: allRewards });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message });
    }
  });

  /**
   * POST /api/minigames/start
   * Starts a new authoritative minigame session.
   */
  router.post('/start', async (req: Request, res: Response) => {
    try {
      const userId = await authenticateRequest(req, verifier);
      if (!userId) {
        res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Authentication required to start minigame.' });
        return;
      }

      const { gameId, characterId, requestId } = req.body ?? {};
      if (!rulesRegistry.isValidGameId(gameId)) {
        res.status(400).json({ ok: false, error: 'INVALID_GAME_ID', message: `Game '${String(gameId)}' is not valid.` });
        return;
      }

      const session = sessionManager.startSession({
        userId,
        characterId,
        gameId,
        requestId
      });

      res.status(201).json({ ok: true, session });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('DAILY_LIMIT_EXCEEDED')) {
        res.status(429).json({ ok: false, error: 'DAILY_LIMIT_EXCEEDED', message });
        return;
      }
      res.status(400).json({ ok: false, error: 'START_FAILED', message });
    }
  });

  /**
   * POST /api/minigames/action
   * Executes an authoritative game action (hit/stand, choose_dice, choose_symbol).
   */
  router.post('/action', async (req: Request, res: Response) => {
    try {
      const userId = await authenticateRequest(req, verifier);
      if (!userId) {
        res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Authentication required.' });
        return;
      }

      const { sessionId, actionId, type, payload } = req.body ?? {};
      if (!sessionId || !actionId || !type) {
        res.status(400).json({
          ok: false,
          error: 'MISSING_FIELDS',
          message: 'sessionId, actionId, and type are required.'
        });
        return;
      }

      const session = sessionManager.processAction({
        sessionId,
        userId,
        actionId,
        type,
        payload
      });

      res.status(200).json({ ok: true, session });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('FORBIDDEN')) {
        res.status(403).json({ ok: false, error: 'FORBIDDEN', message });
        return;
      }
      if (message.includes('SESSION_NOT_FOUND')) {
        res.status(404).json({ ok: false, error: 'SESSION_NOT_FOUND', message });
        return;
      }
      res.status(400).json({ ok: false, error: 'ACTION_FAILED', message });
    }
  });

  /**
   * POST /api/minigames/resolve
   * Chốt phiên và phát thưởng FestivalPoints (idempotent receipt).
   */
  router.post('/resolve', async (req: Request, res: Response) => {
    try {
      const userId = await authenticateRequest(req, verifier);
      if (!userId) {
        res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Authentication required.' });
        return;
      }

      const { sessionId, actionId } = req.body ?? {};
      if (!sessionId) {
        res.status(400).json({ ok: false, error: 'MISSING_FIELDS', message: 'sessionId is required.' });
        return;
      }

      const result = sessionManager.resolveSession({
        sessionId,
        userId,
        actionId
      });

      res.status(200).json({
        ok: true,
        session: result.session,
        reward: result.reward
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('FORBIDDEN')) {
        res.status(403).json({ ok: false, error: 'FORBIDDEN', message });
        return;
      }
      if (message.includes('SESSION_NOT_FOUND')) {
        res.status(404).json({ ok: false, error: 'SESSION_NOT_FOUND', message });
        return;
      }
      if (message.includes('SESSION_NOT_RESOLVED')) {
        res.status(400).json({ ok: false, error: 'SESSION_NOT_RESOLVED', message });
        return;
      }
      res.status(400).json({ ok: false, error: 'RESOLVE_FAILED', message });
    }
  });

  /**
   * GET /api/minigames/history
   * Retrieves player's personal session history.
   */
  router.get('/history', async (req: Request, res: Response) => {
    try {
      const userId = await authenticateRequest(req, verifier);
      if (!userId) {
        res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: 'Authentication required.' });
        return;
      }

      const page = req.query.page ? Math.max(1, Number.parseInt(req.query.page as string, 10)) : 1;
      const limit = req.query.limit ? Math.min(50, Math.max(1, Number.parseInt(req.query.limit as string, 10))) : 10;
      const gameId = req.query.gameId as MinigameId | undefined;

      const historyData = sessionManager.getUserHistory({
        userId,
        page,
        limit,
        gameId
      });

      res.status(200).json({
        ok: true,
        ...historyData
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message });
    }
  });

  return router;
}
