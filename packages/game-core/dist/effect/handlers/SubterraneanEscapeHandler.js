"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubterraneanEscapeHandler = void 0;
class SubterraneanEscapeHandler {
    effectType = 'subterranean_escape';
    subscribesTo = ['OnBeforePieceDestroyed'];
    priority = 250; // After Shield (100) and Fate (200)
    handle(event, state, enqueueAction) {
        if (event.type !== 'OnBeforePieceDestroyed')
            return;
        const { pieceSnapshot, position, reason } = event.payload;
        if (!pieceSnapshot || reason !== 'capture')
            return;
        // Check if the piece has subterranean_escape effect
        const escapeEffect = pieceSnapshot.effects?.find((e) => e.type === 'subterranean_escape');
        if (escapeEffect) {
            // Initialize variant state if not present
            const mutableState = state;
            if (!mutableState.variantState.undergroundPieces) {
                mutableState.variantState.undergroundPieces = [];
            }
            // Filter out subterranean_escape effect so it doesn't return with it
            const cleanEffects = (pieceSnapshot.effects || []).filter((e) => e.type !== 'subterranean_escape');
            const pieceToSave = {
                ...pieceSnapshot,
                effects: cleanEffects,
            };
            // Save to underground list with returning round N + 2
            mutableState.variantState.undergroundPieces.push({
                pieceSnapshot: pieceToSave,
                position,
                returnRound: state.turnNumber + 2,
                ownerColor: pieceSnapshot.color,
            });
        }
    }
}
exports.SubterraneanEscapeHandler = SubterraneanEscapeHandler;
//# sourceMappingURL=SubterraneanEscapeHandler.js.map