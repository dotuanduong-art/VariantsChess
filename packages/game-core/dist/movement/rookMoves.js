"use strict";
// ============================================================
// Rook Movement - Orthogonal sliding
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRookMoves = getRookMoves;
const slidingMoves_1 = require("./slidingMoves");
const ORTHOGONAL_DIRECTIONS = [
    { dcol: 0, drow: 1 },
    { dcol: 0, drow: -1 },
    { dcol: 1, drow: 0 },
    { dcol: -1, drow: 0 },
];
function getRookMoves(board, pos, color, allowAllyCapture) {
    return (0, slidingMoves_1.getSlidingMoves)(board, pos, color, ORTHOGONAL_DIRECTIONS, allowAllyCapture);
}
//# sourceMappingURL=rookMoves.js.map