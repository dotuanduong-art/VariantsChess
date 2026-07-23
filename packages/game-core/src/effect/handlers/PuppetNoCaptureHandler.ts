import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';

export class PuppetNoCaptureHandler implements EffectHandler {
  effectType = 'puppet_no_capture' as EffectType;
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
    if (action.type === 'CAPTURE') {
      const isTarget = activeEffects.some(
        e => e.targetType === 'piece' && e.targetId === action.attackerId && e.type === this.effectType
      );
      if (isTarget) {
        return 'This piece cannot capture on its first move after Stun';
      }
    }
    return null;
  }

  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    return {
      id: `puppet_no_capture_${effect.id}`,
      priority: 300,
      source: 'effect:puppet_no_capture',
      modify(moves, context) {
        if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
          // Cannot capture (must only move to empty squares)
          return moves.filter(pos => context.board.getPiece(pos) === null);
        }
        return moves;
      }
    };
  }
}
