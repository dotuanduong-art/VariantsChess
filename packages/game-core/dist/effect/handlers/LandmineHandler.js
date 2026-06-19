"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandmineHandler = void 0;
const Piece_1 = require("../../pieces/Piece");
class LandmineHandler {
    effectType = 'landmine';
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
        // Check if landing cell has a landmine of the opponent player
        const cellEffects = state.board.getCellEffects(to);
        const landmine = cellEffects.find(e => e.type === 'landmine' && e.sourcePlayer !== piece.color);
        if (landmine) {
            // 1. If moving piece is NOT King, apply bomb effect
            if (piece.type !== Piece_1.PieceType.King) {
                enqueueAction({
                    type: 'APPLY_EFFECT',
                    effect: {
                        id: `bomb_${piece.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                        type: 'bomb',
                        duration: null,
                        remainingDuration: null,
                        tickTiming: 'turnEnd',
                        sourcePlayer: landmine.sourcePlayer,
                        targetType: 'piece',
                        targetId: piece.id,
                        stackingRule: 'ignore',
                        isDebuff: true,
                        metadata: {},
                    }
                });
            }
            // 2. Remove landmine cell effect
            enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: landmine.id,
                targetId: landmine.targetId,
                targetType: 'cell',
                reason: 'triggered',
            });
        }
    }
}
exports.LandmineHandler = LandmineHandler;
//# sourceMappingURL=LandmineHandler.js.map