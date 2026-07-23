"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevilTollHandler = void 0;
class DevilTollHandler {
    effectType = 'devil_toll_dummy';
    subscribesTo = ['OnTurnEnd'];
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnTurnEnd')
            return;
        if (state.variantState.devilTollActive) {
            const stateWritable = state;
            stateWritable.variantState.devilTollRemainingTurns--;
            if (stateWritable.variantState.devilTollRemainingTurns <= 0) {
                stateWritable.variantState.devilTollActive = false;
            }
        }
    }
}
exports.DevilTollHandler = DevilTollHandler;
//# sourceMappingURL=DevilTollHandler.js.map