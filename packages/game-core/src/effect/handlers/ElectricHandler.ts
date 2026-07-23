import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';

/**
 * ElectricHandler – handles the `electric` effect (Thunder Dragon Skill 1).
 *
 * When a piece carrying `electric` is captured by an enemy, the attacker
 * receives a `stun` effect for 2 rounds (4 turns via turnEnd ticking).
 * The electric effect is removed from the captured piece as part of normal
 * lifecycle (the piece is removed from the board), so no explicit REMOVE_EFFECT
 * is needed here.
 */
export class ElectricHandler implements EffectHandler {
  effectType = 'electric' as EffectType;
  subscribesTo: GameEventType[] = ['OnCapture'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnCapture') return;

    const { attackerId, capturedPieceId, to } = event.payload;

    // Find the captured piece snapshot from the graveyard or from the board *before*
    // the capture resolved. We identify via capturedPieceId embedded in the event.
    // The captured piece is no longer on the board at this point; we find the
    // attacker (now at `to` unless stayInPlace) by ID to determine its color.
    const attacker = state.board.getPiece(to) ?? (() => {
      // stayInPlace scenario: attacker is still at `from`
      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
          const p = state.board.getPiece({ col: c, row: r });
          if (p && p.id === attackerId) return p;
        }
      }
      return null;
    })();

    if (!attacker) return;

    // Find the electric effect that was on the captured piece.
    const capturedPieceSnapshot = event.payload.capturedPieceSnapshot;
    if (!capturedPieceSnapshot) return;

    const electricEffect = capturedPieceSnapshot.effects?.find(
      (e: any) => e.type === 'electric' && e.sourcePlayer !== attacker.color
    );
    if (!electricEffect) return;

    // Apply stun to the attacker for 2 rounds (duration 2: ticks once per owner's turnEnd)
    enqueueAction({
      type: 'APPLY_EFFECT',
      effect: {
        id: `electric_stun_${attackerId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        type: 'stun',
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd',
        sourcePlayer: electricEffect.sourcePlayer,
        targetType: 'piece',
        targetId: attackerId,
        stackingRule: 'refresh',
        isDebuff: true,
        metadata: {},
      },
    });
  }
}
