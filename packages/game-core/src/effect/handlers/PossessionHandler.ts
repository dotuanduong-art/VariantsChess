import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { BOARD_SIZE } from '../../board/Board';

export class PossessionHandler implements EffectHandler {
  effectType = 'possession_active' as EffectType;
  subscribesTo: GameEventType[] = ['OnCapture'];

  private findPieceById(state: Readonly<GameState>, id: string) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const pos = { col: c, row: r };
        const p = state.board.getPiece(pos);
        if (p && p.id === id) {
          return { piece: p, pos };
        }
      }
    }
    return null;
  }

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnCapture') return;

    const player = event.activePlayer;
    const playerEffects = state.getPlayerEffects(player);
    const isPossessionActive = playerEffects.some(e => e.type === 'possession_active');
    if (!isPossessionActive) return;

    const { attackerId, capturedPieceSnapshot } = event.payload;
    if (!attackerId || !capturedPieceSnapshot) return;

    const foundAttacker = this.findPieceById(state, attackerId);
    if (!foundAttacker) return;

    const { piece: attacker, pos: attackerPos } = foundAttacker;
    if (attacker.color !== player) return;

    const ghostEffect = attacker.effects?.find(e => e.type === 'ghost');
    if (ghostEffect) {
      // 1. Transform piece
      enqueueAction({
        type: 'TRANSFORM_PIECE',
        pieceId: attacker.id,
        position: attackerPos,
        newType: capturedPieceSnapshot.type,
      });

      // 2. Remove Ghost effect from attacker
      enqueueAction({
        type: 'REMOVE_EFFECT',
        effectId: ghostEffect.id,
        targetId: attacker.id,
        targetType: 'piece',
        reason: 'possession_transformation',
      });
    }
  }
}
