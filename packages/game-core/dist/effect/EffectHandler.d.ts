import { Effect, EffectType } from './Effect';
import { GameEventType, GameEvent } from '../event/GameEvent';
import { GameState } from '../state/GameState';
import { Action } from '../action/Action';
import { MoveModifier } from '../modifier/MoveModifier';
/**
 * An EffectHandler defines behavior for a specific effect type
 * in response to specific game events.
 *
 * Handlers are stateless — all state is in the Effect data and GameState.
 * They react by enqueuing Actions, never by mutating state directly.
 */
export interface EffectHandler {
    /** Which effect type this handler manages */
    effectType: EffectType;
    /**
     * Which events this handler listens to.
     * The registry uses this to auto-register with the EventBus.
     */
    subscribesTo: GameEventType[];
    /** Optional custom priority for event registrations. Lower = runs first. */
    priority?: number;
    /**
     * Handle an event. Called by the EventBus when a matching event fires.
     *
     * @param event - The game event
     * @param state - Read-only game state for queries
     * @param enqueueAction - Callback to enqueue reaction actions
     */
    handle(event: GameEvent, state: Readonly<GameState>, enqueueAction: (action: Action) => void): void;
    /**
     * Optional: participate in move validation.
     * Called during the validation pipeline, not the event bus.
     * Return a modified action or null to block it.
     */
    validateAction?(action: Action, activeEffects: Effect[], state: Readonly<GameState>): string | null;
    /**
     * Optional: participate in move modifier chain.
     * Return a MoveModifier to register, or null.
     */
    getMoveModifier?(effect: Effect, state: Readonly<GameState>): MoveModifier | null;
}
//# sourceMappingURL=EffectHandler.d.ts.map