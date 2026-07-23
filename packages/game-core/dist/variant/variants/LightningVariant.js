"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LightningVariant = void 0;
const Piece_1 = require("../../pieces/Piece");
const apCostConfig_1 = require("../apCostConfig");
class ThunderTrapHandler {
    effectType = 'thunder_trap';
    subscribesTo = ['OnMove'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnMove')
            return;
        const { pieceId, to } = event.payload;
        const piece = state.board.getPiece(to);
        if (!piece)
            return;
        // Check if the moved piece landed on a thunder_trap cell of the opponent
        const cellEffects = state.board.getCellEffects(to);
        const trap = cellEffects.find(e => e.type === 'thunder_trap' && e.sourcePlayer !== piece.color);
        if (trap) {
            // Trigger trap: Apply stun to piece (1 turn) and remove the trap
            enqueueAction({
                type: 'APPLY_EFFECT',
                effect: {
                    id: `stun_trap_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                    type: 'stun',
                    duration: 2,
                    remainingDuration: 2,
                    tickTiming: 'turnEnd',
                    sourcePlayer: trap.sourcePlayer,
                    targetType: 'piece',
                    targetId: pieceId,
                    stackingRule: 'refresh',
                    isDebuff: true,
                    metadata: {},
                }
            });
            enqueueAction({
                type: 'GAIN_AP',
                player: trap.sourcePlayer,
                amount: 2,
                source: 'passive',
            });
            enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: trap.id,
                targetId: trap.targetId,
                targetType: 'cell',
                reason: 'triggered',
            });
        }
    }
}
exports.LightningVariant = {
    id: 'lightning',
    name: 'Lightning',
    description: 'Master of electricity and speed',
    skills: [
        // ── Skill 1: Thunder Trap (3 AP) ──
        {
            id: 'lightning_thunder_trap',
            name: 'Thunder Trap',
            description: 'Place a hidden trap on an empty square. If an enemy lands on it, they are stunned.',
            tier: 'skill1',
            apCost: apCostConfig_1.APCostConfig.lightning.lightning_skill_1,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'cell',
                    filter: 'empty',
                    description: 'Select an empty square to place Thunder Trap',
                }],
            canActivate(state, player, targets) {
                if (targets.length !== 1 || targets[0].type !== 'cell' || !targets[0].position) {
                    return 'Select 1 empty square';
                }
                const pos = targets[0].position;
                if (state.board.getPiece(pos)) {
                    return 'Square must be empty';
                }
                // Check for existing trap of same player on that cell
                const key = `${pos.col},${pos.row}`;
                const existing = state.board.getCellEffects(pos)
                    .find(e => e.type === 'thunder_trap' && e.sourcePlayer === player);
                if (existing) {
                    return 'Thunder Trap already placed here';
                }
                return null;
            },
            execute(state, player, targets, rng) {
                const pos = targets[0].position;
                return [{
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `trap_${pos.col}_${pos.row}_${Date.now()}`,
                            type: 'thunder_trap',
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
        // ── Skill 2: Electric Terrain (8 AP) ──
        {
            id: 'lightning_electric_terrain',
            name: 'Electric Terrain',
            description: 'For 5 rounds, move time is reduced to 3 seconds. Failing to move skips turn and stuns a random piece. No skills can be used during this time.',
            tier: 'skill2',
            apCost: apCostConfig_1.APCostConfig.lightning.lightning_skill_2,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [],
            canActivate(state, player, targets) {
                // Check if Electric Terrain is already active
                const cellEffects = state.board.getAllCellEffects();
                for (const list of cellEffects.values()) {
                    if (list.some(e => e.type === 'electric_terrain')) {
                        return 'Electric Terrain is already active';
                    }
                }
                return null;
            },
            execute(state, player, targets, rng) {
                return [{
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `terrain_${Date.now()}`,
                            type: 'electric_terrain',
                            duration: 5,
                            remainingDuration: 5,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'cell',
                            targetId: '0,0', // Dummy cell for tracking duration/ticking
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {},
                        }
                    }];
            }
        },
        // ── Ultimate: Raigeki (12 AP) ──
        {
            id: 'lightning_raigeki',
            name: 'Raigeki',
            description: 'Destroy all stunned enemy pieces. For King, remove Stun instead of destroying.',
            tier: 'ultimate',
            apCost: apCostConfig_1.APCostConfig.lightning.lightning_ultimate,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [],
            canActivate(state, player, targets) {
                // Find if any opponent piece is stunned
                const opponentColor = player === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
                let hasStunnedOpponent = false;
                for (let r = 0; r < 15; r++) {
                    for (let c = 0; c < 15; c++) {
                        const piece = state.board.getPiece({ col: c, row: r });
                        if (piece && piece.color === opponentColor && piece.effects) {
                            const hasStun = piece.effects.some(e => e.type === 'stun');
                            if (hasStun) {
                                hasStunnedOpponent = true;
                                break;
                            }
                        }
                    }
                    if (hasStunnedOpponent)
                        break;
                }
                if (!hasStunnedOpponent) {
                    return 'No stunned enemy pieces on the board';
                }
                return null;
            },
            execute(state, player, targets, rng) {
                const opponentColor = player === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
                const actions = [];
                for (let r = 0; r < 15; r++) {
                    for (let c = 0; c < 15; c++) {
                        const pos = { col: c, row: r };
                        const piece = state.board.getPiece(pos);
                        if (piece && piece.color === opponentColor && piece.effects) {
                            const stunEffect = piece.effects.find(e => e.type === 'stun');
                            if (stunEffect) {
                                if (piece.type === Piece_1.PieceType.King) {
                                    // For King, remove Stun
                                    actions.push({
                                        type: 'REMOVE_EFFECT',
                                        effectId: stunEffect.id,
                                        targetId: piece.id,
                                        targetType: 'piece',
                                        reason: 'raigeki',
                                    });
                                }
                                else {
                                    // For other pieces, destroy
                                    actions.push({
                                        type: 'DESTROY_PIECE',
                                        pieceId: piece.id,
                                        position: pos,
                                        reason: 'raigeki',
                                    });
                                }
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
            id: 'lightning_electric_terrain_turn_start',
            eventType: 'OnTurnStart',
            priority: 100,
            source: 'variant:lightning',
            handler: () => {
                updateElectricTerrainState(state);
            }
        },
        {
            id: 'lightning_electric_terrain_applied',
            eventType: 'OnEffectApplied',
            priority: 100,
            source: 'variant:lightning',
            handler: () => {
                updateElectricTerrainState(state);
            }
        },
        {
            id: 'lightning_electric_terrain_expired',
            eventType: 'OnEffectExpired',
            priority: 100,
            source: 'variant:lightning',
            handler: () => {
                updateElectricTerrainState(state);
            }
        }
    ],
    effectHandlers: [
        new ThunderTrapHandler(),
    ],
};
function updateElectricTerrainState(state) {
    let isTerrainActive = false;
    const cellEffects = state.board.getAllCellEffects();
    for (const list of cellEffects.values()) {
        if (list.some(e => e.type === 'electric_terrain')) {
            isTerrainActive = true;
            break;
        }
    }
    if (isTerrainActive) {
        state.variantState.turnTimeoutOverride = 3000;
        state.variantState.skillsDisabled = true;
    }
    else {
        state.variantState.turnTimeoutOverride = null;
        state.variantState.skillsDisabled = false;
    }
}
//# sourceMappingURL=LightningVariant.js.map