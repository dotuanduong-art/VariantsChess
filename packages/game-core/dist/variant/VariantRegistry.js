"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VariantRegistry = void 0;
class VariantRegistry {
    variants = new Map();
    loadedVariants = new Map();
    /** Register a variant definition */
    register(variant) {
        this.variants.set(variant.id, variant);
    }
    /** Get a variant by id */
    get(variantId) {
        return this.variants.get(variantId);
    }
    /** List all available variants */
    listAll() {
        return Array.from(this.variants.values());
    }
    /**
     * Load a variant for a player. Registers its handlers, modifiers, and hooks.
     */
    loadForPlayer(variantId, player, effectRegistry, eventBus, moveModifierChain, state) {
        const variant = this.get(variantId);
        if (!variant) {
            throw new Error(`Variant ${variantId} is not registered`);
        }
        const loadKey = `${player}_${variantId}`;
        if (this.loadedVariants.has(loadKey)) {
            return; // Already loaded
        }
        // 1. Register effect handlers
        for (const handler of variant.effectHandlers) {
            effectRegistry.register(handler);
            // Rewire registry to event bus, pipeline and modifier chain to register new handler
            handler.subscribesTo.forEach(eventType => {
                eventBus.on({
                    id: `variant_effect_${player}_${handler.effectType}_${eventType}`,
                    eventType,
                    priority: handler.priority ?? 500,
                    source: `variant:${variantId}:${player}`,
                    handler: (event, enqueueAction) => {
                        const ev = event;
                        if (!ev.executedHandlers) {
                            ev.executedHandlers = new Set();
                        }
                        if (ev.executedHandlers.has(handler.effectType)) {
                            return;
                        }
                        ev.executedHandlers.add(handler.effectType);
                        handler.handle(event, state, enqueueAction);
                    }
                });
            });
        }
        // 2. Register passive hooks
        if (variant.passiveHooks) {
            const hooks = typeof variant.passiveHooks === 'function'
                ? variant.passiveHooks(state, player)
                : variant.passiveHooks;
            for (const hook of hooks) {
                eventBus.on({
                    ...hook,
                    id: `${hook.id}_${player}`,
                    source: `variant:${variantId}:${player}`
                });
            }
        }
        // 3. Register move modifiers
        if (variant.moveModifiers) {
            for (const modifier of variant.moveModifiers) {
                moveModifierChain.register({
                    ...modifier,
                    id: `${modifier.id}_${player}`,
                    source: `variant:${variantId}:${player}`
                });
            }
        }
        // 4. Run onSetup
        if (variant.onSetup) {
            variant.onSetup(state, player);
        }
        // 5. Initialize variant state
        if (variant.getInitialState) {
            state.variantState = {
                ...state.variantState,
                ...variant.getInitialState(),
            };
        }
        this.loadedVariants.set(loadKey, { player, variantId });
    }
    /**
     * Unload a variant for a player.
     */
    unloadForPlayer(variantId, player, eventBus, moveModifierChain) {
        const loadKey = `${player}_${variantId}`;
        if (!this.loadedVariants.has(loadKey)) {
            return;
        }
        // Unregister by source
        const source = `variant:${variantId}:${player}`;
        eventBus.offBySource(source);
        moveModifierChain.unregisterBySource(source);
        this.loadedVariants.delete(loadKey);
    }
}
exports.VariantRegistry = VariantRegistry;
//# sourceMappingURL=VariantRegistry.js.map