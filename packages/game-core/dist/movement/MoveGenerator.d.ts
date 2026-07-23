import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { PieceType, Color } from '../pieces/Piece';
export declare function getGhostSlidingMoves(board: Board, pos: Position, color: Color, directions: {
    dcol: number;
    drow: number;
}[]): Position[];
export declare function getGhostPawnMoves(board: Board, pos: Position, color: Color, ownerColor?: Color): Position[];
/**
 * Base legal moves — standard chess rules only, no effects/modifiers.
 * This is the first step in the MoveModifierChain.
 */
export declare function getBaseLegalMoves(board: Board, pos: Position): Position[];
/**
 * Backward-compatible alias — delegates to getBaseLegalMoves.
 * In Step 4+ this can be replaced by MoveModifierChain.computeLegalMoves()
 * when the chain is available from context.
 */
export declare function getLegalMoves(board: Board, pos: Position): Position[];
/**
 * Compute base moves for a given piece type, color and position.
 */
export declare function getBaseMovesForType(board: Board, pos: Position, type: PieceType | string, color: Color, allowAllyCapture?: boolean): Position[];
//# sourceMappingURL=MoveGenerator.d.ts.map