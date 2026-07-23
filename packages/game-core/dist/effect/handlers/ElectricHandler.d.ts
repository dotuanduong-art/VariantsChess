import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
/**
 * ElectricHandler – handles the `electric` effect (Thunder Dragon Skill 1).
 *
 * When a piece carrying `electric` is captured by an enemy, the attacker
 * receives a `stun` effect for 2 rounds (4 turns via turnEnd ticking).
 * The electric effect is removed from the captured piece as part of normal
 * lifecycle (the piece is removed from the board), so no explicit REMOVE_EFFECT
 * is needed here.
 */
export declare class ElectricHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: GameEventType[];
    handle(event: GameEvent, state: Readonly<GameState>, enqueueAction: (action: Action) => void): void;
}
//# sourceMappingURL=ElectricHandler.d.ts.map