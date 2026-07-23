"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequiemVariant = void 0;
const Piece_1 = require("../../pieces/Piece");
const FateHandler_1 = require("../../effect/handlers/FateHandler");
const BerserkHandler_1 = require("../../effect/handlers/BerserkHandler");
const apCostConfig_1 = require("../apCostConfig");
exports.RequiemVariant = {
    id: 'requiem',
    name: 'Requiem',
    description: 'Harvest souls, curse enemies with berserk, and link fates.',
    effectHandlers: [new FateHandler_1.FateHandler(), new BerserkHandler_1.BerserkHandler()],
    passiveHooks: (state, player) => [{
            id: `requiem_soul_harvest_${player}`,
            eventType: 'OnCapture',
            priority: 500,
            source: `variant:requiem:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnCapture')
                    return;
                // Only trigger when the Requiem player performs a capture
                if (event.activePlayer !== player)
                    return;
                enqueueAction({
                    type: 'GAIN_AP',
                    player,
                    amount: 1,
                    source: 'passive:soul_harvest',
                });
            }
        }],
    skills: [
        // ── Skill 1: Soul Break (4 AP) ──
        // Apply Berserk to 1 enemy piece (excludeKing)
        {
            id: 'requiem_soul_break',
            name: 'Soul Break',
            description: 'Chọn 1 quân địch (trừ King) để nguyền rủa bằng Berserk.',
            tier: 'skill1',
            apCost: apCostConfig_1.APCostConfig.requiem.requiem_skill_1,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'piece',
                    filter: 'enemy',
                    excludeKing: true,
                    description: 'Chọn 1 quân địch (trừ King)',
                }],
            canActivate(state, player, targets) {
                if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
                    return 'Select 1 enemy piece';
                }
                const piece = state.board.getPiece(targets[0].position);
                if (!piece || piece.color === player) {
                    return 'Must target an enemy piece';
                }
                if (piece.type === Piece_1.PieceType.King) {
                    return 'Cannot target King';
                }
                return null;
            },
            execute(state, player, targets) {
                return [{
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `berserk_${targets[0].pieceId}_${Date.now()}`,
                            type: 'berserk',
                            duration: null,
                            remainingDuration: null,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: targets[0].pieceId,
                            stackingRule: 'ignore',
                            isDebuff: true,
                            metadata: { captureCountdown: 2, capturedThisWindow: false, isFirstTurnStart: true },
                        }
                    }];
            }
        },
        // ── Skill 2: Thread of Fate (6 AP) ──
        // Link 1 ally + 1 enemy with Fate effect, duration 3 rounds
        {
            id: 'requiem_thread_of_fate',
            name: 'Thread of Fate',
            description: 'Liên kết sinh mệnh giữa 1 quân đồng minh và 1 quân địch. Khi 1 quân chết, quân kia cũng chết theo.',
            tier: 'skill2',
            apCost: apCostConfig_1.APCostConfig.requiem.requiem_skill_2,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                { type: 'piece', filter: 'ally', excludeKing: true, description: 'Chọn 1 quân đồng minh (trừ King)' },
                { type: 'piece', filter: 'enemy', excludeKing: true, description: 'Chọn 1 quân địch (trừ King)' },
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 2)
                    return 'Select 1 ally and 1 enemy piece';
                for (let i = 0; i < 2; i++) {
                    const t = targets[i];
                    if (t.type !== 'piece' || !t.position || !t.pieceId) {
                        return 'Invalid target';
                    }
                    const piece = state.board.getPiece(t.position);
                    if (!piece)
                        return 'Piece not found';
                    if (piece.type === Piece_1.PieceType.King)
                        return 'Cannot target King';
                }
                // Validate ally/enemy filters
                const piece0 = state.board.getPiece(targets[0].position);
                const piece1 = state.board.getPiece(targets[1].position);
                if (!piece0 || piece0.color !== player)
                    return 'First target must be an ally piece';
                if (!piece1 || piece1.color === player)
                    return 'Second target must be an enemy piece';
                return null;
            },
            execute(state, player, targets) {
                const now = Date.now();
                const effectIdA = `fate_${targets[0].pieceId}_${now}`;
                const effectIdB = `fate_${targets[1].pieceId}_${now + 1}`;
                return [
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: effectIdA,
                            type: 'fate',
                            duration: 3,
                            remainingDuration: 3,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: targets[0].pieceId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                linkedPieceId: targets[1].pieceId,
                                linkedEffectId: effectIdB,
                            },
                        }
                    },
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: effectIdB,
                            type: 'fate',
                            duration: 3,
                            remainingDuration: 3,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: targets[1].pieceId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                linkedPieceId: targets[0].pieceId,
                                linkedEffectId: effectIdA,
                            },
                        }
                    },
                ];
            }
        },
        // ── Ultimate: Reaper's Decree (10 AP) ──
        // Link 2 enemy pieces with Fate effect, duration 5 rounds
        {
            id: 'requiem_reapers_decree',
            name: "Reaper's Decree",
            description: 'Gắn hiệu ứng Fate lên 2 quân địch. Khi 1 quân chết, quân kia cũng chết theo.',
            tier: 'ultimate',
            apCost: apCostConfig_1.APCostConfig.requiem.requiem_ultimate,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                { type: 'piece', filter: 'enemy', excludeKing: true, description: 'Chọn quân địch thứ 1 (trừ King)' },
                { type: 'piece', filter: 'enemy', excludeKing: true, description: 'Chọn quân địch thứ 2 (trừ King)' },
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 2)
                    return 'Select 2 enemy pieces';
                for (let i = 0; i < 2; i++) {
                    const t = targets[i];
                    if (t.type !== 'piece' || !t.position || !t.pieceId) {
                        return 'Invalid target';
                    }
                    const piece = state.board.getPiece(t.position);
                    if (!piece)
                        return 'Piece not found';
                    if (piece.color === player)
                        return 'Must target enemy pieces';
                    if (piece.type === Piece_1.PieceType.King)
                        return 'Cannot target King';
                }
                // Cannot select the same piece twice
                if (targets[0].pieceId === targets[1].pieceId) {
                    return 'Cannot select the same piece twice';
                }
                return null;
            },
            execute(state, player, targets) {
                const now = Date.now();
                const effectIdA = `fate_${targets[0].pieceId}_${now}`;
                const effectIdB = `fate_${targets[1].pieceId}_${now + 1}`;
                return [
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: effectIdA,
                            type: 'fate',
                            duration: 5,
                            remainingDuration: 5,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: targets[0].pieceId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                linkedPieceId: targets[1].pieceId,
                                linkedEffectId: effectIdB,
                            },
                        }
                    },
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: effectIdB,
                            type: 'fate',
                            duration: 5,
                            remainingDuration: 5,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: targets[1].pieceId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                linkedPieceId: targets[0].pieceId,
                                linkedEffectId: effectIdA,
                            },
                        }
                    },
                ];
            }
        }
    ]
};
//# sourceMappingURL=RequiemVariant.js.map