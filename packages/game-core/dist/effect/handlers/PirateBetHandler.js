"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PirateBetHandler = void 0;
const Piece_1 = require("../../pieces/Piece");
class PirateBetHandler {
    effectType = 'pirate_bet';
    subscribesTo = ['OnSkillUsed'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnSkillUsed')
            return;
        const skillUser = event.activePlayer;
        const opponent = skillUser === Piece_1.Color.White ? Piece_1.Color.Black : Piece_1.Color.White;
        // Check if the opponent has an active pirate_bet effect
        const opponentEffects = state.getPlayerEffects(opponent);
        const betEffect = opponentEffects.find(e => e.type === 'pirate_bet');
        if (!betEffect)
            return;
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
exports.PirateBetHandler = PirateBetHandler;
//# sourceMappingURL=PirateBetHandler.js.map