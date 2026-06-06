import { Board } from '../board/Board';
import { Position } from '../board/Position';
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
export declare function getPawnMoves(board: Board, pos: Position, color: Color): Position[];
//# sourceMappingURL=pawnMoves.d.ts.map