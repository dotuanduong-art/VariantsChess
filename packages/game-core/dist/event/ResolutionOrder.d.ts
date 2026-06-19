/**
 * Resolution priorities — lower number = higher priority (runs first).
 * Grouped by event type for clarity.
 *
 * Design principle: defensive effects resolve before offensive effects.
 * Example: Shield must block capture BEFORE Bomb triggers on death.
 */
export declare const PRIORITY: {
    readonly SHIELD_BLOCK: 100;
    readonly MAIN_VOODOO_REDIRECT: 200;
    readonly ZOMBIE_HOLD_POSITION: 300;
    readonly FATE_LINKED_DEATH: 100;
    readonly ELECTRON_STUN: 200;
    readonly BOMB_EXPLOSION: 300;
    readonly GRAVEYARD_RECORD: 900;
    readonly BEFORE_DESTROY_SHIELD: 100;
    readonly BEFORE_DESTROY_FATE: 200;
    readonly DESTROY_ELECTRON: 200;
    readonly DESTROY_BOMB: 300;
    readonly TRAP_TRIGGER: 100;
    readonly REPEL_PUSHBACK: 200;
    readonly SOULLESS_DISABLE: 300;
    readonly DIMENSION_TELEPORT: 400;
    readonly EFFECT_TICK: 100;
    readonly FOOL_AUTO_MOVE: 200;
    readonly BERSERK_CHECK: 300;
    readonly EFFECT_DURATION_TICK: 100;
    readonly EFFECT_CLEANUP: 900;
    readonly STUN_BLOCK: 100;
    readonly SILENCE_BLOCK: 200;
    readonly BIND_RESTRICT: 300;
};
//# sourceMappingURL=ResolutionOrder.d.ts.map