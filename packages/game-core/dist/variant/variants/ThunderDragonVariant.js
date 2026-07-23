"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThunderDragonVariant = exports.ThunderFangCaptureValidator = void 0;
const Piece_1 = require("../../pieces/Piece");
const apCostConfig_1 = require("../apCostConfig");
const Board_1 = require("../../board/Board");
const ElectricHandler_1 = require("../../effect/handlers/ElectricHandler");
const ThunderFangHandler_1 = require("../../effect/handlers/ThunderFangHandler");
// ─────────────────────────────────────────────────────────────────────────────
// Helper: find the player's King position
// ─────────────────────────────────────────────────────────────────────────────
function findKingPosition(state, player) {
    for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
        for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
            const p = state.board.getPiece({ col: c, row: r });
            if (p && p.type === Piece_1.PieceType.King && p.color === player) {
                return { col: c, row: r };
            }
        }
    }
    return null;
}
// ─────────────────────────────────────────────────────────────────────────────
// Helper: compute the 3×10 zone from a king position in a given direction.
// Returns an array of all positions inside the zone.
// direction is a unit vector derived from the target cell adjacent to king.
// ─────────────────────────────────────────────────────────────────────────────
function computeWrathZone(kingPos, dirCol, dirRow) {
    const zone = [];
    // Perpendicular offset: 1 cell to each side of the direction axis
    // For diagonal directions we use the perpendicular in the "wide" sense:
    // if dir is purely horizontal/vertical, perp is the other axis;
    // if diagonal, we use the two orthogonal-to-diagonal axes.
    const perps = getPerpendicularOffsets(dirCol, dirRow);
    // Depth = 10 squares along the direction
    for (let depth = 1; depth <= 10; depth++) {
        const baseCol = kingPos.col + dirCol * depth;
        const baseRow = kingPos.row + dirRow * depth;
        // Width = 3: center + 1 each side perpendicular
        for (const { dc, dr } of perps) {
            for (let w = -1; w <= 1; w++) {
                const col = baseCol + dc * w;
                const row = baseRow + dr * w;
                if (col >= 0 && col < Board_1.BOARD_SIZE && row >= 0 && row < Board_1.BOARD_SIZE) {
                    zone.push({ col, row });
                }
            }
        }
    }
    // De-duplicate (diagonal directions can produce duplicate cells)
    const seen = new Set();
    return zone.filter(p => {
        const k = `${p.col},${p.row}`;
        if (seen.has(k))
            return false;
        seen.add(k);
        return true;
    });
}
/**
 * Returns the "width" perpendicular for a given direction vector.
 * For axis-aligned directions (N/S/E/W) there is a single perpendicular axis.
 * For diagonals we spread width along both orthogonal axes.
 */
function getPerpendicularOffsets(dc, dr) {
    if (dc === 0) {
        // Moving vertically → width along columns
        return [{ dc: 1, dr: 0 }];
    }
    if (dr === 0) {
        // Moving horizontally → width along rows
        return [{ dc: 0, dr: 1 }];
    }
    // Diagonal: spread along both axes (creates a roughly rectangular zone)
    return [
        { dc: dc === 0 ? 1 : -dr, dr: dr === 0 ? 1 : dc },
    ];
}
// ─────────────────────────────────────────────────────────────────────────────
// Helper: derive the direction unit vector from king → adjacent cell
// ─────────────────────────────────────────────────────────────────────────────
function deriveDirection(kingPos, targetPos) {
    const rawDc = targetPos.col - kingPos.col;
    const rawDr = targetPos.row - kingPos.row;
    const absDc = Math.abs(rawDc);
    const absDr = Math.abs(rawDr);
    // Must be one of the 8 adjacent cells (distance 1 in Chebyshev)
    if (absDc > 1 || absDr > 1 || (absDc === 0 && absDr === 0))
        return null;
    return { dc: rawDc, dr: rawDr };
}
// ─────────────────────────────────────────────────────────────────────────────
// ThunderFangCaptureValidator
//
// Injected into the ActionPipeline to make CAPTURE actions from pieces that
// carry thunder_fang use `stayInPlace = true`.
// The validator mutates the action object in-place (same pattern as
// DevilTollValidator) before the pipeline processes it.
// ─────────────────────────────────────────────────────────────────────────────
class ThunderFangCaptureValidator {
    validate(action, state) {
        if (action.type !== 'CAPTURE')
            return null;
        const attacker = state.board.getPiece(action.from);
        if (!attacker)
            return null;
        const hasFang = attacker.effects?.some(e => e.type === 'thunder_fang' && e.sourcePlayer === attacker.color);
        if (!hasFang)
            return null;
        // Mutate stayInPlace on the action (same pattern as Devil Toll AP deduction)
        action.stayInPlace = true;
        return null; // Valid — do not block
    }
}
exports.ThunderFangCaptureValidator = ThunderFangCaptureValidator;
// ─────────────────────────────────────────────────────────────────────────────
exports.ThunderDragonVariant = {
    id: 'thunder_dragon',
    name: 'Thunder Dragon',
    description: 'A dragon that channels lightning — charging AP from every Stun, electrifying allies, and annihilating stunned foes with its wrath.',
    effectHandlers: [
        new ElectricHandler_1.ElectricHandler(),
        new ThunderFangHandler_1.ThunderFangHandler(),
    ],
    getInitialState: () => ({}),
    // ── Passive – Static Charge ──────────────────────────────────────────────
    // At the START of Thunder Dragon's own turn, count how many enemy pieces are
    // currently stunned and grant that many AP.
    passiveHooks: (state, player) => [
        {
            id: `thunder_dragon_static_charge_${player}`,
            eventType: 'OnTurnStart',
            priority: 500,
            source: `variant:thunder_dragon:${player}`,
            handler: (event, enqueueAction) => {
                if (event.type !== 'OnTurnStart')
                    return;
                if (event.activePlayer !== player)
                    return;
                const opponentColor = player === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
                let stunnedCount = 0;
                for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        const piece = state.board.getPiece({ col: c, row: r });
                        if (piece &&
                            piece.color === opponentColor &&
                            piece.effects?.some(e => e.type === 'stun')) {
                            stunnedCount++;
                        }
                    }
                }
                if (stunnedCount > 0) {
                    enqueueAction({
                        type: 'GAIN_AP',
                        player,
                        amount: stunnedCount,
                        source: 'passive:static_charge',
                    });
                }
            },
        },
    ],
    onSetup(state, player) {
        // Nothing to set up beyond initial state
    },
    // ThunderFangCaptureValidator is registered via actionValidators below
    actionValidators: [
        new ThunderFangCaptureValidator(),
    ],
    skills: [
        // ── Skill 1: Dragon's Scale (3 AP) ─────────────────────────────────────
        {
            id: 'thunder_dragon_dragons_scale',
            name: "Dragon's Scale",
            description: "Grant an allied piece the Electric effect for 1 round. " +
                "If an enemy captures that piece, the attacker is stunned for 2 rounds.",
            tier: 'skill1',
            apCost: apCostConfig_1.APCostConfig.thunder_dragon.thunder_dragon_skill_1,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                {
                    type: 'piece',
                    filter: 'ally',
                    description: 'Select an ally piece to apply Electric',
                },
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 1 ||
                    targets[0].type !== 'piece' ||
                    !targets[0].position ||
                    !targets[0].pieceId) {
                    return 'Select 1 ally piece';
                }
                const piece = state.board.getPiece(targets[0].position);
                if (!piece || piece.color !== player) {
                    return 'Must target an ally piece';
                }
                return null;
            },
            execute(state, player, targets) {
                const pieceId = targets[0].pieceId;
                return [
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `electric_${pieceId}_${Date.now()}`,
                            type: 'electric',
                            // 1 round = 2 turns (both players take 1 turn each) → duration 2
                            duration: 2,
                            remainingDuration: 2,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: pieceId,
                            stackingRule: 'refresh',
                            isDebuff: false,
                            metadata: {},
                        },
                    },
                ];
            },
        },
        // ── Skill 2: Thunder Fang (6 AP) ────────────────────────────────────────
        {
            id: 'thunder_dragon_thunder_fang',
            name: 'Thunder Fang',
            description: 'Grant an allied piece Thunder Fang until end of current turn. ' +
                'The piece can capture enemies without moving to their square. ' +
                'When it kills an enemy, that square becomes a thunder trap for 2 rounds.',
            tier: 'skill2',
            apCost: apCostConfig_1.APCostConfig.thunder_dragon.thunder_dragon_skill_2,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements: () => [
                {
                    type: 'piece',
                    filter: 'ally',
                    description: 'Select an ally piece to apply Thunder Fang',
                },
            ],
            canActivate(state, player, targets) {
                if (targets.length !== 1 ||
                    targets[0].type !== 'piece' ||
                    !targets[0].position ||
                    !targets[0].pieceId) {
                    return 'Select 1 ally piece';
                }
                const piece = state.board.getPiece(targets[0].position);
                if (!piece || piece.color !== player) {
                    return 'Must target an ally piece';
                }
                return null;
            },
            execute(state, player, targets) {
                const pieceId = targets[0].pieceId;
                return [
                    {
                        type: 'APPLY_EFFECT',
                        effect: {
                            id: `thunder_fang_${pieceId}_${Date.now()}`,
                            type: 'thunder_fang',
                            // Duration 1 → expires at the end of the current player's turn
                            duration: 1,
                            remainingDuration: 1,
                            tickTiming: 'turnEnd',
                            sourcePlayer: player,
                            targetType: 'piece',
                            targetId: pieceId,
                            stackingRule: 'refresh',
                            isDebuff: false,
                            metadata: {},
                        },
                    },
                ];
            },
        },
        // ── Ultimate: Dragon's Wrath (12 AP) ────────────────────────────────────
        {
            id: 'thunder_dragon_dragons_wrath',
            name: "Dragon's Wrath",
            description: "Choose a direction from your King (target any of the 8 adjacent squares). " +
                "A 3×10 zone erupts in that direction: all enemies are stunned, " +
                "then all already-stunned enemies in the zone are instantly destroyed " +
                "(including the enemy King if stunned).",
            tier: 'ultimate',
            apCost: apCostConfig_1.APCostConfig.thunder_dragon.thunder_dragon_ultimate,
            cooldown: 0,
            usageRule: 'once_per_turn',
            getTargetRequirements(state, player) {
                if (!state || !player)
                    return [];
                const kingPos = findKingPosition(state, player);
                if (!kingPos)
                    return [];
                // Valid targets: any of the 8 adjacent cells of the King
                const region = [];
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        if (dr === 0 && dc === 0)
                            continue;
                        const col = kingPos.col + dc;
                        const row = kingPos.row + dr;
                        if (col >= 0 && col < Board_1.BOARD_SIZE && row >= 0 && row < Board_1.BOARD_SIZE) {
                            region.push({ col, row });
                        }
                    }
                }
                return [
                    {
                        type: 'cell',
                        filter: 'any',
                        region,
                        description: "Select a cell adjacent to your King to set the blast direction",
                    },
                ];
            },
            canActivate(state, player, targets) {
                if (targets.length !== 1 ||
                    targets[0].type !== 'cell' ||
                    !targets[0].position) {
                    return 'Select a cell adjacent to your King';
                }
                const kingPos = findKingPosition(state, player);
                if (!kingPos)
                    return 'King not found';
                const dir = deriveDirection(kingPos, targets[0].position);
                if (!dir) {
                    return 'Target must be one of the 8 cells adjacent to your King';
                }
                return null;
            },
            execute(state, player, targets) {
                const actions = [];
                const opponentColor = player === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
                const kingPos = findKingPosition(state, player);
                if (!kingPos)
                    return [];
                const dir = deriveDirection(kingPos, targets[0].position);
                if (!dir)
                    return [];
                const zone = computeWrathZone(kingPos, dir.dc, dir.dr);
                // For each enemy in the zone:
                // - If they are already stunned, destroy them.
                // - Otherwise, apply stun for 2 rounds (duration 4).
                for (const pos of zone) {
                    const piece = state.board.getPiece(pos);
                    if (!piece || piece.color !== opponentColor)
                        continue;
                    const isStunned = piece.effects?.some(e => e.type === 'stun');
                    if (isStunned) {
                        actions.push({
                            type: 'DESTROY_PIECE',
                            pieceId: piece.id,
                            position: pos,
                            reason: 'dragons_wrath',
                        });
                    }
                    else {
                        actions.push({
                            type: 'APPLY_EFFECT',
                            effect: {
                                id: `wrath_stun_${pos.col}_${pos.row}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                                type: 'stun',
                                duration: 4, // 2 rounds
                                remainingDuration: 4,
                                tickTiming: 'turnEnd',
                                sourcePlayer: player,
                                targetType: 'piece',
                                targetId: piece.id,
                                stackingRule: 'refresh',
                                isDebuff: true,
                                metadata: {},
                            },
                        });
                    }
                }
                return actions;
            },
        },
    ],
};
//# sourceMappingURL=ThunderDragonVariant.js.map