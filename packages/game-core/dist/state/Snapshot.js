"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotManager = void 0;
const GameState_1 = require("./GameState");
class SnapshotManager {
    snapshots = [];
    /** Take a snapshot of current state */
    capture(state) {
        this.snapshots.push({
            data: state.toSerializable(),
            turnNumber: state.turnNumber,
            timestamp: Date.now(),
        });
    }
    /** Restore state to N turns ago. Returns the restored GameState or null. */
    restore(turnsBack) {
        if (this.snapshots.length === 0)
            return null;
        const currentTurnNumber = this.snapshots[this.snapshots.length - 1].turnNumber;
        const targetTurn = Math.max(1, currentTurnNumber - turnsBack);
        const snapshot = this.getSnapshot(targetTurn);
        if (!snapshot)
            return null;
        return GameState_1.GameState.fromSerializable(snapshot.data);
    }
    /** Get snapshot for a specific turn */
    getSnapshot(turnNumber) {
        return this.snapshots.find(s => s.turnNumber === turnNumber) || null;
    }
    /** Clear old snapshots beyond retention limit */
    prune(keepLast, currentTurnNumber) {
        const cutoff = currentTurnNumber - keepLast;
        this.snapshots = this.snapshots.filter(s => s.turnNumber >= cutoff);
    }
    toSerializable() {
        return this.snapshots.map(s => ({
            data: { ...s.data },
            turnNumber: s.turnNumber,
            timestamp: s.timestamp,
        }));
    }
    static fromSerializable(data) {
        const manager = new SnapshotManager();
        manager.snapshots = data.map(s => ({
            data: { ...s.data },
            turnNumber: s.turnNumber,
            timestamp: s.timestamp,
        }));
        return manager;
    }
}
exports.SnapshotManager = SnapshotManager;
//# sourceMappingURL=Snapshot.js.map