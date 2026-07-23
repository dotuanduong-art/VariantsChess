// ============================================================
// Sliding Move Helper
// ============================================================

import { Board } from '../board/Board';
import { Position, isInBounds } from '../board/Position';
import { Color, getPieceOwner } from '../pieces/Piece';
import { isSlidingBlocked } from '../modifier/CellEffectBlockModifier';

/**
 * Generate moves in a single direction until hitting a boundary or piece.
 * If hitting an enemy piece, include that square (capture).
 * If hitting a friendly piece, stop before it.
 */
export function getSlidingMoves(
  board: Board,
  pos: Position,
  color: Color,
  directions: { dcol: number; drow: number }[],
  allowAllyCapture?: boolean
): Position[] {
  const moves: Position[] = [];

  for (const { dcol, drow } of directions) {
    let current: Position = { col: pos.col + dcol, row: pos.row + drow };

    while (isInBounds(current)) {
      if (isSlidingBlocked(board, current, color)) {
        break; // Blocked by cell effect or special piece obstacle
      }
      const piece = board.getPiece(current);
      if (piece) {
        if (getPieceOwner(piece) !== color || allowAllyCapture) {
          moves.push({ ...current }); // capture
        }
        break; // blocked
      }
      moves.push({ ...current });
      current = { col: current.col + dcol, row: current.row + drow };
    }
  }

  return moves;
}
