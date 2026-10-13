export const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
export type SpriteDirection = typeof DIRECTIONS[number];
export interface SpritePose { readonly start: number; readonly count: number; readonly frameRate: number; readonly repeat: number; }
export interface SpriteSheet { readonly size: number; readonly columns: number; readonly atlasColumns?: number; readonly feet: number; readonly poses: Readonly<Record<string, SpritePose>>; }

function poses(definitions: readonly (readonly [string, number, number, number])[]): Readonly<Record<string, SpritePose>> {
  return Object.freeze(Object.fromEntries(definitions.map(([name, count, frameRate, repeat], index) => [name, Object.freeze({
    start: definitions.slice(0, index).reduce((total, entry) => total + entry[1], 0), count, frameRate, repeat,
  })])));
}
const hero = poses([
  ['idle', 4, 6, -1], ['walk', 6, 9, -1], ['run', 6, 14, -1],
  ['attack1', 5, 18, 0], ['attack2', 5, 18, 0], ['attack3', 6, 18, 0],
  ['dodge', 4, 16, 0], ['hit', 3, 14, 0], ['death', 6, 18, 0],
  ['earth', 5, 12, 0], ['fire', 5, 12, 0], ['water', 5, 12, 0],
  ['victory', 4, 8, 0], ['interaction', 4, 8, 0],
]);
const enemy = poses([['idle', 4, 5, -1], ['walk', 6, 8, -1], ['attack', 5, 14, 0], ['hit', 3, 14, 0], ['death', 6, 24, 0]]);
const boss = poses([['idle', 4, 5, -1], ['walk', 6, 8, -1], ['windup', 4, 10, 0], ['attack', 6, 14, 0], ['hit', 3, 14, 0], ['death', 6, 12, 0], ['transition', 4, 8, 0]]);
export const SPRITE_MANIFEST: Readonly<Record<'hero' | 'hero_axe' | 'hero_sword' | 'moctinh' | 'matroi' | 'hoyer' | 'wolf' | 'spider' | 'thuongluong' | 'thachtuong' | 'hacan', SpriteSheet>> = Object.freeze({
  hero: Object.freeze({ size: 48, columns: 68, atlasColumns: 42, feet: 42, poses: hero }),
  hero_axe: Object.freeze({ size: 48, columns: 68, atlasColumns: 42, feet: 42, poses: hero }),
  hero_sword: Object.freeze({ size: 48, columns: 68, atlasColumns: 42, feet: 42, poses: hero }),
  moctinh: Object.freeze({ size: 48, columns: 24, feet: 42, poses: enemy }),
  matroi: Object.freeze({ size: 32, columns: 24, feet: 28, poses: enemy }),
  hoyer: Object.freeze({ size: 96, columns: 24, atlasColumns: 21, feet: 84, poses: enemy }),
  wolf: Object.freeze({ size: 48, columns: 24, feet: 42, poses: enemy }),
  spider: Object.freeze({ size: 48, columns: 24, feet: 42, poses: enemy }),
  thuongluong: Object.freeze({ size: 96, columns: 33, atlasColumns: 21, feet: 84, poses: boss }),
  thachtuong: Object.freeze({ size: 96, columns: 33, atlasColumns: 21, feet: 84, poses: boss }),
  hacan: Object.freeze({ size: 96, columns: 33, atlasColumns: 21, feet: 84, poses: boss }),
});
export type SpriteName = keyof typeof SPRITE_MANIFEST;

export function animationFrames(name: SpriteName, state: string, direction: SpriteDirection): number[] {
  const sheet = SPRITE_MANIFEST[name];
  const pose = sheet.poses[state];
  if (!pose || !DIRECTIONS.includes(direction)) throw new Error('Unknown sprite pose or direction');
  return Array.from({ length: pose.count }, (_, index) => DIRECTIONS.indexOf(direction) * sheet.columns + pose.start + index);
}
export function facingDirection(horizontal: number, vertical: number): SpriteDirection {
  return Math.abs(horizontal) > Math.abs(vertical) ? horizontal < 0 ? 'left' : 'right' : vertical < 0 ? 'up' : 'down';
}
export function canPlayLocomotion(state: string, playing: boolean): boolean {
  return state !== 'death' && (!playing || state === 'idle' || state === 'walk' || state === 'run');
}
