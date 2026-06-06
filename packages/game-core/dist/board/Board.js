"use strict";
// ============================================================
// Board - 15x15 chess board representation
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Board = exports.BOARD_SIZE = void 0;
const Position_1 = require("./Position");
exports.BOARD_SIZE = 15;
class Board {
    grid;
    constructor() {
        this.grid = Array.from({ length: exports.BOARD_SIZE }, () => Array.from({ length: exports.BOARD_SIZE }, () => null));
    }
    /**
     * Get the piece at a position, or null if empty
     */
    getPiece(pos) {
        if (!(0, Position_1.isInBounds)(pos))
            return null;
        return this.grid[pos.row][pos.col];
    }
    /**
     * Place a piece at a position
     */
    setPiece(pos, piece) {
        if (!(0, Position_1.isInBounds)(pos)) {
            throw new Error(`Position out of bounds: (${pos.col}, ${pos.row})`);
        }
        this.grid[pos.row][pos.col] = piece;
    }
    /**
     * Remove a piece from a position and return it
     */
    removePiece(pos) {
        const piece = this.getPiece(pos);
        if (piece) {
            this.grid[pos.row][pos.col] = null;
        }
        return piece;
    }
    /**
     * Move a piece from one position to another. Returns captured piece if any.
     */
    movePiece(from, to) {
        const piece = this.removePiece(from);
        if (!piece) {
            throw new Error(`No piece at position (${from.col}, ${from.row})`);
        }
        const captured = this.removePiece(to);
        this.setPiece(to, piece);
        return captured;
    }
    /**
     * Create a deep copy of the board
     */
    clone() {
        const newBoard = new Board();
        for (let row = 0; row < exports.BOARD_SIZE; row++) {
            for (let col = 0; col < exports.BOARD_SIZE; col++) {
                const piece = this.grid[row][col];
                if (piece) {
                    newBoard.grid[row][col] = { ...piece };
                }
            }
        }
        return newBoard;
    }
    /**
     * Serialize the board for network transfer
     */
    toSerializable() {
        return {
            grid: this.grid.map(row => row.map(piece => (piece ? { ...piece } : null))),
        };
    }
    /**
     * Restore a board from serialized data
     */
    static fromSerializable(data) {
        const board = new Board();
        for (let row = 0; row < exports.BOARD_SIZE; row++) {
            for (let col = 0; col < exports.BOARD_SIZE; col++) {
                const piece = data.grid[row]?.[col];
                if (piece) {
                    board.grid[row][col] = { ...piece };
                }
            }
        }
        return board;
    }
}
exports.Board = Board;
//# sourceMappingURL=Board.js.map