import { EventBus } from '../event/EventBus';
import { GameState } from '../state/GameState';
import { Effect, EffectType } from './Effect';
import { EffectHandler } from './EffectHandler';
import { MoveModifierChain } from '../modifier/MoveModifierChain';
import { ActionPipeline } from '../action/ActionPipeline';
export declare class EffectRegistry {
    private handlers;
    private wiredEventBusTypes;
    private wiredValidationHandlers;
    private wiredMoveModifierHandlers;
    /** Register a handler for an effect type */
    register(handler: EffectHandler): void;
    /** Get handler for an effect type */
    getHandler(effectType: EffectType): EffectHandler | undefined;
    /** Get all registered handlers */
    getAllHandlers(): EffectHandler[];
    /**
     * Helper: Get all active effects on the board.
     */
    getAllActiveEffects(state: Readonly<GameState>): Effect[];
    /**
     * Wire all handlers into the EventBus.
     */
    wireToEventBus(eventBus: EventBus, state: GameState): void;
    /**
     * Wire handlers that have validateAction into the validation pipeline.
     */
    wireToValidationPipeline(pipeline: ActionPipeline, state: GameState): void;
    /**
     * Wire handlers that have getMoveModifier into the modifier chain.
     */
    wireToMoveModifierChain(chain: MoveModifierChain, state: GameState): void;
}
//# sourceMappingURL=EffectRegistry.d.ts.map