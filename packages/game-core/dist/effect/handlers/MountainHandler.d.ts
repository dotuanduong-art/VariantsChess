import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameState } from '../../state/GameState';
import { MoveModifier } from '../../modifier/MoveModifier';
export declare class MountainHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: never[];
    handle(): void;
    /** Block moves from landing on a mountain cell */
    getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null;
}
//# sourceMappingURL=MountainHandler.d.ts.map