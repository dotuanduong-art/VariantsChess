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
 * Get all legal moves for the piece at the given position.
 * Returns empty array if no piece at position.
 */
export function getLegalMoves(board: Board, pos: Position): Position[] {
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
