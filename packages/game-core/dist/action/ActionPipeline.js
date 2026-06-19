"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillValidator = exports.APValidator = exports.TurnPhaseValidator = exports.BasicMoveValidator = exports.ActionPipeline = exports.PROMOTION_AP = exports.LOSS_AP = exports.CAPTURE_AP = void 0;
exports.mapReason = mapReason;
const ActionQueue_1 = require("./ActionQueue");
const Piece_1 = require("../pieces/Piece");
const MoveValidator_1 = require("../validation/MoveValidator");
const Board_1 = require("../board/Board");
const DeterministicRng_1 = require("../rng/DeterministicRng");
exports.CAPTURE_AP = {
    Pawn: 2,
    Knight: 3,
    Bishop: 3,
    Rook: 4,
    Queen: 5,
    King: 0,
};
exports.LOSS_AP = {
    Pawn: 1,
    Knight: 2,
    Bishop: 2,
    Rook: 3,
    Queen: 4,
    King: 0,
};
exports.PROMOTION_AP = 3;
function mapReason(actionReason) {
    if (actionReason === 'capture')
        return 'capture';
    if (actionReason === 'explosion')
        return 'explosion';
    if (actionReason === 'raigeki' || actionReason === 'detonation')
        return 'skill';
    return 'effect';
}
const GameEvent_1 = require("../event/GameEvent");
const AttackDetection_1 = require("../combat/AttackDetection");
class ActionPipeline {
    validators = [];
    queue;
    state;
    snapshots;
    eventBus;
    moveModifierChain;
    variantRegistry;
    constructor(state, snapshots, eventBus, moveModifierChain, variantRegistry) {
        this.state = state;
        this.queue = new ActionQueue_1.ActionQueue();
        this.snapshots = snapshots;
        this.eventBus = eventBus;
        this.moveModifierChain = moveModifierChain;
        this.variantRegistry = variantRegistry;
    }
    emitEvent(event) {
        if (this.eventBus) {
            this.eventBus.emit(event, (action) => this.queue.enqueue(action));
        }
    }
    detectAttacksAndChecks() {
        const opponentColor = this.state.currentTurn === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
        // Get all pieces under attack by the active player
        const attacks = (0, AttackDetection_1.getAttackedPieces)(this.state.board, this.state.currentTurn, this.state);
        for (const atk of attacks) {
            this.emitEvent((0, GameEvent_1.createOnPieceAttackedEvent)(this.state.turnNumber, this.state.currentTurn, atk.attacker, atk.target, atk.attackerPos, atk.targetPos));
        }
        // Check if opponent King is under check
        if ((0, AttackDetection_1.isKingAttacked)(this.state.board, opponentColor, this.state)) {
            const kingAttacks = attacks.filter(atk => atk.target.type === Piece_1.PieceType.King);
            // Find King position and piece details
            let kingPos = { col: -1, row: -1 };
            let kingPiece = null;
            for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                    const p = this.state.board.getPiece({ col: c, row: r });
                    if (p && p.type === Piece_1.PieceType.King && p.color === opponentColor) {
                        kingPos = { col: c, row: r };
                        kingPiece = p;
                        break;
                    }
                }
            }
            if (kingPiece) {
                this.emitEvent((0, GameEvent_1.createOnCheckEvent)(this.state.turnNumber, this.state.currentTurn, kingAttacks.map(atk => ({ piece: atk.attacker, position: atk.attackerPos })), kingPiece, kingPos));
            }
        }
    }
    canPlayerUseAnySkill(player) {
        if (!this.variantRegistry)
            return true;
        const variantId = player === Piece_1.Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
        if (!variantId)
            return true;
        const variant = this.variantRegistry.get(variantId);
        if (!variant)
            return true;
        const maxSkillsPerTurn = 1;
        if (this.state.skillsUsedThisTurn >= maxSkillsPerTurn) {
            return false;
        }
        if (this.state.passSkillSubmitted) {
            return false;
        }
        if (this.state.variantState.skillsDisabled) {
            return false;
        }
        const playerAP = player === Piece_1.Color.White ? this.state.whiteAP : this.state.blackAP;
        for (const skill of variant.skills) {
            const cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, player) : skill.apCost;
            if (playerAP >= cost) {
                if (this.canSkillBeActivatedAnywhere(skill, player)) {
                    return true;
                }
            }
        }
        return false;
    }
    canSkillBeActivatedAnywhere(skill, player) {
        const reqs = skill.getTargetRequirements();
        if (reqs.length === 0) {
            return skill.canActivate(this.state, player, []) === null;
        }
        if (reqs.length === 1) {
            const req = reqs[0];
            if (req.type === 'cell') {
                for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        const pos = { col: c, row: r };
                        if (skill.canActivate(this.state, player, [{ type: 'cell', position: pos }]) === null) {
                            return true;
                        }
                    }
                }
            }
            else if (req.type === 'piece') {
                for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        const pos = { col: c, row: r };
                        const piece = this.state.board.getPiece(pos);
                        if (piece) {
                            if (skill.canActivate(this.state, player, [{ type: 'piece', position: pos, pieceId: piece.id }]) === null) {
                                return true;
                            }
                        }
                    }
                }
            }
            return false;
        }
        return true;
    }
    getActiveEffects() {
        const effects = [];
        // Pieces
        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                const p = this.state.board.getPiece({ col: c, row: r });
                if (p && p.effects) {
                    effects.push(...p.effects);
                }
            }
        }
        // Cells
        const allCellEffects = this.state.board.getAllCellEffects();
        for (const cellEffects of allCellEffects.values()) {
            effects.push(...cellEffects);
        }
        // Players
        effects.push(...this.state.whitePlayerEffects);
        effects.push(...this.state.blackPlayerEffects);
        return effects;
    }
    findPieceById(id) {
        for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
            for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                const p = this.state.board.getPiece({ col: c, row: r });
                if (p && p.id === id) {
                    return { piece: p, pos: { col: c, row: r } };
                }
            }
        }
        return null;
    }
    addValidator(validator) {
        this.validators.push(validator);
    }
    drainQueue(appliedActions, safetyLimit, iterationsRef) {
        while (!this.queue.isEmpty() && iterationsRef.val < safetyLimit) {
            const nextAction = this.queue.dequeue();
            this.applyAction(nextAction);
            appliedActions.push(nextAction);
            iterationsRef.val++;
            if (iterationsRef.val === 200) {
                console.warn('Action pipeline queue exceeded 200 iterations - possible infinite loop');
            }
        }
    }
    submitAction(action) {
        if (action.type === 'USE_SKILL') {
            const playerEffects = this.state.getPlayerEffects(action.player);
            const isSilenced = playerEffects.some(e => e.type === 'silence');
            if (isSilenced) {
                return { success: false, reason: 'Player is silenced and cannot use skills', actions: [] };
            }
        }
        // 1. Validate action
        for (const validator of this.validators) {
            const error = validator.validate(action, this.state);
            if (error) {
                return { success: false, reason: error, actions: [] };
            }
        }
        // 2. Enqueue root action and drain
        const appliedActions = [];
        this.queue.enqueue(action);
        const safetyLimit = 500;
        const iterationsRef = { val: 0 };
        this.drainQueue(appliedActions, safetyLimit, iterationsRef);
        // SAU KHI drainQueue() xong — resolve pendingDeadKings 1 lần duy nhất
        if (this.state.pendingDeadKings && this.state.pendingDeadKings.length > 0) {
            if (this.state.pendingDeadKings.length === 1) {
                this.queue.enqueue({
                    type: 'GAME_OVER',
                    winner: (0, Piece_1.oppositeColor)(this.state.pendingDeadKings[0]),
                    reason: 'King captured/destroyed',
                });
            }
            else if (this.state.pendingDeadKings.length >= 2) {
                // >= 2 kings dead simultaneously → active player wins
                this.queue.enqueue({
                    type: 'GAME_OVER',
                    winner: this.state.currentTurn,
                    reason: 'Simultaneous King deaths',
                });
            }
            this.state.pendingDeadKings = [];
            this.drainQueue(appliedActions, safetyLimit, iterationsRef);
        }
        if (iterationsRef.val >= safetyLimit) {
            console.warn('Action pipeline queue limit reached - possible infinite loop');
        }
        return {
            success: true,
            actions: appliedActions,
        };
    }
    applyAction(action) {
        const maxSkillsPerTurn = 1; // Default - can be modified by variant definition
        switch (action.type) {
            case 'START_MATCH':
                this.state.status = 'playing';
                this.state.lastMoveTimestamp = Date.now();
                this.queue.enqueue({ type: 'START_TURN', player: Piece_1.Color.White });
                break;
            case 'START_TURN': {
                if (this.snapshots) {
                    this.snapshots.capture(this.state);
                }
                this.emitEvent((0, GameEvent_1.createOnTurnStartEvent)(this.state.turnNumber, this.state.currentTurn));
                this.queue.enqueue({
                    type: 'TICK_EFFECTS',
                    timing: 'turnStart',
                    player: this.state.currentTurn,
                });
                this.state.turnPhase = 'start';
                this.state.hasMoved = false;
                this.state.skillsUsedThisTurn = 0;
                this.state.passSkillSubmitted = false;
                this.state.turnPhase = 'action';
                this.state.lastMoveTimestamp = Date.now();
                break;
            }
            case 'MOVE_PIECE': {
                const beforeEvent = (0, GameEvent_1.createOnBeforeMoveEvent)(this.state.turnNumber, this.state.currentTurn, action.pieceId, action.from, action.to);
                this.emitEvent(beforeEvent);
                if (beforeEvent.cancelled) {
                    return;
                }
                this.state.board.movePiece(action.from, action.to);
                this.state.hasMoved = true;
                this.emitEvent((0, GameEvent_1.createOnMoveEvent)(this.state.turnNumber, this.state.currentTurn, action.pieceId, action.from, action.to));
                // Attack & Check detection
                this.detectAttacksAndChecks();
                // Pawn promotion check
                const piece = this.state.board.getPiece(action.to);
                if (piece && piece.type === Piece_1.PieceType.Pawn) {
                    const isPromotionRow = (piece.color === Piece_1.Color.White && action.to.row === 14) ||
                        (piece.color === Piece_1.Color.Black && action.to.row === 0);
                    if (isPromotionRow) {
                        piece.type = Piece_1.PieceType.Queen;
                        this.queue.enqueue({
                            type: 'PAWN_PROMOTION',
                            pieceId: piece.id,
                            position: action.to,
                            promotedTo: 'Queen',
                        });
                        this.queue.enqueue({
                            type: 'GAIN_AP',
                            player: piece.color,
                            amount: exports.PROMOTION_AP,
                            source: 'promotion',
                        });
                    }
                }
                break;
            }
            case 'CAPTURE': {
                const capturedPiece = this.state.board.getPiece(action.to);
                if (!capturedPiece)
                    return;
                const beforeDestroyEvent = (0, GameEvent_1.createOnBeforePieceDestroyedEvent)(this.state.turnNumber, this.state.currentTurn, { ...capturedPiece, effects: capturedPiece.effects ? capturedPiece.effects.map(e => ({ ...e })) : [] }, action.to, 'capture');
                this.emitEvent(beforeDestroyEvent);
                if (beforeDestroyEvent.cancelled) {
                    return;
                }
                const beforeEvent = (0, GameEvent_1.createOnBeforeCaptureEvent)(this.state.turnNumber, this.state.currentTurn, action.attackerId, action.capturedPieceId, action.from, action.to);
                this.emitEvent(beforeEvent);
                if (beforeEvent.cancelled) {
                    return;
                }
                const captured = this.state.board.movePiece(action.from, action.to);
                this.state.hasMoved = true;
                if (captured) {
                    this.emitEvent((0, GameEvent_1.createOnCaptureEvent)(this.state.turnNumber, this.state.currentTurn, action.attackerId, action.capturedPieceId, action.from, action.to));
                    this.emitEvent((0, GameEvent_1.createOnPieceDestroyedEvent)(this.state.turnNumber, this.state.currentTurn, { ...captured, effects: captured.effects ? captured.effects.map(e => ({ ...e })) : [] }, action.to, action.attackerId));
                    this.emitEvent((0, GameEvent_1.createOnPieceDeathEvent)(this.state.turnNumber, this.state.currentTurn, action.capturedPieceId, action.to, 'capture', action.attackerId));
                    // Attack & Check detection
                    this.detectAttacksAndChecks();
                    // Enqueue graveyard
                    this.queue.enqueue({
                        type: 'ADD_TO_GRAVEYARD',
                        piece: captured,
                        position: action.to,
                        killedBy: 'capture',
                        killerId: action.attackerId,
                    });
                    // AP rewards
                    const attackerReward = exports.CAPTURE_AP[captured.type] || 0;
                    const defenderLoss = exports.LOSS_AP[captured.type] || 0;
                    if (attackerReward > 0) {
                        this.queue.enqueue({
                            type: 'GAIN_AP',
                            player: this.state.currentTurn,
                            amount: attackerReward,
                            source: 'capture_reward',
                        });
                    }
                    if (defenderLoss > 0) {
                        this.queue.enqueue({
                            type: 'GAIN_AP',
                            player: (0, Piece_1.oppositeColor)(this.state.currentTurn),
                            amount: defenderLoss,
                            source: 'loss_reward',
                        });
                    }
                    // King capture check
                    if (captured.type === Piece_1.PieceType.King) {
                        this.state.pendingDeadKings.push(captured.color);
                    }
                }
                // Pawn promotion check
                const piece = this.state.board.getPiece(action.to);
                if (piece && piece.type === Piece_1.PieceType.Pawn) {
                    const isPromotionRow = (piece.color === Piece_1.Color.White && action.to.row === 14) ||
                        (piece.color === Piece_1.Color.Black && action.to.row === 0);
                    if (isPromotionRow) {
                        piece.type = Piece_1.PieceType.Queen;
                        this.queue.enqueue({
                            type: 'PAWN_PROMOTION',
                            pieceId: piece.id,
                            position: action.to,
                            promotedTo: 'Queen',
                        });
                        this.queue.enqueue({
                            type: 'GAIN_AP',
                            player: piece.color,
                            amount: exports.PROMOTION_AP,
                            source: 'promotion',
                        });
                    }
                }
                break;
            }
            case 'PASS_SKILL':
                this.state.passSkillSubmitted = true;
                break;
            case 'USE_SKILL': {
                if (this.variantRegistry) {
                    const variantId = action.player === Piece_1.Color.White ? this.state.whiteVariantId : this.state.blackVariantId;
                    if (variantId) {
                        const variant = this.variantRegistry.get(variantId);
                        if (variant) {
                            const skill = variant.skills.find(s => s.id === action.skillId);
                            if (skill) {
                                // 1. Spend AP
                                const cost = typeof skill.apCost === 'function' ? skill.apCost(this.state, action.player) : skill.apCost;
                                this.queue.enqueue({
                                    type: 'SPEND_AP',
                                    player: action.player,
                                    amount: cost,
                                    source: `skill:${action.skillId}`,
                                });
                                // 2. Execute skill with DeterministicRng
                                const rng = new DeterministicRng_1.DeterministicRng(this.state.rngSeed, this.state.rngCounter);
                                const subActions = skill.execute(this.state, action.player, action.targets, rng);
                                this.state.rngCounter = rng.getState().counter;
                                // 3. Enqueue all sub-actions
                                for (const sub of subActions) {
                                    this.queue.enqueue(sub);
                                }
                            }
                        }
                    }
                }
                this.state.skillsUsedThisTurn++;
                this.emitEvent((0, GameEvent_1.createOnSkillUsedEvent)(this.state.turnNumber, this.state.currentTurn, action.skillId, action.targets));
                break;
            }
            case 'GAIN_AP':
                if (action.player === Piece_1.Color.White) {
                    this.state.whiteAP += action.amount;
                }
                else {
                    this.state.blackAP += action.amount;
                }
                this.emitEvent((0, GameEvent_1.createOnAPGainedEvent)(this.state.turnNumber, this.state.currentTurn, action.player, action.amount, action.source));
                break;
            case 'SPEND_AP':
                if (action.player === Piece_1.Color.White) {
                    this.state.whiteAP = Math.max(0, this.state.whiteAP - action.amount);
                }
                else {
                    this.state.blackAP = Math.max(0, this.state.blackAP - action.amount);
                }
                this.emitEvent((0, GameEvent_1.createOnAPSpentEvent)(this.state.turnNumber, this.state.currentTurn, action.player, action.amount, action.source));
                break;
            case 'ADD_TO_GRAVEYARD':
                this.state.graveyard.push({
                    piece: action.piece,
                    position: action.position,
                    turnDied: this.state.turnNumber,
                    killedBy: action.killedBy,
                    killerId: action.killerId,
                });
                break;
            case 'GAME_OVER':
                this.state.status = 'finished';
                this.state.winner = action.winner;
                this.emitEvent((0, GameEvent_1.createOnGameOverEvent)(this.state.turnNumber, this.state.currentTurn, action.winner, action.reason));
                break;
            case 'END_TURN': {
                if (this.state.status === 'playing' && this.state.actionHistory.getAll().length > 0) {
                    const now = Date.now();
                    const elapsed = now - this.state.lastMoveTimestamp;
                    const isTimerPaused = this.state.variantState.turnTimeoutOverride !== undefined && this.state.variantState.turnTimeoutOverride !== null;
                    if (!isTimerPaused) {
                        if (this.state.currentTurn === Piece_1.Color.White) {
                            this.state.whiteTimeLeft = Math.max(0, this.state.whiteTimeLeft - elapsed);
                        }
                        else {
                            this.state.blackTimeLeft = Math.max(0, this.state.blackTimeLeft - elapsed);
                        }
                    }
                    this.state.lastMoveTimestamp = now;
                }
                this.emitEvent((0, GameEvent_1.createOnTurnEndEvent)(this.state.turnNumber, this.state.currentTurn));
                this.queue.enqueue({
                    type: 'TICK_EFFECTS',
                    timing: 'turnEnd',
                    player: this.state.currentTurn,
                });
                this.state.turnPhase = 'end';
                this.state.turnPhase = 'cleanup';
                this.queue.enqueue({
                    type: 'SWITCH_TURN',
                    fromPlayer: this.state.currentTurn,
                    toPlayer: (0, Piece_1.oppositeColor)(this.state.currentTurn),
                });
                break;
            }
            case 'SWITCH_TURN':
                this.state.currentTurn = action.toPlayer;
                if (action.toPlayer === Piece_1.Color.White) {
                    this.state.turnNumber++;
                }
                this.queue.enqueue({ type: 'START_TURN', player: action.toPlayer });
                break;
            case 'TIME_UPDATE':
                this.state.whiteTimeLeft = action.whiteTimeLeft;
                this.state.blackTimeLeft = action.blackTimeLeft;
                break;
            case 'APPLY_EFFECT': {
                const effect = action.effect;
                if (!effect.metadata) {
                    effect.metadata = {};
                }
                effect.metadata.appliedTurn = this.state.turnNumber;
                effect.metadata.appliedPlayer = this.state.currentTurn;
                if (effect.targetType === 'piece') {
                    const found = this.findPieceById(effect.targetId);
                    if (found) {
                        if (!found.piece.effects)
                            found.piece.effects = [];
                        const existingIdx = found.piece.effects.findIndex(e => e.type === effect.type);
                        if (existingIdx !== -1) {
                            const existing = found.piece.effects[existingIdx];
                            if (effect.stackingRule === 'refresh') {
                                existing.remainingDuration = effect.duration;
                            }
                            else if (effect.stackingRule === 'stack') {
                                existing.stackCount = (existing.stackCount || 1) + 1;
                                existing.remainingDuration = effect.duration;
                            }
                        }
                        else {
                            found.piece.effects.push(effect);
                        }
                    }
                }
                else if (effect.targetType === 'cell') {
                    const [col, row] = effect.targetId.split(',').map(Number);
                    const pos = { col, row };
                    const cellEffects = this.state.board.getCellEffects(pos);
                    const existingIdx = cellEffects.findIndex(e => e.type === effect.type);
                    if (existingIdx !== -1) {
                        const existing = cellEffects[existingIdx];
                        if (effect.stackingRule === 'refresh') {
                            existing.remainingDuration = effect.duration;
                        }
                        else if (effect.stackingRule === 'stack') {
                            existing.stackCount = (existing.stackCount || 1) + 1;
                            existing.remainingDuration = effect.duration;
                        }
                    }
                    else {
                        this.state.board.addCellEffect(pos, effect);
                    }
                }
                else if (effect.targetType === 'player') {
                    const targetColor = effect.targetId;
                    this.state.addPlayerEffect(targetColor, effect);
                }
                this.emitEvent((0, GameEvent_1.createOnEffectAppliedEvent)(this.state.turnNumber, this.state.currentTurn, effect));
                break;
            }
            case 'REMOVE_EFFECT': {
                const effectId = action.effectId;
                let removed = false;
                let effectSnapshot = null;
                for (let r = 0; r < Board_1.BOARD_SIZE; r++) {
                    for (let c = 0; c < Board_1.BOARD_SIZE; c++) {
                        const p = this.state.board.getPiece({ col: c, row: r });
                        if (p && p.effects) {
                            const idx = p.effects.findIndex(e => e.id === effectId);
                            if (idx !== -1) {
                                effectSnapshot = { ...p.effects[idx], metadata: { ...p.effects[idx].metadata } };
                                p.effects.splice(idx, 1);
                                removed = true;
                                break;
                            }
                        }
                    }
                    if (removed)
                        break;
                }
                if (!removed) {
                    const allCellEffects = this.state.board.getAllCellEffects();
                    for (const [key, cellEffects] of allCellEffects.entries()) {
                        const idx = cellEffects.findIndex(e => e.id === effectId);
                        if (idx !== -1) {
                            effectSnapshot = { ...cellEffects[idx], metadata: { ...cellEffects[idx].metadata } };
                            const [col, row] = key.split(',').map(Number);
                            this.state.board.removeCellEffect({ col, row }, effectId);
                            break;
                        }
                    }
                }
                if (!removed) {
                    for (const color of [Piece_1.Color.White, Piece_1.Color.Black]) {
                        const effects = this.state.getPlayerEffects(color);
                        const idx = effects.findIndex(e => e.id === effectId);
                        if (idx !== -1) {
                            effectSnapshot = { ...effects[idx], metadata: { ...effects[idx].metadata } };
                            this.state.removePlayerEffect(color, effectId);
                            removed = true;
                            break;
                        }
                    }
                }
                this.emitEvent((0, GameEvent_1.createOnEffectExpiredEvent)(this.state.turnNumber, this.state.currentTurn, effectId, action.reason, effectSnapshot));
                break;
            }
            case 'TICK_EFFECTS': {
                const timing = action.timing;
                const allEffects = this.getActiveEffects();
                for (const effect of allEffects) {
                    if (effect.tickTiming === timing && effect.remainingDuration !== null) {
                        if (effect.metadata && effect.metadata.appliedTurn === this.state.turnNumber && effect.metadata.appliedPlayer === this.state.currentTurn) {
                            continue;
                        }
                        if (effect.targetType === 'piece') {
                            const found = this.findPieceById(effect.targetId);
                            if (found) {
                                if (found.piece.color !== action.player) {
                                    continue;
                                }
                            }
                        }
                        else if (effect.targetType === 'player') {
                            if (effect.targetId !== action.player) {
                                continue;
                            }
                        }
                        effect.remainingDuration--;
                        this.emitEvent((0, GameEvent_1.createOnEffectTickEvent)(this.state.turnNumber, this.state.currentTurn, effect));
                        if (effect.remainingDuration <= 0) {
                            this.queue.enqueue({
                                type: 'REMOVE_EFFECT',
                                effectId: effect.id,
                                targetId: effect.targetId,
                                targetType: effect.targetType,
                                reason: 'expired',
                            });
                        }
                    }
                }
                break;
            }
            case 'PAWN_PROMOTION':
                this.emitEvent((0, GameEvent_1.createOnPawnPromotionEvent)(this.state.turnNumber, this.state.currentTurn, action.pieceId, action.position, action.promotedTo));
                break;
            case 'SPAWN_PIECE':
                this.emitEvent((0, GameEvent_1.createOnPieceSpawnEvent)(this.state.turnNumber, this.state.currentTurn, action.piece.id, action.position));
                break;
            case 'DESTROY_PIECE': {
                const piece = this.state.board.getPiece(action.position);
                if (piece && piece.id === action.pieceId) {
                    const mappedReason = mapReason(action.reason);
                    const beforeDestroyEvent = (0, GameEvent_1.createOnBeforePieceDestroyedEvent)(this.state.turnNumber, this.state.currentTurn, { ...piece, effects: piece.effects ? piece.effects.map(e => ({ ...e })) : [] }, action.position, mappedReason);
                    this.emitEvent(beforeDestroyEvent);
                    if (beforeDestroyEvent.cancelled) {
                        return;
                    }
                    this.state.board.removePiece(action.position);
                    this.emitEvent((0, GameEvent_1.createOnPieceDestroyedEvent)(this.state.turnNumber, this.state.currentTurn, { ...piece, effects: piece.effects ? piece.effects.map(e => ({ ...e })) : [] }, action.position, action.reason));
                    this.emitEvent((0, GameEvent_1.createOnPieceDeathEvent)(this.state.turnNumber, this.state.currentTurn, action.pieceId, action.position, 'effect', action.reason));
                    this.queue.enqueue({
                        type: 'ADD_TO_GRAVEYARD',
                        piece,
                        position: action.position,
                        killedBy: 'effect',
                        killerId: action.reason,
                    });
                    if (piece.type === Piece_1.PieceType.King) {
                        this.state.pendingDeadKings.push(piece.color);
                    }
                }
                break;
            }
            // Fallback/No-op for other step actions not yet handled
        }
        const triggersTurnEnd = ['MOVE_PIECE', 'CAPTURE', 'PASS_SKILL', 'USE_SKILL'].includes(action.type);
        if (triggersTurnEnd && this.state.status === 'playing') {
            const isTimerPaused = this.state.variantState.turnTimeoutOverride !== undefined && this.state.variantState.turnTimeoutOverride !== null;
            const canUseSkill = this.canPlayerUseAnySkill(this.state.currentTurn);
            if (this.state.hasMoved && (isTimerPaused || this.state.skillsUsedThisTurn > 0 || this.state.passSkillSubmitted || !canUseSkill)) {
                this.queue.enqueue({ type: 'END_TURN', player: this.state.currentTurn });
            }
        }
        // Always push the applied action to history
        this.state.actionHistory.push(this.state.turnNumber, action);
    }
}
exports.ActionPipeline = ActionPipeline;
// === Basic Validators ===
class BasicMoveValidator {
    moveModifierChain;
    constructor(moveModifierChain) {
        this.moveModifierChain = moveModifierChain;
    }
    validate(action, state) {
        if (action.type !== 'MOVE_PIECE' && action.type !== 'CAPTURE') {
            return null;
        }
        const validation = (0, MoveValidator_1.validateMove)(state.board, state.currentTurn, state.currentTurn, // Attacking player matches currentTurn
        action.from, action.to, state, this.moveModifierChain);
        return validation.valid ? null : (validation.reason || 'Invalid move');
    }
}
exports.BasicMoveValidator = BasicMoveValidator;
class TurnPhaseValidator {
    validate(action, state) {
        if (action.type !== 'MOVE_PIECE' &&
            action.type !== 'CAPTURE' &&
            action.type !== 'USE_SKILL' &&
            action.type !== 'PASS_SKILL' &&
            action.type !== 'END_TURN') {
            return null;
        }
        if (state.status !== 'playing') {
            return 'Match is not in progress';
        }
        if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
            if (state.turnPhase !== 'action') {
                return 'Not in action turn phase';
            }
            if (state.hasMoved) {
                return 'Already moved this turn';
            }
        }
        if (action.type === 'USE_SKILL') {
            if (state.turnPhase !== 'action') {
                return 'Not in action turn phase';
            }
            const maxSkillsPerTurn = 1;
            if (state.skillsUsedThisTurn >= maxSkillsPerTurn) {
                return 'Already used maximum skills this turn';
            }
            if (state.passSkillSubmitted) {
                return 'Cannot use skill after passing skill selection';
            }
        }
        if (action.type === 'PASS_SKILL') {
            if (state.turnPhase !== 'action') {
                return 'Not in action turn phase';
            }
            if (state.skillsUsedThisTurn > 0) {
                return 'Cannot pass skill after using a skill';
            }
            if (state.passSkillSubmitted) {
                return 'Already passed skill this turn';
            }
        }
        if (action.type === 'END_TURN') {
            if (state.currentTurn !== action.player) {
                return 'Not your turn';
            }
        }
        return null;
    }
}
exports.TurnPhaseValidator = TurnPhaseValidator;
class APValidator {
    variantRegistry;
    constructor(variantRegistry) {
        this.variantRegistry = variantRegistry;
    }
    validate(action, state) {
        if (action.type === 'USE_SKILL') {
            if (!this.variantRegistry)
                return null;
            const variantId = action.player === Piece_1.Color.White ? state.whiteVariantId : state.blackVariantId;
            if (!variantId)
                return 'No variant selected';
            const variant = this.variantRegistry.get(variantId);
            if (!variant)
                return 'Variant not found';
            const skill = variant.skills.find(s => s.id === action.skillId);
            if (!skill)
                return 'Skill not found';
            const cost = typeof skill.apCost === 'function' ? skill.apCost(state, action.player) : skill.apCost;
            const ap = action.player === Piece_1.Color.White ? state.whiteAP : state.blackAP;
            if (ap < cost) {
                return 'Sufficient AP not available';
            }
        }
        return null;
    }
}
exports.APValidator = APValidator;
class SkillValidator {
    variantRegistry;
    constructor(variantRegistry) {
        this.variantRegistry = variantRegistry;
    }
    validate(action, state) {
        if (action.type === 'USE_SKILL') {
            if (state.variantState.skillsDisabled) {
                return 'Cannot use skills while skills are disabled';
            }
            if (!this.variantRegistry)
                return null;
            const variantId = action.player === Piece_1.Color.White ? state.whiteVariantId : state.blackVariantId;
            if (!variantId)
                return 'No variant selected';
            const variant = this.variantRegistry.get(variantId);
            if (!variant)
                return 'Variant not found';
            const skill = variant.skills.find(s => s.id === action.skillId);
            if (!skill)
                return 'Skill not found';
            return skill.canActivate(state, action.player, action.targets);
        }
        return null;
    }
}
exports.SkillValidator = SkillValidator;
//# sourceMappingURL=ActionPipeline.js.map