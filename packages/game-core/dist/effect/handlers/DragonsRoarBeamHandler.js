"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DragonsRoarBeamHandler = void 0;
const Piece_1 = require("../../pieces/Piece");
class DragonsRoarBeamHandler {
    effectType = 'dragons_roar_beam';
    subscribesTo = ['OnMove', 'OnCapture'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnMove' && event.type !== 'OnCapture')
            return;
        const { pieceId, attackerId, to } = event.payload;
        const movingPieceId = event.type === 'OnMove' ? pieceId : attackerId;
        if (!to || !movingPieceId)
            return;
        const piece = state.board.getPiece(to);
        if (!piece || piece.type === Piece_1.PieceType.King)
            return;
        // Check if landing cell has a dragons_roar_beam effect
        const cellEffects = state.board.getCellEffects(to);
        const beamEffect = cellEffects.find(e => e.type === 'dragons_roar_beam' && e.sourcePlayer !== piece.color);
        if (beamEffect) {
            // Caster is beamEffect.sourcePlayer. The moving piece is an enemy.
            // Destroy the piece.
            enqueueAction({
                type: 'DESTROY_PIECE',
                pieceId: movingPieceId,
                position: to,
                reason: 'dragons_roar_beam',
            });
        }
    }
}
exports.DragonsRoarBeamHandler = DragonsRoarBeamHandler;
//# sourceMappingURL=DragonsRoarBeamHandler.js.map