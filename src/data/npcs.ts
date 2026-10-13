export type NpcService = 'quest' | 'smith' | 'healer';

export interface NpcDefinition {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly dialogues: readonly string[];
  readonly services: readonly NpcService[];
  readonly questIds: readonly string[];
}

export const NPCS: readonly NpcDefinition[] = [
  {
    id: 'village-chief',
    name: 'Trưởng làng Hùng',
    role: 'Người giữ lời thề Văn Lang',
    dialogues: ['Rừng trúc đang dậy yêu khí.', 'Con hãy giữ bình an cho dân làng.'],
    services: ['quest'],
    questIds: ['hunt-ho-yeu'],
  },
  {
    id: 'village-smith',
    name: 'Thợ rèn Bách Việt',
    role: 'Rèn vũ khí và giáp',
    dialogues: ['Đồng tốt phải qua lửa mới thành binh khí.'],
    services: ['smith'],
    questIds: [],
  },
  {
    id: 'village-healer',
    name: 'Bà Mo',
    role: 'Người giữ thảo dược',
    dialogues: ['Thiên mệnh còn sáng thì thương tích còn lành.'],
    services: ['healer'],
    questIds: [],
  },
];

export const NPCS_BY_ID: Readonly<Record<string, NpcDefinition>> = Object.fromEntries(
  NPCS.map((npc) => [npc.id, npc]),
);

export function getNpc(npcId: string): NpcDefinition | undefined {
  return NPCS_BY_ID[npcId];
}