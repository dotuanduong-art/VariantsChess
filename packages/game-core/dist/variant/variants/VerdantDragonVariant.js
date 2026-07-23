"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerdantDragonVariant = void 0;
const Piece_1 = require("../../pieces/Piece");
const DragonGazeHandler_1 = require("../../effect/handlers/DragonGazeHandler");
const Piece_2 = require("../../pieces/Piece");
const apCostConfig_1 = require("../apCostConfig");
exports.VerdantDragonVariant = {
    id: 'verdant_dragon',
    name: 'Verdant Dragon',
    description: 'Control the battlefield AP, protect allies with half-AP shields, and unlock Dragon\'s Wrath once reaching 100 Counter.',
    effectHandlers: [
        new DragonGazeHandler_1.DragonGazeHandler(),
    ],
    getInitialState: () => ({
        dragonCounter: 0,
    }),
    passiveHooks: (state, player) => [
        // Hook 1: Dragon Counter Tick
        {
            id: `verdant_dragon_counter_${player}`,
            eventType: 'OnAPGained',
            priority: 100,
            source: `variant:verdant_dragon:${player}`,
            handler: (event) => {
                if (event.type !== 'OnAPGained')
                    return;
                if (event.payload.player === player) {
                    state.variantState.dragonCounter = (state.variantState.dragonCounter || 0) + event.payload.amount;
                }
            }
        },
        // Hook 2: OnSkillUsed (Opponent uses a skill -> Verdant Dragon gets +3 AP)
        {
            id: `verdant_dragon_skill_used_passive_${player}`,
            eventType: 'OnSkillUsed',
            priority: 100,
            source: `variant:verdant_dragon:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnSkillUsed')
                    return;
                if (event.activePlayer !== player) {
                    enqueueAction({
                        type: 'GAIN_AP',
                        player,
                        amount: 3,
                        source: 'passive:dragon_counter_hook',
                    });
                }
            }
        },
        // Hook 3: Emerald Domain AP Transfer
        {
            id: `verdant_dragon_emerald_domain_transfer_${player}`,
            eventType: 'OnSkillUsed',
            priority: 200,
            source: `variant:verdant_dragon:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnSkillUsed')
                    return;
                const enemy = event.activePlayer;
                if (enemy === player)
                    return;
                const enemyEffects = state.getPlayerEffects(enemy);
                const hasDomain = enemyEffects.some(e => e.type === 'emerald_domain');
                if (hasDomain) {
                    const actualCost = event.payload.actualCost ?? 0;
                    const reward = Math.ceil(actualCost / 2);
                    if (reward > 0) {
                        enqueueAction({
                            type: 'GAIN_AP',
                            player,
                            amount: reward,
                            source: 'emerald_domain_transfer',
                        });
                    }
                }
            }
        }
    ],
    skills: [
        // ── Skill 1 – Verdant Shelter (3 AP) ──
        {
            id: 'verdant_dragon_verdant_shelter',
            name: 'Verdant Shelter',
            description: 'Apply shelter to 1 allied piece for 4 rounds. Opponent receives half capture AP if captured/destroyed.',
            tier: 'skill1',
            apCost: apCostConfig_1.APCostConfig.verdant_dragon.verdant_dragon_skill_1,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'piece',
                    filter: 'ally',
                    description: 'Select an allied piece for Verdant Shelter',
                }],
            canActivate(state, player, targets) {
                if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
                    return 'Select 1 allied piece';
                }
                const piece = state.board.getPiece(targets[0].position);
                if (!piece || piece.color !== player) {
                    return 'Must target an allied piece';
                }
                return null;
            },
            execute(state, player, targets) {
                const pieceId = targets[0].pieceId;
                return [{
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `verdant_shelter_${pieceId}_${Date.now()}`,
                            type: 'verdant_shelter',
                            duration: 4, // 4 rounds
                            remainingDuration: 4,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: pieceId,
                            stackingRule: 'refresh',
                            isDebuff: false,
                            metadata: {},
                        }
                    }];
            }
        },
        // ── Skill 2 – Dragon\'s Gaze (4 AP) ──
        {
            id: 'verdant_dragon_dragons_gaze',
            name: "Dragon's Gaze",
            description: 'Apply Dragon\'s Gaze to 1 enemy piece. If it moves/captures, +2 AP to you. Otherwise, enemy loses 2 AP after 2 rounds.',
            tier: 'skill2',
            apCost: apCostConfig_1.APCostConfig.verdant_dragon.verdant_dragon_skill_2,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'piece',
                    filter: 'enemy',
                    description: "Select an enemy piece for Dragon's Gaze",
                }],
            canActivate(state, player, targets) {
                if (targets.length !== 1 || targets[0].type !== 'piece' || !targets[0].position || !targets[0].pieceId) {
                    return 'Select 1 enemy piece';
                }
                const piece = state.board.getPiece(targets[0].position);
                if (!piece || piece.color === player) {
                    return 'Must target an enemy piece';
                }
                return null;
            },
            execute(state, player, targets) {
                const pieceId = targets[0].pieceId;
                return [{
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `dragon_gaze_${pieceId}_${Date.now()}`,
                            type: 'dragon_gaze',
                            duration: 2, // 2 rounds
                            remainingDuration: 2,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: pieceId,
                            stackingRule: 'refresh',
                            isDebuff: false,
                            metadata: { hasMoved: false },
                        }
                    }];
            }
        },
        // ── Ultimate – Emerald Domain / Dragon\'s Wrath (Dynamic) ──
        {
            id: 'verdant_dragon_ultimate',
            name: 'Emerald Domain',
            description: 'Apply stun to 3 enemy pieces and Emerald Domain player effect to opponent, OR unleash Dragon\'s Wrath if Counter >= 100.',
            tier: 'ultimate',
            apCost: (state, player) => {
                const counter = state.variantState.dragonCounter ?? 0;
                return counter >= 100 ? apCostConfig_1.APCostConfig.verdant_dragon.verdant_dragon_ultimate_wrath : apCostConfig_1.APCostConfig.verdant_dragon.verdant_dragon_ultimate;
            },
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: (state, player) => {
                if (state && (state.variantState.dragonCounter ?? 0) >= 100) {
                    return [];
                }
                return [
                    { type: 'piece', filter: 'enemy', excludeKing: true, description: 'Select 1st enemy piece' },
                    { type: 'piece', filter: 'enemy', excludeKing: true, description: 'Select 2nd enemy piece' },
                    { type: 'piece', filter: 'enemy', excludeKing: true, description: 'Select 3rd enemy piece' },
                ];
            },
            canActivate(state, player, targets) {
                const counter = state.variantState.dragonCounter ?? 0;
                if (counter >= 100) {
                    return null; // Dragon's Wrath takes no targets, always valid
                }
                if (targets.length !== 3) {
                    return 'Select exactly 3 enemy pieces';
                }
                const ids = new Set();
                for (const t of targets) {
                    if (t.type !== 'piece' || !t.position || !t.pieceId) {
                        return 'Invalid target';
                    }
                    const p = state.board.getPiece(t.position);
                    if (!p || p.color === player) {
                        return 'Must target enemy pieces';
                    }
                    if (p.type === Piece_1.PieceType.King) {
                        return 'Cannot target King';
                    }
                    ids.add(t.pieceId);
                }
                if (ids.size !== 3) {
                    return 'Must target unique pieces';
                }
                return null;
            },
            execute(state, player, targets, rng) {
                const actions = [];
                const counter = state.variantState.dragonCounter ?? 0;
                const opponent = (0, Piece_2.oppositeColor)(player);
                if (counter >= 100) {
                    // Dragon's Wrath
                    // Stun all enemy pieces in rows 6 to 9 (inclusive, 0-indexed)
                    for (let r = 6; r <= 9; r++) {
                        for (let c = 0; c < 15; c++) {
                            const pos = { col: c, row: r };
                            const p = state.board.getPiece(pos);
                            if (p && p.color === opponent) {
                                actions.push({
                                    type: 'APPLY_EFFECT',
                                    effect: {
                                        id: `wrath_stun_${p.id}_${Date.now()}`,
                                        type: 'stun',
                                        duration: 4, // 2 rounds = 4 turns
                                        remainingDuration: 4,
                                        tickTiming: 'turnEnd',
                                        sourcePlayer: player,
                                        targetType: 'piece',
                                        targetId: p.id,
                                        stackingRule: 'refresh',
                                        isDebuff: true,
                                        metadata: {},
                                    }
                                });
                            }
                        }
                    }
                    // Deduct 3 AP from enemy
                    actions.push({
                        type: 'SPEND_AP',
                        player: opponent,
                        amount: 3,
                        source: 'dragons_wrath',
                    });
                    // Reset Dragon Counter
                    state.variantState.dragonCounter = 0;
                }
                else {
                    // Emerald Domain
                    // Stun 3 enemy targets for 3 rounds
                    for (const t of targets) {
                        actions.push({
                            type: 'APPLY_EFFECT',
                            effect: {
                                id: `domain_stun_${t.pieceId}_${Date.now()}`,
                                type: 'stun',
                                duration: 3, // 3 rounds
                                remainingDuration: 3,
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
                    // Opponent has dynamic cost penalty player effect for 3 rounds
                    actions.push({
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `emerald_domain_${opponent}_${Date.now()}`,
                            type: 'emerald_domain',
                            duration: 3, // 3 rounds
                            remainingDuration: 3,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'player',
                            targetId: opponent,
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
//# sourceMappingURL=VerdantDragonVariant.js.map