"use strict";
// ============================================================
// Bishop Movement - Diagonal sliding + 1 square horizontal
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBishopMoves = getBishopMoves;
const Position_1 = require("../board/Position");
const slidingMoves_1 = require("./slidingMoves");
const DIAGONAL_DIRECTIONS = [
    { dcol: 1, drow: 1 },
    { dcol: 1, drow: -1 },
    { dcol: -1, drow: 1 },
    { dcol: -1, drow: -1 },
];
/**
 * Bishop moves:
 * 1. Standard diagonal sliding
 * 2. Can move exactly 1 square horizontally (left or right)
 */
function getBishopMoves(board, pos, color) {
    const moves = (0, slidingMoves_1.getSlidingMoves)(board, pos, color, DIAGONAL_DIRECTIONS);
    // Additional: 1 square horizontal (left and right)
    for (const dcol of [-1, 1]) {
        const target = { col: pos.col + dcol, row: pos.row };
        if ((0, Position_1.isInBounds)(target)) {
            const piece = board.getPiece(target);
            if (!piece || piece.color !== color) {
                moves.push(target);
            }
        }
    }
    return moves;
}
//# sourceMappingURL=bishopMoves.js.map