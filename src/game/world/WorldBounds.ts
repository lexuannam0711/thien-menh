import { H, W } from '../../data/config';

interface Position { readonly x: number; readonly y: number; }
export interface Barrier { readonly x: number; readonly y: number; readonly width: number; readonly height: number; }

export const VILLAGE_BARRIERS: readonly Barrier[] = [
  { x: 122, y: 143, width: 136, height: 64 },
  { x: 367, y: 143, width: 136, height: 64 },
  { x: 617, y: 129, width: 146, height: 64 },
  { x: 652, y: 372, width: 116, height: 116 },
];

export const FOREST_BARRIERS: readonly Barrier[] = Array.from({ length: 14 }, (_, index) => ({
  x: 35 + (index * 173) % 920, y: 110 + (index * 139) % 380,
})).filter(({ x, y }) => !(x < 210 && Math.abs(y - 270) < 95))
  .map(({ x, y }) => ({ x: x - 4, y: y + 8, width: 8, height: 13 }));

function clamp(position: Position, radius: number): Position {
  return {
    x: Math.max(Math.max(33, radius), Math.min(Math.min(W - 28, W - radius), position.x)),
    y: Math.max(99, Math.min(Math.min(H - 32, H - radius), position.y)),
  };
}

function overlaps(position: Position, radius: number, barrier: Barrier): boolean {
  const dx = position.x - Math.max(barrier.x, Math.min(barrier.x + barrier.width, position.x));
  const dy = position.y - Math.max(barrier.y, Math.min(barrier.y + barrier.height, position.y));
  return dx * dx + dy * dy < radius * radius;
}

export function constrainToWorld(position: Position, radius: number,
  barriers: readonly Barrier[] = []): Position {
  let next = clamp(position, radius);
  for (const barrier of barriers) {
    if (!overlaps(next, radius, barrier)) continue;
    const exits = [
      { x: barrier.x - radius, y: next.y },
      { x: barrier.x + barrier.width + radius, y: next.y },
      { x: next.x, y: barrier.y - radius },
      { x: next.x, y: barrier.y + barrier.height + radius },
    ].filter(exit => !overlaps(clamp(exit, radius), radius, barrier));
    exits.sort((first, second) => Math.hypot(first.x - next.x, first.y - next.y) -
      Math.hypot(second.x - next.x, second.y - next.y));
    if (exits[0]) next = clamp(exits[0], radius);
  }
  return next;
}

export function moveInWorld(previous: Position, desired: Position, radius: number,
  barriers: readonly Barrier[]): Position {
  let next = constrainToWorld(previous, radius, barriers);
  const target = clamp(desired, radius);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(target.x - next.x), Math.abs(target.y - next.y)) / 8));
  const stepX = (target.x - next.x) / steps;
  const stepY = (target.y - next.y) / steps;
  for (let index = 0; index < steps; index++) {
    const horizontal = { x: next.x + stepX, y: next.y };
    if (!barriers.some(barrier => overlaps(horizontal, radius, barrier))) next = horizontal;
    const vertical = { x: next.x, y: next.y + stepY };
    if (!barriers.some(barrier => overlaps(vertical, radius, barrier))) next = vertical;
  }
  return clamp(next, radius);
}
