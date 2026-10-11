export const W = 960;
export const H = 540;
export const UI_DEPTH = 2000;
export const PALETTE = {
  sky: 0x122d2c, forest: 0x274b35, grass: 0x547346, dirt: 0xb99a65,
  bronze: 0xc9a46a, cream: '#f0e4c5', muted: '#b6c4a8',
  red: 0xf26e62, blue: 0x7ccbdc, gold: 0xf3c66f,
};

export type EnemyKind = 'moc-tinh' | 'ma-troi' | 'ho-yeu';

export const ENEMIES: Record<EnemyKind, {
  name: string; hp: number; speed: number; attack: number;
  range: number; reward: number; xp: number; color: number; radius: number;
}> = {
  'moc-tinh': { name: 'Mộc Tinh', hp: 43, speed: 66, attack: 8, range: 37, reward: 7, xp: 12, color: 0x7d9852, radius: 22 },
  'ma-troi': { name: 'Ma Trơi', hp: 29, speed: 88, attack: 6, range: 38, reward: 6, xp: 10, color: 0x7dcbd2, radius: 18 },
  'ho-yeu': { name: 'Hổ Yêu U Minh', hp: 285, speed: 76, attack: 19, range: 65, reward: 65, xp: 110, color: 0xd4a160, radius: 38 },
};

export const BALANCE = {
  attack: 12, hp: 100, mp: 100, speed: 190,
  comboWindowMs: 690, dodgeCooldownMs: 1200, dodgeDurationMs: 190,
  earthCost: 30, earthCooldownMs: 5000,
  flameCost: 20, flameCooldownMs: 3000,
  requiredKills: 6, smithCost: 30, smithAttackGain: 4,
};
