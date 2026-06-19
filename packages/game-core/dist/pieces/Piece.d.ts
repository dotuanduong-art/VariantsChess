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
    type: PieceType;
    color: Color;
    effects: Effect[];
}
/**
 * Get the opponent's color
 */
export declare function oppositeColor(color: Color): Color;
//# sourceMappingURL=Piece.d.ts.map