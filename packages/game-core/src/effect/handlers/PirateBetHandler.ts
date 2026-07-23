import { EffectHandler } from '../EffectHandler';
import { Effect, EffectType } from '../Effect';
import { GameEventType, GameEvent } from '../../event/GameEvent';
import { GameState } from '../../state/GameState';
import { Action } from '../../action/Action';
import { Color } from '../../pieces/Piece';

export class PirateBetHandler implements EffectHandler {
  effectType = 'pirate_bet' as EffectType;
  subscribesTo: GameEventType[] = ['OnSkillUsed'];

  handle(
    event: GameEvent,
    state: Readonly<GameState>,
    enqueueAction: (action: Action) => void
  ): void {
    if (event.type !== 'OnSkillUsed') return;

    const skillUser = event.activePlayer;
    const opponent = skillUser === Color.White ? Color.Black : Color.White;

    // Check if the opponent has an active pirate_bet effect
    const opponentEffects = state.getPlayerEffects(opponent);
    const betEffect = opponentEffects.find(e => e.type === 'pirate_bet');

    if (!betEffect) return;

    // Opponent used a skill, bet is correct!
    // 1. Reward Pirate with 8 AP
    enqueueAction({
      type: 'GAIN_AP',
      player: opponent,
      amount: 8,
      source: 'passive:pirate_bet_win',
    });

    // 2. Remove the pirate_bet effect
    enqueueAction({
      type: 'REMOVE_EFFECT',
      effectId: betEffect.id,
      targetId: opponent,
      targetType: 'player',
      reason: 'pirate_bet_resolved_success',
    });
  }
}
