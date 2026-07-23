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

import { Board, BOARD_SIZE } from '../board/Board';
import { Position, isInBounds, posEquals } from '../board/Position';
import { Piece, PieceType, Color, getPieceOwner } from '../pieces/Piece';
import { getSlidingMoves } from '../movement/slidingMoves';
import { GameState } from '../state/GameState';
import { specialPieceRegistry } from '../pieces/SpecialPieceRegistry';
import { isSlidingBlocked } from '../modifier/CellEffectBlockModifier';

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
function getKingPosition(board: Board, kingColor: Color): Position | null {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const pos = { col, row };
      const piece = board.getPiece(pos);
      if (piece && piece.type === PieceType.King && piece.color === kingColor) {
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
function getPieceAttackSquares(board: Board, pos: Position, piece: Piece, state?: Readonly<GameState>): Position[] {
  if (state) {
    const isStunned = piece.effects?.some(e => e.type === 'stun');
    if (isStunned) {
      return [];
    }
  }

  let attacks: Position[] = [];
  if (piece.specialType) {
    const def = specialPieceRegistry.get(piece.specialType);
    if (def && def.getLegalMoves) {
      attacks = def.getLegalMoves(board, pos, piece);
    }
  } else {
    switch (piece.type) {
      case PieceType.Pawn: {
        const direction = piece.color === Color.White ? 1 : -1;
        for (const dcol of [-1, 1]) {
          const target: Position = { col: pos.col + dcol, row: pos.row + direction };
          if (isInBounds(target)) {
            attacks.push(target);
          }
        }
        break;
      }

    case PieceType.Knight: {
      for (const { dcol, drow } of KNIGHT_OFFSETS) {
        const target: Position = { col: pos.col + dcol, row: pos.row + drow };
        if (isInBounds(target)) {
          attacks.push(target);
        }
      }
      break;
    }

    case PieceType.King: {
      for (const { dcol, drow } of KING_OFFSETS) {
        const target: Position = { col: pos.col + dcol, row: pos.row + drow };
        if (isInBounds(target)) {
          attacks.push(target);
        }
      }
      break;
    }

    case PieceType.Rook:
      attacks = getSlidingAttackSquares(board, pos, piece.color, ORTHOGONAL);
      break;

    case PieceType.Bishop: {
      // Diagonal sliding + 1-square horizontal (same rule as bishopMoves.ts)
      attacks = getSlidingAttackSquares(board, pos, piece.color, DIAGONAL);
      for (const dcol of [-1, 1]) {
        const target: Position = { col: pos.col + dcol, row: pos.row };
        if (isInBounds(target)) {
          attacks.push(target);
        }
      }
      break;
    }

    case PieceType.Queen:
      attacks = getSlidingAttackSquares(board, pos, piece.color, [...ORTHOGONAL, ...DIAGONAL]);
      break;

    default:
      attacks = [];
    }
  }

  if (state) {
    const isWalker = piece.effects?.some(e => e.type === 'walker');
    if (isWalker) {
      const opponentColor = piece.color === Color.White ? Color.Black : Color.White;
      const kingPos = getKingPosition(board, opponentColor);
      if (kingPos) {
        attacks = attacks.filter(atk => !posEquals(atk, kingPos));
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
function getSlidingAttackSquares(
  board: Board,
  pos: Position,
  color: Color,
  directions: { dcol: number; drow: number }[]
): Position[] {
  const attacks: Position[] = [];

  for (const { dcol, drow } of directions) {
    let current: Position = { col: pos.col + dcol, row: pos.row + drow };

    while (isInBounds(current)) {
      if (isSlidingBlocked(board, current, color)) {
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
export function getAttackedSquares(board: Board, byColor: Color, state?: Readonly<GameState>): Set<string> {
  const attackedSet = new Set<string>();

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const pos: Position = { col, row };
      const piece = board.getPiece(pos);
      if (piece && getPieceOwner(piece) === byColor) {
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
export function isSquareAttackedBy(board: Board, pos: Position, byColor: Color, state?: Readonly<GameState>): boolean {
  const key = `${pos.col},${pos.row}`;
  return getAttackedSquares(board, byColor, state).has(key);
}

/**
 * Get all pieces of the opponent that are currently under attack by `attackerColor`.
 * Returns pairs of { attacker, target, attackerPos, targetPos }.
 * Used to emit OnCheck / OnPieceAttacked events and to compute Death Counter.
 */
export function getAttackedPieces(
  board: Board,
  attackerColor: Color,
  state?: Readonly<GameState>
): { attacker: Piece; target: Piece; attackerPos: Position; targetPos: Position }[] {
  const results: { attacker: Piece; target: Piece; attackerPos: Position; targetPos: Position }[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const attackerPos: Position = { col, row };
      const attacker = board.getPiece(attackerPos);
      if (!attacker || getPieceOwner(attacker) !== attackerColor) continue;

      const attacks = getPieceAttackSquares(board, attackerPos, attacker, state);
      for (const targetPos of attacks) {
        const target = board.getPiece(targetPos);
        if (target && getPieceOwner(target) !== attackerColor) {
          if (target.specialType) {
            const def = specialPieceRegistry.get(target.specialType);
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
export function isKingAttacked(board: Board, kingColor: Color, state?: Readonly<GameState>): boolean {
  // Find the king position
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board.getPiece({ col, row });
      if (piece && piece.type === PieceType.King && getPieceOwner(piece) === kingColor) {
        const opponentColor = kingColor === Color.White ? Color.Black : Color.White;
        return isSquareAttackedBy(board, { col, row }, opponentColor, state);
      }
    }
  }
  // King not found on board (shouldn't happen normally)
  return false;
}
