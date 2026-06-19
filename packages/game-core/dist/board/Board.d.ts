import { Position } from './Position';
import { Piece } from '../pieces/Piece';
import { Effect } from '../effect/Effect';
export declare const BOARD_SIZE = 15;
export interface SerializedBoard {
    grid: (Piece | null)[][];
    cellEffects?: Record<string, Effect[]>;
}
export declare class Board {
    private grid;
    private cellEffects;
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
    getCellEffects(pos: Position): Effect[];
    setCellEffects(pos: Position, effects: Effect[]): void;
    addCellEffect(pos: Position, effect: Effect): void;
    removeCellEffect(pos: Position, effectId: string): void;
    getAllCellEffects(): Map<string, Effect[]>;
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