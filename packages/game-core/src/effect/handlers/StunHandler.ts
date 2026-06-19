import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
import { PRIORITY } from '../../event/ResolutionOrder';

export class StunHandler implements EffectHandler {
  effectType = 'stun' as EffectType;
  subscribesTo: GameEventType[] = [];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    // Generic pipeline ticking handles durations, no custom event handling needed
  }

  /** Block movement of stunned pieces */
  validateAction(
    action: Action,
    activeEffects: Effect[],
    state: Readonly<GameState>
  ): string | null {
    if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
      const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
      const isStunned = activeEffects.some(
        e => e.targetType === 'piece' && e.targetId === pieceId
      );
      if (isStunned) {
        return 'This piece is stunned and cannot move';
      }
    }
    return null;
  }

  /** Stunned pieces have no legal moves */
  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    return {
      id: `stun_${effect.id}`,
      priority: PRIORITY.STUN_BLOCK,
      source: 'effect:stun',
      modify(moves, context) {
        if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
          return []; // no moves allowed
        }
        return moves;
      }
    };
  }
}
