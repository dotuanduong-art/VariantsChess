import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { PieceType } from '../../pieces/Piece';

export class DragonsRoarBeamHandler implements EffectHandler {
  effectType = 'dragons_roar_beam' as EffectType;
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

    const piece = state.board.getPiece(to);
    if (!piece || piece.type === PieceType.King) return;

    // Check if landing cell has a dragons_roar_beam effect
    const cellEffects = state.board.getCellEffects(to);
    const beamEffect = cellEffects.find(
      e => e.type === 'dragons_roar_beam' && e.sourcePlayer !== piece.color
    );

    if (beamEffect) {
      // Caster is beamEffect.sourcePlayer. The moving piece is an enemy.
      // Destroy the piece.
      enqueueAction({
        type: 'DESTROY_PIECE',
        pieceId: movingPieceId,
        position: to,
        reason: 'dragons_roar_beam',
      });
    }
  }
}
