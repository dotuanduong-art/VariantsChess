"use strict";
// ============================================================
// Match - Game session management
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Match = void 0;
const Position_1 = require("../board/Position");
const Piece_1 = require("../pieces/Piece");
const initialLayout_1 = require("../pieces/initialLayout");
const MoveValidator_1 = require("../validation/MoveValidator");
const MoveGenerator_1 = require("../movement/MoveGenerator");
class Match {
    board;
    currentTurn;
    status;
    winner;
    moveHistory;
    whiteTimeLeft;
    blackTimeLeft;
    lastMoveTimestamp;
    constructor() {
        this.board = (0, initialLayout_1.createInitialBoard)();
        this.currentTurn = Piece_1.Color.White;
        this.status = 'waiting';
        this.winner = null;
        this.moveHistory = [];
        this.whiteTimeLeft = 15 * 60 * 1000; // 15 mins
        this.blackTimeLeft = 15 * 60 * 1000;
        this.lastMoveTimestamp = 0;
    }
    /**
     * Start the match
     */
    start() {
        if (this.status !== 'waiting') {
            throw new Error('Match already started');
        }
        this.status = 'playing';
        this.lastMoveTimestamp = Date.now();
    }
    /**
     * Attempt to make a move. Returns the result.
     */
    makeMove(playerColor, from, to) {
        if (this.status !== 'playing') {
            return { success: false, reason: 'Match is not in progress' };
        }
        const now = Date.now();
        const elapsed = this.moveHistory.length === 0 ? 0 : now - this.lastMoveTimestamp;
        // Validate
        const validation = (0, MoveValidator_1.validateMove)(this.board, this.currentTurn, playerColor, from, to);
        if (!validation.valid) {
            return { success: false, reason: validation.reason };
        }
        // Process time
        if (this.currentTurn === Piece_1.Color.White) {
            this.whiteTimeLeft -= elapsed;
            if (this.whiteTimeLeft <= 0) {
                this.status = 'finished';
                this.winner = Piece_1.Color.Black;
                this.whiteTimeLeft = 0;
                return { success: false, reason: 'Time out' };
            }
            this.whiteTimeLeft += 10000; // +10 seconds increment
        }
        else {
            this.blackTimeLeft -= elapsed;
            if (this.blackTimeLeft <= 0) {
                this.status = 'finished';
                this.winner = Piece_1.Color.White;
                this.blackTimeLeft = 0;
                return { success: false, reason: 'Time out' };
            }
            this.blackTimeLeft += 10000; // +10 seconds increment
        }
        this.lastMoveTimestamp = now;
        // Execute move
        const captured = this.board.movePiece(from, to);
        // Record move
        this.moveHistory.push({ from: (0, Position_1.toAlgebraic)(from), to: (0, Position_1.toAlgebraic)(to) });
        // Check for king capture
        let isKingCaptured = false;
        if (captured && captured.type === Piece_1.PieceType.King) {
            isKingCaptured = true;
            this.status = 'finished';
            this.winner = playerColor;
        }
        // Switch turns
        if (!isKingCaptured) {
            this.currentTurn = (0, Piece_1.oppositeColor)(this.currentTurn);
        }
        return {
            success: true,
            capturedPiece: captured ? { type: captured.type, color: captured.color } : undefined,
            isKingCaptured,
        };
    }
    /**
     * Get legal moves for a position (used by frontend for highlighting)
     */
    getLegalMovesAt(pos) {
        return (0, MoveGenerator_1.getLegalMoves)(this.board, pos);
    }
    getBoard() {
        return this.board;
    }
    getCurrentTurn() {
        return this.currentTurn;
    }
    getStatus() {
        return this.status;
    }
    getWinner() {
        return this.winner;
    }
    getMoveHistory() {
        return [...this.moveHistory];
    }
    /**
     * Check if the current player has run out of time
     */
    checkTimeout() {
        if (this.status !== 'playing')
            return null;
        if (this.moveHistory.length === 0)
            return null;
        const now = Date.now();
        const elapsed = now - this.lastMoveTimestamp;
        if (this.currentTurn === Piece_1.Color.White && this.whiteTimeLeft - elapsed <= 0) {
            this.status = 'finished';
            this.winner = Piece_1.Color.Black;
            this.whiteTimeLeft = 0;
            return Piece_1.Color.Black;
        }
        else if (this.currentTurn === Piece_1.Color.Black && this.blackTimeLeft - elapsed <= 0) {
            this.status = 'finished';
            this.winner = Piece_1.Color.White;
            this.blackTimeLeft = 0;
            return Piece_1.Color.White;
        }
        return null;
    }
    /**
     * Serialize the entire match state for network transfer
     */
    toSerializable() {
        return {
            board: this.board.toSerializable(),
            currentTurn: this.currentTurn,
            status: this.status,
            winner: this.winner,
            moveHistory: [...this.moveHistory],
            whiteTimeLeft: this.whiteTimeLeft,
            blackTimeLeft: this.blackTimeLeft,
            lastMoveTimestamp: this.lastMoveTimestamp,
        };
    }
}
exports.Match = Match;
//# sourceMappingURL=Match.js.map