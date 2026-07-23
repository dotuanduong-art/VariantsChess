"use strict";
// ============================================================
// Match - Game session management
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Match = void 0;
const Board_1 = require("../board/Board");
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
const DevilEyeHandler_1 = require("../effect/handlers/DevilEyeHandler");
const DevilTollHandler_1 = require("../effect/handlers/DevilTollHandler");
const PredictionHandler_1 = require("../effect/handlers/PredictionHandler");
const TimeFreezeHandler_1 = require("../effect/handlers/TimeFreezeHandler");
const DragonGazeHandler_1 = require("../effect/handlers/DragonGazeHandler");
const SummonDurationHandler_1 = require("../effect/handlers/SummonDurationHandler");
const CellEffectBlockModifier_1 = require("../modifier/CellEffectBlockModifier");
const VariantRegistry_1 = require("../variant/VariantRegistry");
const allVariants_1 = require("../variant/allVariants");
const DeterministicRng_1 = require("../rng/DeterministicRng");
const KazehimeVariant_1 = require("../variant/variants/KazehimeVariant");
const AttackDetection_1 = require("../combat/AttackDetection");
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
        this.moveModifierChain.register(new CellEffectBlockModifier_1.CellEffectBlockModifier());
        this.pipeline = new ActionPipeline_1.ActionPipeline(this.state, this.snapshots, this.eventBus, this.moveModifierChain, this.variantRegistry);
        this.effectRegistry = new EffectRegistry_1.EffectRegistry();
        this.effectRegistry.register(new StunHandler_1.StunHandler());
        this.effectRegistry.register(new DevilEyeHandler_1.DevilEyeHandler());
        this.effectRegistry.register(new DevilTollHandler_1.DevilTollHandler());
        this.effectRegistry.register(new PredictionHandler_1.PredictionHandler());
        this.effectRegistry.register(new TimeFreezeHandler_1.TimeFreezeHandler());
        this.effectRegistry.register(new DragonGazeHandler_1.DragonGazeHandler());
        this.effectRegistry.register(new SummonDurationHandler_1.SummonDurationHandler());
        // Wire effects
        this.effectRegistry.wireToEventBus(this.eventBus, this.state);
        this.effectRegistry.wireToValidationPipeline(this.pipeline, this.state);
        this.effectRegistry.wireToMoveModifierChain(this.moveModifierChain, this.state);
        // Register basic validators
        this.pipeline.addValidator(new ActionPipeline_1.BasicMoveValidator(this.moveModifierChain));
        this.pipeline.addValidator(new ActionPipeline_1.TurnPhaseValidator(this.variantRegistry));
        this.pipeline.addValidator(new ActionPipeline_1.APValidator(this.variantRegistry));
        this.pipeline.addValidator(new ActionPipeline_1.SkillValidator(this.variantRegistry));
        this.pipeline.addValidator(new ActionPipeline_1.DevilTollValidator());
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
    makeMove(playerColor, from, to, moveType) {
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
        const hasMainBefore = target?.effects?.some(e => e.type === 'main');
        let isPredatorStealth = false;
        if (piece) {
            const ownerEffects = this.state.getPlayerEffects(piece.color);
            const hasApexCamouflage = ownerEffects.some(e => e.type === 'apex_camouflage');
            isPredatorStealth = !!(hasApexCamouflage &&
                piece.type !== Piece_1.PieceType.King &&
                !(this.state.variantState.revealedPieceIds || []).includes(piece.id));
        }
        const isStealthMove = !!(piece && (piece.effects?.some((e) => (e.type === 'ghost' && e.metadata?.stealth === true) ||
            e.type === 'invisible' ||
            e.type === 'stealth' ||
            e.isHidden === true) ||
            isPredatorStealth));
        if (!piece) {
            return { success: false, reason: 'No piece at starting position' };
        }
        // Create action details
        let action;
        if (moveType === 'zombie_bite') {
            action = {
                type: 'ZOMBIE_BITE',
                attackerId: piece.id,
                attackerPosition: from,
                targetPosition: to,
            };
        }
        else if (target) {
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
        if (action.type === 'CAPTURE' && target && this.state.board.getPiece(to) === target && !hasMainBefore) {
            return { success: false, reason: 'Captured piece is protected by shield' };
        }
        // Record move
        this.moveHistory.push({
            from: (0, Position_1.toAlgebraic)(from),
            to: (0, Position_1.toAlgebraic)(to),
            isStealth: isStealthMove,
            moverColor: playerColor,
        });
        return {
            success: true,
            capturedPiece: target ? { type: target.type, color: target.color } : undefined,
            isKingCaptured: target?.type === Piece_1.PieceType.King,
            isStealthMove,
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
            this.variantRegistry.loadForPlayer(whiteVariantId, Piece_1.Color.White, this.effectRegistry, this.eventBus, this.moveModifierChain, this.state, this.pipeline);
        }
        if (blackVariantId) {
            this.variantRegistry.loadForPlayer(blackVariantId, Piece_1.Color.Black, this.effectRegistry, this.eventBus, this.moveModifierChain, this.state, this.pipeline);
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
        const req = skill.getTargetRequirements(this.state, player)[reqIndex];
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
                    if (req.pieceType && piece.type !== req.pieceType)
                        continue;
                }
                else if (req.type === 'cell') {
                    if (req.filter === 'empty') {
                        const cellEffects = board.getCellEffects(pos) || [];
                        const hasObstacle = cellEffects.some(e => e.type === 'flame');
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
                // Check single-target validation dynamically
                const reqs = skill.getTargetRequirements(this.state, player);
                if (reqs.length === 1) {
                    const testTarget = req.type === 'piece'
                        ? { type: 'piece', position: pos, pieceId: piece?.id }
                        : { type: 'cell', position: pos };
                    if (skill.canActivate(this.state, player, [testTarget]) !== null) {
                        continue;
                    }
                }
                // 2. Extra skill-specific validation (dry-run/helpers)
                if (skill.id === 'kaze_repel') {
                    const cells = (0, KazehimeVariant_1.getCrossCells)(pos);
                    let isValid = true;
                    for (const c of cells) {
                        if (c.col < 0 || c.col >= Board_1.BOARD_SIZE || c.row < 0 || c.row >= Board_1.BOARD_SIZE) {
                            isValid = false;
                            break;
                        }
                        if (board.getPiece(c)) {
                            isValid = false;
                            break;
                        }
                        const hasTrap = board.getCellEffects(c).some(e => e.type === 'repel' || e.type === 'soulless_cell');
                        if (hasTrap) {
                            isValid = false;
                            break;
                        }
                    }
                    if (!isValid)
                        continue;
                }
                if (skill.id === 'kaze_soulless') {
                    const cells = (0, KazehimeVariant_1.getXCells)(pos);
                    let isValid = true;
                    for (const c of cells) {
                        if (c.col < 0 || c.col >= Board_1.BOARD_SIZE || c.row < 0 || c.row >= Board_1.BOARD_SIZE) {
                            isValid = false;
                            break;
                        }
                        if (board.getPiece(c)) {
                            isValid = false;
                            break;
                        }
                        const hasTrap = board.getCellEffects(c).some(e => e.type === 'repel' || e.type === 'soulless_cell');
                        if (hasTrap) {
                            isValid = false;
                            break;
                        }
                    }
                    if (!isValid)
                        continue;
                }
                if (skill.id === 'predator_shadow_prowl') {
                    if (!(0, AttackDetection_1.isSquareAttackedBy)(board, pos, player, this.state)) {
                        continue;
                    }
                    const hasTrap = board.getCellEffects(pos).some(e => e.type === 'repel' || e.type === 'soulless_cell');
                    if (hasTrap)
                        continue;
                }
                if (skill.id === 'phoenix_ashes') {
                    if (reqIndex === 0) {
                        continue;
                    }
                }
                if (skill.id === 'earth_shifting_peaks') {
                    if (reqIndex === 0) {
                        if (!piece || piece.specialType !== 'mountain' || piece.color !== player) {
                            continue;
                        }
                    }
                }
                if (skill.id === 'turtle_transference') {
                    if (reqIndex === 0) {
                        if (!piece)
                            continue;
                        const isEnemy = piece.color !== player;
                        const hasValidEffect = piece.effects?.some(e => {
                            const isTransferableType = ['stun', 'shield', 'blessing', 'electron', 'ghost'].includes(e.type);
                            if (!isTransferableType)
                                return false;
                            return isEnemy ? !e.isDebuff : e.isDebuff;
                        });
                        if (!hasValidEffect)
                            continue;
                    }
                    if (reqIndex === 1) {
                        if (!piece || piece.type === Piece_1.PieceType.King) {
                            continue;
                        }
                    }
                }
                if (skill.id === 'zombie_infection') {
                    if (piece && piece.effects && piece.effects.some(e => e.type === 'zombie' || e.type === 'walker')) {
                        continue;
                    }
                }
                if (skill.id === 'zombie_mutation') {
                    if (!piece || !piece.effects || !piece.effects.some(e => e.type === 'walker')) {
                        continue;
                    }
                }
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
                if (skill.id === 'magician_swap_allies' || skill.id === 'magician_swap_movements') {
                    if (piece && piece.effects && piece.effects.some(e => e.type === 'position_swap' || e.type === 'moveset_swap')) {
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
        const serializedHistory = this.moveHistory.map(entry => {
            if (entry.isStealth && entry.moverColor !== player) {
                return {
                    from: '',
                    to: '',
                    isStealth: true,
                    moverColor: entry.moverColor,
                };
            }
            return entry;
        });
        // Compute available skill targets
        const availableSkillTargets = {};
        // Only compute if it's the player's active turn and game is playing
        if (this.state.status === 'playing' && this.state.currentTurn === player) {
            const variantId = player === Piece_1.Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
            if (variantId) {
                const variant = this.variantRegistry.get(variantId);
                if (variant) {
                    const isPhoenixSkillDisabled = variantId === 'phoenix' && this.state.variantState.phoenixSkillsDisabled?.[player] === true;
                    const skillsDisabled = this.state.variantState.skillsDisabled === true || isPhoenixSkillDisabled;
                    const maxSkillsPerTurn = variant.maxSkillsPerTurn ?? 1;
                    const skillsUsed = this.state.skillsUsedThisTurn ?? 0;
                    const ap = player === Piece_1.Color.White ? this.state.whiteAP : this.state.blackAP;
                    const isPirateDebt = this.state.variantState[`pirateDebtEnabled_${player}`] === true;
                    if (!skillsDisabled && skillsUsed < maxSkillsPerTurn && !this.state.passSkillSubmitted) {
                        for (const skill of variant.skills) {
                            let cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, player) : skill.apCost;
                            if (this.state.getPlayerEffects(player).some(e => e.type === 'emerald_domain')) {
                                cost += 1;
                            }
                            const hasUsedThisSkill = this.state.skillsUsedThisTurnIds?.includes(skill.id);
                            let canAfford = false;
                            if (isPirateDebt) {
                                canAfford = ap >= 0 && (ap - cost >= -10);
                            }
                            else {
                                canAfford = ap >= cost;
                            }
                            if (canAfford && !hasUsedThisSkill) {
                                const reqs = skill.getTargetRequirements(this.state, player);
                                const validPositions = [];
                                for (let i = 0; i < reqs.length; i++) {
                                    validPositions.push(this.getValidPositionsForRequirement(player, skill, i));
                                }
                                availableSkillTargets[skill.id] = {
                                    requirements: reqs,
                                    validPositions,
                                    currentCost: cost,
                                };
                            }
                            else {
                                const reqs = skill.getTargetRequirements(this.state, player);
                                availableSkillTargets[skill.id] = {
                                    requirements: reqs,
                                    validPositions: reqs.map(() => []),
                                    currentCost: cost,
                                };
                            }
                        }
                    }
                }
            }
        }
        // Compute opponent skill costs (state-dependent, no validPositions needed)
        const opponent = player === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
        const opponentVariantId = opponent === Piece_1.Color.White
            ? this.state.whiteVariantId : this.state.blackVariantId;
        const opponentSkillCosts = {};
        if (opponentVariantId) {
            const opponentVariant = this.variantRegistry.get(opponentVariantId);
            if (opponentVariant) {
                const opponentHasEmeraldDomain = this.state.getPlayerEffects(opponent)
                    .some(e => e.type === 'emerald_domain');
                for (const skill of opponentVariant.skills) {
                    let skillCost = typeof skill.apCost === 'function'
                        ? skill.apCost(this.state, opponent) : skill.apCost;
                    if (opponentHasEmeraldDomain)
                        skillCost += 1;
                    opponentSkillCosts[skill.id] = skillCost;
                }
            }
        }
        return {
            ...serialized,
            moveHistory: serializedHistory,
            availableSkillTargets,
            opponentSkillCosts,
        };
    }
}
exports.Match = Match;
//# sourceMappingURL=Match.js.map