"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StunHandler = void 0;
const ResolutionOrder_1 = require("../../event/ResolutionOrder");
class StunHandler {
    effectType;
    subscribesTo = [];
    constructor(effectType = 'stun') {
        this.effectType = effectType;
    }
    handle(event, state, enqueueAction) {
        // Generic pipeline ticking handles durations, no custom event handling needed
    }
    /** Block movement of stunned/rooted pieces */
    validateAction(action, activeEffects, state) {
        if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
            const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
            const isActive = activeEffects.some(e => e.targetType === 'piece' && e.targetId === pieceId && e.type === this.effectType);
            if (isActive) {
                const verb = this.effectType === 'stun' ? 'stunned' : `${this.effectType}ed`;
                return `This piece is ${verb} and cannot move`;
            }
        }
        return null;
    }
    /** Stunned/rooted pieces have no legal moves */
    getMoveModifier(effect, state) {
        return {
            id: `${this.effectType}_${effect.id}`,
            priority: ResolutionOrder_1.PRIORITY.STUN_BLOCK,
            source: `effect:${this.effectType}`,
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