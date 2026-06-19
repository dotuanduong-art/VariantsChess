import { Board } from '../board/Board';
import { Position } from '../board/Position';
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
//# sourceMappingURL=MoveGenerator.d.ts.map