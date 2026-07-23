"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalkerHandler = void 0;
class WalkerHandler {
    effectType = 'walker';
    subscribesTo = [];
    handle(event, state, enqueueAction) {
        // Walker duration is permanent
    }
    validateAction(action, activeEffects, state) {
        if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE' || action.type === 'ZOMBIE_BITE') {
            const pieceId = action.type === 'MOVE_PIECE'
                ? action.pieceId
                : (action.type === 'CAPTURE' ? action.attackerId : action.attackerId);
            const walkerEffect = activeEffects.find(e => e.targetType === 'piece' && e.targetId === pieceId);
            if (walkerEffect) {
                const controller = walkerEffect.metadata.controlledBy;
                if (controller !== state.currentTurn) {
                    return 'You do not control this Walker';
                }
            }
        }
        return null;
    }
    getMoveModifier(effect, state) {
        return {
            id: `walker_modifier_${effect.id}`,
            priority: 300, // prioritised filtering
            source: 'effect:walker',
            modify(moves, context) {
                if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
                    // Walker cannot capture (must only move to empty squares)
                    return moves.filter(pos => context.board.getPiece(pos) === null);
                }
                return moves;
            }
        };
    }
}
exports.WalkerHandler = WalkerHandler;
//# sourceMappingURL=WalkerHandler.js.map