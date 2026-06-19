import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { Piece, Color } from '../pieces/Piece';
import { GameState } from '../state/GameState';
/**
 * Get all squares attacked by pieces of the given color.
 * "Attacked" = a piece of that color could capture on that square
 * (using current move rules, ignoring effects for now).
 */
export declare function getAttackedSquares(board: Board, byColor: Color, state?: Readonly<GameState>): Set<string>;
/**
 * Check if a specific square is attacked by any piece of the given color.
 */
export declare function isSquareAttackedBy(board: Board, pos: Position, byColor: Color, state?: Readonly<GameState>): boolean;
/**
 * Get all pieces of the opponent that are currently under attack by `attackerColor`.
 * Returns pairs of { attacker, target, attackerPos, targetPos }.
 * Used to emit OnCheck / OnPieceAttacked events and to compute Death Counter.
 */
export declare function getAttackedPieces(board: Board, attackerColor: Color, state?: Readonly<GameState>): {
    attacker: Piece;
    target: Piece;
    attackerPos: Position;
    targetPos: Position;
}[];
/**
 * Specifically: is the King of `kingColor` under attack?
 */
export declare function isKingAttacked(board: Board, kingColor: Color, state?: Readonly<GameState>): boolean;
//# sourceMappingURL=AttackDetection.d.ts.map