import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
export declare class SoullessHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: GameEventType[];
    handle(event: GameEvent, state: Readonly<GameState>, enqueueAction: (action: Action) => void): void;
    /** Block movement of soulless pieces */
    validateAction(action: Action, activeEffects: Effect[], state: Readonly<GameState>): string | null;
    /** Soulless pieces have no legal moves */
    getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null;
}
//# sourceMappingURL=SoullessHandler.d.ts.map