import { Color } from '../pieces/Piece';
import { GameState } from '../state/GameState';
import { EffectHandler } from '../effect/EffectHandler';
import { HandlerRegistration } from '../event/EventBus';
import { MoveModifier } from '../modifier/MoveModifier';
import { SkillDefinition } from './Skill';
import { ActionValidator } from '../action/ActionPipeline';
export interface VariantDefinition {
    id: string;
    name: string;
    description: string;
    /** Skills provided by this variant */
    skills: SkillDefinition[];
    /** Max skills allowed per turn (default 1) */
    maxSkillsPerTurn?: number;
    /** Whether the same skill is prevented from being used more than once per turn */
    preventDuplicateSkillsPerTurn?: boolean;
    /** Effect handlers this variant introduces */
    effectHandlers: EffectHandler[];
    /**
     * Passive hooks — registered on EventBus when variant is loaded.
     */
    passiveHooks?: HandlerRegistration[] | ((state: GameState, player: Color) => HandlerRegistration[]);
    /**
     * Move modifiers this variant introduces (beyond those from effects).
     */
    moveModifiers?: MoveModifier[];
    /**
     * Optional: variant-specific setup logic.
     * Called after both players have selected variants, before first turn.
     */
    onSetup?(state: GameState, player: Color): void;
    /**
     * Optional: initial variant-specific state.
     */
    getInitialState?(): Record<string, unknown>;
    /**
     * Optional: custom action validators this variant introduces.
     * Registered into the ActionPipeline when the variant is loaded.
     */
    actionValidators?: ActionValidator[];
}
//# sourceMappingURL=Variant.d.ts.map