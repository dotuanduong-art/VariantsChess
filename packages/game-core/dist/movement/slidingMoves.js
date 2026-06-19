"use strict";
// ============================================================
// Sliding Move Helper
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSlidingMoves = getSlidingMoves;
const Position_1 = require("../board/Position");
/**
 * Generate moves in a single direction until hitting a boundary or piece.
 * If hitting an enemy piece, include that square (capture).
 * If hitting a friendly piece, stop before it.
 */
function getSlidingMoves(board, pos, color, directions) {
    const moves = [];
    for (const { dcol, drow } of directions) {
        let current = { col: pos.col + dcol, row: pos.row + drow };
        while ((0, Position_1.isInBounds)(current)) {
            if (board.getCellEffects(current).some(e => e.type === 'mountain')) {
                break; // Blocked by mountain
            }
            const piece = board.getPiece(current);
            if (piece) {
                if (piece.color !== color) {
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