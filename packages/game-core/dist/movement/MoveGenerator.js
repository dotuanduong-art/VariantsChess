"use strict";
// ============================================================
// Move Generator - Dispatches to piece-specific move generators
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBaseLegalMoves = getBaseLegalMoves;
exports.getLegalMoves = getLegalMoves;
const Piece_1 = require("../pieces/Piece");
const pawnMoves_1 = require("./pawnMoves");
const rookMoves_1 = require("./rookMoves");
const bishopMoves_1 = require("./bishopMoves");
const knightMoves_1 = require("./knightMoves");
const queenMoves_1 = require("./queenMoves");
const kingMoves_1 = require("./kingMoves");
/**
 * Base legal moves — standard chess rules only, no effects/modifiers.
 * This is the first step in the MoveModifierChain.
 */
function getBaseLegalMoves(board, pos) {
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
/**
 * Backward-compatible alias — delegates to getBaseLegalMoves.
 * In Step 4+ this can be replaced by MoveModifierChain.computeLegalMoves()
 * when the chain is available from context.
 */
function getLegalMoves(board, pos) {
    return getBaseLegalMoves(board, pos);
}
//# sourceMappingURL=MoveGenerator.js.map