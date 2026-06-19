import {
  Match,
  Color,
  Position,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  BOARD_SIZE,
} from 'game-core';

describe('Chess Variant Engine - Requiem Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // ═══════════════════════════════════════════════════════
  // PASSIVE — Soul Harvest
  // ═══════════════════════════════════════════════════════

  // R1: Requiem player captures enemy → +1 AP (on top of CAPTURE_AP)
  it('R1: Passive — Requiem captures enemy → +1 AP bonus', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;

    // Place White Rook to capture Black Pawn
    const attackerPos = { col: 4, row: 3 };
    const targetPos = { col: 4, row: 4 };
    const attacker = { id: 'w_rook_test', type: PieceType.Rook, color: Color.White, effects: [] };
    const target = { id: 'b_pawn_test', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece(attackerPos, attacker);
    state.board.setPiece(targetPos, target);

    // Clear board path (ensure no blocking pieces)
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    match.makeMove(Color.White, attackerPos, targetPos);

    // CAPTURE_AP for Pawn = 2 AP + Soul Harvest +1 AP = 3 AP minimum
    expect(state.whiteAP).toBeGreaterThanOrEqual(3);
    // Verify the extra +1 by checking it's higher than base CAPTURE_AP
    // Base Pawn capture = 2 AP; with passive = 3 AP
    expect(state.whiteAP).toBe(3);
  });

  // R2: Enemy captures Requiem piece → passive does NOT trigger
  it('R2: Passive — enemy captures Requiem piece → no passive trigger', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;

    // Place Black Rook to capture White Pawn
    const attackerPos = { col: 4, row: 5 };
    const targetPos = { col: 4, row: 4 };
    const attacker = { id: 'b_rook_test', type: PieceType.Rook, color: Color.Black, effects: [] };
    const target = { id: 'w_pawn_test', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece(attackerPos, attacker);
    state.board.setPiece(targetPos, target);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    match.makeMove(Color.Black, attackerPos, targetPos);

    // White should get loss_reward only (Pawn loss = 1 AP), NOT the passive +1
    expect(state.whiteAP).toBe(1);
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 1 — Soul Break
  // ═══════════════════════════════════════════════════════

  // R3: Skill 1 — apply Berserk to enemy non-King piece
  it('R3: Skill 1 — apply Berserk to enemy non-King piece', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const targetPos = { col: 3, row: 13 }; // Black pawn
    const piece = state.board.getPiece(targetPos)!;

    const res = match.useSkill(Color.White, 'requiem_soul_break', [
      { type: 'piece', position: targetPos, pieceId: piece.id },
    ]);

    expect(res.success).toBe(true);
    const berserk = piece.effects.find(e => e.type === 'berserk');
    expect(berserk).toBeDefined();
    expect(berserk!.metadata.captureCountdown).toBe(2);
    expect(berserk!.metadata.capturedThisWindow).toBe(false);
  });

  // R4: Skill 1 — cannot target King
  it('R4: Skill 1 — cannot target King', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
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

    const res = match.useSkill(Color.White, 'requiem_soul_break', [
      { type: 'piece', position: kingPos, pieceId: kingId },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Cannot target King');
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 2 — Thread of Fate
  // ═══════════════════════════════════════════════════════

  // R5: Skill 2 — 2 pieces linked with Fate, both have linkedPieceId pointing to each other
  it('R5: Skill 2 — link ally and enemy with Fate', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 }; // White pawn
    const enemyPos = { col: 3, row: 13 }; // Black pawn
    const allyPiece = state.board.getPiece(allyPos)!;
    const enemyPiece = state.board.getPiece(enemyPos)!;

    const res = match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    expect(res.success).toBe(true);

    const allyFate = allyPiece.effects.find(e => e.type === 'fate');
    const enemyFate = enemyPiece.effects.find(e => e.type === 'fate');

    expect(allyFate).toBeDefined();
    expect(enemyFate).toBeDefined();

    // Cross-linked metadata
    expect(allyFate!.metadata.linkedPieceId).toBe(enemyPiece.id);
    expect(allyFate!.metadata.linkedEffectId).toBe(enemyFate!.id);
    expect(enemyFate!.metadata.linkedPieceId).toBe(allyPiece.id);
    expect(enemyFate!.metadata.linkedEffectId).toBe(allyFate!.id);

    // Duration 3 rounds
    expect(allyFate!.duration).toBe(3);
    expect(enemyFate!.duration).toBe(3);
  });

  // R6: Skill 2 — cannot target King (both ally and enemy)
  it('R6: Skill 2 — cannot target King', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Find White King (for ally) and Black pawn (for enemy)
    let whiteKingPos = { col: -1, row: -1 };
    let whiteKingId = '';
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.White) {
          whiteKingPos = { col: c, row: r };
          whiteKingId = p.id;
          break;
        }
      }
    }

    const enemyPos = { col: 3, row: 13 };
    const enemyPiece = state.board.getPiece(enemyPos)!;

    // Try to use White King as ally target
    const res = match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: whiteKingPos, pieceId: whiteKingId },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Cannot target King');
  });

  // R7: Skill 2 — ally (Fate-linked) captured → enemy linked piece destroyed
  it('R7: Skill 2 — ally captured → linked enemy destroyed', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Place ally and enemy at known positions
    const allyPos = { col: 6, row: 4 };
    const enemyPos = { col: 6, row: 10 };
    const allyPiece = { id: 'w_pawn_fate', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    const enemyPiece = { id: 'b_pawn_fate', type: PieceType.Pawn, color: Color.Black, effects: [] as Effect[] };
    state.board.setPiece(allyPos, allyPiece);
    state.board.setPiece(enemyPos, enemyPiece);

    // Link them with Fate
    const res = match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);
    expect(res.success).toBe(true);

    // End White turn → Black turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black captures the ally piece
    const blackAttackerPos = { col: 6, row: 5 };
    state.board.setPiece(blackAttackerPos, { id: 'b_rook_cap', type: PieceType.Rook, color: Color.Black, effects: [] });
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    match.makeMove(Color.Black, blackAttackerPos, allyPos);

    // Ally should be gone (captured)
    // Enemy linked piece should also be destroyed by Fate
    expect(state.board.getPiece(enemyPos)).toBeNull();
  });

  // R8: Skill 2 — enemy destroyed by effect → ally linked piece destroyed
  it('R8: Skill 2 — enemy destroyed by effect → linked ally destroyed', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 6, row: 4 };
    const enemyPos = { col: 6, row: 10 };
    const allyPiece = { id: 'w_pawn_fate2', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    const enemyPiece = { id: 'b_pawn_fate2', type: PieceType.Pawn, color: Color.Black, effects: [] as Effect[] };
    state.board.setPiece(allyPos, allyPiece);
    state.board.setPiece(enemyPos, enemyPiece);

    // Link them
    match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    // Destroy enemy piece via effect
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: enemyPiece.id,
      position: enemyPos,
      reason: 'skill',
    });

    // Enemy should be gone
    expect(state.board.getPiece(enemyPos)).toBeNull();
    // Ally linked piece should also be destroyed by Fate
    expect(state.board.getPiece(allyPos)).toBeNull();
  });

  // R9: Fate chain — linked piece B has Bomb → Fate kills B → Bomb AoE triggers
  it('R9: Fate chain — linked piece has Bomb → Fate death triggers explosion', () => {
    match.setVariants('requiem', 'dynamite');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Piece A (ally) at col:6, row:4
    const allyPos = { col: 6, row: 4 };
    const allyPiece = { id: 'w_pawn_fateA', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece(allyPos, allyPiece);

    // Piece B (enemy with bomb) at col:6, row:10
    const enemyPos = { col: 6, row: 10 };
    const bombEffect: Effect = {
      id: 'bomb_enemy_test',
      type: 'bomb',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: 'b_pawn_fateB',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    const enemyPiece = { id: 'b_pawn_fateB', type: PieceType.Pawn, color: Color.Black, effects: [bombEffect] };
    state.board.setPiece(enemyPos, enemyPiece);

    // Bystander adjacent to enemy (will be hit by bomb AoE)
    const bystanderPos = { col: 7, row: 10 };
    const bystander = { id: 'b_pawn_bystander', type: PieceType.Pawn, color: Color.Black, effects: [] as Effect[] };
    state.board.setPiece(bystanderPos, bystander);

    // Link ally and enemy with Fate
    match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    // Destroy ally piece → Fate kills enemy → Bomb on enemy explodes → bystander destroyed
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: allyPiece.id,
      position: allyPos,
      reason: 'skill',
    });

    expect(state.board.getPiece(allyPos)).toBeNull(); // ally dead
    expect(state.board.getPiece(enemyPos)).toBeNull(); // enemy dead by Fate
    expect(state.board.getPiece(bystanderPos)).toBeNull(); // bystander dead by Bomb AoE
  });

  // R10: Fate chain — linked piece A has Berserk → Fate kills A → Berserk check on that piece
  it('R10: Fate chain — linked piece has Berserk → Fate kills it', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 6, row: 4 };
    const berserkEffect: Effect = {
      id: 'berserk_ally_test',
      type: 'berserk',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: 'w_pawn_berserkFate',
      stackingRule: 'ignore',
      isDebuff: true,
      metadata: { captureCountdown: 2, capturedThisWindow: false, isFirstTurnStart: true },
    };
    const allyPiece = { id: 'w_pawn_berserkFate', type: PieceType.Pawn, color: Color.White, effects: [berserkEffect] };
    state.board.setPiece(allyPos, allyPiece);

    const enemyPos = { col: 6, row: 10 };
    const enemyPiece = { id: 'b_pawn_fateC', type: PieceType.Pawn, color: Color.Black, effects: [] as Effect[] };
    state.board.setPiece(enemyPos, enemyPiece);

    // Link ally (with berserk) and enemy with Fate
    match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    // Destroy enemy → Fate kills ally (which has berserk)
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: enemyPiece.id,
      position: enemyPos,
      reason: 'skill',
    });

    // Both should be dead
    expect(state.board.getPiece(enemyPos)).toBeNull();
    expect(state.board.getPiece(allyPos)).toBeNull();
    // Ally is in graveyard
    expect(state.graveyard.some(e => e.piece.id === allyPiece.id)).toBe(true);
  });

  // R11: Both linked pieces die simultaneously (Bomb AoE covers both) → no infinite loop
  it('R11: Both linked pieces die simultaneously → no infinite loop', () => {
    match.setVariants('requiem', 'dynamite');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Place 2 linked pieces adjacent to each other (both in bomb AoE range)
    const pieceAPos = { col: 6, row: 6 };
    const pieceBPos = { col: 7, row: 6 };
    const pieceA = { id: 'w_pawn_fateSimA', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    const pieceB = { id: 'b_pawn_fateSimB', type: PieceType.Pawn, color: Color.Black, effects: [] as Effect[] };
    state.board.setPiece(pieceAPos, pieceA);
    state.board.setPiece(pieceBPos, pieceB);

    // Link them
    match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: pieceAPos, pieceId: pieceA.id },
      { type: 'piece', position: pieceBPos, pieceId: pieceB.id },
    ]);

    // Place a bomb carrier adjacent that will AoE both
    const bombCarrierPos = { col: 6, row: 7 };
    const bombEffect: Effect = {
      id: 'bomb_carrier_sim',
      type: 'bomb',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: 'w_pawn_bombCarrier',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    const bombCarrier = { id: 'w_pawn_bombCarrier', type: PieceType.Pawn, color: Color.White, effects: [bombEffect] };
    state.board.setPiece(bombCarrierPos, bombCarrier);

    // Destroy bomb carrier → Bomb AoE kills both A and B simultaneously
    // Fate should NOT cause infinite loop
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: bombCarrier.id,
      position: bombCarrierPos,
      reason: 'detonation',
    });

    // Both should be dead, no loop
    expect(state.board.getPiece(pieceAPos)).toBeNull();
    expect(state.board.getPiece(pieceBPos)).toBeNull();
    expect(state.board.getPiece(bombCarrierPos)).toBeNull();
  });

  // R12: Fate expires after 3 rounds → both effects removed, pieces alive
  it('R12: Fate expires after 3 rounds → both effects removed', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const enemyPos = { col: 3, row: 13 };
    const allyPiece = state.board.getPiece(allyPos)!;
    const enemyPiece = state.board.getPiece(enemyPos)!;

    // Link them
    match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    expect(allyPiece.effects.some(e => e.type === 'fate')).toBe(true);
    expect(enemyPiece.effects.some(e => e.type === 'fate')).toBe(true);

    // Advance 6 turns (3 rounds = 6 half-turns)
    for (let i = 0; i < 6; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Both pieces should still be alive
    expect(state.board.getPiece(allyPos)).not.toBeNull();
    expect(state.board.getPiece(enemyPos)).not.toBeNull();

    // Both Fate effects should be removed
    const allyFate = state.board.getPiece(allyPos)!.effects.find(e => e.type === 'fate');
    const enemyFate = state.board.getPiece(enemyPos)!.effects.find(e => e.type === 'fate');
    expect(allyFate).toBeUndefined();
    expect(enemyFate).toBeUndefined();
  });

  // R13: After Fate expires → piece death does NOT trigger linked death
  it('R13: After Fate expires → death does not trigger linked death', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const enemyPos = { col: 3, row: 13 };
    const allyPiece = state.board.getPiece(allyPos)!;
    const enemyPiece = state.board.getPiece(enemyPos)!;

    // Link them
    match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    // Advance 6 turns to expire Fate
    for (let i = 0; i < 6; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Now destroy ally — enemy should NOT die
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: allyPiece.id,
      position: allyPos,
      reason: 'skill',
    });

    expect(state.board.getPiece(allyPos)).toBeNull(); // ally dead
    expect(state.board.getPiece(enemyPos)).not.toBeNull(); // enemy alive — Fate expired
  });

  // ═══════════════════════════════════════════════════════
  // ULTIMATE — Reaper's Decree
  // ═══════════════════════════════════════════════════════

  // R14: Ultimate — 2 enemy pieces linked with Fate, duration 5 rounds
  it('R14: Ultimate — link 2 enemy pieces with Fate duration 5', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPos1 = { col: 3, row: 13 };
    const enemyPos2 = { col: 4, row: 13 };
    const enemy1 = state.board.getPiece(enemyPos1)!;
    const enemy2 = state.board.getPiece(enemyPos2)!;

    const res = match.useSkill(Color.White, 'requiem_reapers_decree', [
      { type: 'piece', position: enemyPos1, pieceId: enemy1.id },
      { type: 'piece', position: enemyPos2, pieceId: enemy2.id },
    ]);

    expect(res.success).toBe(true);

    const fate1 = enemy1.effects.find(e => e.type === 'fate');
    const fate2 = enemy2.effects.find(e => e.type === 'fate');

    expect(fate1).toBeDefined();
    expect(fate2).toBeDefined();
    expect(fate1!.duration).toBe(5);
    expect(fate2!.duration).toBe(5);
    expect(fate1!.metadata.linkedPieceId).toBe(enemy2.id);
    expect(fate2!.metadata.linkedPieceId).toBe(enemy1.id);
  });

  // R15: Ultimate — cannot target King
  it('R15: Ultimate — cannot target King', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Find Black King
    let blackKingPos = { col: -1, row: -1 };
    let blackKingId = '';
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.Black) {
          blackKingPos = { col: c, row: r };
          blackKingId = p.id;
          break;
        }
      }
    }

    const enemyPos = { col: 3, row: 13 };
    const enemy = state.board.getPiece(enemyPos)!;

    const res = match.useSkill(Color.White, 'requiem_reapers_decree', [
      { type: 'piece', position: blackKingPos, pieceId: blackKingId },
      { type: 'piece', position: enemyPos, pieceId: enemy.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Cannot target King');
  });

  // R16: Ultimate — cannot select the same piece twice
  it('R16: Ultimate — cannot select same piece twice', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPos = { col: 3, row: 13 };
    const enemy = state.board.getPiece(enemyPos)!;

    const res = match.useSkill(Color.White, 'requiem_reapers_decree', [
      { type: 'piece', position: enemyPos, pieceId: enemy.id },
      { type: 'piece', position: enemyPos, pieceId: enemy.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Cannot select the same piece twice');
  });

  // R17: Fate stacking — applying Fate to piece with existing Fate → rejected
  it('R17: Fate stacking — apply Fate to piece already with Fate → rejected', () => {
    match.setVariants('requiem', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 20;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const enemyPos1 = { col: 3, row: 13 };
    const enemyPos2 = { col: 4, row: 13 };
    const allyPiece = state.board.getPiece(allyPos)!;
    const enemy1 = state.board.getPiece(enemyPos1)!;
    const enemy2 = state.board.getPiece(enemyPos2)!;

    // First Fate link: ally <-> enemy1
    const res1 = match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos1, pieceId: enemy1.id },
    ]);
    expect(res1.success).toBe(true);

    // End turn and come back (to use another skill)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    state.whiteAP = 20;
    state.skillsUsedThisTurn = 0;

    // Second attempt: try to link ally (already has Fate) <-> enemy2
    const res2 = match.useSkill(Color.White, 'requiem_thread_of_fate', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos2, pieceId: enemy2.id },
    ]);

    // Should succeed in useSkill but the APPLY_EFFECT with stackingRule 'ignore' 
    // should reject stacking — ally still has original Fate, not the new one
    const allyFateEffects = allyPiece.effects.filter(e => e.type === 'fate');
    expect(allyFateEffects.length).toBe(1); // Only 1 Fate effect
    expect(allyFateEffects[0].metadata.linkedPieceId).toBe(enemy1.id); // Still linked to enemy1
  });
});
