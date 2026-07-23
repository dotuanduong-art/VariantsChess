"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LordVariant = void 0;
const Piece_1 = require("../../pieces/Piece");
const Board_1 = require("../../board/Board");
const apCostConfig_1 = require("../apCostConfig");
// Helper to count pieces on the board for each side (including King and summoned pieces)
function countSurvivingPieces(state) {
    let white = 0;
    let black = 0;
    for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
        for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
            const piece = state.board.getPiece({ col: c, row: r });
            if (piece) {
                if (piece.color === Piece_1.Color.White)
                    white++;
                else if (piece.color === Piece_1.Color.Black)
                    black++;
            }
        }
    }
    return { white, black };
}
// Local helper to scan up to 3 cells forward based on orientation/color
function getVanguardTarget(state, player, pos) {
    const direction = player === Piece_1.Color.White ? 1 : -1;
    // 1. Check if there is at least one enemy piece in the 3 cells in front
    let hasEnemy = false;
    for (let i = 1; i <= 3; i++) {
        const row = pos.row + i * direction;
        if (row < 0 || row >= Board_1.BOARD_SIZE)
            break;
        const p = state.board.getPiece({ col: pos.col, row });
        if (p && p.color !== player) {
            hasEnemy = true;
            break;
        }
    }
    if (!hasEnemy) {
        return null;
    }
    // 2. Find the first piece encountered on that path
    for (let i = 1; i <= 3; i++) {
        const row = pos.row + i * direction;
        if (row < 0 || row >= Board_1.BOARD_SIZE)
            break;
        const p = state.board.getPiece({ col: pos.col, row });
        if (p) {
            if (p.type === Piece_1.PieceType.King) {
                return null; // Stops checking immediately when King is encountered first
            }
            return { targetPiece: p, targetPos: { col: pos.col, row } };
        }
    }
    return null;
}
exports.LordVariant = {
    id: 'lord',
    name: 'Lord',
    description: 'A sovereign commander leveraging tactical numbers, vanguard sweeps, reinforcements, and absolute authority.',
    effectHandlers: [],
    passiveHooks: (state, player) => [
        {
            id: `lord_passive_overwhelm_${player}`,
            eventType: 'OnTurnEnd',
            priority: 500,
            source: `variant:lord:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnTurnEnd')
                    return;
                // Trigger at the end of each round (which ends when Black's turn ends)
                if (event.activePlayer !== Piece_1.Color.Black)
                    return;
                if (event.turnNumber % 5 !== 0)
                    return;
                const counts = countSurvivingPieces(state);
                const diff = Math.abs(counts.white - counts.black);
                if (diff > 0) {
                    enqueueAction({
                        type: 'GAIN_AP',
                        player,
                        amount: diff,
                        source: 'passive:overwhelm',
                    });
                }
            },
        },
    ],
    skills: [
        // ── Skill 1: Vanguard Command (4 AP) ──
        {
            id: 'lord_vanguard_command',
            name: 'Vanguard Command',
            description: 'Choose 1 ally piece. Destroy the first piece in its line of sight (up to 3 cells forward), provided there is at least one enemy in range.',
            tier: 'skill1',
            apCost: apCostConfig_1.APCostConfig.lord.lord_skill_1,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                {
                    type: 'piece',
                    filter: 'ally',
                    description: 'Select an ally piece',
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
                const target = getVanguardTarget(state, player, targets[0].position);
                if (!target) {
                    return 'No valid target in range, or path is blocked by King first, or no enemy in range';
                }
                return null;
            },
            execute(state, player, targets) {
                const sourcePos = targets[0].position;
                const target = getVanguardTarget(state, player, sourcePos);
                if (!target)
                    return [];
                return [
                    {
                        type: 'DESTROY_PIECE',
                        pieceId: target.targetPiece.id,
                        position: target.targetPos,
                        reason: 'vanguard_command',
                    },
                ];
            },
        },
        // ── Skill 2: Reinforcements (4 AP) ──
        {
            id: 'lord_reinforcements',
            name: 'Reinforcements',
            description: 'Summon up to 2 Pawns in your own half of the board. Pawns cannot promote. Duration varies with piece counts.',
            tier: 'skill2',
            apCost: apCostConfig_1.APCostConfig.lord.lord_skill_2,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements(state, player) {
                if (!state || !player)
                    return [];
                const region = [];
                const startRow = player === Piece_1.Color.White ? 0 : 8;
                const endRow = player === Piece_1.Color.White ? 6 : 14;
                for (let r = startRow; r <= endRow; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        region.push({ col: c, row: r });
                    }
                }
                // Count empty cells in own half
                const emptyCells = region.filter(pos => !state.board.getPiece(pos));
                if (emptyCells.length === 0) {
                    return [];
                }
                else if (emptyCells.length === 1) {
                    return [
                        {
                            type: 'cell',
                            filter: 'empty',
                            region,
                            description: 'Select 1 empty cell',
                        },
                    ];
                }
                else {
                    return [
                        {
                            type: 'cell',
                            filter: 'empty',
                            region,
                            description: 'Select empty cell 1',
                        },
                        {
                            type: 'cell',
                            filter: 'empty',
                            region,
                            description: 'Select empty cell 2',
                        },
                    ];
                }
            },
            canActivate(state, player, targets) {
                const startRow = player === Piece_1.Color.White ? 0 : 8;
                const endRow = player === Piece_1.Color.White ? 6 : 14;
                let emptyCount = 0;
                for (let r = startRow; r <= endRow; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        if (!state.board.getPiece({ col: c, row: r })) {
                            emptyCount++;
                        }
                    }
                }
                const expectedTargets = Math.min(2, emptyCount);
                if (targets.length !== expectedTargets) {
                    return `Select exactly ${expectedTargets} empty cell(s)`;
                }
                for (const target of targets) {
                    if (target.type !== 'cell' || !target.position) {
                        return 'Invalid target cell';
                    }
                    const piece = state.board.getPiece(target.position);
                    if (piece) {
                        return 'Target cell must be empty';
                    }
                    const isOwnHalf = player === Piece_1.Color.White
                        ? target.position.row >= 0 && target.position.row <= 6
                        : target.position.row >= 8 && target.position.row <= 14;
                    if (!isOwnHalf) {
                        return 'Target cell must be in your own half';
                    }
                }
                if (targets.length === 2) {
                    if (targets[0].position.col === targets[1].position.col &&
                        targets[0].position.row === targets[1].position.row) {
                        return 'Cannot select the same cell twice';
                    }
                }
                return null;
            },
            execute(state, player, targets, rng) {
                const counts = countSurvivingPieces(state);
                const allyCount = player === Piece_1.Color.White ? counts.white : counts.black;
                const enemyCount = player === Piece_1.Color.White ? counts.black : counts.white;
                let duration = null;
                if (allyCount >= enemyCount) {
                    duration = 3;
                }
                else {
                    const diff = enemyCount - allyCount;
                    if (diff <= 3) {
                        duration = 5;
                    }
                    else {
                        duration = null; // permanent
                    }
                }
                const actions = [];
                for (let i = 0; i < targets.length; i++) {
                    const pos = targets[i].position;
                    const pawnId = `summoned_pawn_${player === Piece_1.Color.White ? 'w' : 'b'}_${rng.nextInt(0, 1000000)}_${i}`;
                    // 1. Spawn pawn
                    actions.push({
                        type: 'SPAWN_PIECE',
                        piece: {
                            id: pawnId,
                            type: Piece_1.PieceType.Pawn,
                            color: player,
                            effects: [],
                        },
                        position: pos,
                    });
                    // 2. Apply permanent 'no_promotion' effect
                    actions.push({
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `no_promotion_${pawnId}`,
                            type: 'no_promotion',
                            duration: null,
                            remainingDuration: null,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: pawnId,
                            stackingRule: 'ignore',
                            isDebuff: false,
                            metadata: {},
                        },
                    });
                    // 3. Apply temporary 'summon_duration' effect if not permanent
                    if (duration !== null) {
                        actions.push({
                            type: 'APPLY_EFFECT',
                            effect: {
                                id: `summon_duration_${pawnId}`,
                                type: 'summon_duration',
                                duration,
                                remainingDuration: duration,
                                tickTiming: 'turnEnd',
                                sourcePlayer: player,
                                targetType: 'piece',
                                targetId: pawnId,
                                stackingRule: 'ignore',
                                isDebuff: false,
                                metadata: {},
                            },
                        });
                    }
                }
                return actions;
            },
        },
        // ── Ultimate: Iron Authority (9 AP) ──
        {
            id: 'lord_iron_authority',
            name: 'Iron Authority',
            description: 'Silence the opponent, preventing them from using Skill 1 and Skill 2. Duration is 3 or 5 rounds.',
            tier: 'ultimate',
            apCost: apCostConfig_1.APCostConfig.lord.lord_ultimate,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [],
            canActivate(state, player, targets) {
                return null;
            },
            execute(state, player, targets) {
                const counts = countSurvivingPieces(state);
                const allyCount = player === Piece_1.Color.White ? counts.white : counts.black;
                const enemyCount = player === Piece_1.Color.White ? counts.black : counts.white;
                const opponent = (0, Piece_1.oppositeColor)(player);
                const duration = allyCount <= enemyCount ? 3 : 5;
                return [
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `silence_${opponent}_${Date.now()}`,
                            type: 'silence',
                            duration,
                            remainingDuration: duration,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'player',
                            targetId: opponent,
                            stackingRule: 'refresh',
                            isDebuff: true,
                            metadata: { blockUltimate: false },
                        },
                    },
                ];
            },
        },
    ],
};
//# sourceMappingURL=LordVariant.js.map