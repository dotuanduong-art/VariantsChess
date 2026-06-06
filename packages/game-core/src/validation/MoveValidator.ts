// ============================================================
// Move Validator - Server-side move validation
// ============================================================

import { Board } from '../board/Board';
import { Position, isInBounds, posEquals } from '../board/Position';
import { Color } from '../pieces/Piece';
import { getLegalMoves } from '../movement/MoveGenerator';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validate a move request from a player.
 *
 * Checks:
 * 1. Positions are in bounds
 * 2. A piece exists at the source
 * 3. The piece belongs to the requesting player
 * 4. It is the player's turn
 * 5. The destination is a legal move for that piece
 */
export function validateMove(
  board: Board,
  currentTurn: Color,
  playerColor: Color,
  from: Position,
  to: Position
): ValidationResult {
  // Check bounds
  if (!isInBounds(from) || !isInBounds(to)) {
    return { valid: false, reason: 'Position out of bounds' };
  }

  // Check same square
  if (posEquals(from, to)) {
    return { valid: false, reason: 'Cannot move to the same square' };
  }

  // Check turn ownership
  if (currentTurn !== playerColor) {
    return { valid: false, reason: 'Not your turn' };
  }

  // Check piece exists
  const piece = board.getPiece(from);
  if (!piece) {
    return { valid: false, reason: 'No piece at source position' };
  }

  // Check piece ownership
  if (piece.color !== playerColor) {
    return { valid: false, reason: 'That piece does not belong to you' };
  }

  // Check legal move
  const legalMoves = getLegalMoves(board, from);
  const isLegal = legalMoves.some(move => posEquals(move, to));
  if (!isLegal) {
    return { valid: false, reason: 'Illegal move for this piece' };
  }

  return { valid: true };
}
