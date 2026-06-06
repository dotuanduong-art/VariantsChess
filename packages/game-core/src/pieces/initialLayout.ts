// ============================================================
// Initial Layout - Starting piece positions for 15x15 board
// ============================================================

import { Board, BOARD_SIZE } from '../board/Board';
import { Piece, PieceType, Color } from './Piece';

/**
 * Back rank piece order (left to right, 15 pieces):
 * R N B R N B Q K Q B N R B N R
 */
const BACK_RANK_ORDER: PieceType[] = [
  PieceType.Rook,
  PieceType.Knight,
  PieceType.Bishop,
  PieceType.Rook,
  PieceType.Knight,
  PieceType.Bishop,
  PieceType.Queen,
  PieceType.King,
  PieceType.Queen,
  PieceType.Bishop,
  PieceType.Knight,
  PieceType.Rook,
  PieceType.Bishop,
  PieceType.Knight,
  PieceType.Rook,
];

/**
 * Create a board with all pieces in their starting positions.
 *
 * White: back rank on row 0 (rank 1), pawns on row 1 (rank 2)
 * Black: back rank on row 14 (rank 15), pawns on row 13 (rank 14)
 */
export function createInitialBoard(): Board {
  const board = new Board();

  // White pieces
  for (let col = 0; col < BOARD_SIZE; col++) {
    // Back rank (row 0 = rank 1)
    const piece: Piece = { id: `w_${BACK_RANK_ORDER[col].toLowerCase()}_${col}`, type: BACK_RANK_ORDER[col], color: Color.White };
    board.setPiece({ col, row: 0 }, piece);

    // Pawn row (row 1 = rank 2)
    board.setPiece({ col, row: 1 }, { id: `w_pawn_${col}`, type: PieceType.Pawn, color: Color.White });
  }

  // Black pieces
  for (let col = 0; col < BOARD_SIZE; col++) {
    // Back rank (row 14 = rank 15)
    const piece: Piece = { id: `b_${BACK_RANK_ORDER[col].toLowerCase()}_${col}`, type: BACK_RANK_ORDER[col], color: Color.Black };
    board.setPiece({ col, row: 14 }, piece);

    // Pawn row (row 13 = rank 14)
    board.setPiece({ col, row: 13 }, { id: `b_pawn_${col}`, type: PieceType.Pawn, color: Color.Black });
  }

  return board;
}
