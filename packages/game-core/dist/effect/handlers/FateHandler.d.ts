import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
/**
 * FateHandler — manages the Fate effect that links two pieces.
 *
 * When a piece with Fate is destroyed, the linked piece is also destroyed.
 * When Fate expires on one piece, the partner's Fate effect is also removed.
 */
export declare class FateHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: GameEventType[];
    priority: 200;
    handle(event: GameEvent, state: Readonly<GameState>, enqueueAction: (action: Action) => void): void;
}
//# sourceMappingURL=FateHandler.d.ts.map