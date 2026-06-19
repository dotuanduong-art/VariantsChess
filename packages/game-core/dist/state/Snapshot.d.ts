import { GameState, SerializedGameState } from './GameState';
export interface GameStateSnapshot {
    data: SerializedGameState;
    turnNumber: number;
    timestamp: number;
}
export declare class SnapshotManager {
    private snapshots;
    /** Take a snapshot of current state */
    capture(state: GameState): void;
    /** Restore state to N turns ago. Returns the restored GameState or null. */
    restore(turnsBack: number): GameState | null;
    /** Get snapshot for a specific turn */
    getSnapshot(turnNumber: number): GameStateSnapshot | null;
    /** Clear old snapshots beyond retention limit */
    prune(keepLast: number, currentTurnNumber: number): void;
    toSerializable(): GameStateSnapshot[];
    static fromSerializable(data: GameStateSnapshot[]): SnapshotManager;
}
//# sourceMappingURL=Snapshot.d.ts.map