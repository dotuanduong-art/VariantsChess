export declare enum PieceType {
    King = "King",
    Queen = "Queen",
    Rook = "Rook",
    Bishop = "Bishop",
    Knight = "Knight",
    Pawn = "Pawn"
}
export declare enum Color {
    White = "White",
    Black = "Black"
}
import { Effect } from '../effect/Effect';
export interface Piece {
    id: string;
    type: PieceType | string;
    color: Color;
    effects: Effect[];
    specialType?: string;
}
/**
 * Get the opponent's color
 */
export declare function oppositeColor(color: Color): Color;
/**
 * Get the owner/controller of a piece, taking Walker shared control metadata into account.
 */
export declare function getPieceOwner(piece: Piece): Color;
//# sourceMappingURL=Piece.d.ts.map