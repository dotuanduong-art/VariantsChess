"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
class EventBus {
    handlers = new Map();
    /** Register a handler with explicit priority */
    on(registration) {
        const list = this.handlers.get(registration.eventType) || [];
        list.push(registration);
        // Sort ascending by priority
        list.sort((a, b) => a.priority - b.priority);
        this.handlers.set(registration.eventType, list);
    }
    /** Remove a handler by id */
    off(handlerId) {
        for (const [type, list] of this.handlers.entries()) {
            const filtered = list.filter(reg => reg.id !== handlerId);
            this.handlers.set(type, filtered);
        }
    }
    /** Remove all handlers from a specific source */
    offBySource(source) {
        for (const [type, list] of this.handlers.entries()) {
            const filtered = list.filter(reg => reg.source !== source);
            this.handlers.set(type, filtered);
        }
    }
    /**
     * Emit an event — dispatches to all handlers for this event type,
     * sorted by priority (ascending). Handlers may enqueue actions via callback.
     */
    emit(event, enqueueAction) {
        const list = this.handlers.get(event.type) || [];
        for (const registration of list) {
            if (event.cancelled)
                break; // Stop executing if event is cancelled
            registration.handler(event, enqueueAction);
        }
    }
}
exports.EventBus = EventBus;
//# sourceMappingURL=EventBus.js.map