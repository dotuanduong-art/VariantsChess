"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoullessHandler = void 0;
const ResolutionOrder_1 = require("../../event/ResolutionOrder");
const Board_1 = require("../../board/Board");
class SoullessHandler {
    effectType = 'soulless';
    subscribesTo = ['OnMove', 'OnCapture'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnMove' && event.type !== 'OnCapture')
            return;
        const { pieceId, attackerId, to } = event.payload;
        const movingPieceId = event.type === 'OnMove' ? pieceId : attackerId;
        if (!to || !movingPieceId)
            return;
        const movingPiece = state.board.getPiece(to);
        if (!movingPiece)
            return;
        // Search the entire board for any piece under 'soulless' effect
        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                const piece = state.board.getPiece({ col: c, row: r });
                if (piece && piece.effects) {
                    const soullessEffect = piece.effects.find(e => e.type === 'soulless');
                    if (soullessEffect && soullessEffect.metadata && soullessEffect.metadata.originalPosition) {
                        const orig = soullessEffect.metadata.originalPosition;
                        // Check if moving piece went to the originalPosition, and is an ALLY of the stunned piece (same color)
                        if (to.col === orig.col &&
                            to.row === orig.row &&
                            movingPiece.color === piece.color &&
                            movingPiece.id !== piece.id) {
                            enqueueAction({
                                type: 'REMOVE_EFFECT',
                                effectId: soullessEffect.id,
                                targetId: piece.id,
                                targetType: 'piece',
                                reason: 'released',
                            });
                        }
                    }
                }
            }
        }
    }
    /** Block movement of soulless pieces */
    validateAction(action, activeEffects, state) {
        if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
            const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
            const isSoulless = activeEffects.some(e => e.targetType === 'piece' && e.targetId === pieceId);
            if (isSoulless) {
                return 'This piece is soulless and cannot move';
            }
        }
        return null;
    }
    /** Soulless pieces have no legal moves */
    getMoveModifier(effect, state) {
        return {
            id: `soulless_${effect.id}`,
            priority: ResolutionOrder_1.PRIORITY.STUN_BLOCK,
            source: 'effect:soulless',
            modify(moves, context) {
                if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
                    return []; // no moves allowed
                }
                return moves;
            }
        };
    }
}
exports.SoullessHandler = SoullessHandler;
//# sourceMappingURL=SoullessHandler.js.map