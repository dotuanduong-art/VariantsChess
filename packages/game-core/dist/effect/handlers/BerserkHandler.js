"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BerserkHandler = void 0;
const Board_1 = require("../../board/Board");
class BerserkHandler {
    effectType = 'berserk';
    subscribesTo = ['OnTurnStart', 'OnCapture'];
    handle(event, state, enqueueAction) {
        if (event.type === 'OnTurnStart') {
            const activePlayer = event.activePlayer ?? event.payload.activePlayer;
            if (!activePlayer)
                return;
            // Scan the board to find all pieces owned by the active player with Berserk effect
            for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                    const piece = state.board.getPiece({ col: c, row: r });
                    if (piece && piece.color === activePlayer && piece.effects) {
                        const berserkEffect = piece.effects.find(e => e.type === 'berserk');
                        if (berserkEffect) {
                            if (!berserkEffect.metadata) {
                                berserkEffect.metadata = {};
                            }
                            if (berserkEffect.metadata.captureCountdown === undefined) {
                                berserkEffect.metadata.captureCountdown = 2;
                            }
                            // Decrement countdown, unless it's the first turn start after application
                            if (berserkEffect.metadata.isFirstTurnStart) {
                                berserkEffect.metadata.isFirstTurnStart = false;
                            }
                            else {
                                berserkEffect.metadata.captureCountdown -= 1;
                            }
                            if (berserkEffect.metadata.captureCountdown <= 0) {
                                if (!berserkEffect.metadata.capturedThisWindow) {
                                    enqueueAction({
                                        type: 'APPLY_EFFECT',
                                        effect: {
                                            id: `stun_berserk_${piece.id}_${Date.now()}`,
                                            type: 'stun',
                                            duration: 3,
                                            remainingDuration: 3,
                                            tickTiming: 'turnEnd',
                                            sourcePlayer: berserkEffect.sourcePlayer,
                                            targetType: 'piece',
                                            targetId: piece.id,
                                            stackingRule: 'refresh',
                                            isDebuff: true,
                                            metadata: {},
                                        },
                                    });
                                    // Remove Berserk effect
                                    enqueueAction({
                                        type: 'REMOVE_EFFECT',
                                        effectId: berserkEffect.id,
                                        targetId: piece.id,
                                        targetType: 'piece',
                                        reason: 'berserk_timeout',
                                    });
                                }
                                else {
                                    // Reset window if they did capture
                                    berserkEffect.metadata.captureCountdown = 2;
                                    berserkEffect.metadata.capturedThisWindow = false;
                                }
                            }
                            else {
                                // If countdown is not 0, reset capturedThisWindow to false for a new turn?
                                // Wait! If they capture, we reset captureCountdown to 4 immediately on capture,
                                // so captureCountdown will be 3 on next OnTurnStart.
                                // We should only reset capturedThisWindow to false when starting a new turn if countdown is not 0.
                                berserkEffect.metadata.capturedThisWindow = false;
                            }
                        }
                    }
                }
            }
        }
        if (event.type === 'OnCapture') {
            const { attackerId, to } = event.payload;
            if (!to)
                return;
            const piece = state.board.getPiece(to);
            if (piece && piece.id === attackerId && piece.effects) {
                const berserkEffect = piece.effects.find(e => e.type === 'berserk');
                if (berserkEffect) {
                    enqueueAction({
                        type: 'REMOVE_EFFECT',
                        effectId: berserkEffect.id,
                        targetId: piece.id,
                        targetType: 'piece',
                        reason: 'berserk_captured',
                    });
                }
            }
        }
    }
}
exports.BerserkHandler = BerserkHandler;
//# sourceMappingURL=BerserkHandler.js.map