import { Match, Color, PieceType, APCostConfig } from 'game-core';

describe('AP Cost Centralization Migration Verification Test', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  it('Verify that all registered variants have apCost matching APCostConfig exactly', () => {
    const registry = match.getVariantRegistry();
    const allVariants = registry.listAll();

    // Check all active variants
    const activeVariants = allVariants;
    expect(activeVariants.length).toBe(26);

    for (const variant of activeVariants) {
      const state = match.getGameState();
      const player = Color.White;

      for (const skill of variant.skills) {
        let expectedCost: number | undefined;

        switch (skill.id) {
          // Lightning
          case 'lightning_thunder_trap':
            expectedCost = APCostConfig.lightning.lightning_skill_1;
            break;
          case 'lightning_electric_terrain':
            expectedCost = APCostConfig.lightning.lightning_skill_2;
            break;
          case 'lightning_raigeki':
            expectedCost = APCostConfig.lightning.lightning_ultimate;
            break;

          // Zombie
          case 'zombie_infection':
            // Free for first 3 uses, so we force free infection count to 0 in state
            state.variantState.freeInfectionRemaining = 0;
            expectedCost = APCostConfig.zombie.zombie_skill_1;
            break;
          case 'zombie_mutation':
            expectedCost = APCostConfig.zombie.zombie_skill_2;
            break;
          case 'zombie_outbreak':
            expectedCost = APCostConfig.zombie.zombie_ultimate;
            break;

          // Dynamite
          case 'dynamite_live_charge':
            expectedCost = APCostConfig.dynamite.dynamite_skill_1;
            break;
          case 'dynamite_landmine':
            expectedCost = APCostConfig.dynamite.dynamite_skill_2;
            break;
          case 'dynamite_detonation':
            expectedCost = APCostConfig.dynamite.dynamite_ultimate;
            break;

          // Magician
          case 'magician_swap_allies':
            expectedCost = APCostConfig.magician.magician_skill_1;
            break;
          case 'magician_swap_movements':
            expectedCost = APCostConfig.magician.magician_skill_2;
            break;
          case 'magician_fool':
            expectedCost = APCostConfig.magician.magician_ultimate;
            break;

          // Guardian
          case 'guardian_shield':
            // Verify base cost with empty graveyard
            state.graveyard = [];
            const baseCost = typeof skill.apCost === 'function' ? skill.apCost(state, player) : skill.apCost;
            expect(baseCost).toBe(APCostConfig.guardian.guardian_skill_1);

            // Verify discount cost with >= 8 lost pieces
            for (let i = 0; i < 8; i++) {
              state.graveyard.push({
                piece: { id: `w_lost_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] },
                position: { col: 0, row: i },
                turnDied: 1,
                killedBy: 'capture',
              });
            }
            expectedCost = APCostConfig.guardian.guardian_skill_1_discount;
            break;
          case 'guardian_sanctuary':
            expectedCost = APCostConfig.guardian.guardian_skill_2;
            break;
          case 'guardian_ultimate':
            expectedCost = APCostConfig.guardian.guardian_ultimate;
            break;

          // Requiem
          case 'requiem_soul_break':
            expectedCost = APCostConfig.requiem.requiem_skill_1;
            break;
          case 'requiem_thread_of_fate':
            expectedCost = APCostConfig.requiem.requiem_skill_2;
            break;
          case 'requiem_reapers_decree':
            expectedCost = APCostConfig.requiem.requiem_ultimate;
            break;

          // Kaze
          case 'kaze_repel':
            expectedCost = APCostConfig.kaze.kaze_skill_1;
            break;
          case 'kaze_soulless':
            expectedCost = APCostConfig.kaze.kaze_skill_2;
            break;
          case 'kaze_storm':
            expectedCost = APCostConfig.kaze.kaze_ultimate;
            break;

          // Nephalem
          case 'nephalem_judgment_chains':
            expectedCost = APCostConfig.nephalem.nephalem_skill_1;
            break;
          case 'nephalem_berserk_curse':
            expectedCost = APCostConfig.nephalem.nephalem_skill_2;
            break;
          case 'nephalem_divine_silence':
            expectedCost = APCostConfig.nephalem.nephalem_ultimate;
            break;

          // Angel
          case 'angel_holy_seal':
            expectedCost = APCostConfig.angel.angel_skill_1;
            break;
          case 'angel_blessing':
            expectedCost = APCostConfig.angel.angel_skill_2;
            break;
          case 'angel_divine_judgment':
            expectedCost = APCostConfig.angel.angel_ultimate;
            break;

          // Wizard
          case 'wizard_arcane_swap':
            state.variantState.wizardSkillUseCount_white = 0;
            expectedCost = APCostConfig.wizard.wizard_skill_1;
            break;
          case 'wizard_arcane_bind':
            state.variantState.wizardSkillUseCount_white = 0;
            expectedCost = APCostConfig.wizard.wizard_skill_2;
            break;
          case 'wizard_arcane_annihilation':
            expectedCost = APCostConfig.wizard.wizard_ultimate;
            break;

          // Devil
          case 'devil_eye_skill':
            expectedCost = APCostConfig.devil.devil_skill_1;
            break;
          case 'wrath_curse_skill':
            expectedCost = APCostConfig.devil.devil_skill_2;
            break;
          case 'hellish_toll_skill':
            expectedCost = APCostConfig.devil.devil_ultimate;
            break;

          // Cherubim
          case 'cherubim_ascend':
            expectedCost = APCostConfig.cherubim.cherubim_skill_1;
            break;
          case 'cherubim_fountain_of_youth':
            expectedCost = APCostConfig.cherubim.cherubim_skill_2;
            break;
          case 'cherubim_divine_ascension':
            expectedCost = APCostConfig.cherubim.cherubim_ultimate;
            break;

          // Thunder Dragon
          case 'thunder_dragon_dragons_scale':
            expectedCost = APCostConfig.thunder_dragon.thunder_dragon_skill_1;
            break;
          case 'thunder_dragon_thunder_fang':
            expectedCost = APCostConfig.thunder_dragon.thunder_dragon_skill_2;
            break;
          case 'thunder_dragon_dragons_wrath':
            expectedCost = APCostConfig.thunder_dragon.thunder_dragon_ultimate;
            break;

          // Earth
          case 'earth_raise_mountain':
            expectedCost = APCostConfig.earth.earth_skill_1;
            break;
          case 'earth_shifting_peaks':
            // Evaluates to earth_shifting_peaks_base when no mountains exist
            expectedCost = APCostConfig.earth.earth_skill_2;
            break;
          case 'earth_earth_burst':
            expectedCost = APCostConfig.earth.earth_ultimate;
            break;

          // Cannibal
          case 'cannibal_royal_guard':
            expectedCost = APCostConfig.cannibal.cannibal_skill_1;
            break;
          case 'cannibal_devour':
            expectedCost = APCostConfig.cannibal.cannibal_skill_2;
            break;
          case 'cannibal_apex_predator':
            expectedCost = APCostConfig.cannibal.cannibal_ultimate;
            break;

          // Phantom
          case 'phantom_haunt_skill':
            state.variantState.freeHauntRemaining = 0;
            expectedCost = APCostConfig.phantom.phantom_skill_1;
            break;
          case 'phantom_possession_skill':
            expectedCost = APCostConfig.phantom.phantom_skill_2;
            break;
          case 'phantom_spirit_walk_skill':
            expectedCost = APCostConfig.phantom.phantom_ultimate;
            break;

          // Time
          case 'time_rewind':
            expectedCost = APCostConfig.time.time_skill_1;
            break;
          case 'time_prediction':
            expectedCost = APCostConfig.time.time_skill_2;
            break;
          case 'time_time_freeze':
            // Verify the escalations
            state.variantState.ultimateUseCount = 0;
            let cost0 = typeof skill.apCost === 'function' ? skill.apCost(state, player) : skill.apCost;
            expect(cost0).toBe(APCostConfig.time.time_ultimate[0]);

            state.variantState.ultimateUseCount = 1;
            let cost1 = typeof skill.apCost === 'function' ? skill.apCost(state, player) : skill.apCost;
            expect(cost1).toBe(APCostConfig.time.time_ultimate[1]);

            state.variantState.ultimateUseCount = 2;
            expectedCost = APCostConfig.time.time_ultimate[2];
            break;

          // Predator
          case 'predator_evolution_spore':
            expectedCost = APCostConfig.predator.predator_skill_1;
            break;
          case 'predator_shadow_prowl':
            expectedCost = APCostConfig.predator.predator_skill_2;
            break;
          case 'predator_apex_camouflage':
            expectedCost = APCostConfig.predator.predator_ultimate;
            break;

          // Verdant Dragon
          case 'verdant_dragon_verdant_shelter':
            expectedCost = APCostConfig.verdant_dragon.verdant_dragon_skill_1;
            break;
          case 'verdant_dragon_dragons_gaze':
            expectedCost = APCostConfig.verdant_dragon.verdant_dragon_skill_2;
            break;
          case 'verdant_dragon_ultimate':
            expectedCost = APCostConfig.verdant_dragon.verdant_dragon_ultimate;
            break;

          // Lord
          case 'lord_vanguard_command':
            expectedCost = APCostConfig.lord.lord_skill_1;
            break;
          case 'lord_reinforcements':
            expectedCost = APCostConfig.lord.lord_skill_2;
            break;
          case 'lord_iron_authority':
            expectedCost = APCostConfig.lord.lord_ultimate;
            break;

          // Ruler
          case 'ruler_law2':
            expectedCost = APCostConfig.ruler.ruler_skill_1;
            break;
          case 'ruler_law3':
            expectedCost = APCostConfig.ruler.ruler_skill_2;
            break;
          case 'ruler_close_field':
            expectedCost = APCostConfig.ruler.ruler_ultimate;
            break;

          // Dragon Sentinel
          case 'dragon_sentinel_subterranean_escape':
            expectedCost = APCostConfig.dragon_sentinel.dragon_sentinel_skill_1;
            break;
          case 'dragon_sentinel_shockwave':
            expectedCost = APCostConfig.dragon_sentinel.dragon_sentinel_skill_2;
            break;
          case 'dragon_sentinel_dragons_roar':
            expectedCost = APCostConfig.dragon_sentinel.dragon_sentinel_ultimate;
            break;

          // Turtle
          case 'turtle_transference':
            expectedCost = APCostConfig.turtle.turtle_skill_1;
            break;
          case 'turtle_aegis_blessing':
            expectedCost = APCostConfig.turtle.turtle_skill_2;
            break;
          case 'turtle_great_sanctuary':
            expectedCost = APCostConfig.turtle.turtle_ultimate;
            break;

          // Phoenix
          case 'phoenix_ashes':
            expectedCost = APCostConfig.phoenix.phoenix_skill_1;
            break;
          case 'phoenix_solar_flare':
            expectedCost = APCostConfig.phoenix.phoenix_skill_2;
            break;
          case 'phoenix_supernova':
            expectedCost = APCostConfig.phoenix.phoenix_ultimate;
            break;

          // Space
          case 'space_dimension_link':
            expectedCost = APCostConfig.space.space_skill_1;
            break;
          case 'space_spatial_shift':
            expectedCost = APCostConfig.space.space_skill_2;
            break;
          case 'space_cosmic_void':
            expectedCost = APCostConfig.space.space_ultimate;
            break;

          // Puppet
          case 'puppet_soul_binding':
            expectedCost = APCostConfig.puppet.puppet_skill_1;
            break;
          case 'puppet_strings':
            expectedCost = APCostConfig.puppet.puppet_skill_2;
            break;
          case 'puppet_master':
            expectedCost = APCostConfig.puppet.puppet_ultimate;
            break;
        }

        if (expectedCost !== undefined) {
          const actualCost = typeof skill.apCost === 'function' ? skill.apCost(state, player) : skill.apCost;
          expect(actualCost).toBe(expectedCost);
        }
      }
    }
  });
});
