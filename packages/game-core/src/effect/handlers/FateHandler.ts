import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { PRIORITY } from '../../event/ResolutionOrder';
import { BOARD_SIZE } from '../../board/Board';

/**
 * FateHandler — manages the Fate effect that links two pieces.
 * 
 * When a piece with Fate is destroyed, the linked piece is also destroyed.
 * When Fate expires on one piece, the partner's Fate effect is also removed.
 */
export class FateHandler implements EffectHandler {
  effectType = 'fate' as EffectType;
  subscribesTo: GameEventType[] = ['OnBeforePieceDestroyed', 'OnEffectExpired'];
  priority = PRIORITY.BEFORE_DESTROY_FATE; // 200

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    // ── OnBeforePieceDestroyed ──
    // When a piece with Fate is about to die, enqueue destruction of the linked piece
    if (event.type === 'OnBeforePieceDestroyed') {
      const { pieceSnapshot, position } = event.payload;
      if (!pieceSnapshot || !pieceSnapshot.effects) return;

      const fateEffect = pieceSnapshot.effects.find((e: any) => e.type === 'fate');
      if (!fateEffect) return;

      const linkedPieceId = fateEffect.metadata?.linkedPieceId;
      const linkedEffectId = fateEffect.metadata?.linkedEffectId;

      if (!linkedPieceId) return;

      // Scan board for the linked piece
      let linkedPiece: { id: string; pos: { col: number; row: number } } | null = null;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const p = state.board.getPiece({ col: c, row: r });
          if (p && p.id === linkedPieceId) {
            linkedPiece = { id: p.id, pos: { col: c, row: r } };
            break;
          }
        }
        if (linkedPiece) break;
      }

      // If linked piece still exists on board, destroy it
      if (linkedPiece) {
        enqueueAction({
          type: 'DESTROY_PIECE',
          pieceId: linkedPiece.id,
          position: linkedPiece.pos,
          reason: 'fate',
        });
      }

      // Remove Fate effect from the dying piece (cleanup)
      enqueueAction({
        type: 'REMOVE_EFFECT',
        effectId: fateEffect.id,
        targetId: pieceSnapshot.id,
        targetType: 'piece',
        reason: 'fate_triggered',
      });

      // Remove Fate effect from the linked piece (cleanup)
      if (linkedEffectId) {
        enqueueAction({
          type: 'REMOVE_EFFECT',
          effectId: linkedEffectId,
          targetId: linkedPieceId,
          targetType: 'piece',
          reason: 'fate_triggered',
        });
      }
    }

    // ── OnEffectExpired ──
    // When Fate expires on one piece (duration tick), also remove partner's Fate
    if (event.type === 'OnEffectExpired') {
      const { effectSnapshot } = event.payload;
      if (!effectSnapshot || effectSnapshot.type !== 'fate') return;

      const linkedEffectId = effectSnapshot.metadata?.linkedEffectId;
      if (!linkedEffectId) return;

      // Enqueue removal of partner's Fate effect
      // If partner's Fate has already been removed (same tick), REMOVE_EFFECT is a no-op
      enqueueAction({
        type: 'REMOVE_EFFECT',
        effectId: linkedEffectId,
        targetId: effectSnapshot.metadata.linkedPieceId,
        targetType: 'piece',
        reason: 'fate_partner_expired',
      });
    }
  }
}
