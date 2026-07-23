"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovesetSwapHandler = void 0;
const Board_1 = require("../../board/Board");
class MovesetSwapHandler {
    effectType = 'moveset_swap';
    subscribesTo = ['OnBeforePieceDestroyed', 'OnEffectExpired'];
    findPieceById(state, id) {
        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                const p = state.board.getPiece({ col: c, row: r });
                if (p && p.id === id) {
                    return { piece: p, pos: { col: c, row: r } };
                }
            }
        }
        return null;
    }
    handle(event, state, enqueueAction) {
        if (event.type === 'OnBeforePieceDestroyed') {
            const { pieceSnapshot } = event.payload;
            if (!pieceSnapshot || !pieceSnapshot.effects)
                return;
            const effect = pieceSnapshot.effects.find((e) => e.type === 'moveset_swap');
            if (!effect)
                return;
            const partnerId = effect.metadata.partnerPieceId;
            const partner = this.findPieceById(state, partnerId);
            // Clean up effect on both partners
            enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: effect.id,
                targetId: pieceSnapshot.id,
                targetType: 'piece',
                reason: 'cancelled',
            });
            if (partner) {
                // Revert partner type to original immediately
                const partnerEffect = partner.piece.effects?.find(e => e.type === 'moveset_swap');
                if (partnerEffect) {
                    partner.piece.type = partnerEffect.metadata.originalType;
                    enqueueAction({
                        type: 'REMOVE_EFFECT',
                        effectId: partnerEffect.id,
                        targetId: partnerId,
                        targetType: 'piece',
                        reason: 'cancelled',
                    });
                }
                // Apply stun to partner for 2 rounds (duration 4)
                enqueueAction({
                    type: 'APPLY_EFFECT',
                    effect: {
                        id: `stun_${partnerId}_${Date.now()}`,
                        type: 'stun',
                        duration: 2,
                        remainingDuration: 2,
                        tickTiming: 'turnEnd',
                        sourcePlayer: effect.sourcePlayer,
                        targetType: 'piece',
                        targetId: partnerId,
                        stackingRule: 'refresh',
                        isDebuff: true,
                        metadata: {},
                    },
                });
            }
        }
        if (event.type === 'OnEffectExpired') {
            const { effectId, reason, effectSnapshot } = event.payload;
            if (!effectSnapshot || effectSnapshot.type !== 'moveset_swap')
                return;
            // If this piece promoted, keep its new type (Queen) and do not revert it
            if (reason === 'promoted')
                return;
            // If early cancelled (due to death), the OnBeforePieceDestroyed already handled the partner
            if (reason === 'cancelled')
                return;
            // Revert this piece
            const thisPiece = this.findPieceById(state, effectSnapshot.targetId);
            if (thisPiece) {
                thisPiece.piece.type = effectSnapshot.metadata.originalType;
            }
            // If natural expiry ('expired'), also trigger partner reversion
            if (reason === 'expired') {
                const partnerPieceId = effectSnapshot.metadata.partnerPieceId;
                const partnerPiece = this.findPieceById(state, partnerPieceId);
                if (partnerPiece) {
                    const partnerEffect = partnerPiece.piece.effects?.find(e => e.type === 'moveset_swap');
                    if (partnerEffect) {
                        partnerPiece.piece.type = partnerEffect.metadata.originalType;
                        // Remove the partner's effect with reason 'reverted' to prevent double execution
                        enqueueAction({
                            type: 'REMOVE_EFFECT',
                            effectId: partnerEffect.id,
                            targetId: partnerPieceId,
                            targetType: 'piece',
                            reason: 'reverted',
                        });
                    }
                }
            }
        }
    }
}
exports.MovesetSwapHandler = MovesetSwapHandler;
//# sourceMappingURL=MovesetSwapHandler.js.map