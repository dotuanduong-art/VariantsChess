import {
  Match,
  Color,
  Position,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  LordVariant,
} from 'game-core';

describe('Chess Variant Engine - Lord Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // Helper to clear the board except for Kings
  function clearBoardExceptKings(board: Board) {
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const piece = board.getPiece({ col: c, row: r });
        if (piece && piece.type !== PieceType.King) {
          board.removePiece({ col: c, row: r });
        }
      }
    }
  }

  // ==========================================
  // Passive - Overwhelm (V1, V2)
  // ==========================================

  it('V1: Passive triggers on round 5 end with a piece difference of 3 and awards exactly 3 AP', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // Setup 10 White pieces vs 7 Black pieces (including Kings)
    for (let i = 0; i < 9; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_p_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
    }
    for (let i = 0; i < 6; i++) {
      state.board.setPiece({ col: i, row: 13 }, { id: `b_p_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 0;
    state.turnNumber = 5;
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = true;

    // End Black's turn (Round 5 ends)
    match.submitAction({
      type: 'END_TURN',
      player: Color.Black,
    });

    // 10 vs 7 -> diff = 3 -> White (Lord) should get 3 AP
    expect(state.whiteAP).toBe(3);
  });

  it('V2: Passive AP difference works regardless of who has more pieces', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // Setup 6 White pieces vs 9 Black pieces (including Kings)
    for (let i = 0; i < 5; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_p_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
    }
    for (let i = 0; i < 8; i++) {
      state.board.setPiece({ col: i, row: 13 }, { id: `b_p_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 0;
    state.turnNumber = 5;
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = true;

    // End Black's turn (Round 5 ends)
    match.submitAction({
      type: 'END_TURN',
      player: Color.Black,
    });

    // 6 vs 9 -> diff = 3 -> White (Lord) should get 3 AP
    expect(state.whiteAP).toBe(3);
  });

  // ==========================================
  // Skill 1 - Vanguard Command (V3, V4, V5, V18, V19)
  // ==========================================

  it('V3: Skill 1 destroys first piece in front if it is a Pawn', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // Ally piece (Rook) at D4, Enemy Pawn at D5
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const pawn = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 3, row: 3 }, rook);
    state.board.setPiece({ col: 3, row: 4 }, pawn);

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_vanguard_command', [
      { type: 'piece', position: { col: 3, row: 3 }, pieceId: 'w_rook' },
    ]);

    expect(res.success).toBe(true);
    expect(state.board.getPiece({ col: 3, row: 4 })).toBeNull(); // destroyed
  });

  it('V4: Skill 1 does not destroy Queen if King stands in front of Queen', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // Ally at D4, King at D5, Queen at D6
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const king = { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] };
    const queen = { id: 'b_queen', type: PieceType.Queen, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 3, row: 3 }, rook);
    state.board.setPiece({ col: 3, row: 4 }, king);
    state.board.setPiece({ col: 3, row: 5 }, queen);

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_vanguard_command', [
      { type: 'piece', position: { col: 3, row: 3 }, pieceId: 'w_rook' },
    ]);

    expect(res.success).toBe(false);
    expect(state.board.getPiece({ col: 3, row: 5 })).not.toBeNull(); // Queen survives
  });

  it('V5: Skill 1 cannot be cast if no enemy exists in the 3 squares in front', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const allyPawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 3, row: 3 }, rook);
    state.board.setPiece({ col: 3, row: 4 }, allyPawn); // ally in front, no enemies at all

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_vanguard_command', [
      { type: 'piece', position: { col: 3, row: 3 }, pieceId: 'w_rook' },
    ]);

    expect(res.success).toBe(false);
  });

  it('V18: Skill 1: Ally blocking Enemy path (Ally is destroyed, cast is valid)', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // A (D4) -> Ally B (D5) -> Enemy C (D6)
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const allyPawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    const enemyPawn = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };

    state.board.setPiece({ col: 3, row: 3 }, rook);
    state.board.setPiece({ col: 3, row: 4 }, allyPawn);
    state.board.setPiece({ col: 3, row: 5 }, enemyPawn);

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_vanguard_command', [
      { type: 'piece', position: { col: 3, row: 3 }, pieceId: 'w_rook' },
    ]);

    expect(res.success).toBe(true);
    expect(state.board.getPiece({ col: 3, row: 4 })).toBeNull(); // Ally B is destroyed!
    expect(state.board.getPiece({ col: 3, row: 5 })).not.toBeNull(); // Enemy C survives
  });

  it('V19: Skill 1: King blocking Enemy path (first piece met is King -> invalid cast)', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // A (D4) -> Enemy King (D5) -> Enemy C (D6)
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const enemyKing = { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] };
    const enemyPawn = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };

    state.board.setPiece({ col: 3, row: 3 }, rook);
    state.board.setPiece({ col: 3, row: 4 }, enemyKing);
    state.board.setPiece({ col: 3, row: 5 }, enemyPawn);

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_vanguard_command', [
      { type: 'piece', position: { col: 3, row: 3 }, pieceId: 'w_rook' },
    ]);

    expect(res.success).toBe(false);
  });

  // ==========================================
  // Skill 2 - Reinforcements (V6, V7, V8, V9, V10, V11, V20)
  // ==========================================

  it('V6: Skill 2 summons exactly 2 Pawns when 2 empty squares are selected', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Clear board first
    clearBoardExceptKings(state.board);

    const res = match.useSkill(Color.White, 'lord_reinforcements', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 1, row: 2 } },
    ]);

    expect(res.success).toBe(true);
    const p1 = state.board.getPiece({ col: 0, row: 2 });
    const p2 = state.board.getPiece({ col: 1, row: 2 });
    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    expect(p1!.type).toBe(PieceType.Pawn);
    expect(p2!.type).toBe(PieceType.Pawn);

    // Verify 'no_promotion' effect is present
    expect(p1!.effects.some(e => e.type === 'no_promotion')).toBe(true);
  });

  it('V7: Skill 2 summons exactly 1 Pawn if only 1 empty square exists in the player\'s half', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // Fill all White half (rows 0-6) except for col 0, row 2
    for (let r = 0; r <= 6; r++) {
      for (let c = 0; c < 15; c++) {
        if (r === 2 && c === 0) continue; // leave empty
        state.board.setPiece({ col: c, row: r }, { id: `block_${c}_${r}`, type: PieceType.Pawn, color: Color.White, effects: [] });
      }
    }

    const requirements = match.serializeForPlayer(Color.White).availableSkillTargets['lord_reinforcements'].requirements;
    expect(requirements.length).toBe(1); // Should only ask for 1 target

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_reinforcements', [
      { type: 'cell', position: { col: 0, row: 2 } },
    ]);

    expect(res.success).toBe(true);
    expect(state.board.getPiece({ col: 0, row: 2 })).not.toBeNull();
  });

  it('V8: Skill 2 Pawn duration is set to 3 rounds if ours >= enemy piece count', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // 8 White pieces vs 8 Black pieces
    for (let i = 0; i < 7; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
      state.board.setPiece({ col: i, row: 13 }, { id: `b_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'lord_reinforcements', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 1, row: 2 } },
    ]);

    const p = state.board.getPiece({ col: 0, row: 2 })!;
    const durationEffect = p.effects.find(e => e.type === 'summon_duration');
    expect(durationEffect).toBeDefined();
    expect(durationEffect!.remainingDuration).toBe(3);
  });

  it('V9: Skill 2 Pawn duration is set to 5 rounds if ours is fewer by 1 to 3 pieces', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // 6 White vs 8 Black
    for (let i = 0; i < 5; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
    }
    for (let i = 0; i < 7; i++) {
      state.board.setPiece({ col: i, row: 13 }, { id: `b_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'lord_reinforcements', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 1, row: 2 } },
    ]);

    const p = state.board.getPiece({ col: 0, row: 2 })!;
    const durationEffect = p.effects.find(e => e.type === 'summon_duration');
    expect(durationEffect).toBeDefined();
    expect(durationEffect!.remainingDuration).toBe(5);
  });

  it('V10: Skill 2 Pawn duration is permanent if ours is fewer by > 3 pieces', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // 4 White vs 8 Black
    for (let i = 0; i < 3; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
    }
    for (let i = 0; i < 7; i++) {
      state.board.setPiece({ col: i, row: 13 }, { id: `b_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'lord_reinforcements', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 1, row: 2 } },
    ]);

    const p = state.board.getPiece({ col: 0, row: 2 })!;
    const durationEffect = p.effects.find(e => e.type === 'summon_duration');
    expect(durationEffect).toBeUndefined(); // permanent -> no summon_duration effect
  });

  it('V20: Skill 2: Permanent summon applies no summon_duration effect and persists indefinitely', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // 4 White vs 9 Black
    for (let i = 0; i < 3; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
    }
    for (let i = 0; i < 8; i++) {
      state.board.setPiece({ col: i, row: 13 }, { id: `b_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_reinforcements', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 1, row: 2 } },
    ]);
    expect(res.success).toBe(true);

    const pos = { col: 0, row: 2 };
    expect(state.board.getPiece(pos)).not.toBeNull();
    expect(state.board.getPiece(pos)!.effects.some(e => e.type === 'summon_duration')).toBe(false);

    // Step through turns
    for (let round = 1; round <= 10; round++) {
      match.submitAction({ type: 'END_TURN', player: Color.White });
      match.submitAction({ type: 'END_TURN', player: Color.Black });
    }

    // Still exists
    expect(state.board.getPiece(pos)).not.toBeNull();
  });

  it('V11: Skill 2 Pawn transformed to Queen still vanishes when original timer expires', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_reinforcements', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 1, row: 2 } },
    ]);
    expect(res.success).toBe(true);

    const pos = { col: 0, row: 2 };
    const p = state.board.getPiece(pos)!;
    expect(p.effects.some(e => e.type === 'summon_duration')).toBe(true);

    // Transform Pawn to Queen in-place
    match.submitAction({
      type: 'TRANSFORM_PIECE',
      pieceId: p.id,
      position: pos,
      newType: PieceType.Queen,
    });

    // Check type changed but effects intact
    const queen = state.board.getPiece(pos)!;
    expect(queen.type).toBe(PieceType.Queen);
    expect(queen.effects.some(e => e.type === 'summon_duration')).toBe(true);

    // Step 4 rounds (end turns 4 times each)
    // Round 1
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    // Round 2
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    // Round 3
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    // Round 4
    match.submitAction({ type: 'END_TURN', player: Color.White }); // Ticks down to 0 and enqueues destroy

    expect(state.board.getPiece(pos)).toBeNull(); // Queen disappeared!
  });

  // ==========================================
  // Ultimate - Iron Authority (V12, V13, V14, V21)
  // ==========================================

  it('V12: Ultimate silences opponent for 3 rounds when ours <= enemy pieces', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // 5 White vs 5 Black
    for (let i = 0; i < 4; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
      state.board.setPiece({ col: i, row: 13 }, { id: `b_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 9;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_iron_authority', []);
    expect(res.success).toBe(true);

    const blackEffects = state.getPlayerEffects(Color.Black);
    const silence = blackEffects.find(e => e.type === 'silence')!;
    expect(silence).toBeDefined();
    expect(silence.remainingDuration).toBe(3);
    expect(silence.metadata.blockUltimate).toBe(false); // Can still cast ultimate
  });

  it('V13: Ultimate silences opponent for 5 rounds when ours > enemy pieces', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // 6 White vs 5 Black
    for (let i = 0; i < 5; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
    }
    for (let i = 0; i < 4; i++) {
      state.board.setPiece({ col: i, row: 13 }, { id: `b_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 9;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'lord_iron_authority', []);
    expect(res.success).toBe(true);

    const blackEffects = state.getPlayerEffects(Color.Black);
    const silence = blackEffects.find(e => e.type === 'silence')!;
    expect(silence).toBeDefined();
    expect(silence.remainingDuration).toBe(5);
  });

  it('V14: Ultimate re-cast refreshes the silence duration instead of stacking', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // Apply manual silence on Black with remainingDuration 2
    const silence: Effect = {
      id: 'existing_silence',
      type: 'silence',
      duration: 3,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'player',
      targetId: Color.Black,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: { blockUltimate: false },
    };
    state.addPlayerEffect(Color.Black, silence);

    // Ours > enemy -> cast Ultimate again -> should refresh to 5
    for (let i = 0; i < 5; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
    }
    for (let i = 0; i < 4; i++) {
      state.board.setPiece({ col: i, row: 13 }, { id: `b_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 9;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'lord_iron_authority', []);

    const blackEffects = state.getPlayerEffects(Color.Black);
    const activeSilence = blackEffects.find(e => e.type === 'silence')!;
    expect(activeSilence.remainingDuration).toBe(5); // Refreshed to 5
  });

  it('V21: Ultimate: Refreshing silence on a target currently silenced updates remainingDuration to new value', () => {
    match.setVariants('lord', 'lightning');
    match.start();

    const state = match.getGameState();
    clearBoardExceptKings(state.board);

    // Silence starts with 2
    const silence: Effect = {
      id: 'existing_silence',
      type: 'silence',
      duration: 3,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'player',
      targetId: Color.Black,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: { blockUltimate: false },
    };
    state.addPlayerEffect(Color.Black, silence);

    // Ours <= enemy -> cast Ultimate again -> should refresh to 3 (instead of 2 + 3 = 5)
    for (let i = 0; i < 4; i++) {
      state.board.setPiece({ col: i, row: 1 }, { id: `w_${i}`, type: PieceType.Pawn, color: Color.White, effects: [] });
      state.board.setPiece({ col: i, row: 13 }, { id: `b_${i}`, type: PieceType.Pawn, color: Color.Black, effects: [] });
    }

    state.whiteAP = 9;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'lord_iron_authority', []);

    const blackEffects = state.getPlayerEffects(Color.Black);
    const activeSilence = blackEffects.find(e => e.type === 'silence')!;
    expect(activeSilence.remainingDuration).toBe(3); // Refreshed to exactly 3, not stacked
  });

  // ==========================================
  // Regressions (V15, V16, V17)
  // ==========================================

  it('V15: Regression: Nephalem variant works correctly, and its silence blocks everything by default', () => {
    // Setup Nephalem vs Lord
    match.setVariants('nephalem', 'lord');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 8;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Nephalem casts silence on Lord (Black)
    match.useSkill(Color.White, 'nephalem_divine_silence', []);

    // End White's turn -> Black turn starts
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Lord (Black) tries to use Ultimate 'lord_iron_authority'
    state.blackAP = 9;
    const res = match.useSkill(Color.Black, 'lord_iron_authority', []);
    
    // Silence should block this because blockUltimate is not false (defaults to true)
    expect(res.success).toBe(false);
  });

  it('V16: Regression: Cherubim / other variants\' summoned pieces are unaffected', () => {
    match.setVariants('cherubim', 'lord');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Spawn Cherubim Totem
    match.useSkill(Color.White, 'cherubim_fountain_of_youth', [
      { type: 'cell', position: { col: 5, row: 5 } },
    ]);

    const totem = state.board.getPiece({ col: 5, row: 5 })!;
    expect(totem).not.toBeNull();
    expect(totem.effects.some(e => e.type === 'totem_timer')).toBe(true);

    // End turns
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Verify Cherubim totem is still on board (totem_timer is not summon_duration)
    expect(state.board.getPiece({ col: 5, row: 5 })).not.toBeNull();
  });

  it('V17: Regression: piece transform variants are unaffected', () => {
    match.setVariants('magician', 'lord');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 7;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Setup 2 enemy pawns to swap movements (Misdirection)
    const p1 = state.board.getPiece({ col: 1, row: 13 })!;
    const p2 = state.board.getPiece({ col: 2, row: 13 })!;

    const res = match.useSkill(Color.White, 'magician_swap_movements', [
      { type: 'piece', position: { col: 1, row: 13 }, pieceId: p1.id },
      { type: 'piece', position: { col: 2, row: 13 }, pieceId: p2.id },
    ]);

    expect(res.success).toBe(true);

    // Step turns
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Verify pawns still exist
    expect(state.board.getPiece({ col: 1, row: 13 })).not.toBeNull();
    expect(state.board.getPiece({ col: 2, row: 13 })).not.toBeNull();
  });
});
