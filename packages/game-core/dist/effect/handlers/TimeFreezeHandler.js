"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeFreezeHandler = void 0;
const Piece_1 = require("../../pieces/Piece");
class TimeFreezeHandler {
    effectType = 'time_freeze';
    subscribesTo = ['OnMove', 'OnCapture'];
    handle(event, state, enqueueAction) {
        // Check if either player has time_freeze active
        const whiteTF = state.whitePlayerEffects.find(e => e.type === 'time_freeze');
        const blackTF = state.blackPlayerEffects.find(e => e.type === 'time_freeze');
        if (!whiteTF && !blackTF)
            return;
        let tfEffect;
        let opponentColor;
        if (whiteTF) {
            tfEffect = whiteTF;
            opponentColor = Piece_1.Color.Black;
        }
        else {
            tfEffect = blackTF;
            opponentColor = Piece_1.Color.White;
        }
        const remainingRounds = tfEffect.remainingDuration;
        if (remainingRounds === null || remainingRounds <= 0)
            return;
        if (event.type === 'OnMove') {
            const { pieceId, to } = event.payload;
            const piece = state.board.getPiece(to);
            if (piece && piece.id === pieceId && piece.color === opponentColor && piece.type !== Piece_1.PieceType.King) {
                enqueueAction({
                    type: 'APPLY_EFFECT',
                    effect: {
                        id: `stun_timefreeze_${pieceId}_${Date.now()}`,
                        type: 'stun',
                        duration: remainingRounds,
                        remainingDuration: remainingRounds,
                        tickTiming: 'turnEnd',
                        sourcePlayer: tfEffect.sourcePlayer,
                        targetType: 'piece',
                        targetId: pieceId,
                        stackingRule: 'refresh',
                        isDebuff: true,
                        metadata: {},
                    },
                });
            }
        }
        else if (event.type === 'OnCapture') {
            const { attackerId, to } = event.payload;
            const piece = state.board.getPiece(to);
            if (piece && piece.id === attackerId && piece.color === opponentColor && piece.type !== Piece_1.PieceType.King) {
                enqueueAction({
                    type: 'APPLY_EFFECT',
                    effect: {
                        id: `stun_timefreeze_${attackerId}_${Date.now()}`,
                        type: 'stun',
                        duration: remainingRounds,
                        remainingDuration: remainingRounds,
                        tickTiming: 'turnEnd',
                        sourcePlayer: tfEffect.sourcePlayer,
                        targetType: 'piece',
                        targetId: attackerId,
                        stackingRule: 'refresh',
                        isDebuff: true,
                        metadata: {},
                    },
                });
            }
        }
    }
}
exports.TimeFreezeHandler = TimeFreezeHandler;
//# sourceMappingURL=TimeFreezeHandler.js.map