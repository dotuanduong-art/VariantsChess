"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AngelVariant = void 0;
const Piece_1 = require("../../pieces/Piece");
const BlessingHandler_1 = require("../../effect/handlers/BlessingHandler");
const JudgmentHandler_1 = require("../../effect/handlers/JudgmentHandler");
const ShieldHandler_1 = require("../../effect/handlers/ShieldHandler");
exports.AngelVariant = {
    id: 'angel',
    name: 'Angel',
    description: 'Unleash stun, cleansing, shielding, and divine judgment on your enemies.',
    effectHandlers: [
        new BlessingHandler_1.BlessingHandler(),
        new JudgmentHandler_1.JudgmentHandler(),
        new ShieldHandler_1.ShieldHandler(),
    ],
    getInitialState: () => ({
        judgmentWindowActive_White: false,
        judgmentWindowRemainingTurns_White: 0,
        judgmentWindowActive_Black: false,
        judgmentWindowRemainingTurns_Black: 0,
    }),
    passiveHooks: (state, player) => [
        // Hook 1: Heavenly Grace — +2 AP when an ally is destroyed (by any cause)
        {
            id: `angel_heavenly_grace_${player}`,
            eventType: 'OnPieceDestroyed',
            priority: 500,
            source: `variant:angel:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnPieceDestroyed')
                    return;
                const deadPiece = event.payload.pieceSnapshot;
                if (deadPiece.color !== player)
                    return; // Only ally pieces
                enqueueAction({
                    type: 'GAIN_AP',
                    player,
                    amount: 2,
                    source: 'passive:heavenly_grace',
                });
            }
        },
        // Hook 2: Judgment Mark — apply mark when enemy captures in window
        {
            id: `angel_judgment_mark_${player}`,
            eventType: 'OnCapture',
            priority: 500,
            source: `variant:angel:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnCapture')
                    return;
                const windowActive = state.variantState[`judgmentWindowActive_${player}`];
                if (!windowActive)
                    return;
                if (event.activePlayer === player)
                    return; // Attacking is us (so do not mark)
                const attackerId = event.payload.attackerId;
                const attackerPos = event.payload.to;
                const attacker = state.board.getPiece(attackerPos);
                if (!attacker)
                    return;
                enqueueAction({
                    type: 'APPLY_EFFECT',
                    effect: {
                        id: `judgment_mark_${attackerId}_${Date.now()}`,
                        type: 'judgment_mark',
                        duration: null,
                        remainingDuration: null,
                        tickTiming: 'turnEnd',
                        sourcePlayer: player,
                        targetType: 'piece',
                        targetId: attackerId,
                        stackingRule: 'ignore',
                        isDebuff: false, // isDebuff false so Blessing does not cleanse
                        metadata: {},
                    }
                });
            }
        }
    ],
    skills: [
        // ── Skill 1: Holy Seal (6 AP) ──
        {
            id: 'angel_holy_seal',
            name: 'Holy Seal',
            description: 'Stun 1 enemy piece (excluding King) for 3 rounds (6 turns).',
            tier: 'skill1',
            apCost: 6,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'piece',
                    filter: 'enemy',
                    excludeKing: true,
                    description: 'Select an enemy piece (excluding King)',
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
            execute(state, player, targets, rng) {
                return [{
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `stun_${targets[0].pieceId}_${Date.now()}`,
                            type: 'stun',
                            duration: 3,
                            remainingDuration: 3,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: targets[0].pieceId,
                            stackingRule: 'refresh',
                            isDebuff: true,
                            metadata: {},
                        }
                    }];
            }
        },
        // ── Skill 2: Blessing (4 AP) ──
        {
            id: 'angel_blessing',
            name: 'Blessing',
            description: 'Remove all debuffs from an ally piece. If no debuffs exist, grant Shield for 1 round (2 turns).',
            tier: 'skill2',
            apCost: 4,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [{
                    type: 'piece',
                    filter: 'ally',
                    description: 'Select an ally piece',
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
            execute(state, player, targets, rng) {
                return [{
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `blessing_${targets[0].pieceId}_${Date.now()}`,
                            type: 'blessing',
                            duration: 0,
                            remainingDuration: 0,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: targets[0].pieceId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {},
                        }
                    }];
            }
        },
        // ── Ultimate: Divine Judgment (14 AP) ──
        {
            id: 'angel_divine_judgment',
            name: 'Divine Judgment',
            description: 'Start a Judgment Window for 5 rounds (10 turns). Enemy captures in this window receive judgment mark. At window end, destroy all marked pieces.',
            tier: 'ultimate',
            apCost: 14,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [],
            canActivate(state, player, targets) {
                return null;
            },
            execute(state, player, targets, rng) {
                state.variantState[`judgmentWindowActive_${player}`] = true;
                state.variantState[`judgmentWindowRemainingTurns_${player}`] = 10;
                return [];
            }
        }
    ]
};
//# sourceMappingURL=AngelVariant.js.map