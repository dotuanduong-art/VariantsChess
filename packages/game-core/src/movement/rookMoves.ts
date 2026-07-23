// ============================================================
// Rook Movement - Orthogonal sliding
// ============================================================

import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { Color } from '../pieces/Piece';
import { getSlidingMoves } from './slidingMoves';

const ORTHOGONAL_DIRECTIONS = [
  { dcol: 0, drow: 1 },
  { dcol: 0, drow: -1 },
  { dcol: 1, drow: 0 },
  { dcol: -1, drow: 0 },
];

export function getRookMoves(board: Board, pos: Position, color: Color, allowAllyCapture?: boolean): Position[] {
  return getSlidingMoves(board, pos, color, ORTHOGONAL_DIRECTIONS, allowAllyCapture);
}
