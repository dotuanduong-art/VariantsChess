"use strict";
// ============================================================
// Sliding Move Helper
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSlidingMoves = getSlidingMoves;
const Position_1 = require("../board/Position");
const Piece_1 = require("../pieces/Piece");
const CellEffectBlockModifier_1 = require("../modifier/CellEffectBlockModifier");
/**
 * Generate moves in a single direction until hitting a boundary or piece.
 * If hitting an enemy piece, include that square (capture).
 * If hitting a friendly piece, stop before it.
 */
function getSlidingMoves(board, pos, color, directions, allowAllyCapture) {
    const moves = [];
    for (const { dcol, drow } of directions) {
        let current = { col: pos.col + dcol, row: pos.row + drow };
        while ((0, Position_1.isInBounds)(current)) {
            if ((0, CellEffectBlockModifier_1.isSlidingBlocked)(board, current, color)) {
                break; // Blocked by cell effect or special piece obstacle
            }
            const piece = board.getPiece(current);
            if (piece) {
                if ((0, Piece_1.getPieceOwner)(piece) !== color || allowAllyCapture) {
                    moves.push({ ...current }); // capture
                }
                break; // blocked
            }
            moves.push({ ...current });
            current = { col: current.col + dcol, row: current.row + drow };
        }
    }
    return moves;
}
//# sourceMappingURL=slidingMoves.js.map