"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardianLinkHandler = void 0;
const Board_1 = require("../../board/Board");
const index_1 = require("../../index");
class GuardianLinkHandler {
    effectType = 'guardian_link';
    subscribesTo = ['OnCapture'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnCapture')
            return;
        const { capturedPieceSnapshot, to } = event.payload;
        if (!capturedPieceSnapshot || !capturedPieceSnapshot.effects)
            return;
        const linkEffect = capturedPieceSnapshot.effects.find((e) => e.type === 'guardian_link');
        if (!linkEffect || !linkEffect.metadata)
            return;
        const { role, linkedPieceId, partnerEffectId } = linkEffect.metadata;
        if (!linkedPieceId)
            return;
        if (role === 'low') {
            // ── Low piece captured ──
            // 1. Respawn the low piece back at its captured cell
            enqueueAction({
                type: 'SPAWN_PIECE',
                piece: {
                    ...capturedPieceSnapshot,
                    // Remove link effect from the respawned piece
                    effects: capturedPieceSnapshot.effects.filter((e) => e.id !== linkEffect.id),
                },
                position: to,
            });
            // 2. Find and destroy the linked high-value piece
            let highPos = null;
            for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                    const p = state.board.getPiece({ col: c, row: r });
                    if (p && p.id === linkedPieceId) {
                        highPos = { col: c, row: r };
                        break;
                    }
                }
                if (highPos)
                    break;
            }
            if (highPos) {
                enqueueAction({
                    type: 'DESTROY_PIECE',
                    pieceId: linkedPieceId,
                    position: highPos,
                    reason: 'guardian_link_sacrifice',
                });
            }
            // 3. Remove the link effect from the high piece
            if (partnerEffectId) {
                enqueueAction({
                    type: 'REMOVE_EFFECT',
                    effectId: partnerEffectId,
                    targetId: linkedPieceId,
                    targetType: 'piece',
                    reason: 'guardian_link_triggered',
                });
            }
        }
        else if (role === 'high') {
            // ── High piece captured ──
            // 1. Give shield to the linked low-value piece
            const highType = capturedPieceSnapshot.type;
            let shieldDuration = 2; // Pawn default: 1 round (2 turns)
            if (highType === index_1.PieceType.Knight || highType === index_1.PieceType.Bishop) {
                shieldDuration = 4; // 2 rounds
            }
            else if (highType === index_1.PieceType.Rook) {
                shieldDuration = 6; // 3 rounds
            }
            else if (highType === index_1.PieceType.Queen) {
                shieldDuration = 8; // 4 rounds
            }
            enqueueAction({
                type: 'APPLY_EFFECT',
                effect: {
                    id: `shield_${linkedPieceId}_${Date.now()}`,
                    type: 'shield',
                    duration: shieldDuration,
                    remainingDuration: shieldDuration,
                    tickTiming: 'turnEnd',
                    sourcePlayer: event.activePlayer,
                    targetType: 'piece',
                    targetId: linkedPieceId,
                    stackingRule: 'refresh',
                    isDebuff: false,
                    metadata: {},
                },
            });
            // 2. Remove the link effect from the low piece
            if (partnerEffectId) {
                enqueueAction({
                    type: 'REMOVE_EFFECT',
                    effectId: partnerEffectId,
                    targetId: linkedPieceId,
                    targetType: 'piece',
                    reason: 'guardian_link_triggered',
                });
            }
        }
    }
}
exports.GuardianLinkHandler = GuardianLinkHandler;
//# sourceMappingURL=GuardianLinkHandler.js.map