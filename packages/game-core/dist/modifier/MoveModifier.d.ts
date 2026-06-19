import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { Piece } from '../pieces/Piece';
import { GameState } from '../state/GameState';
export interface MoveModifierContext {
    board: Board;
    piece: Piece;
    piecePosition: Position;
    state: Readonly<GameState>;
}
/**
 * A modifier receives the current set of legal moves and returns a
 * (possibly filtered/expanded) set. Must be pure — no side effects.
 */
export interface MoveModifier {
    id: string;
    priority: number;
    source: string;
    /**
     * Modify the set of legal moves for a piece.
     * @param moves - Current legal moves (may already be modified by earlier modifiers)
     * @param context - Board, piece, position, and game state
     * @returns Modified set of legal moves
     */
    modify(moves: Position[], context: MoveModifierContext): Position[];
}
//# sourceMappingURL=MoveModifier.d.ts.map