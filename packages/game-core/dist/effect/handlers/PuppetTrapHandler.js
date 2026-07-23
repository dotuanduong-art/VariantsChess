"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PuppetTrapHandler = void 0;
class PuppetTrapHandler {
    effectType = 'puppet_trap';
    subscribesTo = ['OnMove', 'OnCapture'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnMove' && event.type !== 'OnCapture')
            return;
        const { to } = event.payload;
        if (!to)
            return;
        const piece = state.board.getPiece(to);
        if (!piece)
            return;
        const cellEffects = state.board.getCellEffects(to);
        const trap = cellEffects.find(e => e.type === this.effectType && e.sourcePlayer !== piece.color);
        if (trap) {
            // Apply stun effect (2 rounds) to the enemy piece
            enqueueAction({
                type: 'APPLY_EFFECT',
                effect: {
                    id: `stun_${piece.id}_${Date.now()}`,
                    type: 'stun',
                    duration: 2,
                    remainingDuration: 2,
                    tickTiming: 'turnEnd',
                    sourcePlayer: trap.sourcePlayer,
                    targetType: 'piece',
                    targetId: piece.id,
                    stackingRule: 'refresh',
                    isDebuff: true,
                    metadata: {
                        sourceSkill: 'puppet_strings',
                        puppetPlayer: trap.sourcePlayer,
                    },
                }
            });
            // Remove the puppet_trap cell effect
            enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: trap.id,
                targetId: trap.targetId,
                targetType: 'cell',
                reason: 'triggered',
            });
        }
    }
}
exports.PuppetTrapHandler = PuppetTrapHandler;
//# sourceMappingURL=PuppetTrapHandler.js.map