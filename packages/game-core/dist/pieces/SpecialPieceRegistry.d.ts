import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { Piece, Color } from './Piece';
import { Action } from '../action/Action';
export interface SpecialPieceDefinition {
    id: string;
    displayName: string;
    getLegalMoves?: (board: Board, pos: Position, piece: Piece) => Position[];
    captureApReward?: number;
    lossApReward?: number;
    canBeAttacked?: boolean;
    onDestroyed?: (piece: Piece, position: Position, enqueueAction: (action: Action) => void) => void;
}
export declare class SpecialPieceRegistry {
    private static instance;
    private definitions;
    private constructor();
    static getInstance(): SpecialPieceRegistry;
    register(definition: SpecialPieceDefinition): void;
    get(specialType: string): SpecialPieceDefinition | undefined;
    clear(): void;
}
export declare const specialPieceRegistry: SpecialPieceRegistry;
export declare function countSpecialPieces(board: Board, player: Color, specialType: string): number;
//# sourceMappingURL=SpecialPieceRegistry.d.ts.map