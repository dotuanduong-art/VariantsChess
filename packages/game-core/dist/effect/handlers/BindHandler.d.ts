import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameState } from '../../state/GameState';
import { MoveModifier } from '../../modifier/MoveModifier';
export declare class BindHandler implements EffectHandler {
    effectType: EffectType;
    subscribesTo: never[];
    handle(): void;
    getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null;
}
//# sourceMappingURL=BindHandler.d.ts.map