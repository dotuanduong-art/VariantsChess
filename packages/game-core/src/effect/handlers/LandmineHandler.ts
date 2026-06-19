import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { PieceType } from '../../pieces/Piece';

export class LandmineHandler implements EffectHandler {
  effectType = 'landmine' as EffectType;
  subscribesTo: GameEventType[] = ['OnMove', 'OnCapture'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnMove' && event.type !== 'OnCapture') return;

    const { to } = event.payload;
    if (!to) return;

    const piece = state.board.getPiece(to);
    if (!piece) return;

    // Check if landing cell has a landmine of the opponent player
    const cellEffects = state.board.getCellEffects(to);
    const landmine = cellEffects.find(
      e => e.type === 'landmine' && e.sourcePlayer !== piece.color
    );

    if (landmine) {
      // 1. If moving piece is NOT King, apply bomb effect
      if (piece.type !== PieceType.King) {
        enqueueAction({
          type: 'APPLY_EFFECT',
          effect: {
            id: `bomb_${piece.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            type: 'bomb' as any,
            duration: null,
            remainingDuration: null,
            tickTiming: 'turnEnd',
            sourcePlayer: landmine.sourcePlayer,
            targetType: 'piece',
            targetId: piece.id,
            stackingRule: 'ignore',
            isDebuff: true,
            metadata: {},
          }
        });
      }

      // 2. Remove landmine cell effect
      enqueueAction({
        type: 'REMOVE_EFFECT',
        effectId: landmine.id,
        targetId: landmine.targetId,
        targetType: 'cell',
        reason: 'triggered',
      });
    }
  }
}
