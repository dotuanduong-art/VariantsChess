"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MagicianVariant = void 0;
const Piece_1 = require("../../pieces/Piece");
const PositionSwapHandler_1 = require("../../effect/handlers/PositionSwapHandler");
const MovesetSwapHandler_1 = require("../../effect/handlers/MovesetSwapHandler");
const FoolHandler_1 = require("../../effect/handlers/FoolHandler");
const apCostConfig_1 = require("../apCostConfig");
exports.MagicianVariant = {
    id: 'magician',
    name: 'Magician',
    description: 'The Magician manipulates the battlefield by swapping ally positions, swapping enemy movesets, and applying a "Fool" effect that forces pieces to walk forward.',
    effectHandlers: [
        new PositionSwapHandler_1.PositionSwapHandler(),
        new MovesetSwapHandler_1.MovesetSwapHandler(),
        new FoolHandler_1.FoolHandler(),
    ],
    getInitialState: () => ({ domainCount: 0 }),
    skills: [
        // ── Skill 1: Now You See Me (4 AP) ──
        {
            id: 'magician_swap_allies',
            name: 'Now You See Me',
            description: 'Hoán đổi vị trí lập tức giữa 2 quân đồng minh bất kỳ (trừ King) trong 3 rounds.',
            tier: 'skill1',
            apCost: apCostConfig_1.APCostConfig.magician.magician_skill_1,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                { type: 'piece', filter: 'ally', excludeKing: true, description: 'Chọn quân đồng minh thứ 1 (trừ King)' },
                { type: 'piece', filter: 'ally', excludeKing: true, description: 'Chọn quân đồng minh thứ 2 (trừ King)' },
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 2) {
                    return 'Select exactly 2 pieces';
                }
                for (const t of targets) {
                    if (t.type !== 'piece' || !t.position || !t.pieceId) {
                        return 'Invalid target';
                    }
                    const p = state.board.getPiece(t.position);
                    if (!p) {
                        return 'Piece not found';
                    }
                    if (p.color !== player) {
                        return 'Must target ally pieces';
                    }
                    if (p.type === Piece_1.PieceType.King) {
                        return 'Cannot target King';
                    }
                    if (p.effects && p.effects.some(e => e.type === 'position_swap' || e.type === 'moveset_swap')) {
                        return 'One or more targets are already swapped';
                    }
                }
                if (targets[0].pieceId === targets[1].pieceId) {
                    return 'Cannot select the same piece twice';
                }
                return null;
            },
            execute(state, player, targets) {
                const t1 = targets[0];
                const t2 = targets[1];
                const now = Date.now();
                const effectId1 = `pos_swap_${t1.pieceId}_${now}`;
                const effectId2 = `pos_swap_${t2.pieceId}_${now + 1}`;
                return [
                    {
                        type: 'SWAP_POSITIONS',
                        pieceAId: t1.pieceId,
                        positionA: t1.position,
                        pieceBId: t2.pieceId,
                        positionB: t2.position,
                        reason: 'skill',
                    },
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: effectId1,
                            type: 'position_swap',
                            duration: 3,
                            remainingDuration: 3,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: t1.pieceId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                partnerPieceId: t2.pieceId,
                            },
                        }
                    },
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: effectId2,
                            type: 'position_swap',
                            duration: 3,
                            remainingDuration: 3,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: t2.pieceId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                partnerPieceId: t1.pieceId,
                            },
                        }
                    }
                ];
            }
        },
        // ── Skill 2: Misdirection (7 AP) ──
        {
            id: 'magician_swap_movements',
            name: 'Misdirection',
            description: 'Hoán đổi move-set (piece.type) của 2 quân địch bất kỳ (trừ King) trong 3 rounds.',
            tier: 'skill2',
            apCost: apCostConfig_1.APCostConfig.magician.magician_skill_2,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                { type: 'piece', filter: 'enemy', excludeKing: true, description: 'Chọn quân địch thứ 1 (trừ King)' },
                { type: 'piece', filter: 'enemy', excludeKing: true, description: 'Chọn quân địch thứ 2 (trừ King)' },
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 2) {
                    return 'Select exactly 2 pieces';
                }
                for (const t of targets) {
                    if (t.type !== 'piece' || !t.position || !t.pieceId) {
                        return 'Invalid target';
                    }
                    const p = state.board.getPiece(t.position);
                    if (!p) {
                        return 'Piece not found';
                    }
                    if (p.color === player) {
                        return 'Must target enemy pieces';
                    }
                    if (p.type === Piece_1.PieceType.King) {
                        return 'Cannot target King';
                    }
                    if (p.effects && p.effects.some(e => e.type === 'position_swap' || e.type === 'moveset_swap')) {
                        return 'One or more targets are already swapped';
                    }
                }
                if (targets[0].pieceId === targets[1].pieceId) {
                    return 'Cannot select the same piece twice';
                }
                return null;
            },
            execute(state, player, targets) {
                const t1 = targets[0];
                const t2 = targets[1];
                const p1 = state.board.getPiece(t1.position);
                const p2 = state.board.getPiece(t2.position);
                const type1 = p1.type;
                const type2 = p2.type;
                // Swap their types directly on the board
                p1.type = type2;
                p2.type = type1;
                const now = Date.now();
                return [
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `moveset_swap_${t1.pieceId}_${now}`,
                            type: 'moveset_swap',
                            duration: 3,
                            remainingDuration: 3,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: t1.pieceId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                partnerPieceId: t2.pieceId,
                                originalType: type1,
                            },
                        }
                    },
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `moveset_swap_${t2.pieceId}_${now + 1}`,
                            type: 'moveset_swap',
                            duration: 3,
                            remainingDuration: 3,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: t2.pieceId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {
                                partnerPieceId: t1.pieceId,
                                originalType: type2,
                            },
                        }
                    }
                ];
            }
        },
        // ── Ultimate: Carnival of Fools (12 AP) ──
        {
            id: 'magician_fool',
            name: 'Carnival of Fools',
            description: 'Áp dụng hiệu ứng Fool lên tối đa 5 quân bất kỳ (đồng minh hoặc kẻ địch, trừ King) trong 5 rounds.',
            tier: 'ultimate',
            apCost: apCostConfig_1.APCostConfig.magician.magician_ultimate,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                { type: 'piece', filter: 'any', excludeKing: true, description: 'Chọn quân thứ 1 (trừ King)' },
                { type: 'piece', filter: 'any', excludeKing: true, description: 'Chọn quân thứ 2 (trừ King)' },
                { type: 'piece', filter: 'any', excludeKing: true, description: 'Chọn quân thứ 3 (trừ King)' },
                { type: 'piece', filter: 'any', excludeKing: true, description: 'Chọn quân thứ 4 (trừ King)' },
                { type: 'piece', filter: 'any', excludeKing: true, description: 'Chọn quân thứ 5 (trừ King)' },
            ],
            canActivate(state, player, targets) {
                if (targets.length < 1 || targets.length > 5) {
                    return 'Select between 1 and 5 pieces';
                }
                for (const t of targets) {
                    if (t.type !== 'piece' || !t.position || !t.pieceId) {
                        return 'Invalid target';
                    }
                    const p = state.board.getPiece(t.position);
                    if (!p) {
                        return 'Piece not found';
                    }
                    if (p.type === Piece_1.PieceType.King) {
                        return 'Cannot target King';
                    }
                }
                const ids = targets.map(t => t.pieceId);
                if (new Set(ids).size !== ids.length) {
                    return 'Cannot select the same piece twice';
                }
                return null;
            },
            execute(state, player, targets) {
                const actions = [];
                const now = Date.now();
                for (let i = 0; i < targets.length; i++) {
                    const t = targets[i];
                    actions.push({
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `fool_${t.pieceId}_${now}_${i}`,
                            type: 'fool',
                            duration: 5,
                            remainingDuration: 5,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: t.pieceId,
                            stackingRule: 'refresh',
                            isDebuff: true,
                            metadata: {},
                        }
                    });
                }
                return actions;
            }
        }
    ]
};
//# sourceMappingURL=MagicianVariant.js.map