import { GameState } from '../state/GameState';
import { Color } from '../pieces/Piece';
import { Position } from '../board/Position';
import { Action } from '../action/Action';
import { DeterministicRng } from '../rng/DeterministicRng';
export interface SkillTarget {
    type: 'piece' | 'cell' | 'effect';
    position?: Position;
    pieceId?: string;
    effectId?: string;
}
export interface SkillTargetRequirement {
    type: 'piece' | 'cell' | 'effect';
    filter: 'ally' | 'enemy' | 'any' | 'empty';
    description: string;
    region?: Position[];
    excludeKing?: boolean;
}
export interface SkillDefinition {
    id: string;
    name: string;
    description: string;
    /** AP cost to activate */
    apCost: number | ((state: Readonly<GameState>, player: Color) => number);
    /** Skill tier */
    tier: 'skill1' | 'skill2' | 'ultimate';
    /** Cooldown in turns (0 = no cooldown) */
    cooldown: number;
    /** Usage rule */
    usageRule: 'once_per_turn' | 'one_time' | 'repeatable';
    /**
     * Validate if this skill can be activated right now.
     * Return null if valid, or rejection reason.
     */
    canActivate(state: Readonly<GameState>, player: Color, targets: SkillTarget[]): string | null;
    /**
     * Define what targets this skill requires.
     */
    getTargetRequirements(): SkillTargetRequirement[];
    /**
     * Execute the skill — returns Actions to be submitted to the pipeline.
     * Note: This does NOT mutate state — it returns the action list to apply.
     */
    execute(state: Readonly<GameState>, player: Color, targets: SkillTarget[], rng: DeterministicRng): Action[];
}
//# sourceMappingURL=Skill.d.ts.map