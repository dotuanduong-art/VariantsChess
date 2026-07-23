import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { BOARD_SIZE } from '../../board/Board';
import { Position, isInBounds } from '../../board/Position';
import { Color } from '../../pieces/Piece';

export class FoolHandler implements EffectHandler {
  effectType = 'fool' as EffectType;
  subscribesTo: GameEventType[] = ['OnTurnStart'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnTurnStart') return;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const pos = { col: c, row: r };
        const piece = state.board.getPiece(pos);

        if (piece && piece.color === event.activePlayer) {
          const hasFool = piece.effects?.some(e => e.type === 'fool');
          if (hasFool) {
            const rowOffset = piece.color === Color.White ? 1 : -1;
            const dest = { col: c, row: r + rowOffset };

            if (isInBounds(dest)) {
              const pieceAtDest = state.board.getPiece(dest);
              const cellEffects = state.board.getCellEffects(dest) || [];
              const hasObstacle = cellEffects.some(e => e.type === 'flame');

              if (pieceAtDest === null && !hasObstacle) {
                enqueueAction({
                  type: 'FOOL_MOVE',
                  pieceId: piece.id,
                  from: pos,
                  to: dest,
                });
              }
            }
          }
        }
      }
    }
  }
}
