// ============================================================
// Pawn Movement
// ============================================================

import { Board } from '../board/Board';
import { Position, isInBounds } from '../board/Position';
import { Color } from '../pieces/Piece';

/**
 * Get legal moves for a pawn at the given position.
 *
 * Rules:
 * - Move forward 1 square (if empty)
 * - Move forward 2 squares from starting row (if both squares empty)
 * - Capture diagonally forward
 * - No en passant, no promotion
 *
 * "Forward" is +row for White, -row for Black.
 */
export function getPawnMoves(board: Board, pos: Position, color: Color): Position[] {
  const moves: Position[] = [];
  const direction = color === Color.White ? 1 : -1;
  const startRow = color === Color.White ? 1 : 13;

  // Forward 1
  const forward1: Position = { col: pos.col, row: pos.row + direction };
  if (isInBounds(forward1) && !board.getPiece(forward1)) {
    moves.push(forward1);

    // Forward 2 from starting row (only if forward 1 is also empty)
    if (pos.row === startRow) {
      const forward2: Position = { col: pos.col, row: pos.row + 2 * direction };
      if (isInBounds(forward2) && !board.getPiece(forward2)) {
        moves.push(forward2);
      }
    }
  }

  // Diagonal captures
  for (const dcol of [-1, 1]) {
    const capturePos: Position = { col: pos.col + dcol, row: pos.row + direction };
    if (isInBounds(capturePos)) {
      const target = board.getPiece(capturePos);
      if (target && target.color !== color) {
        moves.push(capturePos);
      }
    }
  }

  return moves;
}
