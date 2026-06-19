"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BombHandler = void 0;
const ResolutionOrder_1 = require("../../event/ResolutionOrder");
const Region_1 = require("../../region/Region");
const Piece_1 = require("../../pieces/Piece");
class BombHandler {
    effectType = 'bomb';
    subscribesTo = ['OnPieceDestroyed'];
    priority = ResolutionOrder_1.PRIORITY.DESTROY_BOMB;
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnPieceDestroyed')
            return;
        const { pieceSnapshot, position } = event.payload;
        if (!pieceSnapshot)
            return;
        // Check if the piece snapshot had a bomb effect
        const bombEffect = pieceSnapshot.effects?.find((e) => e.type === 'bomb');
        if (!bombEffect)
            return;
        // 1. Enqueue REMOVE_EFFECT for the bomb effect
        enqueueAction({
            type: 'REMOVE_EFFECT',
            effectId: bombEffect.id,
            targetId: bombEffect.targetId,
            targetType: 'piece',
            reason: 'explosion',
        });
        // 2. Retrieve adjacent cells in a 3x3 region centered at position
        const cells = (0, Region_1.getSquareRegion)(position, 3);
        // 3. For each cell, check if a piece is present on the board
        for (const cell of cells) {
            const piece = state.board.getPiece(cell);
            if (piece && piece.type !== Piece_1.PieceType.King) {
                enqueueAction({
                    type: 'DESTROY_PIECE',
                    pieceId: piece.id,
                    position: cell,
                    reason: 'explosion',
                });
            }
        }
    }
}
exports.BombHandler = BombHandler;
//# sourceMappingURL=BombHandler.js.map