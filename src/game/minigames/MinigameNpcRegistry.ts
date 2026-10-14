/**
 * Trò chơi: Thần Mệnh — Hậu Duệ Văn Lang
 * Minigame NPC Registry: Quản lý danh sách Festival NPCs tổ chức minigame
 * 
 * 3 NPC Lễ hội Làng Lạc Thủy:
 * 1. Thầy Thẻ Lạc (game: 7321)
 * 2. Lão Đồng Xúc (game: lucky_dice)
 * 3. Nàng Họa Linh (game: animal_guess)
 * 
 * LƯU Ý: Giữ độc lập với NAMED_NPCS trong contentCatalog.ts để bảo vệ 15 story NPCs.
 */

import type { MinigameId } from './MinigameTypes';
import { MINIGAME_TEXTURE_KEYS } from './MinigameArtwork';

export interface FestivalNpc {
  id: 'thay-the-lac' | 'lao-dong-xuc' | 'nang-hoa-linh' | string;
  name: string;
  title: string;
  role: string;
  gameId: MinigameId;
  x: number;
  y: number;
  position: { x: number; y: number };
  dialogue: string;
  dialogues: string[];
  lore: string;
  portraitKey: string;
  color: number;
}

export const FESTIVAL_NPCS: readonly FestivalNpc[] = Object.freeze([
  {
    id: 'thay-the-lac',
    name: 'Thầy Thẻ Lạc',
    title: 'Người Giữ Thẻ Cổ Văn Lang',
    role: 'Người Giữ Thẻ Cổ Văn Lang',
    gameId: '7321',
    x: 380,
    y: 220,
    position: { x: 380, y: 220 },
    dialogue: 'Thử vận may với những lá thẻ Văn Lang chứ? Hãy nhớ: tham thêm một lá có thể mất cả lượt!',
    dialogues: ['Thử vận may với những lá thẻ Văn Lang chứ? Hãy nhớ: tham thêm một lá có thể mất cả lượt!'],
    lore: 'Ẩn sĩ nắm giữ bộ thẻ bài đồng cổ 52 lá, tương truyền là trò so tài trí tuệ và sự kiềm chế của tổ tiên.',
    portraitKey: MINIGAME_TEXTURE_KEYS.npcThayTheLac,
    color: 0xc6a66b,
  },
  {
    id: 'lao-dong-xuc',
    name: 'Lão Đồng Xúc',
    title: 'Chủ Sạp Xúc Xắc Đồng',
    role: 'Chủ Sạp Xúc Xắc Đồng',
    gameId: 'lucky_dice',
    x: 620,
    y: 225,
    position: { x: 620, y: 225 },
    dialogue: 'Ba viên xúc xắc, một lần dự đoán. Chọn theo cách của ngươi!',
    dialogues: ['Ba viên xúc xắc, một lần dự đoán. Chọn theo cách của ngươi!'],
    lore: 'Thợ đúc đồng rành nghề, chế tác bộ ba xúc xắc đồng ngũ sắc linh nghiệm cho những dịp lễ hội làng.',
    portraitKey: MINIGAME_TEXTURE_KEYS.npcLaoDongXuc,
    color: 0x8a6248,
  },
  {
    id: 'nang-hoa-linh',
    name: 'Nàng Họa Linh',
    title: 'Nghệ Nhân Linh Vật Dân Gian',
    role: 'Nghệ Nhân Linh Vật Dân Gian',
    gameId: 'animal_guess',
    x: 740,
    y: 360,
    position: { x: 740, y: 360 },
    dialogue: 'Hãy chọn hình mà ngươi tin sẽ xuất hiện. Ba viên linh hình sẽ trả lời!',
    dialogues: ['Hãy chọn hình mà ngươi tin sẽ xuất hiện. Ba viên linh hình sẽ trả lời!'],
    lore: 'Nghệ nhân tài hoa vẽ 6 linh vật Bách Việt: Bầu, Cua, Cá, Cọp, Gà, Nai trên các tấm thẻ gỗ.',
    portraitKey: MINIGAME_TEXTURE_KEYS.npcNangHoaLinh,
    color: 0x497459,
  },
]);

/**
 * Trả về danh sách 3 Festival NPCs minigame trong Làng Lạc Thủy
 */
export function getFestivalNpcs(): readonly FestivalNpc[] {
  return FESTIVAL_NPCS;
}

/**
 * Tìm Festival NPC theo id ('thay-the-lac' | 'lao-dong-xuc' | 'nang-hoa-linh')
 */
export function getFestivalNpcById(id: string): FestivalNpc | undefined {
  return FESTIVAL_NPCS.find((npc) => npc.id === id);
}

/**
 * Tìm Festival NPC theo gameId ('7321' | 'lucky_dice' | 'animal_guess')
 */
export function getFestivalNpcByGameId(gameId: MinigameId | string): FestivalNpc | undefined {
  return FESTIVAL_NPCS.find((npc) => npc.gameId === gameId);
}
