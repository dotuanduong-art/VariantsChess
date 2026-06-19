import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';

export class SanctuaryHandler implements EffectHandler {
  effectType = 'sanctuary' as EffectType;
  subscribesTo: GameEventType[] = ['OnCapture'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnCapture') return;

    const { to } = event.payload;
    if (!to) return;

    const cellEffects = state.board.getCellEffects(to);
    const sanctuary = cellEffects.find(
      e => e.type === 'sanctuary'
    );
    if (!sanctuary) return;

    // Attacker is now situated at 'to' cell
    const attackerPiece = state.board.getPiece(to);
    if (!attackerPiece) return;

    // Apply stun only when opponent color is different from the sanctuary sourcePlayer
    if (attackerPiece.color !== sanctuary.sourcePlayer) {
      enqueueAction({
        type: 'APPLY_EFFECT',
        effect: {
          id: `stun_sanctuary_${attackerPiece.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          type: 'stun',
          duration: 4,
          remainingDuration: 4,
          tickTiming: 'turnEnd',
          sourcePlayer: sanctuary.sourcePlayer,
          targetType: 'piece',
          targetId: attackerPiece.id,
          stackingRule: 'refresh',
          isDebuff: true,
          metadata: {},
        }
      });
    }
  }
}
