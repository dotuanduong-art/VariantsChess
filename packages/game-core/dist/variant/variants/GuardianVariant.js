"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuardianVariant = void 0;
const ShieldHandler_1 = require("../../effect/handlers/ShieldHandler");
const SanctuaryHandler_1 = require("../../effect/handlers/SanctuaryHandler");
const Region_1 = require("../../region/Region");
exports.GuardianVariant = {
    id: 'guardian',
    name: 'Guardian',
    description: 'Protect allies with shields and create defensive stun zones.',
    effectHandlers: [
        new ShieldHandler_1.ShieldHandler(),
        new SanctuaryHandler_1.SanctuaryHandler(),
    ],
    getInitialState: () => ({ shieldCount: 0 }),
    skills: [
        // ── Skill 1: Holy Shield (4 AP) ──
        {
            id: 'guardian_shield',
            name: 'Holy Shield',
            description: 'Apply a shield to an ally piece for 2 turns (4 turns duration).',
            tier: 'skill1',
            apCost(state, player) {
                const lostCount = state.graveyard.filter(entry => entry.piece.color === player).length;
                return lostCount >= 8 ? 2 : 4;
            },
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'piece',
                    filter: 'ally',
                    description: 'Chọn 1 quân của phe bạn',
                }],
            canActivate(state, player, targets) {
                if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
                    return 'Select 1 ally piece';
                }
                const piece = state.board.getPiece(targets[0].position);
                if (!piece || piece.color !== player) {
                    return 'Must target an ally piece';
                }
                return null;
            },
            execute(state, player, targets) {
                const target = targets[0];
                const piece = state.board.getPiece(target.position);
                if (!piece)
                    return [];
                return [{
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `shield_${piece.id}_${Date.now()}`,
                            type: 'shield',
                            duration: 4,
                            remainingDuration: 4,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: piece.id,
                            stackingRule: 'refresh',
                            isDebuff: false,
                            isHidden: false,
                            metadata: {},
                        }
                    }];
            }
        },
        // ── Skill 2: Sanctuary (5 AP) ──
        {
            id: 'guardian_sanctuary',
            name: 'Sanctuary',
            description: 'Create a 3x3 zone; enemies capturing inside are stunned.',
            tier: 'skill2',
            apCost: 5,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'cell',
                    filter: 'empty',
                    description: 'Chọn 1 ô trống làm trung tâm vùng 3x3',
                }],
            canActivate(state, player, targets) {
                if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
                    return 'Select 1 cell as center';
                }
                return null;
            },
            execute(state, player, targets) {
                const center = targets[0].position;
                const cells = (0, Region_1.getSquareRegion)(center, 3);
                const actions = [];
                for (const cell of cells) {
                    actions.push({
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `sanctuary_${cell.col}_${cell.row}_${Date.now()}`,
                            type: 'sanctuary',
                            duration: 8,
                            remainingDuration: 8,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'cell',
                            targetId: `${cell.col},${cell.row}`,
                            stackingRule: 'refresh',
                            isDebuff: false,
                            isHidden: false,
                            metadata: {},
                        }
                    });
                }
                return actions;
            }
        },
        // ── Ultimate: Divine Shield (8 AP) ──
        {
            id: 'guardian_ultimate',
            name: 'Divine Shield',
            description: 'Give shields to all allies for 5 turns (10 turns duration).',
            tier: 'ultimate',
            apCost: 8,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [],
            canActivate(state, player, targets) {
                return null;
            },
            execute(state, player, targets) {
                const actions = [];
                for (let r = 0; r < 15; r++) {
                    for (let c = 0; c < 15; c++) {
                        const pos = { col: c, row: r };
                        const piece = state.board.getPiece(pos);
                        if (piece && piece.color === player) {
                            actions.push({
                                type: 'APPLY_EFFECT',
                                effect: {
                                    id: `shield_${piece.id}_${Date.now()}_${c}_${r}`,
                                    type: 'shield',
                                    duration: 10,
                                    remainingDuration: 10,
                                    tickTiming: 'turnEnd',
                                    sourcePlayer: player,
                                    targetType: 'piece',
                                    targetId: piece.id,
                                    stackingRule: 'refresh',
                                    isDebuff: false,
                                    isHidden: false,
                                    metadata: {},
                                }
                            });
                        }
                    }
                }
                return actions;
            }
        }
    ]
};
//# sourceMappingURL=GuardianVariant.js.map