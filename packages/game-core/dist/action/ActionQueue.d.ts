import { Action } from './Action';
export declare class ActionQueue {
    private queue;
    enqueue(action: Action): void;
    dequeue(): Action | undefined;
    dequeueAll(): Action[];
    isEmpty(): boolean;
    peek(): Action | undefined;
}
//# sourceMappingURL=ActionQueue.d.ts.map