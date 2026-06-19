import { Color } from '../pieces/Piece';
import { GameState } from '../state/GameState';
import { EffectHandler } from '../effect/EffectHandler';
import { HandlerRegistration } from '../event/EventBus';
import { MoveModifier } from '../modifier/MoveModifier';
import { SkillDefinition } from './Skill';
export interface VariantDefinition {
    id: string;
    name: string;
    description: string;
    /** Skills provided by this variant */
    skills: SkillDefinition[];
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
}
//# sourceMappingURL=Variant.d.ts.map