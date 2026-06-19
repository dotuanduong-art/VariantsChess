"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionHistory = void 0;
class ActionHistory {
    log = [];
    push(turnNumber, action) {
        this.log.push({
            turnNumber,
            action,
            timestamp: Date.now(),
        });
    }
    getAll() {
        return this.log;
    }
    getActionsForTurn(turn) {
        return this.log
            .filter(entry => entry.turnNumber === turn)
            .map(entry => entry.action);
    }
    getLastN(n) {
        return this.log.slice(-n).map(entry => entry.action);
    }
    toSerializable() {
        return this.log.map(entry => ({ ...entry }));
    }
    static fromSerializable(data) {
        const history = new ActionHistory();
        history.log = data.map(entry => ({ ...entry }));
        return history;
    }
}
exports.ActionHistory = ActionHistory;
//# sourceMappingURL=ActionHistory.js.map