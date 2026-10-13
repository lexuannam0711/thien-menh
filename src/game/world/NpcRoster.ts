import { NAMED_NPCS } from '../../data/contentCatalog';
import { getChapterWorldConfig } from './ChapterWorld';

export function getVillageNpcs(chapter: number) {
  const area = getChapterWorldConfig(chapter).areaId;
  const positions = [{ x: 290, y: 263 }, { x: 518, y: 309 }, { x: 697, y: 271 },
    { x: 225, y: 390 }, { x: 360, y: 400 }, { x: 550, y: 400 }, { x: 835, y: 190 }];
  const colors = [0xc0a275, 0xc27f61, 0x8576aa, 0x648b9d, 0x6b945b, 0xa49862, 0x935a66];
  return NAMED_NPCS.filter(npc => npc.areaId === 'lang-lac-thuy' || npc.areaId === area)
    .map((npc, index) => ({ ...npc, ...positions[index], color: colors[index] }));
}
