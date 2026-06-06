// ============================================================
// Knight Movement - Standard L-shape
// ============================================================

import { Board } from '../board/Board';
import { Position, isInBounds } from '../board/Position';
import { Color } from '../pieces/Piece';

const KNIGHT_OFFSETS = [
  { dcol: 1, drow: 2 },
  { dcol: 2, drow: 1 },
  { dcol: 2, drow: -1 },
  { dcol: 1, drow: -2 },
  { dcol: -1, drow: -2 },
  { dcol: -2, drow: -1 },
  { dcol: -2, drow: 1 },
  { dcol: -1, drow: 2 },
];

export function getKnightMoves(board: Board, pos: Position, color: Color): Position[] {
  const moves: Position[] = [];

  for (const { dcol, drow } of KNIGHT_OFFSETS) {
    const target: Position = { col: pos.col + dcol, row: pos.row + drow };
    if (isInBounds(target)) {
      const piece = board.getPiece(target);
      if (!piece || piece.color !== color) {
        moves.push(target);
      }
    }
  }

  return moves;
}
