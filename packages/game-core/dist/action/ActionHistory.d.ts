import { Action } from './Action';
export interface HistoryEntry {
    turnNumber: number;
    action: Action;
    timestamp: number;
}
export declare class ActionHistory {
    private log;
    push(turnNumber: number, action: Action): void;
    getAll(): ReadonlyArray<HistoryEntry>;
    getActionsForTurn(turn: number): Action[];
    getLastN(n: number): Action[];
    toSerializable(): HistoryEntry[];
    static fromSerializable(data: HistoryEntry[]): ActionHistory;
}
//# sourceMappingURL=ActionHistory.d.ts.map