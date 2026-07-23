import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';

export class RepelHandler implements EffectHandler {
  effectType = 'repel' as EffectType;
  subscribesTo: GameEventType[] = ['OnMove', 'OnCapture'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnMove' && event.type !== 'OnCapture') return;

    const { pieceId, attackerId, from, to } = event.payload;
    const movingPieceId = event.type === 'OnMove' ? pieceId : attackerId;
    if (!to || !from || !movingPieceId) return;

    const piece = state.board.getPiece(to);
    if (!piece) return;

    // Check if landing cell has a repel effect of the opponent player
    const cellEffects = state.board.getCellEffects(to);
    const repel = cellEffects.find(
      e => e.type === 'repel' && e.sourcePlayer !== piece.color
    );

    if (repel) {
      const hasAegis = piece.effects?.some(e => e.type === 'aegis');
      if (!hasAegis) {
        // 1. Push piece back to the original position 'from'
        enqueueAction({
          type: 'PUSH_PIECE',
          pieceId: movingPieceId,
          from: to,
          to: from,
          reason: 'repel_trigger',
        });
      }

      // 2. Remove all repel effects of the same batch
      const batchId = repel.metadata.batchId;
      const allCellEffects = state.board.getAllCellEffects();
      for (const [key, effects] of allCellEffects.entries()) {
        const matching = effects.filter(
          e => e.type === 'repel' && e.metadata.batchId === batchId
        );
        for (const m of matching) {
          enqueueAction({
            type: 'REMOVE_EFFECT',
            effectId: m.id,
            targetId: m.targetId,
            targetType: 'cell',
            reason: 'triggered',
          });
        }
      }

      // 3. Refund 1 windSigil (cap at 6)
      if (state.variantState.windSigils !== undefined) {
        state.variantState.windSigils = Math.min(6, state.variantState.windSigils + 1);
      }
    }
  }
}
