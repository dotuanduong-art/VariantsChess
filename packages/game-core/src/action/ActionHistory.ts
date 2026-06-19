import { Action } from './Action';

export interface HistoryEntry {
  turnNumber: number;
  action: Action;
  timestamp: number;
}

export class ActionHistory {
  private log: HistoryEntry[] = [];

  push(turnNumber: number, action: Action): void {
    this.log.push({
      turnNumber,
      action,
      timestamp: Date.now(),
    });
  }

  getAll(): ReadonlyArray<HistoryEntry> {
    return this.log;
  }

  getActionsForTurn(turn: number): Action[] {
    return this.log
      .filter(entry => entry.turnNumber === turn)
      .map(entry => entry.action);
  }

  getLastN(n: number): Action[] {
    return this.log.slice(-n).map(entry => entry.action);
  }

  toSerializable(): HistoryEntry[] {
    return this.log.map(entry => ({ ...entry }));
  }

  static fromSerializable(data: HistoryEntry[]): ActionHistory {
    const history = new ActionHistory();
    history.log = data.map(entry => ({ ...entry }));
    return history;
  }
}
