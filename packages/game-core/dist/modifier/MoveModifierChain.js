"use strict";
// ============================================================
// Move Modifier Chain — Pipeline for computing final legal moves
// ============================================================
//
// Flow: getBaseLegalMoves(piece) → modifier₁ → modifier₂ → … → result
//
// When no modifiers are registered, returns identical results
// to the original getLegalMoves() function.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoveModifierChain = void 0;
const MoveGenerator_1 = require("../movement/MoveGenerator");
class MoveModifierChain {
    modifiers = [];
    /** Register a modifier (sorted by priority on insert) */
    register(modifier) {
        this.modifiers.push(modifier);
        this.modifiers.sort((a, b) => a.priority - b.priority);
    }
    /** Remove a modifier by id */
    unregister(modifierId) {
        this.modifiers = this.modifiers.filter(m => m.id !== modifierId);
    }
    /** Remove all modifiers from a source */
    unregisterBySource(source) {
        this.modifiers = this.modifiers.filter(m => m.source !== source);
    }
    /** Get all registered modifiers (for inspection/debugging) */
    getModifiers() {
        return this.modifiers;
    }
    /**
     * Compute final legal moves for a piece:
     *   getBaseLegalMoves(piece) → modifier₁ → modifier₂ → … → result
     *
     * When no modifiers are registered, this is identical to the old getLegalMoves().
     */
    computeLegalMoves(board, pos, state) {
        const piece = board.getPiece(pos);
        if (!piece)
            return [];
        // Start with base legal moves (standard chess rules)
        let moves = (0, MoveGenerator_1.getBaseLegalMoves)(board, pos);
        // Build context for modifiers
        const context = {
            board,
            piece,
            piecePosition: pos,
            state,
        };
        // Run each modifier in priority order
        for (const modifier of this.modifiers) {
            moves = modifier.modify(moves, context);
        }
        return moves;
    }
}
exports.MoveModifierChain = MoveModifierChain;
//# sourceMappingURL=MoveModifierChain.js.map