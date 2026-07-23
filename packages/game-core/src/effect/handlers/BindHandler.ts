import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
import { PRIORITY } from '../../event/ResolutionOrder';

export class BindHandler implements EffectHandler {
  effectType = 'bind' as EffectType;
  subscribesTo = [];

  handle(): void {}

  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    return {
      id: `bind_${effect.id}`,
      priority: PRIORITY.BIND_RESTRICT,
      source: 'effect:bind',
      modify(moves, context) {
        if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
          const center = context.piecePosition;
          return moves.filter(m => {
            const dcol = Math.abs(m.col - center.col);
            const drow = Math.abs(m.row - center.row);
            return dcol <= 2 && drow <= 2;
          });
        }
        return moves;
      }
    };
  }
}
