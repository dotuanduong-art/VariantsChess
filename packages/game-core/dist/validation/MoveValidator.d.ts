import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { Color } from '../pieces/Piece';
import { GameState } from '../state/GameState';
import { MoveModifierChain } from '../modifier/MoveModifierChain';
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
 * 5. The destination is a legal move for that piece (evaluating modifiers if provided)
 */
export declare function validateMove(board: Board, currentTurn: Color, playerColor: Color, from: Position, to: Position, state?: GameState, modifierChain?: MoveModifierChain): ValidationResult;
//# sourceMappingURL=MoveValidator.d.ts.map