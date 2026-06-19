"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MountainHandler = void 0;
class MountainHandler {
    effectType = 'mountain';
    subscribesTo = [];
    handle() { }
    /** Block moves from landing on a mountain cell */
    getMoveModifier(effect, state) {
        return {
            id: `mountain_${effect.id}`,
            priority: 400, // Higher priority/runs early
            source: 'effect:mountain',
            modify(moves, context) {
                if (effect.targetType === 'cell') {
                    const [col, row] = effect.targetId.split(',').map(Number);
                    return moves.filter(m => !(m.col === col && m.row === row));
                }
                return moves;
            }
        };
    }
}
exports.MountainHandler = MountainHandler;
//# sourceMappingURL=MountainHandler.js.map