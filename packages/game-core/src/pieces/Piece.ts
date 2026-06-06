// ============================================================
// Piece - Types and enums for chess pieces
// ============================================================

export enum PieceType {
  King = 'King',
  Queen = 'Queen',
  Rook = 'Rook',
  Bishop = 'Bishop',
  Knight = 'Knight',
  Pawn = 'Pawn',
}

export enum Color {
  White = 'White',
  Black = 'Black',
}

export interface Piece {
  id: string;
  type: PieceType;
  color: Color;
}

/**
 * Get the opponent's color
 */
export function oppositeColor(color: Color): Color {
  return color === Color.White ? Color.Black : Color.White;
}
