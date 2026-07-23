import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
export declare class GuardianLinkHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: GameEventType[];
    handle(event: GameEvent, state: Readonly<GameState>, enqueueAction: (action: Action) => void): void;
}
//# sourceMappingURL=GuardianLinkHandler.d.ts.map