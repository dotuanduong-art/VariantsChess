import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';

export class WalkerHandler implements EffectHandler {
  effectType = 'walker' as EffectType;
  subscribesTo: GameEventType[] = [];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    // Walker duration is permanent
  }

  validateAction(
    action: Action,
    activeEffects: Effect[],
    state: Readonly<GameState>
  ): string | null {
    if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE' || action.type === 'ZOMBIE_BITE') {
      const pieceId = action.type === 'MOVE_PIECE' 
        ? action.pieceId 
        : (action.type === 'CAPTURE' ? action.attackerId : action.attackerId);
      
      const walkerEffect = activeEffects.find(
        e => e.targetType === 'piece' && e.targetId === pieceId
      );
      if (walkerEffect) {
        const controller = walkerEffect.metadata.controlledBy;
        if (controller !== state.currentTurn) {
          return 'You do not control this Walker';
        }
      }
    }
    return null;
  }

  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    return {
      id: `walker_modifier_${effect.id}`,
      priority: 300, // prioritised filtering
      source: 'effect:walker',
      modify(moves, context) {
        if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
          // Walker cannot capture (must only move to empty squares)
          return moves.filter(pos => context.board.getPiece(pos) === null);
        }
        return moves;
      }
    };
  }
}
