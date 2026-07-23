import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { PRIORITY } from '../../event/ResolutionOrder';
import { BOARD_SIZE } from '../../board/Board';

export class ShieldHandler implements EffectHandler {
  effectType = 'shield' as EffectType;
  subscribesTo: GameEventType[] = ['OnBeforePieceDestroyed', 'OnTurnEnd'];
  priority = PRIORITY.BEFORE_DESTROY_SHIELD;

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type === 'OnTurnEnd') {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const p = state.board.getPiece({ col: c, row: r });
          if (p && p.effects) {
            const expiredShields = p.effects.filter(
              e => e.type === 'shield' && (e.remainingDuration ?? 0) <= 0
            );
            for (const shield of expiredShields) {
              enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: shield.id,
                targetId: shield.targetId,
                targetType: 'piece',
                reason: 'expired',
              });
            }
          }
        }
      }
      return;
    }

    if (event.type !== 'OnBeforePieceDestroyed') return;

    const { pieceSnapshot, reason } = event.payload;
    if (!pieceSnapshot) return;

    // Shield ONLY cancels when being captured (capture)
    // Shield does NOT cancel when destroyed by effect/explosion/skill
    if (reason !== 'capture') return;

    // Find the shield effect on the snapshot
    const shield = pieceSnapshot.effects?.find(
      (e: Effect) => e.type === 'shield'
    );

    if (shield) {
      // Find the actual piece on the board to mutate the duration
      let boardShield: Effect | undefined;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const p = state.board.getPiece({ col: c, row: r });
          if (p && p.id === pieceSnapshot.id && p.effects) {
            boardShield = p.effects.find(e => e.id === shield.id);
            break;
          }
        }
        if (boardShield) break;
      }

      if (boardShield) {
        event.cancelled = true;

        // Only decrement shield remainingDuration once per turn to prevent spam-clicking bypass
        const turnKey = `${state.turnNumber}_${state.currentTurn}`;
        if (boardShield.metadata?.lastBlockedTurnKey === turnKey) {
          return;
        }

        if (!boardShield.metadata) {
          boardShield.metadata = {};
        }
        boardShield.metadata.lastBlockedTurnKey = turnKey;

        boardShield.remainingDuration = (boardShield.remainingDuration ?? 4) - 1;
      }
    }
  }
}
