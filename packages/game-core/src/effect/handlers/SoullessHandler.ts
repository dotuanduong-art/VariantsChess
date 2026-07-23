import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
import { PRIORITY } from '../../event/ResolutionOrder';
import { BOARD_SIZE } from '../../board/Board';

export class SoullessHandler implements EffectHandler {
  effectType = 'soulless' as EffectType;
  subscribesTo: GameEventType[] = ['OnMove', 'OnCapture'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnMove' && event.type !== 'OnCapture') return;

    const { pieceId, attackerId, to } = event.payload;
    const movingPieceId = event.type === 'OnMove' ? pieceId : attackerId;
    if (!to || !movingPieceId) return;

    const movingPiece = state.board.getPiece(to);
    if (!movingPiece) return;

    // Search the entire board for any piece under 'soulless' effect
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const piece = state.board.getPiece({ col: c, row: r });
        if (piece && piece.effects) {
          const soullessEffect = piece.effects.find(e => e.type === 'soulless');
          if (soullessEffect && soullessEffect.metadata && soullessEffect.metadata.originalPosition) {
            const orig = soullessEffect.metadata.originalPosition;
            // Check if moving piece went to the originalPosition, and is an ALLY of the stunned piece (same color)
            if (
              to.col === orig.col &&
              to.row === orig.row &&
              movingPiece.color === piece.color &&
              movingPiece.id !== piece.id
            ) {
              enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: soullessEffect.id,
                targetId: piece.id,
                targetType: 'piece',
                reason: 'released',
              });
            }
          }
        }
      }
    }
  }

  /** Block movement of soulless pieces */
  validateAction(
    action: Action,
    activeEffects: Effect[],
    state: Readonly<GameState>
  ): string | null {
    if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
      const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
      const isSoulless = activeEffects.some(
        e => e.targetType === 'piece' && e.targetId === pieceId
      );
      if (isSoulless) {
        return 'This piece is soulless and cannot move';
      }
    }
    return null;
  }

  /** Soulless pieces have no legal moves */
  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    return {
      id: `soulless_${effect.id}`,
      priority: PRIORITY.STUN_BLOCK,
      source: 'effect:soulless',
      modify(moves, context) {
        if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
          return []; // no moves allowed
        }
        return moves;
      }
    };
  }
}
