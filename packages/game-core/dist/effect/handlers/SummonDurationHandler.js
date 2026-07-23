"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SummonDurationHandler = void 0;
const Board_1 = require("../../board/Board");
class SummonDurationHandler {
    effectType = 'summon_duration';
    subscribesTo = ['OnEffectExpired'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnEffectExpired')
            return;
        const { effectSnapshot, reason } = event.payload;
        if (effectSnapshot && effectSnapshot.type === 'summon_duration' && reason === 'expired') {
            const pieceId = effectSnapshot.targetId;
            // Find piece by ID on the board
            let foundPos = null;
            for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                    const p = state.board.getPiece({ col: c, row: r });
                    if (p && p.id === pieceId) {
                        foundPos = { col: c, row: r };
                        break;
                    }
                }
                if (foundPos)
                    break;
            }
            if (foundPos) {
                enqueueAction({
                    type: 'DESTROY_PIECE',
                    pieceId,
                    position: foundPos,
                    reason: 'effect_expired',
                });
            }
        }
    }
}
exports.SummonDurationHandler = SummonDurationHandler;
//# sourceMappingURL=SummonDurationHandler.js.map