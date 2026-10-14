/**
 * RulesRegistry
 * Registry of authoritative minigames, metadata, reward tables, and odds.
 */

import {
  type MinigameId,
  type GameMetadata
} from './types.js';

export const GAME_METADATA_MAP: Record<MinigameId, GameMetadata> = {
  '7321': {
    id: '7321',
    title: '7321',
    npcId: 'npc_thay_the_lac',
    npcName: 'Thầy Thẻ Lạc',
    description: 'Trò đấu thẻ bài cổ xưa với mục tiêu 21 điểm. Người chơi nhận 2 thẻ, lựa chọn Rút (HIT) hoặc Dừng (STAND) để so điểm cùng Nhà cái.',
    dailyLimit: 3,
    rulesVersion: '1.0.0',
    oddsDescription: 'Bộ bài 52 lá không joker, xáo bằng CSPRNG Fisher-Yates không thiên vị. Nhà cái dừng ở soft 17.',
    rewardTiers: [
      { condition: 'Thắng ván đấu (hoặc 21 tự nhiên)', participationPoints: 5, bonusPoints: 15, totalPoints: 20, probabilityDesc: 'Biến động theo chiến thuật chơi (~42-45%)' },
      { condition: 'Hòa điểm với Nhà cái', participationPoints: 5, bonusPoints: 5, totalPoints: 10, probabilityDesc: '~8-9%' },
      { condition: 'Thua điểm hoặc Quắc (>21)', participationPoints: 5, bonusPoints: 0, totalPoints: 5, probabilityDesc: '~47-49%' }
    ]
  },
  'lucky_dice': {
    id: 'lucky_dice',
    title: 'Xúc Xắc May Mắn',
    npcId: 'npc_lao_dong_xuc',
    npcName: 'Lão Đồng Xúc',
    description: 'Dự đoán tổng 3 xúc xắc cổ. Xỉu từ 4 đến 10, Tài từ 11 đến 17. Bộ ba đồng số nhận thưởng bảo lưu đặc biệt.',
    dailyLimit: 3,
    rulesVersion: '1.0.0',
    oddsDescription: '216 tổ hợp độc lập: Xỉu 105/216 (48.61%), Tài 105/216 (48.61%), Bộ ba đồng số 6/216 (2.78%).',
    rewardTiers: [
      { condition: 'Đoán đúng Tài hoặc Xỉu', participationPoints: 5, bonusPoints: 10, totalPoints: 15, probabilityDesc: '105/216 (48.61%)' },
      { condition: 'Bộ ba đồng số (Hòa đặc biệt)', participationPoints: 5, bonusPoints: 5, totalPoints: 10, probabilityDesc: '6/216 (2.78%)' },
      { condition: 'Đoán sai cửa', participationPoints: 5, bonusPoints: 0, totalPoints: 5, probabilityDesc: '105/216 (48.61%)' }
    ]
  },
  'animal_guess': {
    id: 'animal_guess',
    title: 'Nhìn Hình Đoán Thú',
    npcId: 'npc_nang_hoa_linh',
    npcName: 'Nàng Họa Linh',
    description: 'Chọn 1 trong 6 linh vật truyền thống (Bầu, Cua, Cá, Cọp, Gà, Nai). Ba viên linh hình quay ngẫu nhiên mở quẻ.',
    dailyLimit: 3,
    rulesVersion: '1.0.0',
    oddsDescription: 'Xác suất trúng ít nhất 1 linh vật: 1 - (5/6)^3 = 91/216 ≈ 42.13% (1 con: 34.72%, 2 con: 6.94%, 3 con: 0.46%).',
    rewardTiers: [
      { condition: 'Trúng cả 3 linh vật', participationPoints: 5, bonusPoints: 45, totalPoints: 50, probabilityDesc: '1/216 (0.46%)' },
      { condition: 'Trúng 2 linh vật', participationPoints: 5, bonusPoints: 20, totalPoints: 25, probabilityDesc: '15/216 (6.94%)' },
      { condition: 'Trúng 1 linh vật', participationPoints: 5, bonusPoints: 8, totalPoints: 13, probabilityDesc: '75/216 (34.72%)' },
      { condition: 'Không trúng linh vật nào', participationPoints: 5, bonusPoints: 0, totalPoints: 5, probabilityDesc: '125/216 (57.87%)' }
    ]
  }
};

export class RulesRegistry {
  getAllGames(): GameMetadata[] {
    return Object.values(GAME_METADATA_MAP);
  }

  getGameMetadata(gameId: MinigameId): GameMetadata {
    const meta = GAME_METADATA_MAP[gameId];
    if (!meta) {
      throw new Error(`Unrecognized minigame ID: ${gameId}`);
    }
    return meta;
  }

  isValidGameId(gameId: unknown): gameId is MinigameId {
    return typeof gameId === 'string' && gameId in GAME_METADATA_MAP;
  }
}

export const rulesRegistry = new RulesRegistry();
