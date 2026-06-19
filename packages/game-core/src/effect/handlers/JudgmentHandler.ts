import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { BOARD_SIZE } from '../../board/Board';
import { Color } from '../../pieces/Piece';

export class JudgmentHandler implements EffectHandler {
  effectType = 'judgment_mark' as EffectType;
  subscribesTo: GameEventType[] = ['OnTurnEnd'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnTurnEnd') return;

    // Tick both players' judgment windows if active
    for (const color of [Color.White, Color.Black]) {
      const activeKey = `judgmentWindowActive_${color}`;
      const turnsKey = `judgmentWindowRemainingTurns_${color}`;

      if (state.variantState[activeKey]) {
        state.variantState[turnsKey]--;
        
        if (state.variantState[turnsKey] === 0) {
          state.variantState[activeKey] = false;

          // Destroy all pieces on the board carrying judgment_mark sourced by this color
          for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
              const pos = { col: c, row: r };
              const piece = state.board.getPiece(pos);
              if (piece && piece.effects) {
                const hasMark = piece.effects.some(
                  e => e.type === 'judgment_mark' && e.sourcePlayer === color
                );
                if (hasMark) {
                  enqueueAction({
                    type: 'DESTROY_PIECE',
                    pieceId: piece.id,
                    position: pos,
                    reason: 'judgment',
                  });
                }
              }
            }
          }
        }
      }
    }
  }
}
