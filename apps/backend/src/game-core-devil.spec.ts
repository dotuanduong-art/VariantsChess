import {
  Match,
  Color,
  Position,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  Piece,
} from 'game-core';

describe('Chess Variant Engine - Devil Variant (TDD)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // ==========================================
  // D1: Passive — Devil player nhận +1 AP mỗi turn của họ
  // ==========================================
  it('D1: Passive — Devil player nhận +1 AP mỗi turn của họ', () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // White ends turn -> Black turn start -> Black ends turn -> White turn start (should trigger passive)
    match.submitAction({ type: 'END_TURN', player: Color.White }); // Black turn starts
    expect(state.whiteAP).toBe(5);

    match.submitAction({ type: 'END_TURN', player: Color.Black }); // White turn starts again
    // White is the Devil player, should have gained +1 AP from passive
    expect(state.whiteAP).toBe(6);
  });

  // ==========================================
  // D2: Skill 1 — apply Devil Eye lên ally non-King
  // ==========================================
  it('D2: Skill 1 — apply Devil Eye lên ally non-King', () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Target allied white pawn at B2 (row 1, col 1)
    const targetPos = { col: 1, row: 1 };
    const pawn = state.board.getPiece(targetPos)!;

    const res = match.useSkill(Color.White, 'devil_eye_skill', [
      { type: 'piece', position: targetPos, pieceId: pawn.id },
    ]);

    expect(res.success).toBe(true);
    expect(pawn.effects).toBeDefined();
    const eyeEffect = pawn.effects.find(e => e.type === 'devil_eye');
    expect(eyeEffect).toBeDefined();
    expect(eyeEffect!.remainingDuration).toBe(2); // 2 rounds = 4 turns (ticks on owner's turn end)
  });

  // ==========================================
  // D3: Skill 1 — không thể target King
  // ==========================================
  it('D3: Skill 1 — không thể target King', () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Target white King at H1 (row 0, col 7)
    const kingPos = { col: 7, row: 0 };
    const king = state.board.getPiece(kingPos)!;
    expect(king.type).toBe(PieceType.King);

    const res = match.useSkill(Color.White, 'devil_eye_skill', [
      { type: 'piece', position: kingPos, pieceId: king.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('King');
  });

  // ==========================================
  // D4: Skill 1 — đã có quân khác mang Devil Eye → reject lần dùng thứ 2
  // ==========================================
  it('D4: Skill 1 — đã có quân khác mang Devil Eye -> reject lần dùng thứ 2', () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10; // Sufficient AP for 2 activations
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = { col: 1, row: 1 }; // white pawn
    const piece1 = state.board.getPiece(p1)!;

    const p2 = { col: 2, row: 1 }; // white pawn
    const piece2 = state.board.getPiece(p2)!;

    // First use
    const res1 = match.useSkill(Color.White, 'devil_eye_skill', [
      { type: 'piece', position: p1, pieceId: piece1.id },
    ]);
    expect(res1.success).toBe(true);

    // Reset skillsUsedThisTurn to bypass the one-skill-per-turn limit so we only test exclusivity
    state.skillsUsedThisTurn = 0;

    // Second use
    const res2 = match.useSkill(Color.White, 'devil_eye_skill', [
      { type: 'piece', position: p2, pieceId: piece2.id },
    ]);
    expect(res2.success).toBe(false);
    expect(res2.reason).toContain('Another piece already has Devil Eye');
  });

  // ==========================================
  // D5: Devil Eye — quân địch chiếu vào quân có Devil Eye → kẻ chiếu bị Stun 6 turns
  // ==========================================
  it('D5: Devil Eye — quân địch chiếu vào quân có Devil Eye -> kẻ chiếu bị Stun 6 turns', () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Apply Devil's Eye to White Bishop on C1 (col 2, row 0)
    const allyPos = { col: 2, row: 0 };
    const ally = state.board.getPiece(allyPos)!;
    match.useSkill(Color.White, 'devil_eye_skill', [
      { type: 'piece', position: allyPos, pieceId: ally.id },
    ]);

    // Setup an enemy Rook at C5 (col 2, row 4) pointing directly at C1
    // Clear path first (there's a White pawn at C2 = col 2, row 1)
    state.board.removePiece({ col: 2, row: 1 });

    const enemyPos = { col: 2, row: 4 };
    const enemyRook: Piece = { id: 'b_rook_test', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyRook);

    // White ends turn -> triggers OnTurnEnd for White.
    // Devil Eye checks: is White Bishop under attack by Black? Yes, by Rook at C5!
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // The enemy Rook should receive Stun 6 turns (duration: 3, remainingDuration: 3)
    expect(enemyRook.effects).toBeDefined();
    const stun = enemyRook.effects.find(e => e.type === 'stun');
    expect(stun).toBeDefined();
    expect(stun!.remainingDuration).toBe(3); // 3 rounds = 6 turns

    // The Devil's Eye effect on White Bishop should be removed immediately on trigger
    expect(ally.effects.some(e => e.type === 'devil_eye')).toBe(false);
  });

  // ==========================================
  // D6: Devil Eye — hết 4 turns (2 rounds) không bị chiếu → effect tự biến mất
  // ==========================================
  it('D6: Devil Eye — hết 4 turns (2 rounds) không bị chiếu -> effect tự biến mất', () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const pos = { col: 1, row: 1 };
    const pawn = state.board.getPiece(pos)!;

    match.useSkill(Color.White, 'devil_eye_skill', [
      { type: 'piece', position: pos, pieceId: pawn.id },
    ]);

    expect(pawn.effects.some(e => e.type === 'devil_eye')).toBe(true);

    // End White Turn 1 (skipped since applied this turn)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // End Black Turn 1
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    // End White Turn 2 (ticks 2 -> 1)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // End Black Turn 2
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    // End White Turn 3 (ticks 1 -> 0 -> removed)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    expect(pawn.effects.some(e => e.type === 'devil_eye')).toBe(false);
  });

  // ==========================================
  // D7: Skill 2 — apply Berserk lên quân địch (tái dùng BerserkHandler)
  // ==========================================
  it('D7: Skill 2 — apply Berserk lên quân địch (tái dùng BerserkHandler)', () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const targetPos = { col: 1, row: 13 }; // Black pawn
    const piece = state.board.getPiece(targetPos)!;

    const res = match.useSkill(Color.White, 'wrath_curse_skill', [
      { type: 'piece', position: targetPos, pieceId: piece.id },
    ]);

    expect(res.success).toBe(true);
    expect(piece.effects.some(e => e.type === 'berserk')).toBe(true);
  });

  // ==========================================
  // D7.5: Skill 2 — không thể target King
  // ==========================================
  it('D7.5: Skill 2 — không thể target King', () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const kingPos = { col: 7, row: 14 }; // Black King
    const king = state.board.getPiece(kingPos)!;
    expect(king.type).toBe(PieceType.King);

    const res = match.useSkill(Color.White, 'wrath_curse_skill', [
      { type: 'piece', position: kingPos, pieceId: king.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('King');
  });

  // ==========================================
  // D8: Ultimate — kích hoạt Devil's Toll 12 turns
  // ==========================================
  it("D8: Ultimate — kích hoạt Devil's Toll 12 turns", () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'hellish_toll_skill', []);
    expect(res.success).toBe(true);
    expect(state.variantState.devilTollActive).toBe(true);
    expect(state.variantState.devilTollRemainingTurns).toBe(12);
  });

  // ==========================================
  // D9: Ultimate — Devil player move Bishop → tốn 2 AP
  // ==========================================
  it("D9: Ultimate — Devil player move Bishop -> tốn 2 AP", () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Toll
    match.useSkill(Color.White, 'hellish_toll_skill', []);
    expect(state.whiteAP).toBe(0);

    // Grant AP to make a move
    state.whiteAP = 5;

    // Move White Bishop at C1 (col 2, row 0) to D2 (col 3, row 1)
    // Note: Chess setup usually has pawn at D2, let's clear it first to make it an empty square
    state.board.removePiece({ col: 3, row: 1 });
    const moveRes = match.makeMove(Color.White, { col: 2, row: 0 }, { col: 3, row: 1 });
    expect(moveRes.success).toBe(true);

    // AP cost should be 2, so 5 - 2 = 3 AP remaining
    expect(state.whiteAP).toBe(3);
  });

  // ==========================================
  // D10: Ultimate — đối thủ (không phải Devil) move Rook → cũng tốn 3 AP (áp dụng 2 chiều)
  // ==========================================
  it("D10: Ultimate — đối thủ (không phải Devil) move Rook -> cũng tốn 3 AP", () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Toll
    match.useSkill(Color.White, 'hellish_toll_skill', []);
    
    // Switch to Black's turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Set Black's AP to 5
    state.blackAP = 5;

    // Move Black Rook at A15 (col 0, row 14) to A14 (col 0, row 13) - clear A14 first
    state.board.removePiece({ col: 0, row: 13 });
    const moveRes = match.makeMove(Color.Black, { col: 0, row: 14 }, { col: 0, row: 13 });
    expect(moveRes.success).toBe(true);

    // AP cost should be 3, so 5 - 3 = 2 AP remaining
    expect(state.blackAP).toBe(2);
  });

  // ==========================================
  // D11: Ultimate — move Pawn hoặc King → 0 AP cost
  // ==========================================
  it("D11: Ultimate — move Pawn hoặc King -> 0 AP cost", () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Toll
    match.useSkill(Color.White, 'hellish_toll_skill', []);
    
    state.whiteAP = 0;
    // Move Pawn at B2 (col 1, row 1) to B3 (col 1, row 2) - clear B3 first
    state.board.removePiece({ col: 1, row: 2 });
    const moveRes = match.makeMove(Color.White, { col: 1, row: 1 }, { col: 1, row: 2 });
    expect(moveRes.success).toBe(true);

    // Pawn move costs 0 AP
    expect(state.whiteAP).toBe(0);
  });

  // ==========================================
  // D12: Ultimate — không đủ AP để move Queen (cần 4) → move bị reject
  // ==========================================
  it("D12: Ultimate — không đủ AP để move Queen (cần 4) -> move bị reject", () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Toll
    match.useSkill(Color.White, 'hellish_toll_skill', []);
    
    // Set White's AP to 3 (requires 4 to move Queen)
    state.whiteAP = 3;

    // Move Queen at G1 (col 6, row 0) to G2 (col 6, row 1) - clear G2 first
    state.board.removePiece({ col: 6, row: 1 });
    const moveRes = match.makeMove(Color.White, { col: 6, row: 0 }, { col: 6, row: 1 });

    expect(moveRes.success).toBe(false);
    expect(moveRes.reason).toContain('Insufficient AP');
  });

  // ==========================================
  // D13: Ultimate — SACRIFICE_PIECE khi không đủ AP → quân bị destroy, nhận AP theo LOSS_AP
  // ==========================================
  it("D13: Ultimate — SACRIFICE_PIECE -> quân bị destroy, nhận AP theo LOSS_AP", () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Sacrifice White Rook at A1 (col 0, row 0). Rook loss AP is 3.
    const pos = { col: 0, row: 0 };
    const rook = state.board.getPiece(pos)!;
    expect(rook.type).toBe(PieceType.Rook);

    const res = match.submitAction({
      type: 'SACRIFICE_PIECE',
      pieceId: rook.id,
      position: pos,
      player: Color.White,
    });

    expect(res.success).toBe(true);
    // Rook is removed from board
    expect(state.board.getPiece(pos)).toBeNull();
    // whiteAP increased by 3
    expect(state.whiteAP).toBe(3);
  });

  // ==========================================
  // D14: Ultimate — không thể hiến tế King
  // ==========================================
  it("D14: Ultimate — không thể hiến tế King", () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const pos = { col: 7, row: 0 }; // King on col 7
    const king = state.board.getPiece(pos)!;
    expect(king.type).toBe(PieceType.King);

    const res = match.submitAction({
      type: 'SACRIFICE_PIECE',
      pieceId: king.id,
      position: pos,
      player: Color.White,
    });

    expect(res.success).toBe(false);
  });

  // ==========================================
  // D15: Ultimate — sau khi hiến tế, player có thể thử move lại trong cùng lượt
  // ==========================================
  it("D15: Ultimate — sau khi hiến tế, player có thể thử move lại trong cùng lượt", () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Toll
    match.useSkill(Color.White, 'hellish_toll_skill', []);
    expect(state.whiteAP).toBe(0);

    // Sacrifice White Bishop at C1 (col 2, row 0) to gain 2 AP
    const bishopPos = { col: 2, row: 0 };
    const bishop = state.board.getPiece(bishopPos)!;
    match.submitAction({
      type: 'SACRIFICE_PIECE',
      pieceId: bishop.id,
      position: bishopPos,
      player: Color.White,
    });
    expect(state.whiteAP).toBe(2);

    // Move White Knight at B1 (col 1, row 0) to C3 (col 2, row 2) - clear C3 first
    state.board.removePiece({ col: 2, row: 2 });
    const moveRes = match.makeMove(Color.White, { col: 1, row: 0 }, { col: 2, row: 2 });
    expect(moveRes.success).toBe(true); // Knight move costs 2 AP, which we now have!
    expect(state.whiteAP).toBe(0);
  });

  // ==========================================
  // D16: Ultimate — sau 12 turns, hiệu ứng hết, move không còn tốn AP nữa
  // ==========================================
  it("D16: Ultimate — sau 12 turns, hiệu ứng hết, move không còn tốn AP nữa", () => {
    match.setVariants('devil', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Toll
    match.useSkill(Color.White, 'hellish_toll_skill', []);
    expect(state.variantState.devilTollRemainingTurns).toBe(12);

    // Simulate 12 turns ending
    for (let i = 0; i < 12; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    expect(state.variantState.devilTollActive).toBe(false);

    // Try a Bishop move without AP
    state.whiteAP = 0;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    state.board.removePiece({ col: 3, row: 1 });
    const moveRes = match.makeMove(Color.White, { col: 2, row: 0 }, { col: 3, row: 1 });
    expect(moveRes.success).toBe(true); // Bishop move should be free now!
    expect(state.whiteAP).toBe(0);
  });
});
