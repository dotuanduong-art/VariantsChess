import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { BOARD_SIZE } from '../../board/Board';
import { Position } from '../../board/Position';

export class BlessingHandler implements EffectHandler {
  effectType = 'blessing' as EffectType;
  subscribesTo: GameEventType[] = ['OnEffectApplied'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnEffectApplied') return;

    const { effect } = event.payload;
    if (!effect || effect.type !== 'blessing') return;

    const targetId = effect.targetId;

    // Find the piece on the board
    let targetPiece: any = null;

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const pos = { col: c, row: r };
        const p = state.board.getPiece(pos);
        if (p && p.id === targetId) {
          targetPiece = p;
          break;
        }
      }
      if (targetPiece) break;
    }

    if (!targetPiece) return;

    // Check if target piece has at least one debuff (isDebuff: true)
    const debuffs = targetPiece.effects?.filter((e: Effect) => e.isDebuff) || [];

    if (debuffs.length > 0) {
      // Remove ALL debuffs from the piece
      for (const debuff of debuffs) {
        enqueueAction({
          type: 'REMOVE_EFFECT',
          effectId: debuff.id,
          targetId: targetPiece.id,
          targetType: 'piece',
          reason: 'cleansed',
        });
      }
    } else {
      // Grant Shield 1 round = 2 turns
      enqueueAction({
        type: 'APPLY_EFFECT',
        effect: {
          id: `shield_${targetPiece.id}_${Date.now()}`,
          type: 'shield',
          duration: 2,
          remainingDuration: 2,
          tickTiming: 'turnEnd',
          sourcePlayer: effect.sourcePlayer,
          targetType: 'piece',
          targetId: targetPiece.id,
          stackingRule: 'refresh',
          isDebuff: false,
          metadata: {},
        },
      });
    }

    // In both cases, remove the blessing effect itself so it doesn't linger on the piece
    enqueueAction({
      type: 'REMOVE_EFFECT',
      effectId: effect.id,
      targetId: targetPiece.id,
      targetType: 'piece',
      reason: 'blessing_resolved',
    });
  }
}
