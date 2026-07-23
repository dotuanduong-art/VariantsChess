"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CellEffectBlockModifier = void 0;
exports.isSlidingBlocked = isSlidingBlocked;
/**
 * Checks if a sliding path is blocked by a cell effect (e.g. mountain, flame)
 * or a special piece (e.g. mountain special piece).
 */
function isSlidingBlocked(board, pos, moverColor) {
    const cellEffects = board.getCellEffects(pos);
    if (cellEffects.some(e => e.type === 'mountain' || e.type === 'flame')) {
        return true;
    }
    if (moverColor !== undefined) {
        if (cellEffects.some(e => e.type === 'outworld' && e.sourcePlayer !== moverColor)) {
            return true;
        }
    }
    const piece = board.getPiece(pos);
    if (piece && piece.specialType === 'mountain') {
        return true;
    }
    return false;
}
class CellEffectBlockModifier {
    id = 'cell_effect_block';
    priority = 50;
    source = 'modifier:cell_effect';
    modify(moves, context) {
        const moverColor = context.piece.color;
        return moves.filter(pos => {
            const cellEffects = context.board.getCellEffects(pos);
            // Flame blocks landing for ALL pieces (Knight, Pawn, King, Rook, Bishop, etc.)
            if (cellEffects.some(e => e.type === 'flame')) {
                return false;
            }
            // Outworld blocks landing for enemy pieces
            if (cellEffects.some(e => e.type === 'outworld' && e.sourcePlayer !== moverColor)) {
                return false;
            }
            return true;
        });
    }
}
exports.CellEffectBlockModifier = CellEffectBlockModifier;
//# sourceMappingURL=CellEffectBlockModifier.js.map