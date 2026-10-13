import type { SkillDefinition } from '../../data/skills';
import { castSkill, type CasterSnapshot, type SkillProgress, type SkillSlot } from '../rpg/SkillSystem';

export function castEquippedSkill(progress: SkillProgress, caster: CasterSnapshot, slot: SkillSlot, nowMs: number) {
  return castSkill(progress, caster, progress.equippedSlots[slot] ?? '', nowMs);
}

export function skillHitsTarget(skill: SkillDefinition, origin: { x: number; y: number },
  direction: { x: number; y: number }, target: { x: number; y: number; radius: number }): boolean {
  if (skill.targetType === 'self') return false;
  const offsetX = target.x - origin.x;
  const offsetY = target.y - origin.y;
  if (skill.targetType === 'area') return Math.hypot(offsetX, offsetY) <= (skill.effect.radius ?? 0) + target.radius;
  const forward = offsetX * direction.x + offsetY * direction.y;
  const lateral = Math.abs(offsetX * direction.y - offsetY * direction.x);
  return forward >= -target.radius && forward <= (skill.effect.range ?? 0) + target.radius && lateral <= 32 + target.radius;
}
