import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { Color } from '../pieces/Piece';
/**
 * Generate moves in a single direction until hitting a boundary or piece.
 * If hitting an enemy piece, include that square (capture).
 * If hitting a friendly piece, stop before it.
 */
export declare function getSlidingMoves(board: Board, pos: Position, color: Color, directions: {
    dcol: number;
    drow: number;
}[]): Position[];
//# sourceMappingURL=slidingMoves.d.ts.map