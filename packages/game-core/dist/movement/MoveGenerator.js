"use strict";
// ============================================================
// Move Generator - Dispatches to piece-specific move generators
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGhostSlidingMoves = getGhostSlidingMoves;
exports.getGhostPawnMoves = getGhostPawnMoves;
exports.getBaseLegalMoves = getBaseLegalMoves;
exports.getLegalMoves = getLegalMoves;
exports.getBaseMovesForType = getBaseMovesForType;
const Position_1 = require("../board/Position");
const Piece_1 = require("../pieces/Piece");
const pawnMoves_1 = require("./pawnMoves");
const rookMoves_1 = require("./rookMoves");
const bishopMoves_1 = require("./bishopMoves");
const knightMoves_1 = require("./knightMoves");
const queenMoves_1 = require("./queenMoves");
const kingMoves_1 = require("./kingMoves");
const SpecialPieceRegistry_1 = require("../pieces/SpecialPieceRegistry");
const CellEffectBlockModifier_1 = require("../modifier/CellEffectBlockModifier");
const ORTHOGONAL_DIRECTIONS = [
    { dcol: 0, drow: 1 },
    { dcol: 0, drow: -1 },
    { dcol: 1, drow: 0 },
    { dcol: -1, drow: 0 },
];
const DIAGONAL_DIRECTIONS = [
    { dcol: 1, drow: 1 },
    { dcol: 1, drow: -1 },
    { dcol: -1, drow: 1 },
    { dcol: -1, drow: -1 },
];
const ALL_DIRECTIONS = [...ORTHOGONAL_DIRECTIONS, ...DIAGONAL_DIRECTIONS];
function getGhostSlidingMoves(board, pos, color, directions) {
    const moves = [];
    for (const { dcol, drow } of directions) {
        let current = { col: pos.col + dcol, row: pos.row + drow };
        let obstacleCount = 0;
        while ((0, Position_1.isInBounds)(current)) {
            if ((0, CellEffectBlockModifier_1.isSlidingBlocked)(board, current, color)) {
                break; // Blocked by cell effect or special piece obstacle
            }
            const piece = board.getPiece(current);
            if (piece) {
                obstacleCount++;
                if (obstacleCount === 1) {
                    if ((0, Piece_1.getPieceOwner)(piece) !== color) {
                        moves.push({ ...current }); // capture first obstacle
                    }
                    // Continue path (phase-through)
                }
                else if (obstacleCount === 2) {
                    if ((0, Piece_1.getPieceOwner)(piece) !== color) {
                        moves.push({ ...current }); // capture second obstacle
                    }
                    break; // Blocked by second obstacle
                }
            }
            else {
                moves.push({ ...current });
            }
            current = { col: current.col + dcol, row: current.row + drow };
        }
    }
    return moves;
}
function getGhostPawnMoves(board, pos, color, ownerColor) {
    const moves = [];
    const direction = color === Piece_1.Color.White ? 1 : -1;
    const startRow = color === Piece_1.Color.White ? 1 : 13;
    const checkColor = ownerColor || color;
    // Forward 1
    const forward1 = { col: pos.col, row: pos.row + direction };
    let isForward1Blocked = false;
    if ((0, Position_1.isInBounds)(forward1)) {
        const p1 = board.getPiece(forward1);
        if (!p1) {
            moves.push(forward1);
        }
        else {
            isForward1Blocked = true;
        }
        // Forward 2
        const forward2 = { col: pos.col, row: pos.row + 2 * direction };
        if ((0, Position_1.isInBounds)(forward2) && !board.getPiece(forward2)) {
            if ((pos.row === startRow && !p1) || isForward1Blocked) {
                moves.push(forward2);
            }
        }
    }
    // Diagonal captures
    for (const dcol of [-1, 1]) {
        const capturePos = { col: pos.col + dcol, row: pos.row + direction };
        if ((0, Position_1.isInBounds)(capturePos)) {
            const target = board.getPiece(capturePos);
            if (target && (0, Piece_1.getPieceOwner)(target) !== checkColor) {
                moves.push(capturePos);
            }
        }
    }
    return moves;
}
/**
 * Base legal moves — standard chess rules only, no effects/modifiers.
 * This is the first step in the MoveModifierChain.
 */
function getBaseLegalMoves(board, pos) {
    const piece = board.getPiece(pos);
    if (!piece)
        return [];
    let moves = [];
    const hasGhost = piece.effects?.some(e => e.type === 'ghost');
    const ownerColor = (0, Piece_1.getPieceOwner)(piece);
    if (piece.specialType) {
        const def = SpecialPieceRegistry_1.specialPieceRegistry.get(piece.specialType);
        if (def && def.getLegalMoves) {
            moves = def.getLegalMoves(board, pos, piece);
        }
    }
    else if (hasGhost) {
        switch (piece.type) {
            case Piece_1.PieceType.Pawn:
                moves = getGhostPawnMoves(board, pos, piece.color, ownerColor);
                break;
            case Piece_1.PieceType.Rook:
                moves = getGhostSlidingMoves(board, pos, ownerColor, ORTHOGONAL_DIRECTIONS);
                break;
            case Piece_1.PieceType.Bishop:
                moves = getGhostSlidingMoves(board, pos, ownerColor, DIAGONAL_DIRECTIONS);
                break;
            case Piece_1.PieceType.Queen:
                moves = getGhostSlidingMoves(board, pos, ownerColor, ALL_DIRECTIONS);
                break;
            case Piece_1.PieceType.Knight:
                moves = (0, knightMoves_1.getKnightMoves)(board, pos, ownerColor);
                break;
            case Piece_1.PieceType.King:
                moves = (0, kingMoves_1.getKingMoves)(board, pos, ownerColor);
                break;
            default:
                moves = [];
        }
    }
    else {
        switch (piece.type) {
            case Piece_1.PieceType.Pawn:
                moves = (0, pawnMoves_1.getPawnMoves)(board, pos, piece.color, false, ownerColor);
                break;
            case Piece_1.PieceType.Rook:
                moves = (0, rookMoves_1.getRookMoves)(board, pos, ownerColor);
                break;
            case Piece_1.PieceType.Bishop:
                moves = (0, bishopMoves_1.getBishopMoves)(board, pos, ownerColor);
                break;
            case Piece_1.PieceType.Knight:
                moves = (0, knightMoves_1.getKnightMoves)(board, pos, ownerColor);
                break;
            case Piece_1.PieceType.Queen:
                moves = (0, queenMoves_1.getQueenMoves)(board, pos, ownerColor);
                break;
            case Piece_1.PieceType.King:
                moves = (0, kingMoves_1.getKingMoves)(board, pos, ownerColor);
                break;
            default:
                moves = [];
        }
    }
    // Filter out captures of pieces that cannot be attacked
    return moves.filter(move => {
        const targetPiece = board.getPiece(move);
        if (targetPiece && (0, Piece_1.getPieceOwner)(targetPiece) !== (0, Piece_1.getPieceOwner)(piece) && targetPiece.specialType) {
            const def = SpecialPieceRegistry_1.specialPieceRegistry.get(targetPiece.specialType);
            if (def && def.canBeAttacked === false) {
                return false;
            }
        }
        return true;
    });
}
/**
 * Backward-compatible alias — delegates to getBaseLegalMoves.
 * In Step 4+ this can be replaced by MoveModifierChain.computeLegalMoves()
 * when the chain is available from context.
 */
function getLegalMoves(board, pos) {
    return getBaseLegalMoves(board, pos);
}
/**
 * Compute base moves for a given piece type, color and position.
 */
function getBaseMovesForType(board, pos, type, color, allowAllyCapture) {
    switch (type) {
        case Piece_1.PieceType.Pawn:
            return (0, pawnMoves_1.getPawnMoves)(board, pos, color, allowAllyCapture);
        case Piece_1.PieceType.Rook:
            return (0, rookMoves_1.getRookMoves)(board, pos, color, allowAllyCapture);
        case Piece_1.PieceType.Bishop:
            return (0, bishopMoves_1.getBishopMoves)(board, pos, color, allowAllyCapture);
        case Piece_1.PieceType.Knight:
            return (0, knightMoves_1.getKnightMoves)(board, pos, color, allowAllyCapture);
        case Piece_1.PieceType.Queen:
            return (0, queenMoves_1.getQueenMoves)(board, pos, color, allowAllyCapture);
        case Piece_1.PieceType.King:
            return (0, kingMoves_1.getKingMoves)(board, pos, color, allowAllyCapture);
        default:
            return [];
    }
}
//# sourceMappingURL=MoveGenerator.js.map