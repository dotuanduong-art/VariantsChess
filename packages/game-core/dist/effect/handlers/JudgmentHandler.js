"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JudgmentHandler = void 0;
const Board_1 = require("../../board/Board");
const Piece_1 = require("../../pieces/Piece");
class JudgmentHandler {
    effectType = 'judgment_mark';
    subscribesTo = ['OnTurnEnd'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnTurnEnd')
            return;
        // Tick both players' judgment windows if active
        for (const color of [Piece_1.Color.White, Piece_1.Color.Black]) {
            const activeKey = `judgmentWindowActive_${color}`;
            const turnsKey = `judgmentWindowRemainingTurns_${color}`;
            if (state.variantState[activeKey]) {
                state.variantState[turnsKey]--;
                if (state.variantState[turnsKey] === 0) {
                    state.variantState[activeKey] = false;
                    // Destroy all pieces on the board carrying judgment_mark sourced by this color
                    for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                        for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                            const pos = { col: c, row: r };
                            const piece = state.board.getPiece(pos);
                            if (piece && piece.effects) {
                                const hasMark = piece.effects.some(e => e.type === 'judgment_mark' && e.sourcePlayer === color);
                                if (hasMark) {
                                    enqueueAction({
                                        type: 'DESTROY_PIECE',
                                        pieceId: piece.id,
                                        position: pos,
                                        reason: 'judgment',
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
exports.JudgmentHandler = JudgmentHandler;
//# sourceMappingURL=JudgmentHandler.js.map