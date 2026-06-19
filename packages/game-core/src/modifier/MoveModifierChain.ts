// ============================================================
// Move Modifier Chain — Pipeline for computing final legal moves
// ============================================================
//
// Flow: getBaseLegalMoves(piece) → modifier₁ → modifier₂ → … → result
//
// When no modifiers are registered, returns identical results
// to the original getLegalMoves() function.
// ============================================================

import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { GameState } from '../state/GameState';
import { MoveModifier, MoveModifierContext } from './MoveModifier';
import { getBaseLegalMoves } from '../movement/MoveGenerator';

export class MoveModifierChain {
  private modifiers: MoveModifier[] = [];

  /** Register a modifier (sorted by priority on insert) */
  register(modifier: MoveModifier): void {
    this.modifiers.push(modifier);
    this.modifiers.sort((a, b) => a.priority - b.priority);
  }

  /** Remove a modifier by id */
  unregister(modifierId: string): void {
    this.modifiers = this.modifiers.filter(m => m.id !== modifierId);
  }

  /** Remove all modifiers from a source */
  unregisterBySource(source: string): void {
    this.modifiers = this.modifiers.filter(m => m.source !== source);
  }

  /** Get all registered modifiers (for inspection/debugging) */
  getModifiers(): ReadonlyArray<MoveModifier> {
    return this.modifiers;
  }

  /**
   * Compute final legal moves for a piece:
   *   getBaseLegalMoves(piece) → modifier₁ → modifier₂ → … → result
   *
   * When no modifiers are registered, this is identical to the old getLegalMoves().
   */
  computeLegalMoves(board: Board, pos: Position, state: Readonly<GameState>): Position[] {
    const piece = board.getPiece(pos);
    if (!piece) return [];

    // Start with base legal moves (standard chess rules)
    let moves = getBaseLegalMoves(board, pos);

    // Build context for modifiers
    const context: MoveModifierContext = {
      board,
      piece,
      piecePosition: pos,
      state,
    };

    // Run each modifier in priority order
    for (const modifier of this.modifiers) {
      moves = modifier.modify(moves, context);
    }

    return moves;
  }
}
