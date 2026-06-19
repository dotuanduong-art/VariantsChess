"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamiteVariant = void 0;
const Piece_1 = require("../../pieces/Piece");
const BombHandler_1 = require("../../effect/handlers/BombHandler");
const LandmineHandler_1 = require("../../effect/handlers/LandmineHandler");
exports.DynamiteVariant = {
    id: 'dynamite',
    name: 'Dynamite',
    description: 'Plant explosive charges and landmines to cause chain reactions.',
    effectHandlers: [
        new BombHandler_1.BombHandler(),
        new LandmineHandler_1.LandmineHandler(),
    ],
    getInitialState: () => ({ bombCount: 0 }),
    skills: [
        // ── Skill 1: Live Charge (3 AP) ──
        {
            id: 'dynamite_live_charge',
            name: 'Live Charge',
            description: 'Attach a bomb effect to an ally piece (excluding King).',
            tier: 'skill1',
            apCost: 3,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'piece',
                    filter: 'ally',
                    excludeKing: true,
                    description: 'Select an ally piece (excluding King) to place a Bomb',
                }],
            canActivate(state, player, targets) {
                if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
                    return 'Select 1 ally piece';
                }
                const piece = state.board.getPiece(targets[0].position);
                if (!piece || piece.color !== player) {
                    return 'Must target an ally piece';
                }
                if (piece.type === Piece_1.PieceType.King) {
                    return 'Cannot target King';
                }
                if (piece.effects && piece.effects.some(e => e.type === 'bomb')) {
                    return 'Piece already has a Bomb attached';
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
                            id: `bomb_${piece.id}_${Date.now()}`,
                            type: 'bomb',
                            duration: null,
                            remainingDuration: null,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: piece.id,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {},
                        }
                    }];
            }
        },
        // ── Skill 2: Landmine (3 AP) ──
        {
            id: 'dynamite_landmine',
            name: 'Landmine',
            description: 'Place a Landmine on an empty square.',
            tier: 'skill2',
            apCost: 3,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'cell',
                    filter: 'empty',
                    description: 'Select an empty square to place a Landmine',
                }],
            canActivate(state, player, targets) {
                if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
                    return 'Select 1 empty square';
                }
                const pos = targets[0].position;
                if (state.board.getPiece(pos)) {
                    return 'Square must be empty';
                }
                const existing = state.board.getCellEffects(pos)
                    .find(e => e.type === 'landmine' && e.sourcePlayer === player);
                if (existing) {
                    return 'Landmine already placed here';
                }
                return null;
            },
            execute(state, player, targets) {
                const pos = targets[0].position;
                return [{
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `landmine_${pos.col}_${pos.row}_${Date.now()}`,
                            type: 'landmine',
                            duration: null,
                            remainingDuration: null,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'cell',
                            targetId: `${pos.col},${pos.row}`,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            isHidden: true,
                            metadata: {},
                        }
                    }];
            }
        },
        // ── Ultimate: Detonation (9 AP) ──
        {
            id: 'dynamite_detonation',
            name: 'Detonation',
            description: 'Detonate all bombs, triggering explosions.',
            tier: 'ultimate',
            apCost: 9,
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
                        if (piece && piece.type !== Piece_1.PieceType.King && piece.effects) {
                            const hasBomb = piece.effects.some(e => e.type === 'bomb');
                            if (hasBomb) {
                                actions.push({
                                    type: 'DESTROY_PIECE',
                                    pieceId: piece.id,
                                    position: pos,
                                    reason: 'detonation',
                                });
                            }
                        }
                    }
                }
                return actions;
            }
        }
    ],
    passiveHooks: (state, player) => [
        {
            id: 'dynamite_detonation_passive',
            eventType: 'OnSkillUsed',
            priority: 100,
            source: 'variant:dynamite',
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnSkillUsed')
                    return;
                const { skillId } = event.payload;
                if (skillId === 'dynamite_detonation') {
                    enqueueAction({
                        type: 'GAIN_AP',
                        player: player,
                        amount: 2,
                        source: 'passive',
                    });
                }
            }
        }
    ]
};
//# sourceMappingURL=DynamiteVariant.js.map