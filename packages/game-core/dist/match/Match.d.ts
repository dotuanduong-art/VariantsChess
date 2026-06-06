import { Board, SerializedBoard } from '../board/Board';
import { Position } from '../board/Position';
import { Color, PieceType } from '../pieces/Piece';
export type MatchStatus = 'waiting' | 'playing' | 'finished';
export interface MoveResult {
    success: boolean;
    reason?: string;
    capturedPiece?: {
        type: PieceType;
        color: Color;
    };
    isKingCaptured?: boolean;
}
export interface SerializedMatch {
    board: SerializedBoard;
    currentTurn: Color;
    status: MatchStatus;
    winner: Color | null;
    moveHistory: {
        from: string;
        to: string;
    }[];
    whiteTimeLeft: number;
    blackTimeLeft: number;
    lastMoveTimestamp: number;
}
export declare class Match {
    private board;
    private currentTurn;
    private status;
    private winner;
    private moveHistory;
    private whiteTimeLeft;
    private blackTimeLeft;
    private lastMoveTimestamp;
    constructor();
    /**
     * Start the match
     */
    start(): void;
    /**
     * Attempt to make a move. Returns the result.
     */
    makeMove(playerColor: Color, from: Position, to: Position): MoveResult;
    /**
     * Get legal moves for a position (used by frontend for highlighting)
     */
    getLegalMovesAt(pos: Position): Position[];
    getBoard(): Board;
    getCurrentTurn(): Color;
    getStatus(): MatchStatus;
    getWinner(): Color | null;
    getMoveHistory(): {
        from: string;
        to: string;
    }[];
    /**
     * Check if the current player has run out of time
     */
    checkTimeout(): Color | null;
    /**
     * Serialize the entire match state for network transfer
     */
    toSerializable(): SerializedMatch;
}
//# sourceMappingURL=Match.d.ts.map