import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { BOARD_SIZE } from '../../board/Board';

export class MovesetSwapHandler implements EffectHandler {
  effectType = 'moveset_swap' as EffectType;
  subscribesTo: GameEventType[] = ['OnBeforePieceDestroyed', 'OnEffectExpired'];

  private findPieceById(state: Readonly<GameState>, id: string) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.id === id) {
          return { piece: p, pos: { col: c, row: r } };
        }
      }
    }
    return null;
  }

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type === 'OnBeforePieceDestroyed') {
      const { pieceSnapshot } = event.payload;
      if (!pieceSnapshot || !pieceSnapshot.effects) return;

      const effect = pieceSnapshot.effects.find((e: Effect) => e.type === 'moveset_swap');
      if (!effect) return;

      const partnerId = effect.metadata.partnerPieceId;
      const partner = this.findPieceById(state, partnerId);

      // Clean up effect on both partners
      enqueueAction({
        type: 'REMOVE_EFFECT',
        effectId: effect.id,
        targetId: pieceSnapshot.id,
        targetType: 'piece',
        reason: 'cancelled',
      });

      if (partner) {
        // Revert partner type to original immediately
        const partnerEffect = partner.piece.effects?.find(e => e.type === 'moveset_swap');
        if (partnerEffect) {
          partner.piece.type = partnerEffect.metadata.originalType;

          enqueueAction({
            type: 'REMOVE_EFFECT',
            effectId: partnerEffect.id,
            targetId: partnerId,
            targetType: 'piece',
            reason: 'cancelled',
          });
        }

        // Apply stun to partner for 2 rounds (duration 4)
        enqueueAction({
          type: 'APPLY_EFFECT',
          effect: {
            id: `stun_${partnerId}_${Date.now()}`,
            type: 'stun',
            duration: 2,
            remainingDuration: 2,
            tickTiming: 'turnEnd',
            sourcePlayer: effect.sourcePlayer,
            targetType: 'piece',
            targetId: partnerId,
            stackingRule: 'refresh',
            isDebuff: true,
            metadata: {},
          },
        });
      }
    }

    if (event.type === 'OnEffectExpired') {
      const { effectId, reason, effectSnapshot } = event.payload;
      if (!effectSnapshot || effectSnapshot.type !== 'moveset_swap') return;
      
      // If this piece promoted, keep its new type (Queen) and do not revert it
      if (reason === 'promoted') return;

      // If early cancelled (due to death), the OnBeforePieceDestroyed already handled the partner
      if (reason === 'cancelled') return;

      // Revert this piece
      const thisPiece = this.findPieceById(state, effectSnapshot.targetId);
      if (thisPiece) {
        thisPiece.piece.type = effectSnapshot.metadata.originalType;
      }

      // If natural expiry ('expired'), also trigger partner reversion
      if (reason === 'expired') {
        const partnerPieceId = effectSnapshot.metadata.partnerPieceId;
        const partnerPiece = this.findPieceById(state, partnerPieceId);
        if (partnerPiece) {
          const partnerEffect = partnerPiece.piece.effects?.find(e => e.type === 'moveset_swap');
          if (partnerEffect) {
            partnerPiece.piece.type = partnerEffect.metadata.originalType;

            // Remove the partner's effect with reason 'reverted' to prevent double execution
            enqueueAction({
              type: 'REMOVE_EFFECT',
              effectId: partnerEffect.id,
              targetId: partnerPieceId,
              targetType: 'piece',
              reason: 'reverted',
            });
          }
        }
      }
    }
  }
}
