import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';

export class PuppetControlHandler implements EffectHandler {
  effectType = 'puppet_control' as EffectType;
  subscribesTo: GameEventType[] = [];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {}

  validateAction(
    action: Action,
    activeEffects: Effect[],
    state: Readonly<GameState>
  ): string | null {
    if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
      const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
      const puppetEffect = activeEffects.find(
        e => e.targetType === 'piece' && e.targetId === pieceId && e.type === this.effectType
      );

      if (puppetEffect) {
        const controller = puppetEffect.metadata.controlledBy;
        if (controller !== state.currentTurn) {
          return 'You do not control this puppeted piece';
        }

        if (action.type === 'CAPTURE') {
          const rem = puppetEffect.remainingDuration;
          if (rem !== null && rem > 5) {
            return 'Cannot capture during the pre-control phase of Puppet Master';
          }
        }
      }
    }
    return null;
  }

  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    return {
      id: `puppet_control_${effect.id}`,
      priority: 300,
      source: 'effect:puppet_control',
      modify(moves, context) {
        if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
          const rem = effect.remainingDuration;
          if (rem !== null && rem > 5) {
            // Cannot capture during pre-control phase (must only move to empty squares)
            return moves.filter(pos => context.board.getPiece(pos) === null);
          }
        }
        return moves;
      }
    };
  }
}
