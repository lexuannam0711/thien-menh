import type { BossId } from './bosses';

export interface ChapterDefinition {
  readonly id: number;
  readonly title: string;
  readonly area: string;
  readonly bossId: BossId;
  readonly objective: string;
}

export const CHAPTERS: readonly ChapterDefinition[] = [
  { id: 1, title: 'Điềm Dữ Rừng Trúc', area: 'Rừng Trúc U Minh', bossId: 'ho-yeu', objective: 'Thanh tẩy yêu khí và bảo vệ làng Lạc Thủy.' },
  { id: 2, title: 'Bóng Đen Đầm Thiêng', area: 'Đầm Thiêng', bossId: 'thuong-luong', objective: 'Giải lời nguyền đang nhấn chìm vùng đầm.' },
  { id: 3, title: 'Lời Nguyền Núi Thiêng', area: 'Núi Tản Viên', bossId: 'thach-tuong', objective: 'Vượt qua thử thách của linh lực núi thiêng.' },
  { id: 4, title: 'Thiên Mệnh Văn Lang', area: 'Phong Châu', bossId: 'hac-an', objective: 'Đối mặt nguồn bóng tối và hoàn thành Thiên Mệnh.' },
];

export const getChapter = (id: number): ChapterDefinition =>
  CHAPTERS.find((chapter) => chapter.id === id) ?? CHAPTERS[CHAPTERS.length - 1];
