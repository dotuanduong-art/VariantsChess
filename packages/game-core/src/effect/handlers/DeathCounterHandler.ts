import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { Color, oppositeColor } from '../../pieces/Piece';
import { getAttackedPieces } from '../../combat/AttackDetection';
import { BOARD_SIZE } from '../../board/Board';

export class DeathCounterHandler implements EffectHandler {
  effectType = 'death_counter' as EffectType;
  subscribesTo: GameEventType[] = ['OnTurnEnd', 'OnBeforePieceDestroyed'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type === 'OnTurnEnd') {
      // Process for both players if they have Wizard variant
      for (const player of [Color.White, Color.Black]) {
        const isWizard = player === Color.White ? state.whiteVariantId === 'wizard' : state.blackVariantId === 'wizard';
        if (!isWizard) continue;

        const opponent = oppositeColor(player);
        const attacks = getAttackedPieces(state.board, player, state as GameState);
        const attackedPieceIds = new Set(attacks.map(a => a.target.id));

        // Find all pieces of the opponent currently on the board
        for (let r = 0; r < BOARD_SIZE; r++) {
          for (let c = 0; c < BOARD_SIZE; c++) {
            const pos = { col: c, row: r };
            const piece = state.board.getPiece(pos);
            if (piece && piece.color === opponent) {
              const existingEffect = piece.effects?.find(
                e => e.type === 'death_counter' && e.sourcePlayer === player
              );

              if (attackedPieceIds.has(piece.id)) {
                if (!existingEffect) {
                  // Apply new death counter
                  enqueueAction({
                    type: 'APPLY_EFFECT',
                    effect: {
                      id: `death_counter_${piece.id}_${player}_${Date.now()}`,
                      type: 'death_counter',
                      duration: null,
                      remainingDuration: null,
                      tickTiming: 'turnEnd',
                      sourcePlayer: player,
                      targetType: 'piece',
                      targetId: piece.id,
                      stackingRule: 'ignore',
                      isDebuff: true,
                      metadata: {
                        count: 1,
                        turnsSinceLastAttacked: 0,
                      },
                    },
                  });
                } else {
                  // Increment and reset turns
                  existingEffect.metadata.count = Math.min(6, (existingEffect.metadata.count ?? 0) + 1);
                  existingEffect.metadata.turnsSinceLastAttacked = 0;
                }
              } else {
                if (existingEffect) {
                  existingEffect.metadata.turnsSinceLastAttacked = (existingEffect.metadata.turnsSinceLastAttacked ?? 0) + 1;
                  if (existingEffect.metadata.turnsSinceLastAttacked >= 6) {
                    enqueueAction({
                      type: 'REMOVE_EFFECT',
                      effectId: existingEffect.id,
                      targetId: piece.id,
                      targetType: 'piece',
                      reason: 'expired',
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    if (event.type === 'OnBeforePieceDestroyed') {
      const { pieceSnapshot } = event.payload;
      if (!pieceSnapshot || !pieceSnapshot.effects) return;

      const dcEffects = pieceSnapshot.effects.filter((e: Effect) => e.type === 'death_counter');
      for (const effect of dcEffects) {
        const count = effect.metadata.count ?? 0;
        if (count > 0) {
          enqueueAction({
            type: 'GAIN_AP',
            player: effect.sourcePlayer,
            amount: count,
            source: 'passive:death_counter',
          });
        }
      }
    }
  }
}
