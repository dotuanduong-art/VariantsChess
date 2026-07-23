// ============================================================
// Queen Movement - Orthogonal + Diagonal sliding
// ============================================================

import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { Color } from '../pieces/Piece';
import { getSlidingMoves } from './slidingMoves';

const ALL_DIRECTIONS = [
  { dcol: 0, drow: 1 },
  { dcol: 0, drow: -1 },
  { dcol: 1, drow: 0 },
  { dcol: -1, drow: 0 },
  { dcol: 1, drow: 1 },
  { dcol: 1, drow: -1 },
  { dcol: -1, drow: 1 },
  { dcol: -1, drow: -1 },
];

export function getQueenMoves(board: Board, pos: Position, color: Color, allowAllyCapture?: boolean): Position[] {
  return getSlidingMoves(board, pos, color, ALL_DIRECTIONS, allowAllyCapture);
}
