import { VariantDefinition } from './Variant';
import { Color } from '../pieces/Piece';
import { EffectRegistry } from '../effect/EffectRegistry';
import { EventBus } from '../event/EventBus';
import { MoveModifierChain } from '../modifier/MoveModifierChain';
import { GameState } from '../state/GameState';
import { ActionPipeline } from '../action/ActionPipeline';
export declare class VariantRegistry {
    private variants;
    private loadedVariants;
    /** Register a variant definition */
    register(variant: VariantDefinition): void;
    /** Get a variant by id */
    get(variantId: string): VariantDefinition | undefined;
    /** List all available variants */
    listAll(): VariantDefinition[];
    /**
     * Load a variant for a player. Registers its handlers, modifiers, and hooks.
     */
    loadForPlayer(variantId: string, player: Color, effectRegistry: EffectRegistry, eventBus: EventBus, moveModifierChain: MoveModifierChain, state: GameState, pipeline?: ActionPipeline): void;
    /**
     * Unload a variant for a player.
     */
    unloadForPlayer(variantId: string, player: Color, eventBus: EventBus, moveModifierChain: MoveModifierChain): void;
}
//# sourceMappingURL=VariantRegistry.d.ts.map