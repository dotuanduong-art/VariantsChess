// ============================================================
// Bishop Movement - Diagonal sliding + 1 square horizontal
// ============================================================

import { Board } from '../board/Board';
import { Position, isInBounds } from '../board/Position';
import { Color } from '../pieces/Piece';
import { getSlidingMoves } from './slidingMoves';

const DIAGONAL_DIRECTIONS = [
  { dcol: 1, drow: 1 },
  { dcol: 1, drow: -1 },
  { dcol: -1, drow: 1 },
  { dcol: -1, drow: -1 },
];

/**
 * Bishop moves:
 * 1. Standard diagonal sliding
 * 2. Can move exactly 1 square horizontally (left or right)
 */
export function getBishopMoves(board: Board, pos: Position, color: Color): Position[] {
  const moves = getSlidingMoves(board, pos, color, DIAGONAL_DIRECTIONS);

  // Additional: 1 square horizontal (left and right)
  for (const dcol of [-1, 1]) {
    const target: Position = { col: pos.col + dcol, row: pos.row };
    if (isInBounds(target)) {
      const piece = board.getPiece(target);
      if (!piece || piece.color !== color) {
        moves.push(target);
      }
    }
  }

  return moves;
}
