// ============================================================
// Move Generator - Dispatches to piece-specific move generators
// ============================================================

import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { PieceType, Color } from '../pieces/Piece';
import { getPawnMoves } from './pawnMoves';
import { getRookMoves } from './rookMoves';
import { getBishopMoves } from './bishopMoves';
import { getKnightMoves } from './knightMoves';
import { getQueenMoves } from './queenMoves';
import { getKingMoves } from './kingMoves';

/**
 * Base legal moves — standard chess rules only, no effects/modifiers.
 * This is the first step in the MoveModifierChain.
 */
export function getBaseLegalMoves(board: Board, pos: Position): Position[] {
  const piece = board.getPiece(pos);
  if (!piece) return [];

  switch (piece.type) {
    case PieceType.Pawn:
      return getPawnMoves(board, pos, piece.color);
    case PieceType.Rook:
      return getRookMoves(board, pos, piece.color);
    case PieceType.Bishop:
      return getBishopMoves(board, pos, piece.color);
    case PieceType.Knight:
      return getKnightMoves(board, pos, piece.color);
    case PieceType.Queen:
      return getQueenMoves(board, pos, piece.color);
    case PieceType.King:
      return getKingMoves(board, pos, piece.color);
    default:
      return [];
  }
}

/**
 * Backward-compatible alias — delegates to getBaseLegalMoves.
 * In Step 4+ this can be replaced by MoveModifierChain.computeLegalMoves()
 * when the chain is available from context.
 */
export function getLegalMoves(board: Board, pos: Position): Position[] {
  return getBaseLegalMoves(board, pos);
}

