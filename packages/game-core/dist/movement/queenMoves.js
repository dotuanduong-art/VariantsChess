"use strict";
// ============================================================
// Queen Movement - Orthogonal + Diagonal sliding
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueenMoves = getQueenMoves;
const slidingMoves_1 = require("./slidingMoves");
const ALL_DIRECTIONS = [
    { dcol: 0, drow: 1 },
    { dcol: 0, drow: -1 },
    { dcol: 1, drow: 0 },
    { dcol: -1, drow: 0 },
    { dcol: 1, drow: 1 },
    { dcol: 1, drow: -1 },
    { dcol: -1, drow: 1 },
    { dcol: -1, drow: -1 },
];
function getQueenMoves(board, pos, color) {
    return (0, slidingMoves_1.getSlidingMoves)(board, pos, color, ALL_DIRECTIONS);
}
//# sourceMappingURL=queenMoves.js.map