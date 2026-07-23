import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { oppositeColor } from '../../pieces/Piece';

export class DragonGazeHandler implements EffectHandler {
  effectType = 'dragon_gaze' as EffectType;
  subscribesTo: GameEventType[] = ['OnMove', 'OnCapture', 'OnEffectExpired'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type === 'OnMove' || event.type === 'OnCapture') {
      const pieceId = event.type === 'OnMove' ? event.payload.pieceId : event.payload.attackerId;
      if (!pieceId) return;

      // Find the piece on the board to check for dragon_gaze effect
      let foundGazeEffect: Effect | null = null;
      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
          const p = state.board.getPiece({ col: c, row: r });
          if (p && p.id === pieceId && p.effects) {
            const gaze = p.effects.find(e => e.type === 'dragon_gaze');
            if (gaze) {
              foundGazeEffect = gaze;
              break;
            }
          }
        }
        if (foundGazeEffect) break;
      }

      if (foundGazeEffect) {
        // Mark hasMoved = true
        if (!foundGazeEffect.metadata) {
          foundGazeEffect.metadata = {};
        }
        foundGazeEffect.metadata.hasMoved = true;

        // Reward +2 AP to Verdant Dragon player (sourcePlayer)
        enqueueAction({
          type: 'GAIN_AP',
          player: foundGazeEffect.sourcePlayer,
          amount: 2,
          source: 'dragon_gaze_move',
        });

        // Immediately remove the effect
        enqueueAction({
          type: 'REMOVE_EFFECT',
          effectId: foundGazeEffect.id,
          targetId: pieceId,
          targetType: 'piece',
          reason: 'moved',
        });
      }
    } else if (event.type === 'OnEffectExpired') {
      const { effectSnapshot } = event.payload;
      if (effectSnapshot && effectSnapshot.type === 'dragon_gaze') {
        const hasMoved = effectSnapshot.metadata?.hasMoved === true;
        if (!hasMoved) {
          // Opponent (opposite of sourcePlayer) loses 2 AP
          const opponent = oppositeColor(effectSnapshot.sourcePlayer);
          enqueueAction({
            type: 'SPEND_AP',
            player: opponent,
            amount: 2,
            source: 'dragon_gaze_expired',
          });
        }
      }
    }
  }
}
