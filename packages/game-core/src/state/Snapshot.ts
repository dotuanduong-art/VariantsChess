import { GameState, SerializedGameState } from './GameState';

export interface GameStateSnapshot {
  data: SerializedGameState;  // deep-serialized copy
  turnNumber: number;
  timestamp: number;
}

export class SnapshotManager {
  private snapshots: GameStateSnapshot[] = [];

  /** Take a snapshot of current state */
  capture(state: GameState): void {
    this.snapshots.push({
      data: state.toSerializable(),
      turnNumber: state.turnNumber,
      timestamp: Date.now(),
    });
  }

  /** Restore state to N turns ago. Returns the restored GameState or null. */
  restore(turnsBack: number): GameState | null {
    if (this.snapshots.length === 0) return null;
    const currentTurnNumber = this.snapshots[this.snapshots.length - 1].turnNumber;
    const targetTurn = Math.max(1, currentTurnNumber - turnsBack);
    const snapshot = this.getSnapshot(targetTurn);
    if (!snapshot) return null;
    return GameState.fromSerializable(snapshot.data);
  }

  /** Get snapshot for a specific turn */
  getSnapshot(turnNumber: number): GameStateSnapshot | null {
    return this.snapshots.find(s => s.turnNumber === turnNumber) || null;
  }

  /** Clear old snapshots beyond retention limit */
  prune(keepLast: number, currentTurnNumber: number): void {
    const cutoff = currentTurnNumber - keepLast;
    this.snapshots = this.snapshots.filter(s => s.turnNumber >= cutoff);
  }

  toSerializable(): GameStateSnapshot[] {
    return this.snapshots.map(s => ({
      data: { ...s.data },
      turnNumber: s.turnNumber,
      timestamp: s.timestamp,
    }));
  }

  static fromSerializable(data: GameStateSnapshot[]): SnapshotManager {
    const manager = new SnapshotManager();
    manager.snapshots = data.map(s => ({
      data: { ...s.data },
      turnNumber: s.turnNumber,
      timestamp: s.timestamp,
    }));
    return manager;
  }
}
