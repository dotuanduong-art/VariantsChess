"use strict";
// ============================================================
// Initial Layout - Starting piece positions for 15x15 board
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInitialBoard = createInitialBoard;
const Board_1 = require("../board/Board");
const Piece_1 = require("./Piece");
/**
 * Back rank piece order (left to right, 15 pieces):
 * R N B R N B Q K Q B N R B N R
 */
const BACK_RANK_ORDER = [
    Piece_1.PieceType.Rook,
    Piece_1.PieceType.Knight,
    Piece_1.PieceType.Bishop,
    Piece_1.PieceType.Rook,
    Piece_1.PieceType.Knight,
    Piece_1.PieceType.Bishop,
    Piece_1.PieceType.Queen,
    Piece_1.PieceType.King,
    Piece_1.PieceType.Queen,
    Piece_1.PieceType.Bishop,
    Piece_1.PieceType.Knight,
    Piece_1.PieceType.Rook,
    Piece_1.PieceType.Bishop,
    Piece_1.PieceType.Knight,
    Piece_1.PieceType.Rook,
];
/**
 * Create a board with all pieces in their starting positions.
 *
 * White: back rank on row 0 (rank 1), pawns on row 1 (rank 2)
 * Black: back rank on row 14 (rank 15), pawns on row 13 (rank 14)
 */
function createInitialBoard() {
    const board = new Board_1.Board();
    // White pieces
    for (let col = 0; col < Board_1.BOARD_SIZE; col++) {
        // Back rank (row 0 = rank 1)
        const piece = { id: `w_${BACK_RANK_ORDER[col].toLowerCase()}_${col}`, type: BACK_RANK_ORDER[col], color: Piece_1.Color.White, effects: [] };
        board.setPiece({ col, row: 0 }, piece);
        // Pawn row (row 1 = rank 2)
        board.setPiece({ col, row: 1 }, { id: `w_pawn_${col}`, type: Piece_1.PieceType.Pawn, color: Piece_1.Color.White, effects: [] });
    }
    // Black pieces
    for (let col = 0; col < Board_1.BOARD_SIZE; col++) {
        // Back rank (row 14 = rank 15)
        const piece = { id: `b_${BACK_RANK_ORDER[col].toLowerCase()}_${col}`, type: BACK_RANK_ORDER[col], color: Piece_1.Color.Black, effects: [] };
        board.setPiece({ col, row: 14 }, piece);
        // Pawn row (row 13 = rank 14)
        board.setPiece({ col, row: 13 }, { id: `b_pawn_${col}`, type: Piece_1.PieceType.Pawn, color: Piece_1.Color.Black, effects: [] });
    }
    return board;
}
//# sourceMappingURL=initialLayout.js.map