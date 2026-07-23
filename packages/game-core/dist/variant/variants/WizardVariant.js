"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WizardVariant = void 0;
const Piece_1 = require("../../pieces/Piece");
const Board_1 = require("../../board/Board");
const Piece_2 = require("../../pieces/Piece");
const DeathCounterHandler_1 = require("../../effect/handlers/DeathCounterHandler");
const EnemySwapHandler_1 = require("../../effect/handlers/EnemySwapHandler");
const BindHandler_1 = require("../../effect/handlers/BindHandler");
const apCostConfig_1 = require("../apCostConfig");
function getUltimateTargets(state, player) {
    const opponent = (0, Piece_2.oppositeColor)(player);
    const targets = [];
    for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
        for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            const piece = state.board.getPiece(pos);
            if (piece && piece.color === opponent && piece.effects) {
                const dc = piece.effects.find(e => e.type === 'death_counter' && e.sourcePlayer === player);
                if (dc && dc.metadata && dc.metadata.count === 6) {
                    targets.push({ piece, pos });
                }
            }
        }
    }
    return targets;
}
const getEscalatedCost = (baseKey) => (state, player) => {
    const key = player === Piece_1.Color.White ? 'wizardSkillUseCount_white' : 'wizardSkillUseCount_black';
    const useCount = state.variantState[key] ?? 0;
    const base = apCostConfig_1.APCostConfig.wizard[baseKey];
    return base + Math.floor(useCount / 2) * 2;
};
exports.WizardVariant = {
    id: 'wizard',
    name: 'Wizard',
    description: 'Vị pháp sư thao túng chiến trường bằng ma pháp cổ xưa: hoán đổi vị trí kẻ địch, trói buộc tầm đi và hủy diệt kẻ mang dấu ấn Tử Vong.',
    effectHandlers: [
        new DeathCounterHandler_1.DeathCounterHandler(),
        new EnemySwapHandler_1.EnemySwapHandler(),
        new BindHandler_1.BindHandler(),
    ],
    getInitialState: () => ({
        wizardSkillUseCount_white: 0,
        wizardSkillUseCount_black: 0,
    }),
    passiveHooks: (state, player) => [
        {
            id: 'wizard_skill_use_tracker',
            eventType: 'OnSkillUsed',
            priority: 100,
            source: 'variant:wizard',
            handler: (event) => {
                const { skillId } = event.payload;
                if (event.activePlayer === player && (skillId === 'wizard_arcane_swap' || skillId === 'wizard_arcane_bind')) {
                    const key = player === Piece_1.Color.White ? 'wizardSkillUseCount_white' : 'wizardSkillUseCount_black';
                    state.variantState[key] = (state.variantState[key] ?? 0) + 1;
                }
            }
        }
    ],
    skills: [
        // ── Skill 1: Arcane Swap ──
        {
            id: 'wizard_arcane_swap',
            name: 'Arcane Swap',
            description: 'Hoán đổi vị trí lập tức giữa 2 quân địch (trừ Vua) trong 2 vòng đấu (4 lượt). Nếu 1 quân chết, hủy hiệu ứng và quân kia giữ nguyên vị trí.',
            tier: 'skill1',
            apCost: getEscalatedCost('wizard_skill_1'),
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
                const effectId1 = `enemy_swap_${t1.pieceId}_${now}`;
                const effectId2 = `enemy_swap_${t2.pieceId}_${now + 1}`;
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
                            type: 'enemy_position_swap',
                            duration: 2,
                            remainingDuration: 2,
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
                            type: 'enemy_position_swap',
                            duration: 2,
                            remainingDuration: 2,
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
        // ── Skill 2: Arcane Bind ──
        {
            id: 'wizard_arcane_bind',
            name: 'Arcane Bind',
            description: 'Trói buộc di chuyển của 1 quân địch trong vùng 5x5 quanh vị trí hiện tại của quân cờ đó trong 3 vòng đấu (6 lượt).',
            tier: 'skill2',
            apCost: getEscalatedCost('wizard_skill_2'),
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                { type: 'piece', filter: 'enemy', excludeKing: true, description: 'Chọn quân địch (trừ King)' }
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
                    return 'Select exactly 1 enemy piece';
                }
                const p = state.board.getPiece(targets[0].position);
                if (!p) {
                    return 'Piece not found';
                }
                if (p.color === player) {
                    return 'Must target enemy piece';
                }
                if (p.type === Piece_1.PieceType.King) {
                    return 'Cannot target King';
                }
                return null;
            },
            execute(state, player, targets) {
                const target = targets[0];
                return [
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `bind_${target.pieceId}_${Date.now()}`,
                            type: 'bind',
                            duration: 3,
                            remainingDuration: 3,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: target.pieceId,
                            stackingRule: 'refresh',
                            isDebuff: true,
                            metadata: {},
                        }
                    }
                ];
            }
        },
        // ── Ultimate: Arcane Annihilation ──
        {
            id: 'wizard_arcane_annihilation',
            name: 'Arcane Annihilation',
            description: 'Tự động tiêu diệt toàn bộ quân địch đạt tối đa 6 dấu ấn Tử Vong cùng lúc. AP cost giảm dần theo số lượng mục tiêu bị tiêu diệt.',
            tier: 'ultimate',
            apCost: (state, player) => {
                const targets = getUltimateTargets(state, player);
                const count = targets.length;
                const base = apCostConfig_1.APCostConfig.wizard.wizard_ultimate;
                if (count >= 6)
                    return base - 6;
                if (count >= 4)
                    return base - 4;
                if (count >= 2)
                    return base - 2;
                return base;
            },
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [],
            canActivate(state, player, targets) {
                const ultTargets = getUltimateTargets(state, player);
                if (ultTargets.length === 0) {
                    return 'No enemy pieces with 6 Death Counter available';
                }
                return null;
            },
            execute(state, player, targets) {
                const ultTargets = getUltimateTargets(state, player);
                return ultTargets.map(t => ({
                    type: 'DESTROY_PIECE',
                    pieceId: t.piece.id,
                    position: t.pos,
                    reason: 'annihilation',
                }));
            }
        }
    ]
};
//# sourceMappingURL=WizardVariant.js.map