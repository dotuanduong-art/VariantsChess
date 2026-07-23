import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { BOARD_SIZE } from '../../board/Board';

export class SummonDurationHandler implements EffectHandler {
  effectType = 'summon_duration' as EffectType;
  subscribesTo: GameEventType[] = ['OnEffectExpired'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnEffectExpired') return;
    const { effectSnapshot, reason } = event.payload;
    if (effectSnapshot && effectSnapshot.type === 'summon_duration' && reason === 'expired') {
      const pieceId = effectSnapshot.targetId;
      // Find piece by ID on the board
      let foundPos = null;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const p = state.board.getPiece({ col: c, row: r });
          if (p && p.id === pieceId) {
            foundPos = { col: c, row: r };
            break;
          }
        }
        if (foundPos) break;
      }
      if (foundPos) {
        enqueueAction({
          type: 'DESTROY_PIECE',
          pieceId,
          position: foundPos,
          reason: 'effect_expired',
        });
      }
    }
  }
}
