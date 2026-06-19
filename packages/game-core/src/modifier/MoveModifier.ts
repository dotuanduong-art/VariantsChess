// ============================================================
// Move Modifier — Interface for modifying legal move sets
// ============================================================
//
// A MoveModifier receives the current set of legal moves for a
// piece and returns a (possibly filtered/expanded) set.
// Modifiers are registered with MoveModifierChain and executed
// in priority order (lower = earlier).
//
// Examples:
//   - Bind effect: removes moves beyond N squares from current position
//   - Mountain cell: adds/removes squares in mountain terrain
//   - Stun effect: returns empty array (piece can't move)
//   - Walker effect: removes ability to capture King
// ============================================================

import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { Piece } from '../pieces/Piece';
import { GameState } from '../state/GameState';

export interface MoveModifierContext {
  board: Board;
  piece: Piece;
  piecePosition: Position;
  state: Readonly<GameState>;
}

/**
 * A modifier receives the current set of legal moves and returns a
 * (possibly filtered/expanded) set. Must be pure — no side effects.
 */
export interface MoveModifier {
  id: string;
  priority: number;     // lower = runs earlier in the chain
  source: string;       // 'effect:bind', 'effect:mountain', 'variant:ruler', etc.

  /**
   * Modify the set of legal moves for a piece.
   * @param moves - Current legal moves (may already be modified by earlier modifiers)
   * @param context - Board, piece, position, and game state
   * @returns Modified set of legal moves
   */
  modify(moves: Position[], context: MoveModifierContext): Position[];
}
