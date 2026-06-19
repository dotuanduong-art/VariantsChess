import { GameEvent, GameEventType } from './GameEvent';
import { Action } from '../action/Action';
export type EventHandler = (event: GameEvent, enqueueAction: (action: Action) => void) => void;
export interface HandlerRegistration {
    id: string;
    eventType: GameEventType;
    priority: number;
    handler: EventHandler;
    source: string;
}
export declare class EventBus {
    private handlers;
    /** Register a handler with explicit priority */
    on(registration: HandlerRegistration): void;
    /** Remove a handler by id */
    off(handlerId: string): void;
    /** Remove all handlers from a specific source */
    offBySource(source: string): void;
    /**
     * Emit an event — dispatches to all handlers for this event type,
     * sorted by priority (ascending). Handlers may enqueue actions via callback.
     */
    emit(event: GameEvent, enqueueAction: (action: Action) => void): void;
}
//# sourceMappingURL=EventBus.d.ts.map