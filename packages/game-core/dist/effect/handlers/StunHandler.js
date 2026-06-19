"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StunHandler = void 0;
const ResolutionOrder_1 = require("../../event/ResolutionOrder");
class StunHandler {
    effectType = 'stun';
    subscribesTo = [];
    handle(event, state, enqueueAction) {
        // Generic pipeline ticking handles durations, no custom event handling needed
    }
    /** Block movement of stunned pieces */
    validateAction(action, activeEffects, state) {
        if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
            const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
            const isStunned = activeEffects.some(e => e.targetType === 'piece' && e.targetId === pieceId);
            if (isStunned) {
                return 'This piece is stunned and cannot move';
            }
        }
        return null;
    }
    /** Stunned pieces have no legal moves */
    getMoveModifier(effect, state) {
        return {
            id: `stun_${effect.id}`,
            priority: ResolutionOrder_1.PRIORITY.STUN_BLOCK,
            source: 'effect:stun',
            modify(moves, context) {
                if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
                    return []; // no moves allowed
                }
                return moves;
            }
        };
    }
}
exports.StunHandler = StunHandler;
//# sourceMappingURL=StunHandler.js.map