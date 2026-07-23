"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurtleVariant = void 0;
const Piece_1 = require("../../pieces/Piece");
const AegisHandler_1 = require("../../effect/handlers/AegisHandler");
const BindHandler_1 = require("../../effect/handlers/BindHandler");
const Board_1 = require("../../board/Board");
const apCostConfig_1 = require("../apCostConfig");
const TRANSFERABLE_EFFECTS = ['stun', 'shield', 'blessing', 'electron', 'ghost'];
exports.TurtleVariant = {
    id: 'turtle',
    name: 'Turtle',
    description: 'A defensive titan that grants Aegis immunity, punishes attackers with Bind, and transfers effects between pieces.',
    effectHandlers: [
        new AegisHandler_1.AegisHandler(),
        new BindHandler_1.BindHandler(),
    ],
    passiveHooks: (state, player) => [
        {
            id: `turtle_retaliation_${player}`,
            eventType: 'OnCapture',
            priority: 400,
            source: `variant:turtle:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnCapture')
                    return;
                const capturedPiece = event.payload.capturedPieceSnapshot;
                if (!capturedPiece || capturedPiece.color !== player)
                    return;
                const hasAegis = capturedPiece.effects?.some((e) => e.type === 'aegis');
                if (!hasAegis)
                    return;
                const attackerId = event.payload.attackerId;
                const attackerPos = event.payload.to;
                if (!attackerPos)
                    return;
                const attacker = state.board.getPiece(attackerPos);
                if (!attacker || attacker.id !== attackerId || attacker.color === player)
                    return;
                enqueueAction({
                    type: 'APPLY_EFFECT',
                    effect: {
                        id: `bind_${attackerId}_${Date.now()}`,
                        type: 'bind',
                        duration: 2,
                        remainingDuration: 2,
                        tickTiming: 'turnEnd',
                        sourcePlayer: player,
                        targetType: 'piece',
                        targetId: attackerId,
                        stackingRule: 'refresh',
                        isDebuff: true,
                        metadata: {},
                    },
                });
            },
        },
    ],
    skills: [
        // ── Skill 1: Transference (4 AP) ──
        {
            id: 'turtle_transference',
            name: 'Transference',
            description: 'Transfer a buff from an enemy to an ally, or a debuff from an ally to an enemy. Only works with basic effects: Stun, Shield, Blessing, Electron, Ghost.',
            tier: 'skill1',
            apCost: apCostConfig_1.APCostConfig.turtle.turtle_skill_1,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                {
                    type: 'piece',
                    filter: 'any',
                    description: 'Select piece with transferable effect',
                },
                {
                    type: 'piece',
                    filter: 'any',
                    description: 'Select destination piece',
                },
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 2) {
                    return 'Must select source piece and destination piece';
                }
                const sourceTarget = targets[0];
                const destTarget = targets[1];
                if (sourceTarget.type !== 'piece' || !sourceTarget.position) {
                    return 'Source target must be a piece';
                }
                if (destTarget.type !== 'piece' || !destTarget.position) {
                    return 'Destination target must be a piece';
                }
                const sourcePiece = state.board.getPiece(sourceTarget.position);
                if (!sourcePiece) {
                    return 'Source piece not found';
                }
                const destPiece = state.board.getPiece(destTarget.position);
                if (!destPiece) {
                    return 'Destination piece not found';
                }
                if (sourcePiece.id === destPiece.id) {
                    return 'Source and destination pieces must be different';
                }
                if (destPiece.type === Piece_1.PieceType.King) {
                    return 'Cannot transfer effects to King';
                }
                const isSourceEnemy = sourcePiece.color !== player;
                const isDestEnemy = destPiece.color !== player;
                // Auto-find the valid effect on source piece
                const effect = sourcePiece.effects?.find(e => {
                    const isTransferableType = TRANSFERABLE_EFFECTS.includes(e.type);
                    if (!isTransferableType)
                        return false;
                    return isSourceEnemy ? !e.isDebuff : e.isDebuff;
                });
                if (!effect) {
                    return 'No transferable effect found on source piece';
                }
                if (isSourceEnemy) {
                    // Transferring buff from enemy -> must be to ally
                    if (effect.isDebuff) {
                        return 'Cannot transfer enemy debuffs to ally';
                    }
                    if (isDestEnemy) {
                        return 'Buffs from enemy must be transferred to an ally';
                    }
                }
                else {
                    // Transferring debuff from ally -> must be to enemy
                    if (!effect.isDebuff) {
                        return 'Cannot transfer ally buffs to enemy';
                    }
                    if (!isDestEnemy) {
                        return 'Debuffs from ally must be transferred to an enemy';
                    }
                    // Aegis target check for destination piece if it is an enemy receiving a debuff
                    const destHasAegis = destPiece.effects?.some(e => e.type === 'aegis');
                    if (destHasAegis) {
                        return 'Destination target has Aegis immunity';
                    }
                }
                return null;
            },
            execute(state, player, targets) {
                const sourceTarget = targets[0];
                const destTarget = targets[1];
                const sourcePiece = state.board.getPiece(sourceTarget.position);
                const destPiece = state.board.getPiece(destTarget.position);
                const isSourceEnemy = sourcePiece.color !== player;
                const effect = sourcePiece.effects.find(e => {
                    const isTransferableType = TRANSFERABLE_EFFECTS.includes(e.type);
                    if (!isTransferableType)
                        return false;
                    return isSourceEnemy ? !e.isDebuff : e.isDebuff;
                });
                const newEffectId = `transfer_${effect.type}_${destPiece.id}_${Date.now()}`;
                return [
                    {
                        type: 'REMOVE_EFFECT',
                        effectId: effect.id,
                        targetId: sourcePiece.id,
                        targetType: 'piece',
                        reason: 'transferred',
                    },
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            ...effect,
                            id: newEffectId,
                            targetId: destPiece.id,
                            sourcePlayer: player,
                            duration: effect.remainingDuration,
                            remainingDuration: effect.remainingDuration,
                        },
                    },
                ];
            },
        },
        // ── Skill 2: Aegis Blessing (4 AP) ──
        {
            id: 'turtle_aegis_blessing',
            name: 'Aegis Blessing',
            description: 'Grant Aegis to an ally piece (excluding King) for 2 rounds.',
            tier: 'skill2',
            apCost: apCostConfig_1.APCostConfig.turtle.turtle_skill_2,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                {
                    type: 'piece',
                    filter: 'ally',
                    excludeKing: true,
                    description: 'Select an ally piece (excluding King)',
                },
            ],
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
                return null;
            },
            execute(state, player, targets) {
                return [
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `aegis_${targets[0].pieceId}_${Date.now()}`,
                            type: 'aegis',
                            duration: 2,
                            remainingDuration: 2,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: targets[0].pieceId,
                            stackingRule: 'refresh',
                            isDebuff: false,
                            metadata: {},
                        },
                    },
                ];
            },
        },
        // ── Ultimate: Great Sanctuary (10 AP) ──
        {
            id: 'turtle_great_sanctuary',
            name: 'Great Sanctuary',
            description: 'Grant Aegis to all ally pieces (excluding Pawn and King) for 5 rounds.',
            tier: 'ultimate',
            apCost: apCostConfig_1.APCostConfig.turtle.turtle_ultimate,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [],
            canActivate(state, player, targets) {
                return null;
            },
            execute(state, player, targets) {
                const actions = [];
                for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        const piece = state.board.getPiece({ col: c, row: r });
                        if (piece &&
                            piece.color === player &&
                            piece.type !== Piece_1.PieceType.Pawn &&
                            piece.type !== Piece_1.PieceType.King) {
                            actions.push({
                                type: 'APPLY_EFFECT',
                                effect: {
                                    id: `aegis_${piece.id}_${Date.now()}_${r}_${c}`,
                                    type: 'aegis',
                                    duration: 5,
                                    remainingDuration: 5,
                                    tickTiming: 'turnEnd',
                                    sourcePlayer: player,
                                    targetType: 'piece',
                                    targetId: piece.id,
                                    stackingRule: 'refresh',
                                    isDebuff: false,
                                    metadata: {},
                                },
                            });
                        }
                    }
                }
                return actions;
            },
        },
    ],
};
//# sourceMappingURL=TurtleVariant.js.map