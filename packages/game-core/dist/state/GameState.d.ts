import { Board, SerializedBoard } from '../board/Board';
import { Color } from '../pieces/Piece';
import { MatchStatus } from '../match/Match';
import { ActionHistory } from '../action/ActionHistory';
import { GraveyardEntry } from './Graveyard';
import { Effect } from '../effect/Effect';
import { Position } from '../board/Position';
export type TurnPhase = 'start' | 'action' | 'resolution' | 'end' | 'cleanup';
export interface PositionSnapshot {
    turnNumber: number;
    player: Color;
    positions: {
        pieceId: string;
        position: Position;
    }[];
}
export interface SerializedGameState {
    board: SerializedBoard;
    currentTurn: Color;
    turnNumber: number;
    status: MatchStatus;
    winner: Color | null;
    turnPhase: TurnPhase;
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
    graveyard: GraveyardEntry[];
    rngSeed: number;
    rngCounter: number;
    whiteVariantId: string | null;
    blackVariantId: string | null;
    variantState: Record<string, any>;
    pendingDeadKings: Color[];
    whitePlayerEffects: Effect[];
    blackPlayerEffects: Effect[];
    positionSnapshots?: PositionSnapshot[];
}
export declare class GameState {
    board: Board;
    currentTurn: Color;
    turnNumber: number;
    status: MatchStatus;
    winner: Color | null;
    turnPhase: TurnPhase;
    hasMoved: boolean;
    skillsUsedThisTurn: number;
    skillsUsedThisTurnIds: string[];
    passSkillSubmitted: boolean;
    whiteAP: number;
    blackAP: number;
    whiteTimeLeft: number;
    blackTimeLeft: number;
    lastMoveTimestamp: number;
    actionHistory: ActionHistory;
    graveyard: GraveyardEntry[];
    rngSeed: number;
    rngCounter: number;
    whiteVariantId: string | null;
    blackVariantId: string | null;
    variantState: Record<string, any>;
    pendingDeadKings: Color[];
    whitePlayerEffects: Effect[];
    blackPlayerEffects: Effect[];
    positionSnapshots: PositionSnapshot[];
    constructor(rngSeed?: number);
    getPlayerEffects(player: Color): Effect[];
    addPlayerEffect(player: Color, effect: Effect): void;
    removePlayerEffect(player: Color, effectId: string): void;
    toSerializable(): SerializedGameState;
    serializeForPlayer(player: Color): SerializedGameState;
    static fromSerializable(data: SerializedGameState): GameState;
}
//# sourceMappingURL=GameState.d.ts.map