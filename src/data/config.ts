import { COMMON_ENEMIES, ELITES } from './contentCatalog';

export const W = 960;
export const H = 540;
export const UI_DEPTH = 2000;
export const PALETTE = {
  sky: 0x122d2c, forest: 0x274b35, grass: 0x547346, dirt: 0xb99a65,
  bronze: 0xc9a46a, cream: '#f0e4c5', muted: '#b6c4a8',
  red: 0xf26e62, blue: 0x7ccbdc, gold: 0xf3c66f,
};

export type EnemyRole = 'melee' | 'ranged' | 'charge' | 'ambush';

const ENEMY_METADATA = {
  'moc-tinh-con': { role: 'melee', questTags: ['moc-tinh', 'corrupt-root', 'field-pest'] },
  'ma-troi-u-am': { role: 'ranged', questTags: ['ma-troi', 'mourning-wraith'] },
  'soi-rung-hac-am': { role: 'charge', questTags: ['forest-badger', 'cave-beast'] },
  'dia-yeu-canh-truc': { role: 'ambush', questTags: ['forest-spider', 'wild-crow', 'copper-thief'] },
  'thuy-quai-tam-ngu': { role: 'ranged', questTags: ['water-fiend', 'ngu-tinh-spawn', 'river-monster'] },
  'dia-dia-khong-lo': { role: 'ambush', questTags: ['marsh-lurker'] },
  'bo-cap-dam-lay': { role: 'melee', questTags: ['marsh-lurker', 'poison-toad'] },
  'thach-hau-cuong-bao': { role: 'charge', questTags: ['mountain-beast', 'cave-beast'] },
  'dieu-sat-tan-vien': { role: 'ambush', questTags: ['mountain-beast', 'wild-crow', 'corrupt-root'] },
  'thach-binh-co': { role: 'melee', questTags: ['stone-guardian', 'golem-scout', 'ruin-guardian', 'mourning-wraith'] },
  'hac-an-ve-si': { role: 'melee', questTags: ['court-infiltrator', 'dark-cultist', 'citadel-looter'] },
  'u-linh-cung-thu': { role: 'ranged', questTags: ['void-shade', 'dark-cultist', 'drum-ambusher'] },
  'bach-trao-ho-ma': { role: 'charge', questTags: ['forest-badger'] },
  'giao-long-thuy-than': { role: 'ranged', questTags: ['water-fiend', 'river-monster'] },
  'thach-giap-nguu-ma': { role: 'charge', questTags: ['mountain-beast', 'stone-guardian'] },
  'am-anh-quy-vuong': { role: 'ambush', questTags: ['void-shade', 'court-infiltrator', 'mourning-wraith'] },
} as const satisfies Record<string, { readonly role: EnemyRole; readonly questTags: readonly string[] }>;

export type EnemyKind = keyof typeof ENEMY_METADATA | 'moc-tinh' | 'ma-troi' | 'ho-yeu';

export interface EnemyStats {
  readonly name: string; readonly hp: number; readonly speed: number; readonly attack: number; readonly defense: number;
  readonly range: number; readonly reward: number; readonly xp: number; readonly color: number;
  readonly radius: number; readonly scale: number; readonly role: EnemyRole;
  readonly elite: boolean; readonly areaId: string; readonly questTags: readonly string[];
}

const runtimeRoster = Object.fromEntries([...COMMON_ENEMIES, ...ELITES].map((source, index) => {
  const metadata = ENEMY_METADATA[source.id as keyof typeof ENEMY_METADATA];
  if (!metadata) throw new Error('Missing enemy metadata: ' + source.id);
  const elite = ELITES.some(enemy => enemy.id === source.id);
  const radius = (metadata.role === 'ranged' ? 18 : metadata.role === 'charge' ? 25 : 22) + (elite ? 7 : 0);
  const colors = [0x7d9852, 0x7dcbd2, 0x967cb4, 0xc784a6, 0x61b9cb, 0x8d9c58, 0xab7855,
    0xa9a0a0, 0xd0b978, 0x869fbb, 0xaf638c, 0xa397df, 0xebbf87, 0x50d4cd, 0xcd9c72, 0xd385df];
  return [source.id, Object.freeze({ name: source.name, hp: source.hp, speed: source.speed,
    attack: source.attack, defense: source.defense, range: metadata.role === 'ranged' ? 38 : 37 + (elite ? 12 : 0),
    reward: source.goldReward, xp: source.xpReward, color: colors[index], radius,
    scale: radius / 22, role: metadata.role, elite, areaId: source.areaId,
    questTags: Object.freeze([...metadata.questTags]) })];
})) as Record<keyof typeof ENEMY_METADATA, EnemyStats>;

export const ENEMIES: Readonly<Record<EnemyKind, EnemyStats>> = Object.freeze({
  ...runtimeRoster,
  'moc-tinh': runtimeRoster['moc-tinh-con'],
  'ma-troi': runtimeRoster['ma-troi-u-am'],
  'ho-yeu': Object.freeze({ name: 'Hổ Yêu U Minh', hp: 285, speed: 76, attack: 19, defense: 0, range: 65,
    reward: 65, xp: 110, color: 0xd4a160, radius: 38, scale: 1, role: 'melee', elite: false,
    areaId: 'rung-truc-u-minh', questTags: Object.freeze([]) }),
});

export function getEnemyKillTargets(kind: EnemyKind): readonly string[] {
  if (!Object.hasOwn(ENEMIES, kind)) throw new Error('Unknown enemy kind: ' + kind);
  return Object.freeze([...new Set([kind, ...ENEMIES[kind].questTags, 'forest-enemy'])]);
}

export const BALANCE = {
  attack: 12, hp: 100, mp: 100, speed: 190,
  comboWindowMs: 690, attackBufferMs: 150, dodgeCooldownMs: 1200, dodgeDurationMs: 190,
  earthCost: 30, earthCooldownMs: 5000,
  flameCost: 20, flameCooldownMs: 3000,
  requiredKills: 6, smithCost: 30, smithAttackGain: 4,
};
