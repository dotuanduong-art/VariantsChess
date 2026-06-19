import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { PRIORITY } from '../../event/ResolutionOrder';
import { getSquareRegion } from '../../region/Region';
import { PieceType } from '../../pieces/Piece';

export class BombHandler implements EffectHandler {
  effectType = 'bomb' as EffectType;
  subscribesTo: GameEventType[] = ['OnPieceDestroyed'];
  priority = PRIORITY.DESTROY_BOMB;

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnPieceDestroyed') return;

    const { pieceSnapshot, position } = event.payload;
    if (!pieceSnapshot) return;

    // Check if the piece snapshot had a bomb effect
    const bombEffect = pieceSnapshot.effects?.find((e: Effect) => e.type === 'bomb');
    if (!bombEffect) return;

    // 1. Enqueue REMOVE_EFFECT for the bomb effect
    enqueueAction({
      type: 'REMOVE_EFFECT',
      effectId: bombEffect.id,
      targetId: bombEffect.targetId,
      targetType: 'piece',
      reason: 'explosion',
    });

    // 2. Retrieve adjacent cells in a 3x3 region centered at position
    const cells = getSquareRegion(position, 3);

    // 3. For each cell, check if a piece is present on the board
    for (const cell of cells) {
      const piece = state.board.getPiece(cell);
      if (piece && piece.type !== PieceType.King) {
        enqueueAction({
          type: 'DESTROY_PIECE',
          pieceId: piece.id,
          position: cell,
          reason: 'explosion',
        });
      }
    }
  }
}
