import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
export declare class SubterraneanEscapeHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: GameEventType[];
    priority: number;
    handle(event: GameEvent, state: Readonly<GameState>, enqueueAction: (action: Action) => void): void;
}
//# sourceMappingURL=SubterraneanEscapeHandler.d.ts.map