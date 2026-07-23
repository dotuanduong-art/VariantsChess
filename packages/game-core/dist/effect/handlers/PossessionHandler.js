"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PossessionHandler = void 0;
const Board_1 = require("../../board/Board");
class PossessionHandler {
    effectType = 'possession_active';
    subscribesTo = ['OnCapture'];
    findPieceById(state, id) {
        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                const pos = { col: c, row: r };
                const p = state.board.getPiece(pos);
                if (p && p.id === id) {
                    return { piece: p, pos };
                }
            }
        }
        return null;
    }
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnCapture')
            return;
        const player = event.activePlayer;
        const playerEffects = state.getPlayerEffects(player);
        const isPossessionActive = playerEffects.some(e => e.type === 'possession_active');
        if (!isPossessionActive)
            return;
        const { attackerId, capturedPieceSnapshot } = event.payload;
        if (!attackerId || !capturedPieceSnapshot)
            return;
        const foundAttacker = this.findPieceById(state, attackerId);
        if (!foundAttacker)
            return;
        const { piece: attacker, pos: attackerPos } = foundAttacker;
        if (attacker.color !== player)
            return;
        const ghostEffect = attacker.effects?.find(e => e.type === 'ghost');
        if (ghostEffect) {
            // 1. Transform piece
            enqueueAction({
                type: 'TRANSFORM_PIECE',
                pieceId: attacker.id,
                position: attackerPos,
                newType: capturedPieceSnapshot.type,
            });
            // 2. Remove Ghost effect from attacker
            enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: ghostEffect.id,
                targetId: attacker.id,
                targetType: 'piece',
                reason: 'possession_transformation',
            });
        }
    }
}
exports.PossessionHandler = PossessionHandler;
//# sourceMappingURL=PossessionHandler.js.map