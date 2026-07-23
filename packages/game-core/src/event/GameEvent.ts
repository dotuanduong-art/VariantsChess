import { Color, Piece } from '../pieces/Piece';
import { Position } from '../board/Position';

export type GameEventType =
  | 'OnTurnStart'
  | 'OnTurnEnd'
  | 'OnBeforeMove'        // before board mutation — can be intercepted/cancelled
  | 'OnMove'              // after piece has moved
  | 'OnBeforeCapture'     // before capture resolves
  | 'OnCapture'           // after capture
  | 'OnPieceDeath'        // any piece removal (capture, skill, effect)
  | 'OnPieceSpawn'        // resurrection / summon
  | 'OnCheck'             // piece is under attack
  | 'OnPieceAttacked'     // a specific piece is attacked
  | 'OnSkillUsed'
  | 'OnEffectApplied'
  | 'OnEffectExpired'
  | 'OnEffectTick'
  | 'OnAPGained'
  | 'OnAPSpent'
  | 'OnPawnPromotion'
  | 'OnGameOver'
  | 'OnBeforePieceDestroyed'
  | 'OnPieceDestroyed'
  | 'OnPiecePushed';

export interface GameEvent {
  type: GameEventType;
  turnNumber: number;
  activePlayer: Color;
  payload: Record<string, any>;   // event-specific data
  cancelled?: boolean;            // Set to true by a handler to cancel the originating action
}

// Payload factories
export function createOnTurnStartEvent(turnNumber: number, activePlayer: Color): GameEvent {
  return { type: 'OnTurnStart', turnNumber, activePlayer, payload: {} };
}

export function createOnTurnEndEvent(turnNumber: number, activePlayer: Color): GameEvent {
  return { type: 'OnTurnEnd', turnNumber, activePlayer, payload: {} };
}

export function createOnBeforeMoveEvent(
  turnNumber: number,
  activePlayer: Color,
  pieceId: string,
  from: any,
  to: any
): GameEvent {
  return { type: 'OnBeforeMove', turnNumber, activePlayer, payload: { pieceId, from, to } };
}

export function createOnMoveEvent(
  turnNumber: number,
  activePlayer: Color,
  pieceId: string,
  from: any,
  to: any
): GameEvent {
  return { type: 'OnMove', turnNumber, activePlayer, payload: { pieceId, from, to } };
}

export function createOnBeforeCaptureEvent(
  turnNumber: number,
  activePlayer: Color,
  attackerId: string,
  capturedPieceId: string,
  from: any,
  to: any
): GameEvent {
  return { type: 'OnBeforeCapture', turnNumber, activePlayer, payload: { attackerId, capturedPieceId, from, to } };
}

export function createOnCaptureEvent(
  turnNumber: number,
  activePlayer: Color,
  attackerId: string,
  capturedPieceId: string,
  from: any,
  to: any,
  capturedPieceSnapshot?: Piece
): GameEvent {
  return {
    type: 'OnCapture',
    turnNumber,
    activePlayer,
    payload: {
      attackerId,
      capturedPieceId,
      from,
      to,
      capturedPieceSnapshot,
    },
  };
}

export function createOnPieceDeathEvent(
  turnNumber: number,
  activePlayer: Color,
  pieceId: string,
  position: any,
  killedBy: 'capture' | 'effect' | 'skill',
  killerId?: string
): GameEvent {
  return { type: 'OnPieceDeath', turnNumber, activePlayer, payload: { pieceId, position, killedBy, killerId } };
}

export function createOnBeforePieceDestroyedEvent(
  turnNumber: number,
  activePlayer: Color,
  pieceSnapshot: Piece,
  position: Position,
  reason: 'capture' | 'skill' | 'effect' | 'explosion'
): GameEvent {
  return {
    type: 'OnBeforePieceDestroyed',
    turnNumber,
    activePlayer,
    payload: { pieceSnapshot, position, reason },
  };
}

export function createOnPieceDestroyedEvent(
  turnNumber: number,
  activePlayer: Color,
  pieceSnapshot: Piece,
  position: Position,
  reason: string
): GameEvent {
  return {
    type: 'OnPieceDestroyed',
    turnNumber,
    activePlayer,
    payload: { pieceSnapshot, position, reason },
  };
}

export function createOnPieceSpawnEvent(
  turnNumber: number,
  activePlayer: Color,
  pieceId: string,
  position: any
): GameEvent {
  return { type: 'OnPieceSpawn', turnNumber, activePlayer, payload: { pieceId, position } };
}

export function createOnSkillUsedEvent(
  turnNumber: number,
  activePlayer: Color,
  skillId: string,
  targets: any[],
  actualCost?: number
): GameEvent {
  return { type: 'OnSkillUsed', turnNumber, activePlayer, payload: { skillId, targets, actualCost } };
}


export function createOnEffectAppliedEvent(
  turnNumber: number,
  activePlayer: Color,
  effect: any
): GameEvent {
  return { type: 'OnEffectApplied', turnNumber, activePlayer, payload: { effect } };
}

export function createOnEffectExpiredEvent(
  turnNumber: number,
  activePlayer: Color,
  effectId: string,
  reason: string,
  effectSnapshot?: any
): GameEvent {
  return { type: 'OnEffectExpired', turnNumber, activePlayer, payload: { effectId, reason, effectSnapshot } };
}

export function createOnEffectTickEvent(
  turnNumber: number,
  activePlayer: Color,
  effect: any
): GameEvent {
  return { type: 'OnEffectTick', turnNumber, activePlayer, payload: { effect } };
}

export function createOnAPGainedEvent(
  turnNumber: number,
  activePlayer: Color,
  player: Color,
  amount: number,
  source: string
): GameEvent {
  return { type: 'OnAPGained', turnNumber, activePlayer, payload: { player, amount, source } };
}

export function createOnAPSpentEvent(
  turnNumber: number,
  activePlayer: Color,
  player: Color,
  amount: number,
  source: string
): GameEvent {
  return { type: 'OnAPSpent', turnNumber, activePlayer, payload: { player, amount, source } };
}

export function createOnPawnPromotionEvent(
  turnNumber: number,
  activePlayer: Color,
  pieceId: string,
  position: any,
  promotedTo: string
): GameEvent {
  return { type: 'OnPawnPromotion', turnNumber, activePlayer, payload: { pieceId, position, promotedTo } };
}

export function createOnGameOverEvent(
  turnNumber: number,
  activePlayer: Color,
  winner: Color | null,
  reason: string
): GameEvent {
  return { type: 'OnGameOver', turnNumber, activePlayer, payload: { winner, reason } };
}

export function createOnCheckEvent(
  turnNumber: number,
  activePlayer: Color,
  attackerPieces: { piece: any; position: any }[],
  targetPiece: any,
  targetPosition: any
): GameEvent {
  return {
    type: 'OnCheck',
    turnNumber,
    activePlayer,
    payload: { attackerPieces, targetPiece, targetPosition },
  };
}

export function createOnPieceAttackedEvent(
  turnNumber: number,
  activePlayer: Color,
  attacker: any,
  target: any,
  attackerPos: any,
  targetPos: any
): GameEvent {
  return {
    type: 'OnPieceAttacked',
    turnNumber,
    activePlayer,
    payload: { attacker, target, attackerPos, targetPos },
  };
}
