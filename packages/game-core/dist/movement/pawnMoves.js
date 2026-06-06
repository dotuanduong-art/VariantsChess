"use strict";
// ============================================================
// Pawn Movement
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPawnMoves = getPawnMoves;
const Position_1 = require("../board/Position");
const Piece_1 = require("../pieces/Piece");
/**
 * Get legal moves for a pawn at the given position.
 *
 * Rules:
 * - Move forward 1 square (if empty)
 * - Move forward 2 squares from starting row (if both squares empty)
 * - Capture diagonally forward
 * - No en passant, no promotion
 *
 * "Forward" is +row for White, -row for Black.
 */
function getPawnMoves(board, pos, color) {
    const moves = [];
    const direction = color === Piece_1.Color.White ? 1 : -1;
    const startRow = color === Piece_1.Color.White ? 1 : 13;
    // Forward 1
    const forward1 = { col: pos.col, row: pos.row + direction };
    if ((0, Position_1.isInBounds)(forward1) && !board.getPiece(forward1)) {
        moves.push(forward1);
        // Forward 2 from starting row (only if forward 1 is also empty)
        if (pos.row === startRow) {
            const forward2 = { col: pos.col, row: pos.row + 2 * direction };
            if ((0, Position_1.isInBounds)(forward2) && !board.getPiece(forward2)) {
                moves.push(forward2);
            }
        }
    }
    // Diagonal captures
    for (const dcol of [-1, 1]) {
        const capturePos = { col: pos.col + dcol, row: pos.row + direction };
        if ((0, Position_1.isInBounds)(capturePos)) {
            const target = board.getPiece(capturePos);
            if (target && target.color !== color) {
                moves.push(capturePos);
            }
        }
    }
    return moves;
}
//# sourceMappingURL=pawnMoves.js.map