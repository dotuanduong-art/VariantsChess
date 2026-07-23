/**
 * Tests: currentCost & opponentSkillCosts in serializeForPlayer()
 *
 * Mục tiêu: Xác nhận backend tính đúng `currentCost` cho từng ngưỡng/trạng thái
 * của Guardian, Wizard, Time, Zombie, Phantom, VerdantDragon, và trả đúng
 * `opponentSkillCosts` cho panel đối thủ — tránh regression khi công thức thay đổi.
 */

import { Match, Color, PieceType } from 'game-core';

describe('Dynamic AP Cost — currentCost & opponentSkillCosts', () => {

  // ─── Guardian ────────────────────────────────────────────────────────────

  describe('Guardian — Holy Shield (Skill 1)', () => {
    let match: Match;

    beforeEach(() => {
      match = new Match();
      match.setVariants('guardian', 'zombie');
      match.start();
    });

    it('GC-1: currentCost = 4 khi White chưa mất quân nào', () => {
      const state = match.getGameState();
      state.whiteAP = 10;
      const serialized = match.serializeForPlayer(Color.White);
      const entry = serialized.availableSkillTargets['guardian_shield'];
      expect(entry).toBeDefined();
      expect(entry.currentCost).toBe(4);
    });

    it('GC-2: currentCost = 2 sau khi White mất >= 8 quân', () => {
      const state = match.getGameState();
      // Simulate 8 lost pieces
      for (let i = 0; i < 8; i++) {
        state.graveyard.push({
          piece: { id: `w_dead_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] },
          position: { col: 0, row: i },
          turnDied: 1,
          killedBy: 'capture',
        });
      }
      state.whiteAP = 10;
      const serialized = match.serializeForPlayer(Color.White);
      expect(serialized.availableSkillTargets['guardian_shield'].currentCost).toBe(2);
    });

    it('GC-3: opponentSkillCosts trả đúng cost Guardian S1 theo graveyard của opponent', () => {
      const state = match.getGameState();
      // Switch turn to Black so White's opponent perspective is serialized for Black
      match.submitAction({ type: 'END_TURN', player: Color.White });
      state.blackAP = 10;
      // Add 8 White pieces to graveyard (White = opponent of Black here, but we want to test
      // that opponentSkillCosts for White's guardian skills are computed correctly from Black's perspective)
      // Guardian is White's variant — so Black serializes and sees opponentSkillCosts for guardian_shield
      for (let i = 0; i < 8; i++) {
        state.graveyard.push({
          piece: { id: `w_dead_osc_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] },
          position: { col: i, row: 0 },
          turnDied: 1,
          killedBy: 'capture',
        });
      }
      const serialized = match.serializeForPlayer(Color.Black);
      // opponentSkillCosts should contain guardian_shield = 2 (>= 8 pieces lost)
      expect(serialized.opponentSkillCosts['guardian_shield']).toBe(2);
    });

    it('GC-4: currentCost still 4 AP (insufficient AP) still returns currentCost = 4', () => {
      // Even when not affordable, currentCost should still reflect the formula output
      const state = match.getGameState();
      state.whiteAP = 1; // Not enough to cast skill
      const serialized = match.serializeForPlayer(Color.White);
      // Entry still exists but validPositions should be empty
      const entry = serialized.availableSkillTargets['guardian_shield'];
      expect(entry).toBeDefined();
      expect(entry.currentCost).toBe(4); // Cost computed correctly regardless of affordability
      expect(entry.validPositions[0]).toHaveLength(0); // But no valid targets since can't afford
    });
  });

  // ─── Wizard ──────────────────────────────────────────────────────────────

  describe('Wizard — Escalating costs (Skill 1 / Skill 2)', () => {
    let match: Match;

    beforeEach(() => {
      match = new Match();
      match.setVariants('wizard', 'guardian');
      match.start();
    });

    it('WC-1: Skill 1 currentCost = 5 at useCount 0', () => {
      const state = match.getGameState();
      state.whiteAP = 15;
      state.variantState['wizardSkillUseCount_white'] = 0;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['wizard_arcane_swap'].currentCost).toBe(5);
    });

    it('WC-2: Skill 1 currentCost escalates to 7 at useCount 2', () => {
      const state = match.getGameState();
      state.whiteAP = 15;
      state.variantState['wizardSkillUseCount_white'] = 2;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['wizard_arcane_swap'].currentCost).toBe(7);
    });

    it('WC-3: Skill 2 currentCost = 4 at useCount 0', () => {
      const state = match.getGameState();
      state.whiteAP = 15;
      state.variantState['wizardSkillUseCount_white'] = 0;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['wizard_arcane_bind'].currentCost).toBe(4);
    });

    it('WC-4: Skill 2 currentCost = 6 at useCount 2', () => {
      const state = match.getGameState();
      state.whiteAP = 15;
      state.variantState['wizardSkillUseCount_white'] = 2;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['wizard_arcane_bind'].currentCost).toBe(6);
    });

    it('WC-5: opponentSkillCosts reflects enemy Wizard escalation', () => {
      const state = match.getGameState();
      // Simulate Black's perspective — White is opponent (Wizard)
      match.submitAction({ type: 'END_TURN', player: Color.White });
      state.blackAP = 10;
      state.variantState['wizardSkillUseCount_white'] = 4; // White wizard used 4 times
      const s = match.serializeForPlayer(Color.Black);
      // S1: 5 + floor(4/2)*2 = 5 + 4 = 9
      expect(s.opponentSkillCosts['wizard_arcane_swap']).toBe(9);
    });
  });

  // ─── Time ────────────────────────────────────────────────────────────────

  describe('Time — Ultimate escalation (Grand Rewind / Time Freeze)', () => {
    let match: Match;

    beforeEach(() => {
      match = new Match();
      match.setVariants('time', 'guardian');
      match.start();
    });

    it('TC-1: Ultimate currentCost = 6 at first use (ultimateUseCount = 0)', () => {
      const state = match.getGameState();
      state.whiteAP = 20;
      state.variantState['ultimateUseCount'] = 0;
      const s = match.serializeForPlayer(Color.White);
      // Both ultimate options have the same cost
      const grandRewind = s.availableSkillTargets['time_grand_rewind'];
      const timeFreeze = s.availableSkillTargets['time_time_freeze'];
      expect(grandRewind?.currentCost).toBe(6);
      expect(timeFreeze?.currentCost).toBe(6);
    });

    it('TC-2: Ultimate currentCost = 9 at second use (ultimateUseCount = 1)', () => {
      const state = match.getGameState();
      state.whiteAP = 20;
      state.variantState['ultimateUseCount'] = 1;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['time_grand_rewind']?.currentCost).toBe(9);
      expect(s.availableSkillTargets['time_time_freeze']?.currentCost).toBe(9);
    });

    it('TC-3: Ultimate currentCost = 15 at third+ use (ultimateUseCount >= 2)', () => {
      const state = match.getGameState();
      state.whiteAP = 20;
      state.variantState['ultimateUseCount'] = 2;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['time_grand_rewind']?.currentCost).toBe(15);
    });
  });

  // ─── Zombie ──────────────────────────────────────────────────────────────

  describe('Zombie — Infection free charges (Skill 1)', () => {
    let match: Match;

    beforeEach(() => {
      match = new Match();
      match.setVariants('zombie', 'guardian');
      match.start();
    });

    it('ZC-1: currentCost = 0 when freeInfectionRemaining = 3 (initial)', () => {
      const state = match.getGameState();
      state.whiteAP = 10;
      // Initial state has freeInfectionRemaining = 3
      expect(state.variantState.freeInfectionRemaining).toBe(3);
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['zombie_infection'].currentCost).toBe(0);
    });

    it('ZC-2: currentCost = 0 when freeInfectionRemaining = 1', () => {
      const state = match.getGameState();
      state.whiteAP = 10;
      state.variantState.freeInfectionRemaining = 1;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['zombie_infection'].currentCost).toBe(0);
    });

    it('ZC-3: currentCost = 5 when freeInfectionRemaining = 0', () => {
      const state = match.getGameState();
      state.whiteAP = 10;
      state.variantState.freeInfectionRemaining = 0;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['zombie_infection'].currentCost).toBe(5);
    });
  });

  // ─── Phantom ─────────────────────────────────────────────────────────────

  describe('Phantom — Haunt free charges (Skill 1)', () => {
    let match: Match;

    beforeEach(() => {
      match = new Match();
      match.setVariants('phantom', 'guardian');
      match.start();
    });

    it('PC-1: currentCost = 0 when White_freeSkill1Remaining > 0', () => {
      const state = match.getGameState();
      state.whiteAP = 10;
      // Set free charge available
      state.variantState[`${Color.White}_freeSkill1Remaining`] = 2;
      const s = match.serializeForPlayer(Color.White);
      const entry = s.availableSkillTargets['phantom_haunt_skill'];
      expect(entry).toBeDefined();
      expect(entry.currentCost).toBe(0);
    });

    it('PC-2: currentCost = 3 when White_freeSkill1Remaining = 0', () => {
      const state = match.getGameState();
      state.whiteAP = 10;
      state.variantState[`${Color.White}_freeSkill1Remaining`] = 0;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['phantom_haunt_skill'].currentCost).toBe(3);
    });

    it('PC-3: opponentSkillCosts reflects Phantom Haunt cost correctly', () => {
      const state = match.getGameState();
      match.submitAction({ type: 'END_TURN', player: Color.White });
      state.blackAP = 10;
      // White is Phantom opponent (from Black's POV): White still has 0 free charges
      state.variantState[`${Color.White}_freeSkill1Remaining`] = 0;
      const s = match.serializeForPlayer(Color.Black);
      expect(s.opponentSkillCosts['phantom_haunt_skill']).toBe(3);
    });
  });

  // ─── VerdantDragon ───────────────────────────────────────────────────────

  describe('VerdantDragon — Emerald Domain / Dragon\'s Wrath (Ultimate)', () => {
    let match: Match;

    beforeEach(() => {
      match = new Match();
      match.setVariants('verdant_dragon', 'guardian');
      match.start();
    });

    it('VD-1: currentCost = 9 when dragonCounter < 100', () => {
      const state = match.getGameState();
      state.whiteAP = 15;
      state.variantState.dragonCounter = 50;
      const s = match.serializeForPlayer(Color.White);
      const entry = s.availableSkillTargets['verdant_dragon_ultimate'];
      expect(entry).toBeDefined();
      expect(entry.currentCost).toBe(9);
    });

    it('VD-2: currentCost = 0 when dragonCounter >= 100 (Dragon\'s Wrath mode)', () => {
      const state = match.getGameState();
      state.whiteAP = 15;
      state.variantState.dragonCounter = 100;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['verdant_dragon_ultimate'].currentCost).toBe(0);
    });

    it('VD-3: opponentSkillCosts shows 0 when opponent Dragon reaches 100', () => {
      const state = match.getGameState();
      match.submitAction({ type: 'END_TURN', player: Color.White });
      state.blackAP = 10;
      state.variantState.dragonCounter = 100; // White VerdantDragon at full counter
      const s = match.serializeForPlayer(Color.Black);
      expect(s.opponentSkillCosts['verdant_dragon_ultimate']).toBe(0);
    });

    it('VD-4: currentCost correctly reflects boundary at exactly 99 (not yet Dragon\'s Wrath)', () => {
      const state = match.getGameState();
      state.whiteAP = 15;
      state.variantState.dragonCounter = 99;
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['verdant_dragon_ultimate'].currentCost).toBe(9);
    });
  });

  // ─── Cross-cutting: emerald_domain +1 ────────────────────────────────────

  describe('emerald_domain +1 cost effect on currentCost', () => {
    it('ED-1: Guardian S1 currentCost = 5 (4+1) when player has emerald_domain', () => {
      const match = new Match();
      match.setVariants('guardian', 'verdant_dragon');
      match.start();
      const state = match.getGameState();
      state.whiteAP = 10;
      // Apply emerald_domain effect to White player
      state.getPlayerEffects(Color.White).push({
        id: 'emerald_test',
        type: 'emerald_domain' as any,
        duration: 3,
        remainingDuration: 3,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.Black,
        targetType: 'player',
        targetId: Color.White,
        stackingRule: 'ignore',
        isDebuff: true,
        isHidden: false,
        metadata: {},
      });
      const s = match.serializeForPlayer(Color.White);
      expect(s.availableSkillTargets['guardian_shield'].currentCost).toBe(5); // 4+1
    });
  });

});
