import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { BOARD_SIZE } from '../../board/Board';
import { posEquals } from '../../board/Position';

export class PredictionHandler implements EffectHandler {
  effectType = 'prediction' as EffectType;
  subscribesTo: GameEventType[] = ['OnMove', 'OnCapture'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type === 'OnMove') {
      const { pieceId, to } = event.payload;
      // Find piece on the board
      const piece = state.board.getPiece(to);
      if (piece && piece.id === pieceId && piece.effects) {
        const effect = piece.effects.find(e => e.type === 'prediction');
        if (effect) {
          const predicted = effect.metadata.predictedPosition;
          if (predicted && posEquals(to, predicted)) {
            enqueueAction({
              type: 'APPLY_EFFECT',
              effect: {
                id: `stun_prediction_${pieceId}_${Date.now()}`,
                type: 'stun',
                duration: 4,
                remainingDuration: 4,
                tickTiming: 'turnEnd',
                sourcePlayer: effect.sourcePlayer,
                targetType: 'piece',
                targetId: pieceId,
                stackingRule: 'refresh',
                isDebuff: true,
                metadata: {},
              },
            });
          }
          enqueueAction({
            type: 'REMOVE_EFFECT',
            effectId: effect.id,
            targetId: pieceId,
            targetType: 'piece',
            reason: 'prediction_resolved',
          });
        }
      }
    } else if (event.type === 'OnCapture') {
      const { attackerId, to } = event.payload;
      // Find attacker on the board
      const piece = state.board.getPiece(to);
      if (piece && piece.id === attackerId && piece.effects) {
        const effect = piece.effects.find(e => e.type === 'prediction');
        if (effect) {
          const predicted = effect.metadata.predictedPosition;
          if (predicted && posEquals(to, predicted)) {
            enqueueAction({
              type: 'APPLY_EFFECT',
              effect: {
                id: `stun_prediction_${attackerId}_${Date.now()}`,
                type: 'stun',
                duration: 4,
                remainingDuration: 4,
                tickTiming: 'turnEnd',
                sourcePlayer: effect.sourcePlayer,
                targetType: 'piece',
                targetId: attackerId,
                stackingRule: 'refresh',
                isDebuff: true,
                metadata: {},
              },
            });
          }
          enqueueAction({
            type: 'REMOVE_EFFECT',
            effectId: effect.id,
            targetId: attackerId,
            targetType: 'piece',
            reason: 'prediction_resolved',
          });
        }
      }
    }
  }
}
