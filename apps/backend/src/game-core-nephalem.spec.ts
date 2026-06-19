import {
  Match,
  Color,
  Position,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  NephalemVariant,
} from 'game-core';

describe('Chess Variant Engine - Nephalem Variant & Engine Upgrades', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // ==========================================
  // Part 1: Engine Upgrade Tests (U1-U6)
  // ==========================================

  it('U1: APPLY_EFFECT targetType="player" -> effect appears in getPlayerEffects', () => {
    const state = match.getGameState();
    const effect: Effect = {
      id: 'silence_white_test',
      type: 'silence',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };

    match.submitAction({
      type: 'APPLY_EFFECT',
      effect,
    });

    const whiteEffects = state.getPlayerEffects(Color.White);
    expect(whiteEffects.some(e => e.id === 'silence_white_test')).toBe(true);
  });

  it('U2: Player effect tick duration is correct on END_TURN', () => {
    const state = match.getGameState();
    state.status = 'playing';
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = true;
    state.skillsUsedThisTurn = 1;

    const effectW: Effect = {
      id: 'effect_w',
      type: 'silence',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };

    const effectB: Effect = {
      id: 'effect_b',
      type: 'silence',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'player',
      targetId: Color.Black,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };

    state.addPlayerEffect(Color.White, effectW);
    state.addPlayerEffect(Color.Black, effectB);

    // End turn of White
    match.submitAction({
      type: 'END_TURN',
      player: Color.White,
    });

    // White effect should decrement, Black should not
    expect(effectW.remainingDuration).toBe(2);
    expect(effectB.remainingDuration).toBe(3);
  });

  it('U3: Player effect expires when remainingDuration is 0', () => {
    const state = match.getGameState();
    state.status = 'playing';
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = true;
    state.skillsUsedThisTurn = 1;

    const effect: Effect = {
      id: 'expiring_effect',
      type: 'silence',
      duration: 1,
      remainingDuration: 1,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };

    state.addPlayerEffect(Color.White, effect);

    // End White's turn -> should tick down to 0 and remove
    match.submitAction({
      type: 'END_TURN',
      player: Color.White,
    });

    const whiteEffects = state.getPlayerEffects(Color.White);
    expect(whiteEffects.some(e => e.id === 'expiring_effect')).toBe(false);
  });

  it('U4: USE_SKILL is rejected when player has silence effect', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const effect: Effect = {
      id: 'silence_white',
      type: 'silence',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    state.addPlayerEffect(Color.White, effect);

    const res = match.useSkill(Color.White, 'nephalem_judgment_chains', [
      { type: 'piece', position: { col: 3, row: 8 }, pieceId: 'b_pawn_d7' },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('silenced');
  });

  it('U5: USE_SKILL succeeds when player does not have silence effect', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Place an enemy piece at D8 to target
    state.board = new Board();
    const enemyPiece = { id: 'target_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 3, row: 7 }, enemyPiece);

    const res = match.useSkill(Color.White, 'nephalem_judgment_chains', [
      { type: 'piece', position: { col: 3, row: 7 }, pieceId: 'target_pawn' },
    ]);

    expect(res.success).toBe(true);
  });

  it('U6: serializeForPlayer includes playerEffects for both sides', () => {
    const state = match.getGameState();
    const effectW: Effect = {
      id: 'eff_w',
      type: 'silence',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    state.addPlayerEffect(Color.White, effectW);

    const serialized = state.serializeForPlayer(Color.Black);
    expect(serialized.whitePlayerEffects).toBeDefined();
    expect(serialized.whitePlayerEffects.length).toBe(1);
    expect(serialized.whitePlayerEffects[0].id).toBe('eff_w');
  });

  // ==========================================
  // Part 2: Nephalem Variant Tests (N1-N14)
  // ==========================================

  it('N1: Passive — 3 ally pieces in graveyard -> +4 AP', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;

    // Simulate 3 White (ally) deaths
    for (let i = 0; i < 3; i++) {
      const pos = { col: i, row: 1 };
      const piece = state.board.getPiece(pos);
      expect(piece).not.toBeNull();
      match.submitAction({
        type: 'DESTROY_PIECE',
        pieceId: piece!.id,
        position: pos,
        reason: 'skill',
      });
    }

    expect(state.whiteAP).toBe(4);
  });

  it('N2: Passive — 6 ally pieces in graveyard -> +8 AP total', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;

    // Simulate 6 White deaths
    for (let i = 0; i < 6; i++) {
      const pos = { col: i % 15, row: Math.floor(i / 15) + 1 };
      const piece = state.board.getPiece(pos);
      if (piece && piece.color === Color.White) {
        match.submitAction({
          type: 'DESTROY_PIECE',
          pieceId: piece.id,
          position: pos,
          reason: 'skill',
        });
      }
    }

    expect(state.whiteAP).toBe(8);
  });

  it('N3: Passive — enemy deaths do not trigger AP reward', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;

    // Simulate 3 Black (enemy) deaths
    for (let i = 0; i < 3; i++) {
      const pos = { col: i, row: 13 }; // Black pieces row
      const piece = state.board.getPiece(pos);
      expect(piece).not.toBeNull();
      match.submitAction({
        type: 'DESTROY_PIECE',
        pieceId: piece!.id,
        position: pos,
        reason: 'skill',
      });
    }

    expect(state.whiteAP).toBe(0);
  });

  it('N4: Passive — all killedBy types count (capture, effect, skill)', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;

    // Death 1: Skill/Effect (DESTROY_PIECE)
    const p1 = state.board.getPiece({ col: 0, row: 1 })!;
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: p1.id,
      position: { col: 0, row: 1 },
      reason: 'skill',
    });

    // Death 2: Capture (Standard move capture by opponent)
    // Setup a piece to be captured
    state.board.setPiece({ col: 4, row: 4 }, { id: 'w_sacrificial', type: PieceType.Pawn, color: Color.White, effects: [] });
    state.board.setPiece({ col: 4, row: 5 }, { id: 'b_attacker', type: PieceType.Rook, color: Color.Black, effects: [] });
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    match.makeMove(Color.Black, { col: 4, row: 5 }, { col: 4, row: 4 });

    // Reset White AP to 0 to discard the capture loss reward AP and isolate passive reward
    state.whiteAP = 0;

    // Death 3: Another DESTROY_PIECE
    const p3 = state.board.getPiece({ col: 1, row: 1 })!;
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: p3.id,
      position: { col: 1, row: 1 },
      reason: 'skill',
    });

    expect(state.whiteAP).toBe(4);
  });

  it('N5: Skill 1 — Judgment Chains stuns enemy piece for 2 rounds (2 turns)', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const targetPos = { col: 3, row: 13 }; // Black pawn
    const piece = state.board.getPiece(targetPos)!;

    const res = match.useSkill(Color.White, 'nephalem_judgment_chains', [
      { type: 'piece', position: targetPos, pieceId: piece.id },
    ]);

    expect(res.success).toBe(true);
    expect(piece.effects.length).toBe(1);
    expect(piece.effects[0].type).toBe('stun');
    expect(piece.effects[0].remainingDuration).toBe(2);
  });

  it('N6: Skill 1 — Judgment Chains rejects King selection', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Find Black King
    let kingPos = { col: -1, row: -1 };
    let kingId = '';
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.Black) {
          kingPos = { col: c, row: r };
          kingId = p.id;
          break;
        }
      }
    }

    const res = match.useSkill(Color.White, 'nephalem_judgment_chains', [
      { type: 'piece', position: kingPos, pieceId: kingId },
    ]);

    expect(res.success).toBe(false);
  });

  it('N7: Skill 2 — applies Berserk to enemy piece', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const targetPos = { col: 4, row: 13 }; // Black pawn
    const piece = state.board.getPiece(targetPos)!;

    const res = match.useSkill(Color.White, 'nephalem_berserk_curse', [
      { type: 'piece', position: targetPos, pieceId: piece.id },
    ]);

    expect(res.success).toBe(true);
    const berserk = piece.effects.find(e => e.type === 'berserk');
    expect(berserk).toBeDefined();
    expect(berserk!.metadata.captureCountdown).toBe(4);
    expect(berserk!.metadata.capturedThisWindow).toBe(false);
  });

  it('N8: Skill 2 — Berserk: no capture for 4 turns -> gets Stun 6 turns, Berserk removed', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const targetPos = { col: 4, row: 13 };
    const piece = state.board.getPiece(targetPos)!;

    // Apply Berserk
    match.useSkill(Color.White, 'nephalem_berserk_curse', [
      { type: 'piece', position: targetPos, pieceId: piece.id },
    ]);

    // White ends turn -> Black Turn 1 starts (countdown: 4 -> 4 due to isFirstTurnStart)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black ends turn -> White Turn 2 starts
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White ends turn -> Black Turn 2 starts (countdown: 4 -> 3)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black ends turn -> White Turn 3 starts
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White ends turn -> Black Turn 3 starts (countdown: 3 -> 2)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black ends turn -> White Turn 4 starts
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White ends turn -> Black Turn 4 starts (countdown: 2 -> 1)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black ends turn -> White Turn 5 starts
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White ends turn -> Black Turn 5 starts (countdown: 1 -> 0 -> triggers Stun 6, removes Berserk)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Let's check effects on the piece
    const stun = piece.effects.find(e => e.type === 'stun');
    const berserk = piece.effects.find(e => e.type === 'berserk');

    expect(stun).toBeDefined();
    expect(stun!.remainingDuration).toBe(6);
    expect(berserk).toBeUndefined();
  });

  it('N9: Skill 2 — Berserk: captures in window -> Berserk is removed', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const targetPos = { col: 4, row: 13 };
    const piece = state.board.getPiece(targetPos)!;

    // Apply Berserk
    match.useSkill(Color.White, 'nephalem_berserk_curse', [
      { type: 'piece', position: targetPos, pieceId: piece.id },
    ]);

    // White ends turn -> Black Turn 1 starts (countdown: 4 -> 4)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black piece makes a capture!
    state.board.setPiece({ col: 4, row: 8 }, piece);
    state.board.removePiece(targetPos);
    const victim = { id: 'w_victim', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 5, row: 7 }, victim);

    // Make capture move
    const captureRes = match.makeMove(Color.Black, { col: 4, row: 8 }, { col: 5, row: 7 });
    expect(captureRes.success).toBe(true);

    const berserk = piece.effects.find(e => e.type === 'berserk');
    expect(berserk).toBeUndefined();
  });

  it('N10: Skill 2 — Berserk + Stun interaction: stun ends -> countdown ends -> stuns again', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 9; // 4 + 5 for skill 2 and skill 1
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const targetPos = { col: 4, row: 13 };
    const piece = state.board.getPiece(targetPos)!;

    // Apply Berserk
    match.useSkill(Color.White, 'nephalem_berserk_curse', [
      { type: 'piece', position: targetPos, pieceId: piece.id },
    ]);

    // Apply Stun (2 turns remaining duration)
    const stunEffect: Effect = {
      id: 'manual_stun',
      type: 'stun',
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: piece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    piece.effects.push(stunEffect);

    // White ends turn -> Black Turn 1 starts (countdown 4 -> 4)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    
    // Black ends turn -> White Turn 2 starts (manual_stun remainingDuration 2 -> 1)
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White ends turn -> Black Turn 2 starts (countdown 4 -> 3)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black ends turn -> White Turn 3 starts (manual_stun remainingDuration 1 -> 0 -> removed)
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Verify stun is removed, but Berserk is still there with countdown 3
    expect(piece.effects.some(e => e.type === 'stun')).toBe(false);
    const berserk1 = piece.effects.find(e => e.type === 'berserk')!;
    expect(berserk1).toBeDefined();
    expect(berserk1.metadata.captureCountdown).toBe(3);

    // White ends turn -> Black Turn 3 starts (countdown: 3 -> 2)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(berserk1.metadata.captureCountdown).toBe(2);

    // Black ends turn -> White Turn 4 starts
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White ends turn -> Black Turn 4 starts (countdown: 2 -> 1)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(berserk1.metadata.captureCountdown).toBe(1);

    // Black ends turn -> White Turn 5 starts
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White ends turn -> Black Turn 5 starts (countdown: 1 -> 0 -> triggers Stun 6, removes Berserk)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    expect(piece.effects.some(e => e.type === 'stun')).toBe(true);
    expect(piece.effects.find(e => e.type === 'stun')!.remainingDuration).toBe(6);
    expect(piece.effects.some(e => e.type === 'berserk')).toBe(false);
  });

  it('N11: Ultimate — opponent receives Silence for 3 rounds (3 turns)', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 8;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'nephalem_divine_silence', []);
    expect(res.success).toBe(true);

    const blackEffects = state.getPlayerEffects(Color.Black);
    const silence = blackEffects.find(e => e.type === 'silence');
    expect(silence).toBeDefined();
    expect(silence!.remainingDuration).toBe(3);
  });

  it('N12: Ultimate — opponent silenced -> USE_SKILL is rejected', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 8;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // White uses Ultimate
    match.useSkill(Color.White, 'nephalem_divine_silence', []);

    // White ends turn -> Black Turn 1 starts
    match.submitAction({ type: 'END_TURN', player: Color.White });

    state.blackAP = 3;

    // Black attempts to place a thunder trap (Skill 1)
    const res = match.useSkill(Color.Black, 'lightning_thunder_trap', [
      { type: 'cell', position: { col: 5, row: 5 } },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('silenced');
  });

  it('N13: Ultimate — Silence does not cancel existing Berserk', () => {
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 12; // Sufficient AP for Skill 2 and Ultimate
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const targetPos = { col: 4, row: 13 };
    const piece = state.board.getPiece(targetPos)!;

    // Apply Berserk
    match.useSkill(Color.White, 'nephalem_berserk_curse', [
      { type: 'piece', position: targetPos, pieceId: piece.id },
    ]);

    // Apply Silence
    match.useSkill(Color.White, 'nephalem_divine_silence', []);

    // Berserk should still be active on the piece
    expect(piece.effects.some(e => e.type === 'berserk')).toBe(true);
  });

  it('N14: Ultimate — Passive of opponent still triggers when silenced', () => {
    // Dynamite has a passive that gains +2 AP on detonation, or trap passive in Lightning
    // Let's use Lightning variant for Black. Silence is on Black.
    // If Black lands on a trap, does Black's passive trigger?
    // Let's setup a Lightning trap for Black at E5, White lands on it.
    // Black should gain +2 AP from their passive, even if Black is Silenced!
    match.setVariants('nephalem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 8; // AP for White Ultimate
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // White silences Black
    match.useSkill(Color.White, 'nephalem_divine_silence', []);

    // Place a trap on E5 owned by Black (so White landing on it triggers it)
    const trap: Effect = {
      id: 'b_trap',
      type: 'thunder_trap',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'cell',
      targetId: '4,4',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    state.board.addCellEffect({ col: 4, row: 4 }, trap);

    // Place White Rook at E6
    const whiteRook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece({ col: 4, row: 5 }, whiteRook);

    // White moves onto the trap
    state.blackAP = 0;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    match.makeMove(Color.White, { col: 4, row: 5 }, { col: 4, row: 4 });

    // Black's passive should trigger and Black gets 2 AP
    expect(state.blackAP).toBe(2);
  });
});
