import { MoveModifier, MoveModifierContext } from './MoveModifier';
import { Position } from '../board/Position';
import { Board } from '../board/Board';
import { Color } from '../pieces/Piece';
/**
 * Checks if a sliding path is blocked by a cell effect (e.g. mountain, flame)
 * or a special piece (e.g. mountain special piece).
 */
export declare function isSlidingBlocked(board: Board, pos: Position, moverColor?: Color): boolean;
export declare class CellEffectBlockModifier implements MoveModifier {
    id: string;
    priority: number;
    source: string;
    modify(moves: Position[], context: MoveModifierContext): Position[];
}
//# sourceMappingURL=CellEffectBlockModifier.d.ts.map