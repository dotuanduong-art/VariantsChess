"use strict";
// ============================================================
// game-core - Public API
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.Match = exports.validateMove = exports.getLegalMoves = exports.createInitialBoard = exports.oppositeColor = exports.Color = exports.PieceType = exports.posEquals = exports.isInBounds = exports.fromAlgebraic = exports.toAlgebraic = exports.BOARD_SIZE = exports.Board = void 0;
// Board
var Board_1 = require("./board/Board");
Object.defineProperty(exports, "Board", { enumerable: true, get: function () { return Board_1.Board; } });
Object.defineProperty(exports, "BOARD_SIZE", { enumerable: true, get: function () { return Board_1.BOARD_SIZE; } });
var Position_1 = require("./board/Position");
Object.defineProperty(exports, "toAlgebraic", { enumerable: true, get: function () { return Position_1.toAlgebraic; } });
Object.defineProperty(exports, "fromAlgebraic", { enumerable: true, get: function () { return Position_1.fromAlgebraic; } });
Object.defineProperty(exports, "isInBounds", { enumerable: true, get: function () { return Position_1.isInBounds; } });
Object.defineProperty(exports, "posEquals", { enumerable: true, get: function () { return Position_1.posEquals; } });
// Pieces
var Piece_1 = require("./pieces/Piece");
Object.defineProperty(exports, "PieceType", { enumerable: true, get: function () { return Piece_1.PieceType; } });
Object.defineProperty(exports, "Color", { enumerable: true, get: function () { return Piece_1.Color; } });
Object.defineProperty(exports, "oppositeColor", { enumerable: true, get: function () { return Piece_1.oppositeColor; } });
var initialLayout_1 = require("./pieces/initialLayout");
Object.defineProperty(exports, "createInitialBoard", { enumerable: true, get: function () { return initialLayout_1.createInitialBoard; } });
// Movement
var MoveGenerator_1 = require("./movement/MoveGenerator");
Object.defineProperty(exports, "getLegalMoves", { enumerable: true, get: function () { return MoveGenerator_1.getLegalMoves; } });
// Validation
var MoveValidator_1 = require("./validation/MoveValidator");
Object.defineProperty(exports, "validateMove", { enumerable: true, get: function () { return MoveValidator_1.validateMove; } });
// Match
var Match_1 = require("./match/Match");
Object.defineProperty(exports, "Match", { enumerable: true, get: function () { return Match_1.Match; } });
//# sourceMappingURL=index.js.map