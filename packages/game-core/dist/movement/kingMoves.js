"use strict";
// ============================================================
// King Movement - 1 square in any direction
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKingMoves = getKingMoves;
const Position_1 = require("../board/Position");
const KING_OFFSETS = [
    { dcol: 0, drow: 1 },
    { dcol: 0, drow: -1 },
    { dcol: 1, drow: 0 },
    { dcol: -1, drow: 0 },
    { dcol: 1, drow: 1 },
    { dcol: 1, drow: -1 },
    { dcol: -1, drow: 1 },
    { dcol: -1, drow: -1 },
];
function getKingMoves(board, pos, color) {
    const moves = [];
    for (const { dcol, drow } of KING_OFFSETS) {
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
//# sourceMappingURL=kingMoves.js.map