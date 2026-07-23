"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SailingHandler = void 0;
const ResolutionOrder_1 = require("../../event/ResolutionOrder");
const Board_1 = require("../../board/Board");
const Piece_1 = require("../../pieces/Piece");
class SailingHandler {
    effectType = 'sailing';
    subscribesTo = ['OnEffectExpired'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnEffectExpired')
            return;
        const { effectSnapshot } = event.payload;
        if (!effectSnapshot || effectSnapshot.type !== 'sailing')
            return;
        const { targetPieceId, destCol, destRow } = effectSnapshot.metadata;
        const destPos = { col: destCol, row: destRow };
        // Find the piece on the board
        let piecePos = null;
        let piece = null;
        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                const p = state.board.getPiece({ col: c, row: r });
                if (p && p.id === targetPieceId) {
                    piecePos = { col: c, row: r };
                    piece = p;
                    break;
                }
            }
            if (piece)
                break;
        }
        // If piece was destroyed/captured during sailing, do nothing
        if (!piece || !piecePos)
            return;
        const destPiece = state.board.getPiece(destPos);
        if (!destPiece) {
            // Empty cell -> Move
            enqueueAction({
                type: 'MOVE_PIECE',
                pieceId: piece.id,
                from: piecePos,
                to: destPos,
            });
        }
        else if (destPiece.color !== piece.color) {
            // Enemy piece -> Capture (unless it is enemy King, as King capture rules are handled elsewhere or King cannot be captured this way)
            if (destPiece.type !== Piece_1.PieceType.King) {
                enqueueAction({
                    type: 'CAPTURE',
                    attackerId: piece.id,
                    from: piecePos,
                    to: destPos,
                    capturedPieceId: destPiece.id,
                    capturedPieceSnapshot: { ...destPiece, effects: destPiece.effects ? destPiece.effects.map(e => ({ ...e })) : [] },
                    stayInPlace: false,
                });
            }
        }
        // Allied piece -> do nothing (sailing fails, piece stays where it is)
    }
    validateAction(action, activeEffects, state) {
        if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
            const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
            const isActive = activeEffects.some(e => e.targetType === 'piece' && e.targetId === pieceId && e.type === this.effectType);
            if (isActive) {
                return 'This piece is Sailing and cannot move';
            }
        }
        return null;
    }
    getMoveModifier(effect, state) {
        return {
            id: `sailing_modifier_${effect.id}`,
            priority: ResolutionOrder_1.PRIORITY.STUN_BLOCK,
            source: 'effect:sailing',
            modify(moves, context) {
                if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
                    return []; // block all standard movements
                }
                return moves;
            }
        };
    }
}
exports.SailingHandler = SailingHandler;
//# sourceMappingURL=SailingHandler.js.map