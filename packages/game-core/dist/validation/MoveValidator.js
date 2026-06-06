"use strict";
// ============================================================
// Move Validator - Server-side move validation
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMove = validateMove;
const Position_1 = require("../board/Position");
const MoveGenerator_1 = require("../movement/MoveGenerator");
/**
 * Validate a move request from a player.
 *
 * Checks:
 * 1. Positions are in bounds
 * 2. A piece exists at the source
 * 3. The piece belongs to the requesting player
 * 4. It is the player's turn
 * 5. The destination is a legal move for that piece
 */
function validateMove(board, currentTurn, playerColor, from, to) {
    // Check bounds
    if (!(0, Position_1.isInBounds)(from) || !(0, Position_1.isInBounds)(to)) {
        return { valid: false, reason: 'Position out of bounds' };
    }
    // Check same square
    if ((0, Position_1.posEquals)(from, to)) {
        return { valid: false, reason: 'Cannot move to the same square' };
    }
    // Check turn ownership
    if (currentTurn !== playerColor) {
        return { valid: false, reason: 'Not your turn' };
    }
    // Check piece exists
    const piece = board.getPiece(from);
    if (!piece) {
        return { valid: false, reason: 'No piece at source position' };
    }
    // Check piece ownership
    if (piece.color !== playerColor) {
        return { valid: false, reason: 'That piece does not belong to you' };
    }
    // Check legal move
    const legalMoves = (0, MoveGenerator_1.getLegalMoves)(board, from);
    const isLegal = legalMoves.some(move => (0, Position_1.posEquals)(move, to));
    if (!isLegal) {
        return { valid: false, reason: 'Illegal move for this piece' };
    }
    return { valid: true };
}
//# sourceMappingURL=MoveValidator.js.map