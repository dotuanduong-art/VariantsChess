import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';

export class PuppetTrapHandler implements EffectHandler {
  effectType = 'puppet_trap' as EffectType;
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

    const cellEffects = state.board.getCellEffects(to);
    const trap = cellEffects.find(
      e => e.type === this.effectType && e.sourcePlayer !== piece.color
    );

    if (trap) {
      // Apply stun effect (2 rounds) to the enemy piece
      enqueueAction({
        type: 'APPLY_EFFECT',
        effect: {
          id: `stun_${piece.id}_${Date.now()}`,
          type: 'stun',
          duration: 2,
          remainingDuration: 2,
          tickTiming: 'turnEnd',
          sourcePlayer: trap.sourcePlayer,
          targetType: 'piece',
          targetId: piece.id,
          stackingRule: 'refresh',
          isDebuff: true,
          metadata: {
            sourceSkill: 'puppet_strings',
            puppetPlayer: trap.sourcePlayer,
          },
        }
      });

      // Remove the puppet_trap cell effect
      enqueueAction({
        type: 'REMOVE_EFFECT',
        effectId: trap.id,
        targetId: trap.targetId,
        targetType: 'cell',
        reason: 'triggered',
      });
    }
  }
}
