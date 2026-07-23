import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';

export class SoullessCellHandler implements EffectHandler {
  effectType = 'soulless_cell' as EffectType;
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

    // Check if landing cell has a soulless_cell effect of the opponent player
    const cellEffects = state.board.getCellEffects(to);
    const soullessCell = cellEffects.find(
      e => e.type === 'soulless_cell' && e.sourcePlayer !== piece.color
    );

    if (soullessCell) {
      // 1. Apply 'soulless' piece effect on the piece
      enqueueAction({
        type: 'APPLY_EFFECT',
        effect: {
          id: `soulless_${movingPieceId}_${Date.now()}`,
          type: 'soulless',
          duration: 2,
          remainingDuration: 2,
          tickTiming: 'turnEnd',
          sourcePlayer: soullessCell.sourcePlayer,
          targetType: 'piece',
          targetId: movingPieceId,
          stackingRule: 'refresh',
          isDebuff: true,
          metadata: {
            originalPosition: from,
            batchId: soullessCell.metadata.batchId,
          },
        }
      });

      // 2. Remove all soulless_cell effects of the same batch
      const batchId = soullessCell.metadata.batchId;
      const allCellEffects = state.board.getAllCellEffects();
      for (const [key, effects] of allCellEffects.entries()) {
        const matching = effects.filter(
          e => e.type === 'soulless_cell' && e.metadata.batchId === batchId
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
