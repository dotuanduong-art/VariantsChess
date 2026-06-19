"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SilenceHandler = void 0;
class SilenceHandler {
    effectType = 'silence';
    subscribesTo = [];
    handle(event, state, enqueueAction) {
        // The main validation and blocking of skills is handled directly in ActionPipeline.ts
    }
}
exports.SilenceHandler = SilenceHandler;
//# sourceMappingURL=SilenceHandler.js.map