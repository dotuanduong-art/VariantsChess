import { VariantDefinition } from '../Variant';
import { Color } from '../../pieces/Piece';
import { Action } from '../../action/Action';
import { SkillDefinition, SkillTarget } from '../Skill';

// Utility helper to create a basic stub skill
function createStubSkill(
  id: string,
  name: string,
  description: string,
  tier: 'skill1' | 'skill2' | 'ultimate',
  apCost: number
): SkillDefinition {
  return {
    id,
    name,
    description,
    tier,
    apCost,
    cooldown: 0,
    usageRule: 'once_per_turn',
    getTargetRequirements: () => [],
    canActivate: () => null,
    execute: (): Action[] => [],
  };
}



