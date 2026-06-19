import { GameEvent, GameEventType } from './GameEvent';
import { Action } from '../action/Action';

export type EventHandler = (
  event: GameEvent,
  enqueueAction: (action: Action) => void
) => void;

export interface HandlerRegistration {
  id: string;
  eventType: GameEventType;
  priority: number;              // lower = runs first
  handler: EventHandler;
  source: string;                // e.g. 'effect:stun', 'variant:lightning'
}

export class EventBus {
  private handlers: Map<GameEventType, HandlerRegistration[]> = new Map();

  /** Register a handler with explicit priority */
  on(registration: HandlerRegistration): void {
    const list = this.handlers.get(registration.eventType) || [];
    list.push(registration);
    // Sort ascending by priority
    list.sort((a, b) => a.priority - b.priority);
    this.handlers.set(registration.eventType, list);
  }

  /** Remove a handler by id */
  off(handlerId: string): void {
    for (const [type, list] of this.handlers.entries()) {
      const filtered = list.filter(reg => reg.id !== handlerId);
      this.handlers.set(type, filtered);
    }
  }

  /** Remove all handlers from a specific source */
  offBySource(source: string): void {
    for (const [type, list] of this.handlers.entries()) {
      const filtered = list.filter(reg => reg.source !== source);
      this.handlers.set(type, filtered);
    }
  }

  /** 
   * Emit an event — dispatches to all handlers for this event type,
   * sorted by priority (ascending). Handlers may enqueue actions via callback.
   */
  emit(event: GameEvent, enqueueAction: (action: Action) => void): void {
    const list = this.handlers.get(event.type) || [];
    for (const registration of list) {
      if (event.cancelled) break; // Stop executing if event is cancelled
      registration.handler(event, enqueueAction);
    }
  }
}
