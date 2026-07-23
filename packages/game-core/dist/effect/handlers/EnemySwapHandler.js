"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnemySwapHandler = void 0;
const Board_1 = require("../../board/Board");
class EnemySwapHandler {
    effectType = 'enemy_position_swap';
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
            const effect = pieceSnapshot.effects.find((e) => e.type === 'enemy_position_swap');
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
                const partnerEffect = partner.piece.effects?.find(e => e.type === 'enemy_position_swap');
                if (partnerEffect) {
                    enqueueAction({
                        type: 'REMOVE_EFFECT',
                        effectId: partnerEffect.id,
                        targetId: partnerId,
                        targetType: 'piece',
                        reason: 'cancelled',
                    });
                }
            }
        }
        if (event.type === 'OnEffectExpired') {
            const { effectId, reason, effectSnapshot } = event.payload;
            if (!effectSnapshot || effectSnapshot.type !== 'enemy_position_swap')
                return;
            if (reason !== 'expired')
                return;
            const partnerPieceId = effectSnapshot.metadata.partnerPieceId;
            // Find current positions of both pieces
            const thisPiece = this.findPieceById(state, effectSnapshot.targetId);
            const partnerPiece = this.findPieceById(state, partnerPieceId);
            if (thisPiece && partnerPiece) {
                const partnerEffect = partnerPiece.piece.effects?.find(e => e.type === 'enemy_position_swap');
                if (partnerEffect) {
                    // Swap their current positions back
                    enqueueAction({
                        type: 'SWAP_POSITIONS',
                        pieceAId: thisPiece.piece.id,
                        positionA: thisPiece.pos,
                        pieceBId: partnerPiece.piece.id,
                        positionB: partnerPiece.pos,
                        reason: 'wizard_revert',
                    });
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
exports.EnemySwapHandler = EnemySwapHandler;
//# sourceMappingURL=EnemySwapHandler.js.map