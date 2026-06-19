import { Action } from './Action';

export class ActionQueue {
  private queue: Action[] = [];

  enqueue(action: Action): void {
    this.queue.push(action);
  }

  dequeue(): Action | undefined {
    return this.queue.shift();
  }

  dequeueAll(): Action[] {
    const actions = [...this.queue];
    this.queue = [];
    return actions;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  peek(): Action | undefined {
    return this.queue[0];
  }
}
