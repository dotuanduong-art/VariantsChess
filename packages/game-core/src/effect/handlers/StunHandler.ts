import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { MoveModifier } from '../../modifier/MoveModifier';
import { PRIORITY } from '../../event/ResolutionOrder';

export class StunHandler implements EffectHandler {
  effectType: EffectType;
  subscribesTo: GameEventType[] = [];

  constructor(effectType: EffectType = 'stun' as EffectType) {
    this.effectType = effectType;
  }

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    // Generic pipeline ticking handles durations, no custom event handling needed
  }

  /** Block movement of stunned/rooted pieces */
  validateAction(
    action: Action,
    activeEffects: Effect[],
    state: Readonly<GameState>
  ): string | null {
    if (action.type === 'MOVE_PIECE' || action.type === 'CAPTURE') {
      const pieceId = action.type === 'MOVE_PIECE' ? action.pieceId : action.attackerId;
      const isActive = activeEffects.some(
        e => e.targetType === 'piece' && e.targetId === pieceId && e.type === this.effectType
      );
      if (isActive) {
        const verb = this.effectType === 'stun' ? 'stunned' : `${this.effectType}ed`;
        return `This piece is ${verb} and cannot move`;
      }
    }

    return null;
  }

  /** Stunned/rooted pieces have no legal moves */
  getMoveModifier(effect: Effect, state: Readonly<GameState>): MoveModifier | null {
    return {
      id: `${this.effectType}_${effect.id}`,
      priority: PRIORITY.STUN_BLOCK,
      source: `effect:${this.effectType}`,
      modify(moves, context) {
        if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
          return []; // no moves allowed
        }
        return moves;
      }
    };
  }
}

