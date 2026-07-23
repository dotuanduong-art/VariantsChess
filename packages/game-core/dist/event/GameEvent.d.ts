import { Color, Piece } from '../pieces/Piece';
import { Position } from '../board/Position';
export type GameEventType = 'OnTurnStart' | 'OnTurnEnd' | 'OnBeforeMove' | 'OnMove' | 'OnBeforeCapture' | 'OnCapture' | 'OnPieceDeath' | 'OnPieceSpawn' | 'OnCheck' | 'OnPieceAttacked' | 'OnSkillUsed' | 'OnEffectApplied' | 'OnEffectExpired' | 'OnEffectTick' | 'OnAPGained' | 'OnAPSpent' | 'OnPawnPromotion' | 'OnGameOver' | 'OnBeforePieceDestroyed' | 'OnPieceDestroyed' | 'OnPiecePushed';
export interface GameEvent {
    type: GameEventType;
    turnNumber: number;
    activePlayer: Color;
    payload: Record<string, any>;
    cancelled?: boolean;
}
export declare function createOnTurnStartEvent(turnNumber: number, activePlayer: Color): GameEvent;
export declare function createOnTurnEndEvent(turnNumber: number, activePlayer: Color): GameEvent;
export declare function createOnBeforeMoveEvent(turnNumber: number, activePlayer: Color, pieceId: string, from: any, to: any): GameEvent;
export declare function createOnMoveEvent(turnNumber: number, activePlayer: Color, pieceId: string, from: any, to: any): GameEvent;
export declare function createOnBeforeCaptureEvent(turnNumber: number, activePlayer: Color, attackerId: string, capturedPieceId: string, from: any, to: any): GameEvent;
export declare function createOnCaptureEvent(turnNumber: number, activePlayer: Color, attackerId: string, capturedPieceId: string, from: any, to: any, capturedPieceSnapshot?: Piece): GameEvent;
export declare function createOnPieceDeathEvent(turnNumber: number, activePlayer: Color, pieceId: string, position: any, killedBy: 'capture' | 'effect' | 'skill', killerId?: string): GameEvent;
export declare function createOnBeforePieceDestroyedEvent(turnNumber: number, activePlayer: Color, pieceSnapshot: Piece, position: Position, reason: 'capture' | 'skill' | 'effect' | 'explosion'): GameEvent;
export declare function createOnPieceDestroyedEvent(turnNumber: number, activePlayer: Color, pieceSnapshot: Piece, position: Position, reason: string): GameEvent;
export declare function createOnPieceSpawnEvent(turnNumber: number, activePlayer: Color, pieceId: string, position: any): GameEvent;
export declare function createOnSkillUsedEvent(turnNumber: number, activePlayer: Color, skillId: string, targets: any[], actualCost?: number): GameEvent;
export declare function createOnEffectAppliedEvent(turnNumber: number, activePlayer: Color, effect: any): GameEvent;
export declare function createOnEffectExpiredEvent(turnNumber: number, activePlayer: Color, effectId: string, reason: string, effectSnapshot?: any): GameEvent;
export declare function createOnEffectTickEvent(turnNumber: number, activePlayer: Color, effect: any): GameEvent;
export declare function createOnAPGainedEvent(turnNumber: number, activePlayer: Color, player: Color, amount: number, source: string): GameEvent;
export declare function createOnAPSpentEvent(turnNumber: number, activePlayer: Color, player: Color, amount: number, source: string): GameEvent;
export declare function createOnPawnPromotionEvent(turnNumber: number, activePlayer: Color, pieceId: string, position: any, promotedTo: string): GameEvent;
export declare function createOnGameOverEvent(turnNumber: number, activePlayer: Color, winner: Color | null, reason: string): GameEvent;
export declare function createOnCheckEvent(turnNumber: number, activePlayer: Color, attackerPieces: {
    piece: any;
    position: any;
}[], targetPiece: any, targetPosition: any): GameEvent;
export declare function createOnPieceAttackedEvent(turnNumber: number, activePlayer: Color, attacker: any, target: any, attackerPos: any, targetPos: any): GameEvent;
//# sourceMappingURL=GameEvent.d.ts.map