import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { BOARD_SIZE } from '../../board/Board';

export class SubterraneanEscapeHandler implements EffectHandler {
  effectType = 'subterranean_escape' as EffectType;
  subscribesTo: GameEventType[] = ['OnBeforePieceDestroyed'];
  priority = 250; // After Shield (100) and Fate (200)

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnBeforePieceDestroyed') return;

    const { pieceSnapshot, position, reason } = event.payload;
    if (!pieceSnapshot || reason !== 'capture') return;

    // Check if the piece has subterranean_escape effect
    const escapeEffect = pieceSnapshot.effects?.find(
      (e: Effect) => e.type === 'subterranean_escape'
    );

    if (escapeEffect) {
      // Initialize variant state if not present
      const mutableState = state as any;
      if (!mutableState.variantState.undergroundPieces) {
        mutableState.variantState.undergroundPieces = [];
      }

      // Filter out subterranean_escape effect so it doesn't return with it
      const cleanEffects = (pieceSnapshot.effects || []).filter(
        (e: Effect) => e.type !== 'subterranean_escape'
      );

      const pieceToSave = {
        ...pieceSnapshot,
        effects: cleanEffects,
      };

      // Save to underground list with returning round N + 2
      mutableState.variantState.undergroundPieces.push({
        pieceSnapshot: pieceToSave,
        position,
        returnRound: state.turnNumber + 2,
        ownerColor: pieceSnapshot.color,
      });
    }
  }
}
