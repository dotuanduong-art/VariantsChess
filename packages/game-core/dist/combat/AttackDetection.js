"use strict";
// ============================================================
// Attack Detection — Geometry queries for attack/check detection
// ============================================================
//
// These functions answer "which squares does color X attack?" using
// standard chess move rules.  Pawn attacks are diagonal-only (not
// the forward push).  All other pieces reuse the existing movement
// helpers from `movement/`.
//
// NOTE: In Step 5+ the MoveModifierChain may alter what "attack"
// means for some pieces (e.g., Walker can't attack the King).
// For now we use vanilla piece movement.
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAttackedSquares = getAttackedSquares;
exports.isSquareAttackedBy = isSquareAttackedBy;
exports.getAttackedPieces = getAttackedPieces;
exports.isKingAttacked = isKingAttacked;
const Board_1 = require("../board/Board");
const Position_1 = require("../board/Position");
const Piece_1 = require("../pieces/Piece");
const SpecialPieceRegistry_1 = require("../pieces/SpecialPieceRegistry");
const CellEffectBlockModifier_1 = require("../modifier/CellEffectBlockModifier");
// ─── Per-piece attack squares ─────────────────────────────────
const KNIGHT_OFFSETS = [
    { dcol: 1, drow: 2 },
    { dcol: 2, drow: 1 },
    { dcol: 2, drow: -1 },
    { dcol: 1, drow: -2 },
    { dcol: -1, drow: -2 },
    { dcol: -2, drow: -1 },
    { dcol: -2, drow: 1 },
    { dcol: -1, drow: 2 },
];
const KING_OFFSETS = [
    { dcol: 0, drow: 1 },
    { dcol: 0, drow: -1 },
    { dcol: 1, drow: 0 },
    { dcol: -1, drow: 0 },
    { dcol: 1, drow: 1 },
    { dcol: 1, drow: -1 },
    { dcol: -1, drow: 1 },
    { dcol: -1, drow: -1 },
];
const ORTHOGONAL = [
    { dcol: 0, drow: 1 },
    { dcol: 0, drow: -1 },
    { dcol: 1, drow: 0 },
    { dcol: -1, drow: 0 },
];
const DIAGONAL = [
    { dcol: 1, drow: 1 },
    { dcol: 1, drow: -1 },
    { dcol: -1, drow: 1 },
    { dcol: -1, drow: -1 },
];
/**
 * Get the set of squares that a single piece at `pos` attacks.
 * For pawns this is diagonal captures only (not forward pushes).
 * For bishops this includes the 1-square horizontal special rule.
 */
function getKingPosition(board, kingColor) {
    for (let row = 0; row < Board_1.BOARD_SIZE; row++) {
        for (let col = 0; col < Board_1.BOARD_SIZE; col++) {
            const pos = { col, row };
            const piece = board.getPiece(pos);
            if (piece && piece.type === Piece_1.PieceType.King && piece.color === kingColor) {
                return pos;
            }
        }
    }
    return null;
}
/**
 * Get the set of squares that a single piece at `pos` attacks.
 * For pawns this is diagonal captures only (not forward pushes).
 * For bishops this includes the 1-square horizontal special rule.
 */
function getPieceAttackSquares(board, pos, piece, state) {
    if (state) {
        const isStunned = piece.effects?.some(e => e.type === 'stun');
        if (isStunned) {
            return [];
        }
    }
    let attacks = [];
    if (piece.specialType) {
        const def = SpecialPieceRegistry_1.specialPieceRegistry.get(piece.specialType);
        if (def && def.getLegalMoves) {
            attacks = def.getLegalMoves(board, pos, piece);
        }
    }
    else {
        switch (piece.type) {
            case Piece_1.PieceType.Pawn: {
                const direction = piece.color === Piece_1.Color.White ? 1 : -1;
                for (const dcol of [-1, 1]) {
                    const target = { col: pos.col + dcol, row: pos.row + direction };
                    if ((0, Position_1.isInBounds)(target)) {
                        attacks.push(target);
                    }
                }
                break;
            }
            case Piece_1.PieceType.Knight: {
                for (const { dcol, drow } of KNIGHT_OFFSETS) {
                    const target = { col: pos.col + dcol, row: pos.row + drow };
                    if ((0, Position_1.isInBounds)(target)) {
                        attacks.push(target);
                    }
                }
                break;
            }
            case Piece_1.PieceType.King: {
                for (const { dcol, drow } of KING_OFFSETS) {
                    const target = { col: pos.col + dcol, row: pos.row + drow };
                    if ((0, Position_1.isInBounds)(target)) {
                        attacks.push(target);
                    }
                }
                break;
            }
            case Piece_1.PieceType.Rook:
                attacks = getSlidingAttackSquares(board, pos, piece.color, ORTHOGONAL);
                break;
            case Piece_1.PieceType.Bishop: {
                // Diagonal sliding + 1-square horizontal (same rule as bishopMoves.ts)
                attacks = getSlidingAttackSquares(board, pos, piece.color, DIAGONAL);
                for (const dcol of [-1, 1]) {
                    const target = { col: pos.col + dcol, row: pos.row };
                    if ((0, Position_1.isInBounds)(target)) {
                        attacks.push(target);
                    }
                }
                break;
            }
            case Piece_1.PieceType.Queen:
                attacks = getSlidingAttackSquares(board, pos, piece.color, [...ORTHOGONAL, ...DIAGONAL]);
                break;
            default:
                attacks = [];
        }
    }
    if (state) {
        const isWalker = piece.effects?.some(e => e.type === 'walker');
        if (isWalker) {
            const opponentColor = piece.color === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
            const kingPos = getKingPosition(board, opponentColor);
            if (kingPos) {
                attacks = attacks.filter(atk => !(0, Position_1.posEquals)(atk, kingPos));
            }
        }
    }
    return attacks;
}
/**
 * Sliding attack squares — includes squares with pieces on them
 * (both friendly and enemy), unlike move generation which stops at
 * friendly pieces. Attack detection cares about *what squares are
 * controlled*, and a sliding piece controls up to and including
 * the first piece it sees in each direction.
 */
function getSlidingAttackSquares(board, pos, color, directions) {
    const attacks = [];
    for (const { dcol, drow } of directions) {
        let current = { col: pos.col + dcol, row: pos.row + drow };
        while ((0, Position_1.isInBounds)(current)) {
            if ((0, CellEffectBlockModifier_1.isSlidingBlocked)(board, current, color)) {
                break; // Blocked by cell effect or special piece obstacle
            }
            const piece = board.getPiece(current);
            attacks.push({ ...current });
            // Stop sliding after hitting any piece (but the square is still attacked)
            if (piece) {
                break;
            }
            current = { col: current.col + dcol, row: current.row + drow };
        }
    }
    return attacks;
}
// ─── Public API ───────────────────────────────────────────────
/**
 * Get all squares attacked by pieces of the given color.
 * "Attacked" = a piece of that color could capture on that square
 * (using current move rules, ignoring effects for now).
 */
function getAttackedSquares(board, byColor, state) {
    const attackedSet = new Set();
    for (let row = 0; row < Board_1.BOARD_SIZE; row++) {
        for (let col = 0; col < Board_1.BOARD_SIZE; col++) {
            const pos = { col, row };
            const piece = board.getPiece(pos);
            if (piece && (0, Piece_1.getPieceOwner)(piece) === byColor) {
                const attacks = getPieceAttackSquares(board, pos, piece, state);
                for (const atk of attacks) {
                    attackedSet.add(`${atk.col},${atk.row}`);
                }
            }
        }
    }
    return attackedSet;
}
/**
 * Check if a specific square is attacked by any piece of the given color.
 */
function isSquareAttackedBy(board, pos, byColor, state) {
    const key = `${pos.col},${pos.row}`;
    return getAttackedSquares(board, byColor, state).has(key);
}
/**
 * Get all pieces of the opponent that are currently under attack by `attackerColor`.
 * Returns pairs of { attacker, target, attackerPos, targetPos }.
 * Used to emit OnCheck / OnPieceAttacked events and to compute Death Counter.
 */
function getAttackedPieces(board, attackerColor, state) {
    const results = [];
    for (let row = 0; row < Board_1.BOARD_SIZE; row++) {
        for (let col = 0; col < Board_1.BOARD_SIZE; col++) {
            const attackerPos = { col, row };
            const attacker = board.getPiece(attackerPos);
            if (!attacker || (0, Piece_1.getPieceOwner)(attacker) !== attackerColor)
                continue;
            const attacks = getPieceAttackSquares(board, attackerPos, attacker, state);
            for (const targetPos of attacks) {
                const target = board.getPiece(targetPos);
                if (target && (0, Piece_1.getPieceOwner)(target) !== attackerColor) {
                    if (target.specialType) {
                        const def = SpecialPieceRegistry_1.specialPieceRegistry.get(target.specialType);
                        if (def && def.canBeAttacked === false) {
                            continue;
                        }
                    }
                    results.push({ attacker, target, attackerPos, targetPos });
                }
            }
        }
    }
    return results;
}
/**
 * Specifically: is the King of `kingColor` under attack?
 */
function isKingAttacked(board, kingColor, state) {
    // Find the king position
    for (let row = 0; row < Board_1.BOARD_SIZE; row++) {
        for (let col = 0; col < Board_1.BOARD_SIZE; col++) {
            const piece = board.getPiece({ col, row });
            if (piece && piece.type === Piece_1.PieceType.King && (0, Piece_1.getPieceOwner)(piece) === kingColor) {
                const opponentColor = kingColor === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
                return isSquareAttackedBy(board, { col, row }, opponentColor, state);
            }
        }
    }
    // King not found on board (shouldn't happen normally)
    return false;
}
//# sourceMappingURL=AttackDetection.js.map