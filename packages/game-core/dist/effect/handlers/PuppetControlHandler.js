"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PuppetControlHandler = void 0;
class PuppetControlHandler {
    effectType = 'puppet_control';
    subscribesTo = [];
    handle(event, state, enqueueAction) { }
    validateAction(action, activeEffects, state) {
        if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
            const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
            const puppetEffect = activeEffects.find(e => e.targetType === 'piece' && e.targetId === pieceId && e.type === this.effectType);
            if (puppetEffect) {
                const controller = puppetEffect.metadata.controlledBy;
                if (controller !== state.currentTurn) {
                    return 'You do not control this puppeted piece';
                }
                if (action.type === 'CAPTURE') {
                    const rem = puppetEffect.remainingDuration;
                    if (rem !== null && rem > 5) {
                        return 'Cannot capture during the pre-control phase of Puppet Master';
                    }
                }
            }
        }
        return null;
    }
    getMoveModifier(effect, state) {
        return {
            id: `puppet_control_${effect.id}`,
            priority: 300,
            source: 'effect:puppet_control',
            modify(moves, context) {
                if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
                    const rem = effect.remainingDuration;
                    if (rem !== null && rem > 5) {
                        // Cannot capture during pre-control phase (must only move to empty squares)
                        return moves.filter(pos => context.board.getPiece(pos) === null);
                    }
                }
                return moves;
            }
        };
    }
}
exports.PuppetControlHandler = PuppetControlHandler;
//# sourceMappingURL=PuppetControlHandler.js.map