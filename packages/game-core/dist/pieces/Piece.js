"use strict";
// ============================================================
// Piece - Types and enums for chess pieces
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Color = exports.PieceType = void 0;
exports.oppositeColor = oppositeColor;
var PieceType;
(function (PieceType) {
    PieceType["King"] = "King";
    PieceType["Queen"] = "Queen";
    PieceType["Rook"] = "Rook";
    PieceType["Bishop"] = "Bishop";
    PieceType["Knight"] = "Knight";
    PieceType["Pawn"] = "Pawn";
})(PieceType || (exports.PieceType = PieceType = {}));
var Color;
(function (Color) {
    Color["White"] = "White";
    Color["Black"] = "Black";
})(Color || (exports.Color = Color = {}));
/**
 * Get the opponent's color
 */
function oppositeColor(color) {
    return color === Color.White ? Color.Black : Color.White;
}
//# sourceMappingURL=Piece.js.map