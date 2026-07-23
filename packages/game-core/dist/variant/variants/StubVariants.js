"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Utility helper to create a basic stub skill
function createStubSkill(id, name, description, tier, apCost) {
    return {
        id,
        name,
        description,
        tier,
        apCost,
        cooldown: 0,
        usageRule: 'once_per_turn',
        getTargetRequirements: () => [],
        canActivate: () => null,
        execute: () => [],
    };
}
//# sourceMappingURL=StubVariants.js.map