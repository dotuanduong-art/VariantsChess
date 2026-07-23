import { Board } from '../board/Board';
import { Position } from '../board/Position';
import { Color, PieceType } from '../pieces/Piece';
import { GameState } from '../state/GameState';
import { Action } from '../action/Action';
import { ActionResult } from '../action/ActionPipeline';
import { SnapshotManager } from '../state/Snapshot';
import { EventBus } from '../event/EventBus';
import { MoveModifierChain } from '../modifier/MoveModifierChain';
import { EffectRegistry } from '../effect/EffectRegistry';
import { VariantRegistry } from '../variant/VariantRegistry';
import { SkillTarget } from '../variant/Skill';
export type MatchStatus = 'waiting' | 'playing' | 'finished';
export interface MoveResult {
    success: boolean;
    reason?: string;
    capturedPiece?: {
        type: PieceType | string;
        color: Color;
    };
    isKingCaptured?: boolean;
    isStealthMove?: boolean;
}
export interface SerializedMatch {
    board: any;
    currentTurn: Color;
    status: MatchStatus;
    winner: Color | null;
    moveHistory: {
        from: string;
        to: string;
        isStealth?: boolean;
        moverColor?: Color;
    }[];
    whiteTimeLeft: number;
    blackTimeLeft: number;
    lastMoveTimestamp: number;
}
export declare class Match {
    private state;
    private pipeline;
    private snapshots;
    private eventBus;
    private moveModifierChain;
    private effectRegistry;
    private variantRegistry;
    private moveHistory;
    turnTimeoutOverride: number | null;
    constructor();
    getTurnTimeoutMs(): number;
    /**
     * Start the match
     */
    start(): void;
    /**
     * Attempt to make a move. Returns the result.
     */
    makeMove(playerColor: Color, from: Position, to: Position, moveType?: string): MoveResult;
    /**
     * Submit any action directly (e.g. for skills or pass skill)
     */
    submitAction(action: Action): ActionResult;
    /**
     * Get legal moves for a position (used by frontend for highlighting)
     */
    getLegalMovesAt(pos: Position): Position[];
    getMoveModifierChain(): MoveModifierChain;
    getEffectRegistry(): EffectRegistry;
    getVariantRegistry(): VariantRegistry;
    setVariants(whiteVariantId: string | null, blackVariantId: string | null): void;
    useSkill(playerColor: Color, skillId: string, targets: SkillTarget[]): ActionResult;
    handleTimeoutSkip(playerColor: Color): ActionResult;
    getBoard(): Board;
    getCurrentTurn(): Color;
    getStatus(): MatchStatus;
    getWinner(): Color | null;
    getMoveHistory(): {
        from: string;
        to: string;
        isStealth?: boolean;
        moverColor?: Color;
    }[];
    getGameState(): GameState;
    getEventBus(): EventBus;
    getSnapshots(): SnapshotManager;
    /**
     * Check if the current player has run out of time
     */
    checkTimeout(): Color | null;
    /**
     * Serialize the entire match state for network transfer
     */
    toSerializable(): SerializedMatch;
    private getValidPositionsForRequirement;
    serializeForPlayer(player: Color): {
        moveHistory: {
            from: string;
            to: string;
            isStealth?: boolean;
            moverColor?: Color;
        }[];
        availableSkillTargets: Record<string, {
            requirements: any[];
            validPositions: Position[][];
            currentCost: number;
        }>;
        opponentSkillCosts: Record<string, number>;
        board: import("../board/Board").SerializedBoard;
        currentTurn: Color;
        turnNumber: number;
        status: MatchStatus;
        winner: Color | null;
        turnPhase: import("../state/GameState").TurnPhase;
        hasMoved: boolean;
        skillsUsedThisTurn: number;
        skillsUsedThisTurnIds: string[];
        passSkillSubmitted: boolean;
        whiteAP: number;
        blackAP: number;
        whiteTimeLeft: number;
        blackTimeLeft: number;
        lastMoveTimestamp: number;
        actionHistory: any;
        graveyard: import("..").GraveyardEntry[];
        rngSeed: number;
        rngCounter: number;
        whiteVariantId: string | null;
        blackVariantId: string | null;
        variantState: Record<string, any>;
        pendingDeadKings: Color[];
        whitePlayerEffects: import("..").Effect[];
        blackPlayerEffects: import("..").Effect[];
        positionSnapshots?: import("../state/GameState").PositionSnapshot[];
    };
}
//# sourceMappingURL=Match.d.ts.map