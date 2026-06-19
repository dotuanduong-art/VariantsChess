"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Board = exports.BOARD_SIZE = void 0;
const Position_1 = require("./Position");
exports.BOARD_SIZE = 15;
class Board {
    grid;
    cellEffects = new Map();
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
    getCellEffects(pos) {
        const key = `${pos.col},${pos.row}`;
        return this.cellEffects.get(key) || [];
    }
    setCellEffects(pos, effects) {
        const key = `${pos.col},${pos.row}`;
        if (effects.length === 0) {
            this.cellEffects.delete(key);
        }
        else {
            this.cellEffects.set(key, effects);
        }
    }
    addCellEffect(pos, effect) {
        const effects = this.getCellEffects(pos);
        effects.push(effect);
        this.setCellEffects(pos, effects);
    }
    removeCellEffect(pos, effectId) {
        const effects = this.getCellEffects(pos);
        const filtered = effects.filter(e => e.id !== effectId);
        this.setCellEffects(pos, filtered);
    }
    getAllCellEffects() {
        return this.cellEffects;
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
                    newBoard.grid[row][col] = {
                        ...piece,
                        effects: piece.effects ? piece.effects.map(e => ({ ...e })) : [],
                    };
                }
            }
        }
        for (const [key, effects] of this.cellEffects.entries()) {
            newBoard.cellEffects.set(key, effects.map(e => ({ ...e })));
        }
        return newBoard;
    }
    /**
     * Serialize the board for network transfer
     */
    toSerializable() {
        const serializedEffects = {};
        for (const [key, effects] of this.cellEffects.entries()) {
            serializedEffects[key] = effects.map(e => ({ ...e }));
        }
        return {
            grid: this.grid.map(row => row.map(piece => piece
                ? {
                    ...piece,
                    effects: piece.effects ? piece.effects.map(e => ({ ...e })) : [],
                }
                : null)),
            cellEffects: serializedEffects,
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
                    board.grid[row][col] = {
                        ...piece,
                        effects: piece.effects ? piece.effects.map(e => ({ ...e })) : [],
                    };
                }
            }
        }
        if (data.cellEffects) {
            for (const [key, effects] of Object.entries(data.cellEffects)) {
                board.cellEffects.set(key, effects.map(e => ({ ...e })));
            }
        }
        return board;
    }
}
exports.Board = Board;
//# sourceMappingURL=Board.js.map