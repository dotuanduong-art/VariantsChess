import { EffectHandler } from '../EffectHandler';
import { EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';

export class DevilTollHandler implements EffectHandler {
  effectType = 'devil_toll_dummy' as EffectType;
  subscribesTo: GameEventType[] = ['OnTurnEnd'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnTurnEnd') return;

    if (state.variantState.devilTollActive) {
      const stateWritable = state as GameState;
      stateWritable.variantState.devilTollRemainingTurns--;
      if (stateWritable.variantState.devilTollRemainingTurns <= 0) {
        stateWritable.variantState.devilTollActive = false;
      }
    }
  }
}
