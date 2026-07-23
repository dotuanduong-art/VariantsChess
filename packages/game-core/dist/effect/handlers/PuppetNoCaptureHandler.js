"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PuppetNoCaptureHandler = void 0;
class PuppetNoCaptureHandler {
    effectType = 'puppet_no_capture';
    subscribesTo = [];
    handle(event, state, enqueueAction) { }
    validateAction(action, activeEffects, state) {
        if (action.type === 'CAPTURE') {
            const isTarget = activeEffects.some(e => e.targetType === 'piece' && e.targetId === action.attackerId && e.type === this.effectType);
            if (isTarget) {
                return 'This piece cannot capture on its first move after Stun';
            }
        }
        return null;
    }
    getMoveModifier(effect, state) {
        return {
            id: `puppet_no_capture_${effect.id}`,
            priority: 300,
            source: 'effect:puppet_no_capture',
            modify(moves, context) {
                if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
                    // Cannot capture (must only move to empty squares)
                    return moves.filter(pos => context.board.getPiece(pos) === null);
                }
                return moves;
            }
        };
    }
}
exports.PuppetNoCaptureHandler = PuppetNoCaptureHandler;
//# sourceMappingURL=PuppetNoCaptureHandler.js.map