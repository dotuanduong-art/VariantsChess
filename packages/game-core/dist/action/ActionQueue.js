"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionQueue = void 0;
class ActionQueue {
    queue = [];
    enqueue(action) {
        this.queue.push(action);
    }
    dequeue() {
        return this.queue.shift();
    }
    dequeueAll() {
        const actions = [...this.queue];
        this.queue = [];
        return actions;
    }
    isEmpty() {
        return this.queue.length === 0;
    }
    peek() {
        return this.queue[0];
    }
}
exports.ActionQueue = ActionQueue;
//# sourceMappingURL=ActionQueue.js.map