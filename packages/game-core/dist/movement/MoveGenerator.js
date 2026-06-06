"use strict";
// ============================================================
// Move Generator - Dispatches to piece-specific move generators
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLegalMoves = getLegalMoves;
const Piece_1 = require("../pieces/Piece");
const pawnMoves_1 = require("./pawnMoves");
const rookMoves_1 = require("./rookMoves");
const bishopMoves_1 = require("./bishopMoves");
const knightMoves_1 = require("./knightMoves");
const queenMoves_1 = require("./queenMoves");
const kingMoves_1 = require("./kingMoves");
/**
 * Get all legal moves for the piece at the given position.
 * Returns empty array if no piece at position.
 */
function getLegalMoves(board, pos) {
    const piece = board.getPiece(pos);
    if (!piece)
        return [];
    switch (piece.type) {
        case Piece_1.PieceType.Pawn:
            return (0, pawnMoves_1.getPawnMoves)(board, pos, piece.color);
        case Piece_1.PieceType.Rook:
            return (0, rookMoves_1.getRookMoves)(board, pos, piece.color);
        case Piece_1.PieceType.Bishop:
            return (0, bishopMoves_1.getBishopMoves)(board, pos, piece.color);
        case Piece_1.PieceType.Knight:
            return (0, knightMoves_1.getKnightMoves)(board, pos, piece.color);
        case Piece_1.PieceType.Queen:
            return (0, queenMoves_1.getQueenMoves)(board, pos, piece.color);
        case Piece_1.PieceType.King:
            return (0, kingMoves_1.getKingMoves)(board, pos, piece.color);
        default:
            return [];
    }
}
//# sourceMappingURL=MoveGenerator.js.map