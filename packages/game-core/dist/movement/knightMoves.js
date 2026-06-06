"use strict";
// ============================================================
// Knight Movement - Standard L-shape
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKnightMoves = getKnightMoves;
const Position_1 = require("../board/Position");
const KNIGHT_OFFSETS = [
    { dcol: 1, drow: 2 },
    { dcol: 2, drow: 1 },
    { dcol: 2, drow: -1 },
    { dcol: 1, drow: -2 },
    { dcol: -1, drow: -2 },
    { dcol: -2, drow: -1 },
    { dcol: -2, drow: 1 },
    { dcol: -1, drow: 2 },
];
function getKnightMoves(board, pos, color) {
    const moves = [];
    for (const { dcol, drow } of KNIGHT_OFFSETS) {
        const target = { col: pos.col + dcol, row: pos.row + drow };
        if ((0, Position_1.isInBounds)(target)) {
            const piece = board.getPiece(target);
            if (!piece || piece.color !== color) {
                moves.push(target);
            }
        }
    }
    return moves;
}
//# sourceMappingURL=knightMoves.js.map