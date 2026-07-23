"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FoolHandler = void 0;
const Board_1 = require("../../board/Board");
const Position_1 = require("../../board/Position");
const Piece_1 = require("../../pieces/Piece");
class FoolHandler {
    effectType = 'fool';
    subscribesTo = ['OnTurnStart'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnTurnStart')
            return;
        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                const pos = { col: c, row: r };
                const piece = state.board.getPiece(pos);
                if (piece && piece.color === event.activePlayer) {
                    const hasFool = piece.effects?.some(e => e.type === 'fool');
                    if (hasFool) {
                        const rowOffset = piece.color === Piece_1.Color.White ? 1 : -1;
                        const dest = { col: c, row: r + rowOffset };
                        if ((0, Position_1.isInBounds)(dest)) {
                            const pieceAtDest = state.board.getPiece(dest);
                            const cellEffects = state.board.getCellEffects(dest) || [];
                            const hasObstacle = cellEffects.some(e => e.type === 'flame');
                            if (pieceAtDest === null && !hasObstacle) {
                                enqueueAction({
                                    type: 'FOOL_MOVE',
                                    pieceId: piece.id,
                                    from: pos,
                                    to: dest,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
}
exports.FoolHandler = FoolHandler;
//# sourceMappingURL=FoolHandler.js.map