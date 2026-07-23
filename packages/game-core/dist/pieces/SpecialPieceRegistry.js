"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.specialPieceRegistry = exports.SpecialPieceRegistry = void 0;
exports.countSpecialPieces = countSpecialPieces;
const Board_1 = require("../board/Board");
class SpecialPieceRegistry {
    static instance;
    definitions = new Map();
    constructor() { }
    static getInstance() {
        if (!SpecialPieceRegistry.instance) {
            SpecialPieceRegistry.instance = new SpecialPieceRegistry();
        }
        return SpecialPieceRegistry.instance;
    }
    register(definition) {
        this.definitions.set(definition.id, definition);
    }
    get(specialType) {
        return this.definitions.get(specialType);
    }
    clear() {
        this.definitions.clear();
    }
}
exports.SpecialPieceRegistry = SpecialPieceRegistry;
exports.specialPieceRegistry = SpecialPieceRegistry.getInstance();
function countSpecialPieces(board, player, specialType) {
    let count = 0;
    for (let row = 0; row < Board_1.BOARD_SIZE; row++) {
        for (let col = 0; col < Board_1.BOARD_SIZE; col++) {
            const p = board.getPiece({ col, row });
            if (p && p.color === player && p.specialType === specialType) {
                count++;
            }
        }
    }
    return count;
}
//# sourceMappingURL=SpecialPieceRegistry.js.map