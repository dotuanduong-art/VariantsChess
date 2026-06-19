import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';

export class MountainHandler implements EffectHandler {
  effectType = 'mountain' as EffectType;
  subscribesTo = [];

  handle(): void {}

  /** Block moves from landing on a mountain cell */
  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    return {
      id: `mountain_${effect.id}`,
      priority: 400, // Higher priority/runs early
      source: 'effect:mountain',
      modify(moves, context) {
        if (effect.targetType === 'cell') {
          const [col, row] = effect.targetId.split(',').map(Number);
          return moves.filter(m => !(m.col === col && m.row === row));
        }
        return moves;
      }
    };
  }
}
