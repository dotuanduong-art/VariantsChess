import {
  Match,
  Color,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  TimeVariant,
} from 'game-core';

describe('Chess Variant Engine - Time Variant (TDD)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('time', 'lightning');
  });

  // =========================================================================
  // Passive & Cost tests (T1-T3)
  // =========================================================================

  it('T1: Passive — lần 1 dùng Ultimate: cost 6 AP', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'time_grand_rewind', []);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(4); // 10 - 6
    expect(state.variantState.ultimateUseCount).toBe(1);
  });

  it('T2: Passive — lần 2: cost 9 AP', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 20;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // First use
    let res = match.useSkill(Color.White, 'time_grand_rewind', []);
    expect(res.success).toBe(true);

    // Reset skill use limit for test
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    // Second use
    res = match.useSkill(Color.White, 'time_time_freeze', []);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(5); // 20 - 6 - 9 = 5
    expect(state.variantState.ultimateUseCount).toBe(2);
  });

  it('T3: Passive — lần 3+: cost 15 AP', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 40;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // First use
    match.useSkill(Color.White, 'time_grand_rewind', []);
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    // Second use
    match.useSkill(Color.White, 'time_time_freeze', []);
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    // Third use
    const res = match.useSkill(Color.White, 'time_grand_rewind', []);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(10); // 40 - 6 - 9 - 15 = 10
    expect(state.variantState.ultimateUseCount).toBe(3);
  });

  // =========================================================================
  // Skill 1 - Rewind tests (T4-T6)
  // =========================================================================

  it('T4: Skill 1 — quân về đúng vị trí 1 round trước', () => {
    match.start();
    const state = match.getGameState();

    // W1: start turn captures initial W1 snapshot
    // Move White Pawn at A2 (0, 1) to A3 (0, 2)
    match.makeMove(Color.White, { col: 0, row: 1 }, { col: 0, row: 2 });
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // B1: start turn captures initial B1 snapshot
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // W2: start turn captures W2 snapshot (Pawn is at (0, 2))
    // Move White Pawn from A3 (0, 2) to A4 (0, 3)
    state.hasMoved = false;
    match.makeMove(Color.White, { col: 0, row: 2 }, { col: 0, row: 3 });
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // B2: start turn captures B2 snapshot
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // W3: start turn captures W3 snapshot (Pawn is at (0, 3))
    // Use Skill 1 (Rewind) to restore to 1 round ago (2 turns ago, which is W2 start: Pawn at (0, 2))
    state.whiteAP = 10;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    const res = match.useSkill(Color.White, 'time_rewind', []);
    expect(res.success).toBe(true);

    const piece = state.board.getPiece({ col: 0, row: 2 });
    expect(piece).toBeDefined();
    expect(piece?.type).toBe(PieceType.Pawn);

    const oldPosPiece = state.board.getPiece({ col: 0, row: 3 });
    expect(oldPosPiece).toBeNull();
  });

  it('T5: Skill 1 — quân đã chết không hồi sinh', () => {
    match.start();
    const state = match.getGameState();

    // W1: Kill the Black Pawn at (0, 13) or some piece to put it in graveyard
    // Let's manually set a piece dead and remove it
    const blackPawn = state.board.getPiece({ col: 0, row: 13 })!;
    state.board.removePiece({ col: 0, row: 13 });
    state.graveyard.push({
      piece: blackPawn,
      position: { col: 0, row: 13 },
      turnDied: 1,
      killedBy: 'capture',
    });

    // Make some turns so snapshots roll
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    state.whiteAP = 10;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    
    // Rewind
    const res = match.useSkill(Color.White, 'time_rewind', []);
    expect(res.success).toBe(true);

    // Dead pawn must still be dead and not on board
    expect(state.board.getPiece({ col: 0, row: 13 })).toBeNull();
    expect(state.graveyard.length).toBe(1);
  });

  it('T6: Skill 1 — AP/effects/graveyard không thay đổi', () => {
    match.start();
    const state = match.getGameState();

    // Add an effect to White Pawn at (0, 1)
    const pawn = state.board.getPiece({ col: 0, row: 1 })!;
    pawn.effects.push({
      id: 'shield_test',
      type: 'shield',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: pawn.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    // End turns
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    state.whiteAP = 10;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    const initialGraveyardSize = state.graveyard.length;

    // Use Rewind
    match.useSkill(Color.White, 'time_rewind', []);

    // AP remains 6 (10 - 4 for skill cost)
    expect(state.whiteAP).toBe(6);
    // Graveyard size unchanged
    expect(state.graveyard.length).toBe(initialGraveyardSize);
    // Shield effect still exists on pawn
    expect(pawn.effects.some(e => e.type === 'shield')).toBe(true);
  });

  // =========================================================================
  // Skill 2 - Future Prediction tests (T7-T11)
  // =========================================================================

  it('T7: Skill 2 — apply prediction effect lên quân địch với predicted position', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const enemyPawn = state.board.getPiece({ col: 0, row: 13 })!;
    const res = match.useSkill(Color.White, 'time_prediction', [
      { type: 'piece', position: { col: 0, row: 13 }, pieceId: enemyPawn.id },
      { type: 'cell', position: { col: 0, row: 12 } },
    ]);

    expect(res.success).toBe(true);
    expect(enemyPawn.effects.length).toBe(1);
    expect(enemyPawn.effects[0].type).toBe('prediction');
    expect(enemyPawn.effects[0].metadata.predictedPosition).toEqual({ col: 0, row: 12 });
  });

  it('T8: Skill 2 — địch di chuyển đúng ô → Stun 4 rounds', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const enemyPawn = state.board.getPiece({ col: 0, row: 13 })!;
    match.useSkill(Color.White, 'time_prediction', [
      { type: 'piece', position: { col: 0, row: 13 }, pieceId: enemyPawn.id },
      { type: 'cell', position: { col: 0, row: 12 } },
    ]);

    // End White's turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black's turn: move enemy pawn to predicted cell (0, 12)
    state.hasMoved = false;
    const moveRes = match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 12 });
    expect(moveRes.success).toBe(true);

    // Enemy pawn should be stunned for 4 rounds, and prediction effect removed
    expect(enemyPawn.effects.some(e => e.type === 'stun')).toBe(true);
    expect(enemyPawn.effects.some(e => e.type === 'prediction')).toBe(false);

    const stun = enemyPawn.effects.find(e => e.type === 'stun')!;
    expect(stun.duration).toBe(4);
  });

  it('T9: Skill 2 — địch capture đúng ô → cũng trigger Stun', () => {
    match.start();
    const state = match.getGameState();
    
    // Replace Black Pawn at (0, 13) with a Black Rook
    state.board.setPiece({ col: 0, row: 13 }, {
      id: 'b_rook_test',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    // Put a White Pawn at (0, 12) to be captured
    const whiteDummy = { id: 'w_dummy', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 0, row: 12 }, whiteDummy);

    state.whiteAP = 10;
    const enemyRook = state.board.getPiece({ col: 0, row: 13 })!;

    match.useSkill(Color.White, 'time_prediction', [
      { type: 'piece', position: { col: 0, row: 13 }, pieceId: enemyRook.id },
      { type: 'cell', position: { col: 0, row: 12 } },
    ]);

    // End White's turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black's turn: capture the white dummy at (0, 12)
    state.hasMoved = false;
    const moveRes = match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 12 });
    expect(moveRes.success).toBe(true);

    // Stunned!
    expect(enemyRook.effects.some(e => e.type === 'stun')).toBe(true);
    expect(enemyRook.effects.some(e => e.type === 'prediction')).toBe(false);
  });

  it('T10: Skill 2 — địch di chuyển sai ô → không Stun', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const enemyPawn = state.board.getPiece({ col: 0, row: 13 })!;
    match.useSkill(Color.White, 'time_prediction', [
      { type: 'piece', position: { col: 0, row: 13 }, pieceId: enemyPawn.id },
      { type: 'cell', position: { col: 0, row: 11 } }, // Predict different cell (0, 11)
    ]);

    // End White's turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black moves to (0, 12) instead of (0, 11)
    state.hasMoved = false;
    match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 12 });

    // Not stunned, but prediction resolved/removed
    expect(enemyPawn.effects.some(e => e.type === 'stun')).toBe(false);
    expect(enemyPawn.effects.some(e => e.type === 'prediction')).toBe(false);
  });

  it('T11: Skill 2 — hết 1 round không di chuyển → prediction expire', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const enemyPawn = state.board.getPiece({ col: 0, row: 13 })!;
    match.useSkill(Color.White, 'time_prediction', [
      { type: 'piece', position: { col: 0, row: 13 }, pieceId: enemyPawn.id },
      { type: 'cell', position: { col: 0, row: 12 } },
    ]);

    // End White's turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black ends turn without moving the Pawn
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Prediction effect should be removed by ticking
    expect(enemyPawn.effects.some(e => e.type === 'prediction')).toBe(false);
  });

  // =========================================================================
  // Ultimate Option A - Grand Rewind tests (T12-T14)
  // =========================================================================

  it('T12: Ultimate (Grand Rewind) — quân về vị trí 5 rounds trước', () => {
    match.start();
    const state = match.getGameState();

    // W1: Knight is at (1, 0)
    // Make 10 turns (5 full rounds)
    for (let round = 1; round <= 5; round++) {
      state.hasMoved = false;
      // White moves Knight back and forth
      if (round % 2 === 1) {
        match.makeMove(Color.White, { col: 1, row: 0 }, { col: 2, row: 2 });
      } else {
        match.makeMove(Color.White, { col: 2, row: 2 }, { col: 1, row: 0 });
      }
      match.submitAction({ type: 'END_TURN', player: Color.White });
      match.submitAction({ type: 'END_TURN', player: Color.Black });
    }

    // Now we are at W6. Knight is currently at (2, 2)
    const knight = state.board.getPiece({ col: 2, row: 2 })!;
    expect(knight).toBeDefined();

    // Use Grand Rewind
    state.whiteAP = 15;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    const res = match.useSkill(Color.White, 'time_grand_rewind', []);
    expect(res.success).toBe(true);

    // Knight returned to (1, 0) (position 5 rounds/10 turns ago, W1 start)
    expect(state.board.getPiece({ col: 1, row: 0 })).toBeDefined();
    expect(state.board.getPiece({ col: 2, row: 2 })).toBeNull();
  });

  it('T13: Ultimate (Grand Rewind) — chưa đủ 5 rounds → về đầu ván', () => {
    match.start();
    const state = match.getGameState();

    // W1: Move Pawn from A2 (0, 1) to A3 (0, 2)
    match.makeMove(Color.White, { col: 0, row: 1 }, { col: 0, row: 2 });
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // W2: Move Pawn from A3 (0, 2) to A4 (0, 3)
    state.hasMoved = false;
    match.makeMove(Color.White, { col: 0, row: 2 }, { col: 0, row: 3 });

    // Only 2 turns elapsed. Trigger Grand Rewind
    state.whiteAP = 15;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    const res = match.useSkill(Color.White, 'time_grand_rewind', []);
    expect(res.success).toBe(true);

    // Back to W1 start position -> Pawn at (0, 1)
    expect(state.board.getPiece({ col: 0, row: 1 })).toBeDefined();
    expect(state.board.getPiece({ col: 0, row: 3 })).toBeNull();
  });

  it('T14: Ultimate (Grand Rewind) — quân đã chết không hồi sinh', () => {
    match.start();
    const state = match.getGameState();

    // Kill a piece
    const enemyPawn = state.board.getPiece({ col: 0, row: 13 })!;
    state.board.removePiece({ col: 0, row: 13 });
    state.graveyard.push({
      piece: enemyPawn,
      position: { col: 0, row: 13 },
      turnDied: 1,
      killedBy: 'capture',
    });

    // Use Grand Rewind
    state.whiteAP = 15;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    match.useSkill(Color.White, 'time_grand_rewind', []);

    // Remains dead
    expect(state.board.getPiece({ col: 0, row: 13 })).toBeNull();
  });

  // =========================================================================
  // Ultimate Option B - Time Freeze tests (T15-T19)
  // =========================================================================

  it('T15: Ultimate (Time Freeze) — địch di chuyển quân trong window → Stun còn lại đúng rounds', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    // Time Freeze!
    match.useSkill(Color.White, 'time_time_freeze', []);
    
    // End White's turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black moves their Pawn at (0, 13) to (0, 12)
    state.hasMoved = false;
    const enemyPiece = state.board.getPiece({ col: 0, row: 13 })!;
    match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 12 });

    // Stunned for 6 rounds (since freeze duration is 6)
    expect(enemyPiece.effects.some(e => e.type === 'stun')).toBe(true);
    const stun = enemyPiece.effects.find(e => e.type === 'stun')!;
    expect(stun.duration).toBe(6);
  });

  it('T16: Ultimate (Time Freeze) — địch di chuyển turn 3 của 6 → Stun = 3 rounds còn lại', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    match.useSkill(Color.White, 'time_time_freeze', []);
    
    // Fast-forward 2 rounds of time freeze (2 full turns of W & B)
    // End Turn W1
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // End Turn B1
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    
    // End Turn W2 (decrements white player effect time_freeze to 5)
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // End Turn B2
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // End Turn W3 (decrements to 4)
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black's turn 3 of freeze (time_freeze remaining duration = 4)
    state.hasMoved = false;
    const enemyPiece = state.board.getPiece({ col: 0, row: 13 })!;
    match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 12 });

    // Stunned for 4 rounds (remaining duration)
    expect(enemyPiece.effects.some(e => e.type === 'stun')).toBe(true);
    const stun = enemyPiece.effects.find(e => e.type === 'stun')!;
    expect(stun.duration).toBe(4);
  });

  it('T17: Ultimate (Time Freeze) — King không bị Stun', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    // Remove the blocking Black Pawn at (7, 13)
    state.board.removePiece({ col: 7, row: 13 });

    match.useSkill(Color.White, 'time_time_freeze', []);
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black moves King from (7, 14) to (7, 13)
    state.hasMoved = false;
    const king = state.board.getPiece({ col: 7, row: 14 })!;
    expect(king.type).toBe(PieceType.King);

    const res = match.makeMove(Color.Black, { col: 7, row: 14 }, { col: 7, row: 13 });
    expect(res.success).toBe(true);

    // King is NOT stunned
    expect(king.effects.some(e => e.type === 'stun')).toBe(false);
  });

  it('T18: Ultimate (Time Freeze) — Stun có thể bị Blessing cleanse', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    match.useSkill(Color.White, 'time_time_freeze', []);
    match.submitAction({ type: 'END_TURN', player: Color.White });

    state.hasMoved = false;
    const enemyPiece = state.board.getPiece({ col: 0, row: 13 })!;
    match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 12 });

    expect(enemyPiece.effects.some(e => e.type === 'stun')).toBe(true);

    // Cleanse it by removing debuffs (Blessing effect or manual action simulation)
    // In our codebase, Blessing cleanser removes all debuffs (isDebuff === true)
    enemyPiece.effects = enemyPiece.effects.filter(e => !e.isDebuff);
    expect(enemyPiece.effects.some(e => e.type === 'stun')).toBe(false);
  });

  it('T19: Ultimate (Time Freeze) — sau 6 rounds, time_freeze expire, không còn trigger', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    match.useSkill(Color.White, 'time_time_freeze', []);

    // Fast-forward 6 rounds of Time Freeze
    for (let round = 1; round <= 6; round++) {
      state.hasMoved = false;
      match.submitAction({ type: 'END_TURN', player: Color.White });
      match.submitAction({ type: 'END_TURN', player: Color.Black });
    }
    // End White's turn once more to expire player effect
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Freeze has expired, no time_freeze player effect left
    expect(state.whitePlayerEffects.some(e => e.type === 'time_freeze')).toBe(false);

    // Opponent moves a piece
    state.hasMoved = false;
    const enemyPiece = state.board.getPiece({ col: 0, row: 13 })!;
    match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 12 });

    // Not stunned
    expect(enemyPiece.effects.some(e => e.type === 'stun')).toBe(false);
  });
});
