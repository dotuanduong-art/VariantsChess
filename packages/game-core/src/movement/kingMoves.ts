// ============================================================
// King Movement - 1 square in any direction
// ============================================================

import { Board } from '../board/Board';
import { Position, isInBounds } from '../board/Position';
import { Color } from '../pieces/Piece';

const KING_OFFSETS = [
  { dcol: 0, drow: 1 },
  { dcol: 0, drow: -1 },
  { dcol: 1, drow: 0 },
  { dcol: -1, drow: 0 },
  { dcol: 1, drow: 1 },
  { dcol: 1, drow: -1 },
  { dcol: -1, drow: 1 },
  { dcol: -1, drow: -1 },
];

export function getKingMoves(board: Board, pos: Position, color: Color): Position[] {
  const moves: Position[] = [];

  for (const { dcol, drow } of KING_OFFSETS) {
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
