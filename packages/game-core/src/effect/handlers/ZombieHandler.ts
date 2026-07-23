import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
import { getPieceOwner } from '../../pieces/Piece';
import { LegalMove } from '../../board/Position';

export class ZombieHandler implements EffectHandler {
  effectType = 'zombie' as EffectType;
  subscribesTo: GameEventType[] = [];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    // Zombie is permanent passive, does not tick duration
  }

  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    return {
      id: `zombie_moves_${effect.id}`,
      priority: 500, // standard priority
      source: 'effect:zombie',
      modify(moves, context) {
        if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
          // Annotate each move destination with the correct type
          return moves.map(pos => {
            const target = context.board.getPiece(pos);
            const lm: LegalMove = { ...pos };
            if (target) {
              const targetOwner = getPieceOwner(target);
              const moverOwner = getPieceOwner(context.piece);
              if (targetOwner !== moverOwner) {
                const hasWalker = target.effects?.some(e => e.type === 'walker');
                if (!hasWalker) {
                  lm.moveType = 'zombie_bite';
                } else {
                  lm.moveType = 'capture';
                }
              } else {
                lm.moveType = 'capture'; // capture friendly (if allowAllyCapture)
              }
            } else {
              lm.moveType = 'normal';
            }
            return lm;
          });
        }
        return moves;
      }
    };
  }
}
