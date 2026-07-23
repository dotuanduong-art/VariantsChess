"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZombieHandler = void 0;
const Piece_1 = require("../../pieces/Piece");
class ZombieHandler {
    effectType = 'zombie';
    subscribesTo = [];
    handle(event, state, enqueueAction) {
        // Zombie is permanent passive, does not tick duration
    }
    getMoveModifier(effect, state) {
        return {
            id: `zombie_moves_${effect.id}`,
            priority: 500, // standard priority
            source: 'effect:zombie',
            modify(moves, context) {
                if (effect.targetType === 'piece' && context.piece.id === effect.targetId) {
                    // Annotate each move destination with the correct type
                    return moves.map(pos => {
                        const target = context.board.getPiece(pos);
                        const lm = { ...pos };
                        if (target) {
                            const targetOwner = (0, Piece_1.getPieceOwner)(target);
                            const moverOwner = (0, Piece_1.getPieceOwner)(context.piece);
                            if (targetOwner !== moverOwner) {
                                const hasWalker = target.effects?.some(e => e.type === 'walker');
                                if (!hasWalker) {
                                    lm.moveType = 'zombie_bite';
                                }
                                else {
                                    lm.moveType = 'capture';
                                }
                            }
                            else {
                                lm.moveType = 'capture'; // capture friendly (if allowAllyCapture)
                            }
                        }
                        else {
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
exports.ZombieHandler = ZombieHandler;
//# sourceMappingURL=ZombieHandler.js.map