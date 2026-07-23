import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { Color, PieceType } from '../../pieces/Piece';

export class TimeFreezeHandler implements EffectHandler {
  effectType = 'time_freeze' as EffectType;
  subscribesTo: GameEventType[] = ['OnMove', 'OnCapture'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    // Check if either player has time_freeze active
    const whiteTF = state.whitePlayerEffects.find(e => e.type === 'time_freeze');
    const blackTF = state.blackPlayerEffects.find(e => e.type === 'time_freeze');

    if (!whiteTF && !blackTF) return;

    let tfEffect: Effect;
    let opponentColor: Color;

    if (whiteTF) {
      tfEffect = whiteTF;
      opponentColor = Color.Black;
    } else {
      tfEffect = blackTF!;
      opponentColor = Color.White;
    }

    const remainingRounds = tfEffect.remainingDuration;
    if (remainingRounds === null || remainingRounds <= 0) return;

    if (event.type === 'OnMove') {
      const { pieceId, to } = event.payload;
      const piece = state.board.getPiece(to);
      if (piece && piece.id === pieceId && piece.color === opponentColor && piece.type !== PieceType.King) {
        enqueueAction({
          type: 'APPLY_EFFECT',
          effect: {
            id: `stun_timefreeze_${pieceId}_${Date.now()}`,
            type: 'stun',
            duration: remainingRounds,
            remainingDuration: remainingRounds,
            tickTiming: 'turnEnd',
            sourcePlayer: tfEffect.sourcePlayer,
            targetType: 'piece',
            targetId: pieceId,
            stackingRule: 'refresh',
            isDebuff: true,
            metadata: {},
          },
        });
      }
    } else if (event.type === 'OnCapture') {
      const { attackerId, to } = event.payload;
      const piece = state.board.getPiece(to);
      if (piece && piece.id === attackerId && piece.color === opponentColor && piece.type !== PieceType.King) {
        enqueueAction({
          type: 'APPLY_EFFECT',
          effect: {
            id: `stun_timefreeze_${attackerId}_${Date.now()}`,
            type: 'stun',
            duration: remainingRounds,
            remainingDuration: remainingRounds,
            tickTiming: 'turnEnd',
            sourcePlayer: tfEffect.sourcePlayer,
            targetType: 'piece',
            targetId: attackerId,
            stackingRule: 'refresh',
            isDebuff: true,
            metadata: {},
          },
        });
      }
    }
  }
}
