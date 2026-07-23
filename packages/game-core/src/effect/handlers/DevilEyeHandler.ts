import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { Color, oppositeColor } from '../../pieces/Piece';
import { getAttackedPieces } from '../../combat/AttackDetection';
import { BOARD_SIZE } from '../../board/Board';

export class DevilEyeHandler implements EffectHandler {
  effectType = 'devil_eye' as EffectType;
  subscribesTo: GameEventType[] = ['OnTurnEnd'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnTurnEnd') return;

    // Scan board for any piece carrying 'devil_eye'
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const pos = { col: c, row: r };
        const piece = state.board.getPiece(pos);
        if (piece && piece.effects) {
          const eyeEffect = piece.effects.find(e => e.type === 'devil_eye');
          if (eyeEffect) {
            // Determine the enemy color relative to this piece
            const enemyColor = oppositeColor(piece.color);
            
            // Get all attacks from enemy pieces
            const attacks = getAttackedPieces(state.board, enemyColor, state as GameState);
            
            // Filter attacks pointing specifically at this piece's position
            const attackingThreats = attacks.filter(
              a => a.targetPos.col === pos.col && a.targetPos.row === pos.row
            );

            if (attackingThreats.length > 0) {
              // Apply Stun 6 turns (3 rounds) to each attacking piece (the kẻ đang chiếu)
              for (const threat of attackingThreats) {
                enqueueAction({
                  type: 'APPLY_EFFECT',
                  effect: {
                    id: `stun_${threat.attacker.id}_${Date.now()}`,
                    type: 'stun',
                    duration: 3,
                    remainingDuration: 3,
                    tickTiming: 'turnEnd',
                    sourcePlayer: eyeEffect.sourcePlayer,
                    targetType: 'piece',
                    targetId: threat.attacker.id,
                    stackingRule: 'refresh',
                    isDebuff: true,
                    metadata: {},
                  }
                });
              }

              // Remove Devil Eye effect immediately (one-time trigger)
              enqueueAction({
                type: 'REMOVE_EFFECT',
                effectId: eyeEffect.id,
                targetId: piece.id,
                targetType: 'piece',
                reason: 'devil_eye_triggered',
              });
            }
          }
        }
      }
    }
  }
}
