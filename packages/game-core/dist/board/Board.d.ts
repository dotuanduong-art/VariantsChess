import { Position } from './Position';
import { Piece } from '../pieces/Piece';
export declare const BOARD_SIZE = 15;
export interface SerializedBoard {
    grid: (Piece | null)[][];
}
export declare class Board {
    private grid;
    constructor();
    /**
     * Get the piece at a position, or null if empty
     */
    getPiece(pos: Position): Piece | null;
    /**
     * Place a piece at a position
     */
    setPiece(pos: Position, piece: Piece | null): void;
    /**
     * Remove a piece from a position and return it
     */
    removePiece(pos: Position): Piece | null;
    /**
     * Move a piece from one position to another. Returns captured piece if any.
     */
    movePiece(from: Position, to: Position): Piece | null;
    /**
     * Create a deep copy of the board
     */
    clone(): Board;
    /**
     * Serialize the board for network transfer
     */
    toSerializable(): SerializedBoard;
    /**
     * Restore a board from serialized data
     */
    static fromSerializable(data: SerializedBoard): Board;
}
//# sourceMappingURL=Board.d.ts.map