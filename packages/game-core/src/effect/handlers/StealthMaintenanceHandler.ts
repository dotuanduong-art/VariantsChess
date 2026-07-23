import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { BOARD_SIZE } from '../../board/Board';
import { isInBounds } from '../../board/Position';

export class StealthMaintenanceHandler implements EffectHandler {
  effectType = 'spirit_walk' as EffectType;
  subscribesTo: GameEventType[] = ['OnTurnEnd', 'OnCapture'];

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
    const player = event.activePlayer;

    if (event.type === 'OnTurnEnd') {
      // 1. Reveal any stealth piece that ended adjacent to an enemy
      const adjCells = [
        { dcol: -1, drow: -1 }, { dcol: -1, drow: 0 }, { dcol: -1, drow: 1 },
        { dcol: 0, drow: -1 },                        { dcol: 0, drow: 1 },
        { dcol: 1, drow: -1 },  { dcol: 1, drow: 0 },  { dcol: 1, drow: 1 }
      ];

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const pos = { col: c, row: r };
          const piece = state.board.getPiece(pos);
          if (piece && piece.color === player && piece.effects) {
            const ghost = piece.effects.find(e => e.type === 'ghost');
            if (ghost && ghost.metadata?.stealth === true) {
              let hasEnemyAdjacent = false;
              for (const adj of adjCells) {
                const adjPos = { col: c + adj.dcol, row: r + adj.drow };
                if (isInBounds(adjPos)) {
                  const adjPiece = state.board.getPiece(adjPos);
                  if (adjPiece && adjPiece.color !== player) {
                    hasEnemyAdjacent = true;
                    break;
                  }
                }
              }
              if (hasEnemyAdjacent) {
                ghost.metadata.stealth = false;
              }
            }
          }
        }
      }
    }

    if (event.type === 'OnCapture') {
      // 2. Reveal attacker immediately after any capture
      const { attackerId } = event.payload;
      if (attackerId) {
        const found = this.findPieceById(state, attackerId);
        if (found) {
          const ghost = found.piece.effects?.find(e => e.type === 'ghost');
          if (ghost && ghost.metadata?.stealth === true) {
            ghost.metadata.stealth = false;
          }
        }
      }
    }

    // 3. Maintenance check: Spirit Walk expires if freeSkill1Remaining === 0 AND there are no stealth pieces
    const playerEffects = state.getPlayerEffects(player);
    const spiritWalkEffect = playerEffects.find(e => e.type === 'spirit_walk');

    if (spiritWalkEffect) {
      const freeSkillCount = state.variantState[`${player}_freeSkill1Remaining`] ?? 0;
      let hasAnyStealthPiece = false;

      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const piece = state.board.getPiece({ col: c, row: r });
          if (piece && piece.color === player && piece.effects) {
            const ghost = piece.effects.find(e => e.type === 'ghost');
            if (ghost && ghost.metadata?.stealth === true) {
              hasAnyStealthPiece = true;
              break;
            }
          }
        }
        if (hasAnyStealthPiece) break;
      }

      if (freeSkillCount <= 0 && !hasAnyStealthPiece) {
        enqueueAction({
          type: 'REMOVE_EFFECT',
          effectId: spiritWalkEffect.id,
          targetId: player,
          targetType: 'player',
          reason: 'spirit_walk_expired',
        });
      }
    }
  }
}
