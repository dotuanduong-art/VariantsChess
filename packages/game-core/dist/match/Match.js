"use strict";
// ============================================================
// Match - Game session management
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Match = void 0;
const Position_1 = require("../board/Position");
const Piece_1 = require("../pieces/Piece");
const initialLayout_1 = require("../pieces/initialLayout");
const GameState_1 = require("../state/GameState");
const ActionPipeline_1 = require("../action/ActionPipeline");
const Snapshot_1 = require("../state/Snapshot");
const EventBus_1 = require("../event/EventBus");
const MoveModifierChain_1 = require("../modifier/MoveModifierChain");
const EffectRegistry_1 = require("../effect/EffectRegistry");
const StunHandler_1 = require("../effect/handlers/StunHandler");
const MountainHandler_1 = require("../effect/handlers/MountainHandler");
const VariantRegistry_1 = require("../variant/VariantRegistry");
const allVariants_1 = require("../variant/allVariants");
const DeterministicRng_1 = require("../rng/DeterministicRng");
class Match {
    state;
    pipeline;
    snapshots;
    eventBus;
    moveModifierChain;
    effectRegistry;
    variantRegistry;
    moveHistory = [];
    turnTimeoutOverride = null;
    constructor() {
        this.state = new GameState_1.GameState();
        this.state.board = (0, initialLayout_1.createInitialBoard)();
        this.state.status = 'waiting';
        this.snapshots = new Snapshot_1.SnapshotManager();
        this.eventBus = new EventBus_1.EventBus();
        this.variantRegistry = new VariantRegistry_1.VariantRegistry();
        for (const variant of allVariants_1.ALL_VARIANTS) {
            this.variantRegistry.register(variant);
        }
        this.moveModifierChain = new MoveModifierChain_1.MoveModifierChain();
        this.pipeline = new ActionPipeline_1.ActionPipeline(this.state, this.snapshots, this.eventBus, this.moveModifierChain, this.variantRegistry);
        this.effectRegistry = new EffectRegistry_1.EffectRegistry();
        this.effectRegistry.register(new StunHandler_1.StunHandler());
        this.effectRegistry.register(new MountainHandler_1.MountainHandler());
        // Wire effects
        this.effectRegistry.wireToEventBus(this.eventBus, this.state);
        this.effectRegistry.wireToValidationPipeline(this.pipeline, this.state);
        this.effectRegistry.wireToMoveModifierChain(this.moveModifierChain, this.state);
        // Register basic validators
        this.pipeline.addValidator(new ActionPipeline_1.BasicMoveValidator(this.moveModifierChain));
        this.pipeline.addValidator(new ActionPipeline_1.TurnPhaseValidator());
        this.pipeline.addValidator(new ActionPipeline_1.APValidator(this.variantRegistry));
        this.pipeline.addValidator(new ActionPipeline_1.SkillValidator(this.variantRegistry));
    }
    getTurnTimeoutMs() {
        if (this.turnTimeoutOverride !== null) {
            return this.turnTimeoutOverride;
        }
        if (this.state.variantState.turnTimeoutOverride !== undefined && this.state.variantState.turnTimeoutOverride !== null) {
            return this.state.variantState.turnTimeoutOverride;
        }
        return 15000;
    }
    /**
     * Start the match
     */
    start() {
        if (this.state.status !== 'waiting') {
            throw new Error('Match already started');
        }
        const result = this.pipeline.submitAction({
            type: 'START_MATCH',
            rngSeed: this.state.rngSeed,
        });
        if (!result.success) {
            throw new Error(`Failed to start match: ${result.reason}`);
        }
    }
    /**
     * Attempt to make a move. Returns the result.
     */
    makeMove(playerColor, from, to) {
        if (this.state.status !== 'playing') {
            return { success: false, reason: 'Match is not in progress' };
        }
        const now = Date.now();
        const elapsed = this.moveHistory.length === 0 ? 0 : now - this.state.lastMoveTimestamp;
        const turnTimeout = this.getTurnTimeoutMs();
        const isOverrideActive = this.state.variantState.turnTimeoutOverride !== undefined && this.state.variantState.turnTimeoutOverride !== null;
        if (isOverrideActive && this.moveHistory.length > 0) {
            if (elapsed >= turnTimeout) {
                return { success: false, reason: 'Turn timeout' };
            }
        }
        // Process time
        if (!isOverrideActive) {
            if (this.state.currentTurn === Piece_1.Color.White) {
                this.state.whiteTimeLeft -= elapsed;
                if (this.state.whiteTimeLeft <= 0) {
                    this.pipeline.submitAction({
                        type: 'GAME_OVER',
                        winner: Piece_1.Color.Black,
                        reason: 'Time out',
                    });
                    return { success: false, reason: 'Time out' };
                }
                // +5 seconds increment only when under 1 minute
                if (this.state.whiteTimeLeft < 60000) {
                    this.state.whiteTimeLeft += 5000;
                }
            }
            else {
                this.state.blackTimeLeft -= elapsed;
                if (this.state.blackTimeLeft <= 0) {
                    this.pipeline.submitAction({
                        type: 'GAME_OVER',
                        winner: Piece_1.Color.White,
                        reason: 'Time out',
                    });
                    return { success: false, reason: 'Time out' };
                }
                // +5 seconds increment only when under 1 minute
                if (this.state.blackTimeLeft < 60000) {
                    this.state.blackTimeLeft += 5000;
                }
            }
            this.pipeline.submitAction({
                type: 'TIME_UPDATE',
                whiteTimeLeft: this.state.whiteTimeLeft,
                blackTimeLeft: this.state.blackTimeLeft,
            });
        }
        this.state.lastMoveTimestamp = now;
        // Get piece details before move
        const piece = this.state.board.getPiece(from);
        const target = this.state.board.getPiece(to);
        if (!piece) {
            return { success: false, reason: 'No piece at starting position' };
        }
        // Create action details
        let action;
        if (target) {
            action = {
                type: 'CAPTURE',
                attackerId: piece.id,
                from,
                to,
                capturedPieceId: target.id,
                capturedPieceSnapshot: { ...target },
            };
        }
        else {
            action = {
                type: 'MOVE_PIECE',
                pieceId: piece.id,
                from,
                to,
            };
        }
        const result = this.pipeline.submitAction(action);
        if (!result.success) {
            return { success: false, reason: result.reason };
        }
        if (target && this.state.board.getPiece(to) === target) {
            return { success: false, reason: 'Captured piece is protected by shield' };
        }
        // Record move
        this.moveHistory.push({ from: (0, Position_1.toAlgebraic)(from), to: (0, Position_1.toAlgebraic)(to) });
        return {
            success: true,
            capturedPiece: target ? { type: target.type, color: target.color } : undefined,
            isKingCaptured: target?.type === Piece_1.PieceType.King,
        };
    }
    /**
     * Submit any action directly (e.g. for skills or pass skill)
     */
    submitAction(action) {
        return this.pipeline.submitAction(action);
    }
    /**
     * Get legal moves for a position (used by frontend for highlighting)
     */
    getLegalMovesAt(pos) {
        return this.moveModifierChain.computeLegalMoves(this.state.board, pos, this.state);
    }
    getMoveModifierChain() {
        return this.moveModifierChain;
    }
    getEffectRegistry() {
        return this.effectRegistry;
    }
    getVariantRegistry() {
        return this.variantRegistry;
    }
    setVariants(whiteVariantId, blackVariantId) {
        this.state.whiteVariantId = whiteVariantId;
        this.state.blackVariantId = blackVariantId;
        if (whiteVariantId) {
            this.variantRegistry.loadForPlayer(whiteVariantId, Piece_1.Color.White, this.effectRegistry, this.eventBus, this.moveModifierChain, this.state);
        }
        if (blackVariantId) {
            this.variantRegistry.loadForPlayer(blackVariantId, Piece_1.Color.Black, this.effectRegistry, this.eventBus, this.moveModifierChain, this.state);
        }
        this.effectRegistry.wireToValidationPipeline(this.pipeline, this.state);
        this.effectRegistry.wireToMoveModifierChain(this.moveModifierChain, this.state);
    }
    useSkill(playerColor, skillId, targets) {
        return this.pipeline.submitAction({
            type: 'USE_SKILL',
            player: playerColor,
            skillId,
            targets,
        });
    }
    handleTimeoutSkip(playerColor) {
        const actions = [];
        const pieces = [];
        // Find all pieces of the player (excluding King)
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const pos = { col: c, row: r };
                const p = this.state.board.getPiece(pos);
                if (p && p.color === playerColor && p.type !== Piece_1.PieceType.King) {
                    pieces.push({ piece: p, pos });
                }
            }
        }
        if (pieces.length > 0) {
            const rng = new DeterministicRng_1.DeterministicRng(this.state.rngSeed, this.state.rngCounter);
            const idx = rng.nextInt(0, pieces.length - 1);
            this.state.rngCounter = rng.getState().counter;
            const chosen = pieces[idx];
            actions.push({
                type: 'APPLY_EFFECT',
                effect: {
                    id: `stun_timeout_${Date.now()}_${chosen.piece.id}`,
                    type: 'stun',
                    duration: 3,
                    remainingDuration: 3,
                    tickTiming: 'turnEnd',
                    sourcePlayer: playerColor === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White,
                    targetType: 'piece',
                    targetId: chosen.piece.id,
                    stackingRule: 'refresh',
                    isDebuff: true,
                    metadata: {},
                }
            });
        }
        // Force end turn
        actions.push({
            type: 'END_TURN',
            player: playerColor,
        });
        let lastResult = { success: true, actions: [] };
        for (const action of actions) {
            const res = this.pipeline.submitAction(action);
            if (!res.success) {
                return res;
            }
            lastResult.actions.push(...res.actions);
        }
        return lastResult;
    }
    getBoard() {
        return this.state.board;
    }
    getCurrentTurn() {
        return this.state.currentTurn;
    }
    getStatus() {
        return this.state.status;
    }
    getWinner() {
        return this.state.winner;
    }
    getMoveHistory() {
        return [...this.moveHistory];
    }
    getGameState() {
        return this.state;
    }
    getEventBus() {
        return this.eventBus;
    }
    getSnapshots() {
        return this.snapshots;
    }
    /**
     * Check if the current player has run out of time
     */
    checkTimeout() {
        if (this.state.status !== 'playing')
            return null;
        if (this.moveHistory.length === 0)
            return null;
        const now = Date.now();
        const elapsed = now - this.state.lastMoveTimestamp;
        if (this.state.currentTurn === Piece_1.Color.White && this.state.whiteTimeLeft - elapsed <= 0) {
            this.pipeline.submitAction({
                type: 'GAME_OVER',
                winner: Piece_1.Color.Black,
                reason: 'Time out',
            });
            this.state.whiteTimeLeft = 0;
            return Piece_1.Color.Black;
        }
        else if (this.state.currentTurn === Piece_1.Color.Black && this.state.blackTimeLeft - elapsed <= 0) {
            this.pipeline.submitAction({
                type: 'GAME_OVER',
                winner: Piece_1.Color.White,
                reason: 'Time out',
            });
            this.state.blackTimeLeft = 0;
            return Piece_1.Color.White;
        }
        return null;
    }
    /**
     * Serialize the entire match state for network transfer
     */
    toSerializable() {
        return {
            board: this.state.board.toSerializable(),
            currentTurn: this.state.currentTurn,
            status: this.state.status,
            winner: this.state.winner,
            moveHistory: [...this.moveHistory],
            whiteTimeLeft: this.state.whiteTimeLeft,
            blackTimeLeft: this.state.blackTimeLeft,
            lastMoveTimestamp: this.state.lastMoveTimestamp,
        };
    }
    getValidPositionsForRequirement(player, skill, reqIndex) {
        const req = skill.getTargetRequirements()[reqIndex];
        if (!req)
            return [];
        const positions = [];
        const board = this.state.board;
        for (let r = 0; r < 15; r++) {
            for (let c = 0; c < 15; c++) {
                const pos = { col: c, row: r };
                const piece = board.getPiece(pos);
                // Check region constraint if defined
                if (req.region && !req.region.some((p) => p.col === c && p.row === r)) {
                    continue;
                }
                if (req.excludeKing && piece && piece.type === Piece_1.PieceType.King) {
                    continue;
                }
                // 1. Basic Type & Filter Checks
                if (req.type === 'piece') {
                    if (!piece)
                        continue;
                    if (req.filter === 'ally' && piece.color !== player)
                        continue;
                    if (req.filter === 'enemy' && piece.color === player)
                        continue;
                }
                else if (req.type === 'cell') {
                    if (req.filter === 'empty') {
                        const cellEffects = board.getCellEffects(pos) || [];
                        const hasObstacle = cellEffects.some(e => e.type === 'flame' || e.type === 'mountain');
                        if (piece || hasObstacle)
                            continue;
                    }
                    if (req.filter === 'ally') {
                        if (!piece || piece.color !== player)
                            continue;
                    }
                    if (req.filter === 'enemy') {
                        if (!piece || piece.color === player)
                            continue;
                    }
                }
                // 2. Extra skill-specific validation (dry-run/helpers)
                if (skill.id === 'lightning_thunder_trap') {
                    const existing = board.getCellEffects(pos)
                        .find(e => e.type === 'thunder_trap' && e.sourcePlayer === player);
                    if (existing)
                        continue;
                }
                if (skill.id === 'dynamite_live_charge') {
                    if (piece && piece.effects && piece.effects.some(e => e.type === 'bomb')) {
                        continue;
                    }
                }
                positions.push(pos);
            }
        }
        return positions;
    }
    serializeForPlayer(player) {
        const serialized = this.state.serializeForPlayer(player);
        // Compute available skill targets
        const availableSkillTargets = {};
        // Only compute if it's the player's active turn and game is playing
        if (this.state.status === 'playing' && this.state.currentTurn === player) {
            const variantId = player === Piece_1.Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
            if (variantId) {
                const variant = this.variantRegistry.get(variantId);
                if (variant) {
                    const skillsDisabled = this.state.variantState.skillsDisabled === true;
                    const maxSkillsPerTurn = 1;
                    const skillsUsed = this.state.skillsUsedThisTurn ?? 0;
                    const ap = player === Piece_1.Color.White ? this.state.whiteAP : this.state.blackAP;
                    if (!skillsDisabled && skillsUsed < maxSkillsPerTurn && !this.state.passSkillSubmitted) {
                        for (const skill of variant.skills) {
                            const cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, player) : skill.apCost;
                            // Only expose targets if player has sufficient AP to cast
                            if (ap >= cost) {
                                const reqs = skill.getTargetRequirements();
                                const validPositions = [];
                                for (let i = 0; i < reqs.length; i++) {
                                    validPositions.push(this.getValidPositionsForRequirement(player, skill, i));
                                }
                                availableSkillTargets[skill.id] = {
                                    requirements: reqs,
                                    validPositions,
                                };
                            }
                            else {
                                // Return empty targets if AP is not enough
                                const reqs = skill.getTargetRequirements();
                                availableSkillTargets[skill.id] = {
                                    requirements: reqs,
                                    validPositions: reqs.map(() => []),
                                };
                            }
                        }
                    }
                }
            }
        }
        return {
            ...serialized,
            availableSkillTargets,
        };
    }
}
exports.Match = Match;
//# sourceMappingURL=Match.js.map