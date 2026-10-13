import type { SaveData } from './GameState';

export function isFinalChapter(save: Pick<SaveData, 'chapter'>): boolean {
  return save.chapter >= 4;
}

export function advanceAfterVictory(save: SaveData): SaveData {
  if (isFinalChapter(save)) return save;
  return {
    ...save,
    chapter: save.chapter + 1,
    quest: 'new',
    kills: 0,
    bossDead: false,
    checkpoint: 'village-gate',
  };
}
