"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RootHandler = void 0;
const ResolutionOrder_1 = require("../../event/ResolutionOrder");
class RootHandler {
    effectType = 'root';
    subscribesTo = [];
    handle(event, state, enqueueAction) {
        // No custom ticking behavior required beyond default duration decay
    }
    /** Block movement/captures of rooted pieces */
    validateAction(action, activeEffects, state) {
        if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
            const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
            const isRooted = activeEffects.some(e => e.targetType === 'piece' && e.targetId === pieceId && e.type === 'root');
            if (isRooted) {
                return 'This piece is rooted and cannot move';
            }
        }
        return null;
    }
    /** Rooted pieces have no legal moves */
    getMoveModifier(effect, state) {
        return {
            id: `root_${effect.id}`,
            priority: ResolutionOrder_1.PRIORITY.STUN_BLOCK,
            source: 'effect:root',
            modify(moves, context) {
                if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
                    return []; // no moves allowed
                }
                return moves;
            }
        };
    }
}
exports.RootHandler = RootHandler;
//# sourceMappingURL=RootHandler.js.map