/**
 * Authoritative RewardService
 * Calculates FestivalPoints and issues unique cryptographic receipts.
 * Strictly non-cash, virtual festival points only.
 */

import {
  type MinigameId,
  type GameOutcome,
  type RewardReceipt,
  type MinigameSession
} from './types.js';
import { generateReceiptId } from './CSPRNG.js';

export const PARTICIPATION_POINTS = 5;

export interface RewardBreakdown {
  participationPoints: number;
  bonusPoints: number;
  totalPoints: number;
  summary: string;
}

/**
 * Calculates reward points based on game outcome.
 */
export function calculatePoints(
  gameId: MinigameId,
  outcome: GameOutcome
): RewardBreakdown {
  const participation = PARTICIPATION_POINTS;
  let bonus = 0;
  let summary = '';

  switch (gameId) {
    case '7321': {
      if (outcome === 'player_won') {
        bonus = 15;
        summary = 'Thắng 7321 (+15 điểm) + Tham gia (+5 điểm)';
      } else if (outcome === 'tie') {
        bonus = 5;
        summary = 'Hòa 7321 (+5 điểm) + Tham gia (+5 điểm)';
      } else {
        bonus = 0;
        summary = 'Tham gia 7321 (+5 điểm)';
      }
      break;
    }

    case 'lucky_dice': {
      if (outcome === 'player_won') {
        bonus = 10;
        summary = 'Đoán đúng Xúc Xắc (+10 điểm) + Tham gia (+5 điểm)';
      } else if (outcome === 'special_triple') {
        bonus = 5;
        summary = 'Bộ ba đồng số đặc biệt (+5 điểm) + Tham gia (+5 điểm)';
      } else {
        bonus = 0;
        summary = 'Tham gia Xúc Xắc May Mắn (+5 điểm)';
      }
      break;
    }

    case 'animal_guess': {
      if (outcome === 'match_3') {
        bonus = 45;
        summary = 'Trúng 3 hình linh vật (+45 điểm) + Tham gia (+5 điểm)';
      } else if (outcome === 'match_2') {
        bonus = 20;
        summary = 'Trúng 2 hình linh vật (+20 điểm) + Tham gia (+5 điểm)';
      } else if (outcome === 'match_1') {
        bonus = 8;
        summary = 'Trúng 1 hình linh vật (+8 điểm) + Tham gia (+5 điểm)';
      } else {
        bonus = 0;
        summary = 'Tham gia Nhìn Hình Đoán Thú (+5 điểm)';
      }
      break;
    }

    default:
      throw new Error(`Unknown game ID: ${gameId}`);
  }

  return {
    participationPoints: participation,
    bonusPoints: bonus,
    totalPoints: participation + bonus,
    summary
  };
}

export class RewardService {
  /**
   * Generates or retrieves an existing idempotent reward receipt for a completed session.
   */
  issueReward(session: MinigameSession): RewardReceipt {
    // Idempotency: return existing receipt if already rewarded
    if (session.reward) {
      return session.reward;
    }

    if (session.status !== 'resolved' || !session.result) {
      throw new Error(`Cannot issue reward: session ${session.sessionId} is not in 'resolved' status (current: ${session.status})`);
    }

    const breakdown = calculatePoints(session.gameId, session.result.outcome);
    const receipt: RewardReceipt = {
      receiptId: generateReceiptId(session.sessionId),
      sessionId: session.sessionId,
      userId: session.userId,
      gameId: session.gameId,
      participationPoints: breakdown.participationPoints,
      bonusPoints: breakdown.bonusPoints,
      totalPoints: breakdown.totalPoints,
      claimedAt: Date.now()
    };

    return receipt;
  }
}

export const rewardService = new RewardService();
