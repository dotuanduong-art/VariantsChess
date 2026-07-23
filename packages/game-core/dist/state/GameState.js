"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = void 0;
const Board_1 = require("../board/Board");
const Piece_1 = require("../pieces/Piece");
const ActionHistory_1 = require("../action/ActionHistory");
class GameState {
    board;
    currentTurn;
    turnNumber;
    status;
    winner;
    // Turn phase tracking (GDD §Turn Structure)
    turnPhase;
    hasMoved;
    skillsUsedThisTurn;
    skillsUsedThisTurnIds;
    passSkillSubmitted;
    // AP economy
    whiteAP;
    blackAP;
    // Time
    whiteTimeLeft;
    blackTimeLeft;
    lastMoveTimestamp;
    // History
    actionHistory;
    // Graveyard
    graveyard;
    // RNG
    rngSeed;
    rngCounter;
    // Variant state
    whiteVariantId = null;
    blackVariantId = null;
    variantState = {};
    pendingDeadKings = [];
    whitePlayerEffects;
    blackPlayerEffects;
    positionSnapshots = [];
    constructor(rngSeed = Date.now()) {
        this.board = new Board_1.Board();
        this.currentTurn = Piece_1.Color.White;
        this.turnNumber = 1;
        this.status = 'waiting';
        this.winner = null;
        this.turnPhase = 'start';
        this.hasMoved = false;
        this.skillsUsedThisTurn = 0;
        this.skillsUsedThisTurnIds = [];
        this.passSkillSubmitted = false;
        this.whiteAP = 0;
        this.blackAP = 0;
        this.whiteTimeLeft = 15 * 60 * 1000;
        this.blackTimeLeft = 15 * 60 * 1000;
        this.lastMoveTimestamp = 0;
        this.actionHistory = new ActionHistory_1.ActionHistory();
        this.graveyard = [];
        this.rngSeed = rngSeed;
        this.rngCounter = 0;
        this.pendingDeadKings = [];
        this.whitePlayerEffects = [];
        this.blackPlayerEffects = [];
    }
    getPlayerEffects(player) {
        return player === Piece_1.Color.White ? this.whitePlayerEffects : this.blackPlayerEffects;
    }
    addPlayerEffect(player, effect) {
        const effects = this.getPlayerEffects(player);
        const existingIdx = effects.findIndex(e => e.type === effect.type);
        if (existingIdx !== -1) {
            const existing = effects[existingIdx];
            if (effect.stackingRule === 'refresh') {
                existing.remainingDuration = effect.duration;
            }
            else if (effect.stackingRule === 'stack') {
                existing.stackCount = (existing.stackCount || 1) + 1;
                existing.remainingDuration = effect.duration;
            }
        }
        else {
            effects.push(effect);
        }
    }
    removePlayerEffect(player, effectId) {
        const effects = player === Piece_1.Color.White ? this.whitePlayerEffects : this.blackPlayerEffects;
        const idx = effects.findIndex(e => e.id === effectId);
        if (idx !== -1) {
            effects.splice(idx, 1);
        }
    }
    toSerializable() {
        return {
            board: this.board.toSerializable(),
            currentTurn: this.currentTurn,
            turnNumber: this.turnNumber,
            status: this.status,
            winner: this.winner,
            turnPhase: this.turnPhase,
            hasMoved: this.hasMoved,
            skillsUsedThisTurn: this.skillsUsedThisTurn,
            skillsUsedThisTurnIds: [...(this.skillsUsedThisTurnIds || [])],
            passSkillSubmitted: this.passSkillSubmitted,
            whiteAP: this.whiteAP,
            blackAP: this.blackAP,
            whiteTimeLeft: this.whiteTimeLeft,
            blackTimeLeft: this.blackTimeLeft,
            lastMoveTimestamp: this.lastMoveTimestamp,
            actionHistory: this.actionHistory.toSerializable(),
            graveyard: this.graveyard.map(e => ({
                ...e,
                piece: { ...e.piece, effects: e.piece.effects ? e.piece.effects.map(eff => ({ ...eff })) : [] },
            })),
            rngSeed: this.rngSeed,
            rngCounter: this.rngCounter,
            whiteVariantId: this.whiteVariantId,
            blackVariantId: this.blackVariantId,
            variantState: this.variantState ? structuredClone(this.variantState) : {},
            pendingDeadKings: [...this.pendingDeadKings],
            whitePlayerEffects: this.whitePlayerEffects.map(e => ({ ...e })),
            blackPlayerEffects: this.blackPlayerEffects.map(e => ({ ...e })),
            positionSnapshots: this.positionSnapshots ? this.positionSnapshots.map(s => ({
                turnNumber: s.turnNumber,
                player: s.player,
                positions: s.positions.map(p => ({ pieceId: p.pieceId, position: { col: p.position.col, row: p.position.row } }))
            })) : [],
        };
    }
    serializeForPlayer(player) {
        const serialized = this.toSerializable();
        // Filter cell effects on the board
        if (serialized.board.cellEffects) {
            const filteredCellEffects = {};
            for (const [key, effects] of Object.entries(serialized.board.cellEffects)) {
                const kept = effects.filter(e => {
                    const isSensitiveType = e.type === 'thunder_trap' || e.type === 'landmine';
                    const isHiddenEffect = e.isHidden === true || isSensitiveType;
                    if (isHiddenEffect && e.sourcePlayer !== player) {
                        return false;
                    }
                    return true;
                });
                if (kept.length > 0) {
                    filteredCellEffects[key] = kept;
                }
            }
            serialized.board.cellEffects = filteredCellEffects;
        }
        // Filter invisible pieces of the opponent on the grid
        serialized.board.grid = serialized.board.grid.map(row => row.map(piece => {
            if (!piece)
                return null;
            if (piece.color !== player) {
                const isInvisible = piece.effects?.some((e) => (e.type === 'ghost' && e.metadata?.stealth === true) ||
                    e.type === 'invisible' ||
                    e.type === 'stealth' ||
                    e.isHidden === true);
                if (isInvisible)
                    return null;
                // Apex Camouflage check
                const hasApexCamouflage = this.getPlayerEffects(piece.color).some(e => e.type === 'apex_camouflage');
                if (hasApexCamouflage && piece.type !== Piece_1.PieceType.King) {
                    const revealedPieceIds = this.variantState.revealedPieceIds || [];
                    if (!revealedPieceIds.includes(piece.id)) {
                        return null;
                    }
                }
            }
            return piece;
        }));
        return serialized;
    }
    static fromSerializable(data) {
        const state = new GameState(data.rngSeed);
        state.board = Board_1.Board.fromSerializable(data.board);
        state.currentTurn = data.currentTurn;
        state.turnNumber = data.turnNumber;
        state.status = data.status;
        state.winner = data.winner;
        state.turnPhase = data.turnPhase;
        state.hasMoved = data.hasMoved;
        state.skillsUsedThisTurn = data.skillsUsedThisTurn;
        state.skillsUsedThisTurnIds = data.skillsUsedThisTurnIds ? [...data.skillsUsedThisTurnIds] : [];
        state.passSkillSubmitted = data.passSkillSubmitted;
        state.whiteAP = data.whiteAP;
        state.blackAP = data.blackAP;
        state.whiteTimeLeft = data.whiteTimeLeft;
        state.blackTimeLeft = data.blackTimeLeft;
        state.lastMoveTimestamp = data.lastMoveTimestamp;
        state.actionHistory = ActionHistory_1.ActionHistory.fromSerializable(data.actionHistory);
        state.graveyard = data.graveyard.map(e => ({
            ...e,
            piece: { ...e.piece, effects: e.piece.effects ? e.piece.effects.map(eff => ({ ...eff })) : [] },
        }));
        state.rngCounter = data.rngCounter;
        state.whiteVariantId = data.whiteVariantId;
        state.blackVariantId = data.blackVariantId;
        state.variantState = { ...data.variantState };
        state.pendingDeadKings = data.pendingDeadKings ? [...data.pendingDeadKings] : [];
        state.whitePlayerEffects = data.whitePlayerEffects ? data.whitePlayerEffects.map(e => ({ ...e })) : [];
        state.blackPlayerEffects = data.blackPlayerEffects ? data.blackPlayerEffects.map(e => ({ ...e })) : [];
        state.positionSnapshots = data.positionSnapshots ? data.positionSnapshots.map(s => ({
            turnNumber: s.turnNumber,
            player: s.player,
            positions: s.positions.map(p => ({ pieceId: p.pieceId, position: { col: p.position.col, row: p.position.row } }))
        })) : [];
        return state;
    }
}
exports.GameState = GameState;
//# sourceMappingURL=GameState.js.map