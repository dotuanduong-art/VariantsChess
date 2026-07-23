import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
export declare class WalkerHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: GameEventType[];
    handle(event: GameEvent, state: Readonly<GameState>, enqueueAction: (action: Action) => void): void;
    validateAction(action: Action, activeEffects: Effect[], state: Readonly<GameState>): string | null;
    getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null;
}
//# sourceMappingURL=WalkerHandler.d.ts.map