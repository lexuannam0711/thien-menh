import { BALANCE } from '../../data/config';

export type QuestStage = 'new' | 'active' | 'return' | 'complete';
export interface SaveData {
  version: 1;
  hp: number; mp: number; maxHp: number; maxMp: number;
  attack: number; level: number; xp: number; gold: number;
  kills: number; quest: QuestStage; bossDead: boolean;
  upgrades: number;
}
const SAVE_KEY = 'than-menh-van-lang-mvp-v1';
export const newSave = (): SaveData => ({
  version: 1, hp: BALANCE.hp, mp: BALANCE.mp,
  maxHp: BALANCE.hp, maxMp: BALANCE.mp, attack: BALANCE.attack,
  level: 1, xp: 0, gold: 0, kills: 0, quest: 'new',
  bossDead: false, upgrades: 0,
});

class GameState {
  data: SaveData = newSave();

  load(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const candidate: unknown = JSON.parse(raw);
      if (candidate && typeof candidate === 'object' &&
          'version' in candidate && candidate.version === 1 &&
          'quest' in candidate && typeof candidate.quest === 'string') {
        this.data = { ...newSave(), ...(candidate as Partial<SaveData>) };
      }
    } catch { /* Private-mode or malformed save: use in-memory data. */ }
  }

  save(): void {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); }
    catch { /* Saving is optional when browser storage is unavailable. */ }
  }

  reset(): void {
    this.data = newSave();
    this.save();
  }

  earn(reward: number, xp: number): boolean {
    const s = this.data;
    s.gold += reward;
    s.xp += xp;
    let levelled = false;
    while (s.xp >= 45 + s.level * 15) {
      s.xp -= 45 + s.level * 15;
      s.level++;
      s.maxHp += 10;
      s.maxMp += 5;
      s.attack += 2;
      s.hp = s.maxHp;
      s.mp = s.maxMp;
      levelled = true;
    }
    this.save();
    return levelled;
  }
}

export const gameState = new GameState();
