"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KazeVariant = exports.RulerVariant = exports.MagicianVariant = exports.ZombieVariant = void 0;
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
exports.ZombieVariant = {
    id: 'zombie',
    name: 'Zombie',
    description: 'Infect enemies and raise Walker zombies to overrun the board.',
    skills: [
        createStubSkill('zombie_infection', 'Infection', 'Choose an ally pawn to convert to a Zombie.', 'skill1', 5),
        createStubSkill('zombie_mutation', 'Mutation', 'Convert a Walker into a controllable Zombie.', 'skill2', 4),
        createStubSkill('zombie_outbreak', 'Outbreak', 'Resurrect 2 fallen allies as Walkers.', 'ultimate', 8),
    ],
    effectHandlers: [],
    getInitialState: () => ({ zombieCount: 2 }),
};
exports.MagicianVariant = {
    id: 'magician',
    name: 'Magician',
    description: 'Swap pieces and manipulate movements in a 5x5 magic domain.',
    skills: [
        createStubSkill('magician_swap_allies', 'Ally Swap', 'Swap positions of 2 ally pieces.', 'skill1', 3),
        createStubSkill('magician_swap_movements', 'Movement Swap', 'Swap movement patterns of 2 enemy pieces.', 'skill2', 4),
        createStubSkill('magician_fool', 'Fool Domain', 'Apply Fool effect to 5 pieces for 5 turns.', 'ultimate', 8),
    ],
    effectHandlers: [],
    getInitialState: () => ({ domainCount: 0 }),
};
exports.RulerVariant = {
    id: 'ruler',
    name: 'Ruler',
    description: 'Enforce absolute laws on a 9x9 battlefield.',
    skills: [
        createStubSkill('ruler_law2', 'Giới Luật 2', 'Enable Law 2 (higher rank eats lower rank) in 9x9 zone.', 'skill1', 4),
        createStubSkill('ruler_law3', 'Giới Luật 3', 'Enable Law 3 (lower rank eats higher rank) in 9x9 zone.', 'skill2', 4),
        createStubSkill('ruler_close_field', 'Đóng Chiến Trường', 'Lock the 9x9 battlefield; no entering or leaving.', 'ultimate', 10),
    ],
    effectHandlers: [],
    getInitialState: () => ({ lawActive: 1 }),
};
exports.KazeVariant = {
    id: 'kaze',
    name: 'Kaze',
    description: 'Utilize wind energy (Kunai) to repel enemies and summon storms.',
    skills: [
        createStubSkill('kaze_repel', 'Repel', 'Set repel effect on a cross-shaped empty area.', 'skill1', 3),
        createStubSkill('kaze_soulless', 'Soulless', 'Set soulless effect on an X-shaped empty area.', 'skill2', 4),
        createStubSkill('kaze_storm', 'Storm', 'Summon a 7x7 storm shrinking over time.', 'ultimate', 12),
    ],
    effectHandlers: [],
    getInitialState: () => ({ kunaiCount: 4 }),
};
//# sourceMappingURL=StubVariants.js.map