// ============================================================
// Move Generator - Dispatches to piece-specific move generators
// ============================================================

import { Board } from '../board/Board';
import { Position, isInBounds } from '../board/Position';
import { PieceType, Color, getPieceOwner } from '../pieces/Piece';
import { getPawnMoves } from './pawnMoves';
import { getRookMoves } from './rookMoves';
import { getBishopMoves } from './bishopMoves';
import { getKnightMoves } from './knightMoves';
import { getQueenMoves } from './queenMoves';
import { getKingMoves } from './kingMoves';
import { specialPieceRegistry } from '../pieces/SpecialPieceRegistry';
import { isSlidingBlocked } from '../modifier/CellEffectBlockModifier';

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

export function getGhostSlidingMoves(
  board: Board,
  pos: Position,
  color: Color,
  directions: { dcol: number; drow: number }[]
): Position[] {
  const moves: Position[] = [];

  for (const { dcol, drow } of directions) {
    let current: Position = { col: pos.col + dcol, row: pos.row + drow };
    let obstacleCount = 0;

    while (isInBounds(current)) {
      if (isSlidingBlocked(board, current, color)) {
        break; // Blocked by cell effect or special piece obstacle
      }
      const piece = board.getPiece(current);
      if (piece) {
        obstacleCount++;
        if (obstacleCount === 1) {
          if (getPieceOwner(piece) !== color) {
            moves.push({ ...current }); // capture first obstacle
          }
          // Continue path (phase-through)
        } else if (obstacleCount === 2) {
          if (getPieceOwner(piece) !== color) {
            moves.push({ ...current }); // capture second obstacle
          }
          break; // Blocked by second obstacle
        }
      } else {
        moves.push({ ...current });
      }
      current = { col: current.col + dcol, row: current.row + drow };
    }
  }

  return moves;
}

export function getGhostPawnMoves(board: Board, pos: Position, color: Color, ownerColor?: Color): Position[] {
  const moves: Position[] = [];
  const direction = color === Color.White ? 1 : -1;
  const startRow = color === Color.White ? 1 : 13;
  const checkColor = ownerColor || color;

  // Forward 1
  const forward1: Position = { col: pos.col, row: pos.row + direction };
  let isForward1Blocked = false;
  if (isInBounds(forward1)) {
    const p1 = board.getPiece(forward1);
    if (!p1) {
      moves.push(forward1);
    } else {
      isForward1Blocked = true;
    }

    // Forward 2
    const forward2: Position = { col: pos.col, row: pos.row + 2 * direction };
    if (isInBounds(forward2) && !board.getPiece(forward2)) {
      if ((pos.row === startRow && !p1) || isForward1Blocked) {
        moves.push(forward2);
      }
    }
  }

  // Diagonal captures
  for (const dcol of [-1, 1]) {
    const capturePos: Position = { col: pos.col + dcol, row: pos.row + direction };
    if (isInBounds(capturePos)) {
      const target = board.getPiece(capturePos);
      if (target && getPieceOwner(target) !== checkColor) {
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
export function getBaseLegalMoves(board: Board, pos: Position): Position[] {
  const piece = board.getPiece(pos);
  if (!piece) return [];

  let moves: Position[] = [];

  const hasGhost = piece.effects?.some(e => e.type === 'ghost');
  const ownerColor = getPieceOwner(piece);

  if (piece.specialType) {
    const def = specialPieceRegistry.get(piece.specialType);
    if (def && def.getLegalMoves) {
      moves = def.getLegalMoves(board, pos, piece);
    }
  } else if (hasGhost) {
    switch (piece.type) {
      case PieceType.Pawn:
        moves = getGhostPawnMoves(board, pos, piece.color, ownerColor);
        break;
      case PieceType.Rook:
        moves = getGhostSlidingMoves(board, pos, ownerColor, ORTHOGONAL_DIRECTIONS);
        break;
      case PieceType.Bishop:
        moves = getGhostSlidingMoves(board, pos, ownerColor, DIAGONAL_DIRECTIONS);
        break;
      case PieceType.Queen:
        moves = getGhostSlidingMoves(board, pos, ownerColor, ALL_DIRECTIONS);
        break;
      case PieceType.Knight:
        moves = getKnightMoves(board, pos, ownerColor);
        break;
      case PieceType.King:
        moves = getKingMoves(board, pos, ownerColor);
        break;
      default:
        moves = [];
    }
  } else {
    switch (piece.type) {
      case PieceType.Pawn:
        moves = getPawnMoves(board, pos, piece.color, false, ownerColor);
        break;
      case PieceType.Rook:
        moves = getRookMoves(board, pos, ownerColor);
        break;
      case PieceType.Bishop:
        moves = getBishopMoves(board, pos, ownerColor);
        break;
      case PieceType.Knight:
        moves = getKnightMoves(board, pos, ownerColor);
        break;
      case PieceType.Queen:
        moves = getQueenMoves(board, pos, ownerColor);
        break;
      case PieceType.King:
        moves = getKingMoves(board, pos, ownerColor);
        break;
      default:
        moves = [];
    }
  }

  // Filter out captures of pieces that cannot be attacked
  return moves.filter(move => {
    const targetPiece = board.getPiece(move);
    if (targetPiece && getPieceOwner(targetPiece) !== getPieceOwner(piece) && targetPiece.specialType) {
      const def = specialPieceRegistry.get(targetPiece.specialType);
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
export function getLegalMoves(board: Board, pos: Position): Position[] {
  return getBaseLegalMoves(board, pos);
}

/**
 * Compute base moves for a given piece type, color and position.
 */
export function getBaseMovesForType(
  board: Board,
  pos: Position,
  type: PieceType | string,
  color: Color,
  allowAllyCapture?: boolean
): Position[] {
  switch (type) {
    case PieceType.Pawn:
      return getPawnMoves(board, pos, color, allowAllyCapture);
    case PieceType.Rook:
      return getRookMoves(board, pos, color, allowAllyCapture);
    case PieceType.Bishop:
      return getBishopMoves(board, pos, color, allowAllyCapture);
    case PieceType.Knight:
      return getKnightMoves(board, pos, color, allowAllyCapture);
    case PieceType.Queen:
      return getQueenMoves(board, pos, color, allowAllyCapture);
    case PieceType.King:
      return getKingMoves(board, pos, color, allowAllyCapture);
    default:
      return [];
  }
}

