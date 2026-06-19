import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { GameState } from '../state/GameState';
import { MoveModifier } from './MoveModifier';
export declare class MoveModifierChain {
    private modifiers;
    /** Register a modifier (sorted by priority on insert) */
    register(modifier: MoveModifier): void;
    /** Remove a modifier by id */
    unregister(modifierId: string): void;
    /** Remove all modifiers from a source */
    unregisterBySource(source: string): void;
    /** Get all registered modifiers (for inspection/debugging) */
    getModifiers(): ReadonlyArray<MoveModifier>;
    /**
     * Compute final legal moves for a piece:
     *   getBaseLegalMoves(piece) → modifier₁ → modifier₂ → … → result
     *
     * When no modifiers are registered, this is identical to the old getLegalMoves().
     */
    computeLegalMoves(board: Board, pos: Position, state: Readonly<GameState>): Position[];
}
//# sourceMappingURL=MoveModifierChain.d.ts.map