"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FateHandler = void 0;
const ResolutionOrder_1 = require("../../event/ResolutionOrder");
const Board_1 = require("../../board/Board");
/**
 * FateHandler — manages the Fate effect that links two pieces.
 *
 * When a piece with Fate is destroyed, the linked piece is also destroyed.
 * When Fate expires on one piece, the partner's Fate effect is also removed.
 */
class FateHandler {
    effectType = 'fate';
    subscribesTo = ['OnBeforePieceDestroyed', 'OnEffectExpired'];
    priority = ResolutionOrder_1.PRIORITY.BEFORE_DESTROY_FATE; // 200
    handle(event, state, enqueueAction) {
        // ── OnBeforePieceDestroyed ──
        // When a piece with Fate is about to die, enqueue destruction of the linked piece
        if (event.type === 'OnBeforePieceDestroyed') {
            const { pieceSnapshot, position } = event.payload;
            if (!pieceSnapshot || !pieceSnapshot.effects)
                return;
            const fateEffect = pieceSnapshot.effects.find((e) => e.type === 'fate');
            if (!fateEffect)
                return;
            const linkedPieceId = fateEffect.metadata?.linkedPieceId;
            const linkedEffectId = fateEffect.metadata?.linkedEffectId;
            if (!linkedPieceId)
                return;
            // Scan board for the linked piece
            let linkedPiece = null;
            for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                    const p = state.board.getPiece({ col: c, row: r });
                    if (p && p.id === linkedPieceId) {
                        linkedPiece = { id: p.id, pos: { col: c, row: r } };
                        break;
                    }
                }
                if (linkedPiece)
                    break;
            }
            // If linked piece still exists on board, destroy it
            if (linkedPiece) {
                enqueueAction({
                    type: 'DESTROY_PIECE',
                    pieceId: linkedPiece.id,
                    position: linkedPiece.pos,
                    reason: 'fate',
                });
            }
            // Remove Fate effect from the dying piece (cleanup)
            enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: fateEffect.id,
                targetId: pieceSnapshot.id,
                targetType: 'piece',
                reason: 'fate_triggered',
            });
            // Remove Fate effect from the linked piece (cleanup)
            if (linkedEffectId) {
                enqueueAction({
                    type: 'REMOVE_EFFECT',
                    effectId: linkedEffectId,
                    targetId: linkedPieceId,
                    targetType: 'piece',
                    reason: 'fate_triggered',
                });
            }
        }
        // ── OnEffectExpired ──
        // When Fate expires on one piece (duration tick), also remove partner's Fate
        if (event.type === 'OnEffectExpired') {
            const { effectSnapshot } = event.payload;
            if (!effectSnapshot || effectSnapshot.type !== 'fate')
                return;
            const linkedEffectId = effectSnapshot.metadata?.linkedEffectId;
            if (!linkedEffectId)
                return;
            // Enqueue removal of partner's Fate effect
            // If partner's Fate has already been removed (same tick), REMOVE_EFFECT is a no-op
            enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: linkedEffectId,
                targetId: effectSnapshot.metadata.linkedPieceId,
                targetType: 'piece',
                reason: 'fate_partner_expired',
            });
        }
    }
}
exports.FateHandler = FateHandler;
//# sourceMappingURL=FateHandler.js.map