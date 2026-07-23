"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BindHandler = void 0;
const ResolutionOrder_1 = require("../../event/ResolutionOrder");
class BindHandler {
    effectType = 'bind';
    subscribesTo = [];
    handle() { }
    getMoveModifier(effect, state) {
        return {
            id: `bind_${effect.id}`,
            priority: ResolutionOrder_1.PRIORITY.BIND_RESTRICT,
            source: 'effect:bind',
            modify(moves, context) {
                if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
                    const center = context.piecePosition;
                    return moves.filter(m => {
                        const dcol = Math.abs(m.col - center.col);
                        const drow = Math.abs(m.row - center.row);
                        return dcol <= 2 && drow <= 2;
                    });
                }
                return moves;
            }
        };
    }
}
exports.BindHandler = BindHandler;
//# sourceMappingURL=BindHandler.js.map