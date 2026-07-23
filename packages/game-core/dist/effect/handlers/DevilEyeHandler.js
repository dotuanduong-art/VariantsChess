"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevilEyeHandler = void 0;
const Piece_1 = require("../../pieces/Piece");
const AttackDetection_1 = require("../../combat/AttackDetection");
const Board_1 = require("../../board/Board");
class DevilEyeHandler {
    effectType = 'devil_eye';
    subscribesTo = ['OnTurnEnd'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnTurnEnd')
            return;
        // Scan board for any piece carrying 'devil_eye'
        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                const pos = { col: c, row: r };
                const piece = state.board.getPiece(pos);
                if (piece && piece.effects) {
                    const eyeEffect = piece.effects.find(e => e.type === 'devil_eye');
                    if (eyeEffect) {
                        // Determine the enemy color relative to this piece
                        const enemyColor = (0, Piece_1.oppositeColor)(piece.color);
                        // Get all attacks from enemy pieces
                        const attacks = (0, AttackDetection_1.getAttackedPieces)(state.board, enemyColor, state);
                        // Filter attacks pointing specifically at this piece's position
                        const attackingThreats = attacks.filter(a => a.targetPos.col === pos.col && a.targetPos.row === pos.row);
                        if (attackingThreats.length > 0) {
                            // Apply Stun 6 turns (3 rounds) to each attacking piece (the kẻ đang chiếu)
                            for (const threat of attackingThreats) {
                                enqueueAction({
                                    type: 'APPLY_EFFECT',
                                    effect: {
                                        id: `stun_${threat.attacker.id}_${Date.now()}`,
                                        type: 'stun',
                                        duration: 3,
                                        remainingDuration: 3,
                                        tickTiming: 'turnEnd',
                                        sourcePlayer: eyeEffect.sourcePlayer,
                                        targetType: 'piece',
                                        targetId: threat.attacker.id,
                                        stackingRule: 'refresh',
                                        isDebuff: true,
                                        metadata: {},
                                    }
                                });
                            }
                            // Remove Devil Eye effect immediately (one-time trigger)
                            enqueueAction({
                                type: 'REMOVE_EFFECT',
                                effectId: eyeEffect.id,
                                targetId: piece.id,
                                targetType: 'piece',
                                reason: 'devil_eye_triggered',
                            });
                        }
                    }
                }
            }
        }
    }
}
exports.DevilEyeHandler = DevilEyeHandler;
//# sourceMappingURL=DevilEyeHandler.js.map