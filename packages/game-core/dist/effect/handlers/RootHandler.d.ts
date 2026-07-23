import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
export declare class RootHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: GameEventType[];
    handle(event: GameEvent, state: Readonly<GameState>, enqueueAction: (action: Action) => void): void;
    /** Block movement/captures of rooted pieces */
    validateAction(action: Action, activeEffects: Effect[], state: Readonly<GameState>): string | null;
    /** Rooted pieces have no legal moves */
    getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null;
}
//# sourceMappingURL=RootHandler.d.ts.map