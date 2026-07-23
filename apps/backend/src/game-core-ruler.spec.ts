import {
  Match,
  Color,
  Position,
  PieceType,
  BOARD_SIZE,
} from 'game-core';

describe('Chess Variant Engine - Ruler Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  function setupWhiteRulerTurn() {
    match.setVariants('ruler', 'lightning');
    match.start();
    const state = match.getGameState();
    state.whiteAP = 40;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    return state;
  }

  // Helper to place a piece on the board and clear any existing piece at that position
  function placePiece(pos: Position, type: PieceType, color: Color) {
    const state = match.getGameState();
    const piece = {
      id: `${color.toLowerCase()}_${type.toLowerCase()}_${pos.col}_${pos.row}`,
      type,
      color,
      effects: [],
    };
    state.board.setPiece(pos, piece);
    return piece;
  }

  // ═══════════════════════════════════════════════════════
  // LAW 1 (DEFAULT) TESTS
  // ═══════════════════════════════════════════════════════

  it('RL1: Law 1 (default) — Pawn ăn Pawn trong vùng: cho phép', () => {
    const state = setupWhiteRulerTurn();
    const from = { col: 5, row: 5 }; // inside zone
    const to = { col: 6, row: 6 };   // inside zone

    const whitePawn = placePiece(from, PieceType.Pawn, Color.White);
    const blackPawn = placePiece(to, PieceType.Pawn, Color.Black);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(true);
    expect(state.board.getPiece(to)).toBe(whitePawn);
  });

  it('RL2: Law 1 — Pawn ăn Knight trong vùng: bị chặn', () => {
    const state = setupWhiteRulerTurn();
    const from = { col: 5, row: 5 };
    const to = { col: 6, row: 6 };

    placePiece(from, PieceType.Pawn, Color.White);
    placePiece(to, PieceType.Knight, Color.Black);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(false);
  });

  it('RL3: Law 1 — quân ngoài vùng ăn quân trong vùng: không bị hạn chế (capture bình thường)', () => {
    const state = setupWhiteRulerTurn();
    const from = { col: 2, row: 5 }; // outside zone (col 2)
    const to = { col: 3, row: 5 };   // inside zone (col 3)

    const whiteRook = placePiece(from, PieceType.Rook, Color.White);
    placePiece(to, PieceType.Pawn, Color.Black);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(true);
    expect(state.board.getPiece(to)).toBe(whiteRook);
  });

  it('RL4: Law 1 — quân trong vùng ăn quân ngoài vùng: không bị hạn chế', () => {
    const state = setupWhiteRulerTurn();
    const from = { col: 3, row: 5 }; // inside zone (col 3)
    const to = { col: 2, row: 5 };   // outside zone (col 2)

    const whiteRook = placePiece(from, PieceType.Rook, Color.White);
    placePiece(to, PieceType.Pawn, Color.Black);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(true);
    expect(state.board.getPiece(to)).toBe(whiteRook);
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 1 / LAW 2 TESTS
  // ═══════════════════════════════════════════════════════

  it('RL5: Skill 1 — chuyển sang Law 2', () => {
    const state = setupWhiteRulerTurn();
    expect(state.variantState.currentLaw).toBe(1);

    const res = match.useSkill(Color.White, 'ruler_law2', []);
    expect(res.success).toBe(true);
    expect(state.variantState.currentLaw).toBe(2);
    expect(state.variantState.lawRemainingRounds).toBe(3);
  });

  it('RL6: Law 2 — Queen (5) ăn Pawn (1) trong vùng: cho phép', () => {
    const state = setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law2', []);

    const from = { col: 5, row: 5 };
    const to = { col: 5, row: 6 };

    const whiteQueen = placePiece(from, PieceType.Queen, Color.White);
    placePiece(to, PieceType.Pawn, Color.Black);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(true);
    expect(state.board.getPiece(to)).toBe(whiteQueen);
  });

  it('RL7: Law 2 — Pawn ăn Queen trong vùng: bị chặn', () => {
    setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law2', []);

    const from = { col: 5, row: 5 };
    const to = { col: 6, row: 6 };

    placePiece(from, PieceType.Pawn, Color.White);
    placePiece(to, PieceType.Queen, Color.Black);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(false);
  });

  it('RL8: Law 2 — Knight ăn Knight (equal value) trong vùng: bị chặn', () => {
    setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law2', []);

    const from = { col: 5, row: 5 };
    const to = { col: 6, row: 7 };

    placePiece(from, PieceType.Knight, Color.White);
    placePiece(to, PieceType.Knight, Color.Black);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(false);
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 2 / LAW 3 TESTS
  // ═══════════════════════════════════════════════════════

  it('RL9: Skill 2 — chuyển sang Law 3', () => {
    const state = setupWhiteRulerTurn();
    expect(state.variantState.currentLaw).toBe(1);

    const res = match.useSkill(Color.White, 'ruler_law3', []);
    expect(res.success).toBe(true);
    expect(state.variantState.currentLaw).toBe(3);
    expect(state.variantState.lawRemainingRounds).toBe(3);
  });

  it('RL10: Law 3 — Pawn ăn Queen trong vùng: cho phép', () => {
    const state = setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law3', []);

    const from = { col: 5, row: 5 };
    const to = { col: 6, row: 6 };

    const whitePawn = placePiece(from, PieceType.Pawn, Color.White);
    placePiece(to, PieceType.Queen, Color.Black);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(true);
    expect(state.board.getPiece(to)).toBe(whitePawn);
  });

  it('RL11: Law 3 — Queen ăn Pawn trong vùng: bị chặn', () => {
    setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law3', []);

    const from = { col: 5, row: 5 };
    const to = { col: 5, row: 6 };

    placePiece(from, PieceType.Queen, Color.White);
    placePiece(to, PieceType.Pawn, Color.Black);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(false);
  });

  // ═══════════════════════════════════════════════════════
  // SKILL INTERACTION & EXPIRATION TESTS
  // ═══════════════════════════════════════════════════════

  it('RL12: Skill 1 reject khi Law 3 đang active', () => {
    setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law3', []);

    const res = match.useSkill(Color.White, 'ruler_law2', []);
    expect(res.success).toBe(false);
  });

  it('RL13: Skill 2 reject khi Law 2 đang active', () => {
    setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law2', []);

    const res = match.useSkill(Color.White, 'ruler_law3', []);
    expect(res.success).toBe(false);
  });

  it('RL14: Skill 1/2 hết 3 rounds → tự reset về Law 1', () => {
    const state = setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law2', []);
    expect(state.variantState.currentLaw).toBe(2);

    // End 3 turns of White (which ticks down 3 rounds because ticking happens at Ruler's TurnEnd)
    for (let i = 0; i < 3; i++) {
      state.skillsUsedThisTurn = 0;
      state.hasMoved = true;
      state.currentTurn = Color.White;
      match.submitAction({ type: 'END_TURN', player: Color.White });
    }

    expect(state.variantState.currentLaw).toBe(1);
  });

  // ═══════════════════════════════════════════════════════
  // ULTIMATE / BOUNDARY TESTS
  // ═══════════════════════════════════════════════════════

  it('RL15: Ultimate — quân ngoài vùng không thể move vào trong', () => {
    setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_close_field', []);

    const from = { col: 2, row: 5 }; // outside
    const to = { col: 3, row: 5 };   // inside

    placePiece(from, PieceType.Rook, Color.White);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(false);
  });

  it('RL16: Ultimate — quân trong vùng không thể move ra ngoài', () => {
    setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_close_field', []);

    const from = { col: 3, row: 5 }; // inside
    const to = { col: 2, row: 5 };   // outside

    placePiece(from, PieceType.Rook, Color.White);

    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(false);
  });

  it('RL17: Ultimate — Rook ngoài vùng không thể SLIDE VÀO trong (path bị chặn tại biên)', () => {
    setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_close_field', []);

    const from = { col: 1, row: 5 }; // outside
    const insideDest = { col: 4, row: 5 }; // inside (crossing boundary)
    const edgeDest = { col: 2, row: 5 }; // outside, just before edge

    placePiece(from, PieceType.Rook, Color.White);

    // Moves inside should be blocked
    const legalMoves = match.getLegalMovesAt(from);
    expect(legalMoves.some(m => m.col === insideDest.col && m.row === insideDest.row)).toBe(false);

    // Moves outside should be allowed
    expect(legalMoves.some(m => m.col === edgeDest.col && m.row === edgeDest.row)).toBe(true);
  });

  it('RL18: Ultimate — Rook trong vùng không thể SLIDE RA ngoài (path bị chặn tại biên)', () => {
    setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_close_field', []);

    const from = { col: 4, row: 5 }; // inside
    const outsideDest = { col: 1, row: 5 }; // outside (crossing boundary)
    const edgeDest = { col: 3, row: 5 }; // inside edge

    placePiece(from, PieceType.Rook, Color.White);

    const legalMoves = match.getLegalMovesAt(from);
    expect(legalMoves.some(m => m.col === outsideDest.col && m.row === outsideDest.row)).toBe(false);
    expect(legalMoves.some(m => m.col === edgeDest.col && m.row === edgeDest.row)).toBe(true);
  });

  it('RL19: Ultimate — hết 5 rounds → domain kết thúc, quân di chuyển tự do', () => {
    const state = setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_close_field', []);
    expect(state.variantState.domainActive).toBe(true);

    const from = { col: 2, row: 5 };
    const to = { col: 3, row: 5 };
    placePiece(from, PieceType.Rook, Color.White);

    // Can't move in initially
    expect(match.makeMove(Color.White, from, to).success).toBe(false);

    // End 5 turns of Ruler to expire (advance both White and Black turns)
    for (let i = 0; i < 5; i++) {
      state.skillsUsedThisTurn = 0;
      state.hasMoved = true;
      state.currentTurn = Color.White;
      match.submitAction({ type: 'END_TURN', player: Color.White });

      state.skillsUsedThisTurn = 0;
      state.hasMoved = true;
      state.currentTurn = Color.Black;
      match.submitAction({ type: 'END_TURN', player: Color.Black });
    }

    expect(state.variantState.domainActive).toBe(false);

    // Can move freely now
    expect(match.makeMove(Color.White, from, to).success).toBe(true);
  });

  it('RL20: Ultimate — early termination: tất cả quân White snapshot bị diệt → domain kết thúc', () => {
    const state = setupWhiteRulerTurn();

    // Place 2 White pieces and 1 Black piece in zone before activation
    const w1 = { col: 4, row: 4 };
    const w2 = { col: 5, row: 5 };
    const b1 = { col: 6, row: 6 };

    const pw1 = placePiece(w1, PieceType.Pawn, Color.White);
    const pw2 = placePiece(w2, PieceType.Pawn, Color.White);
    placePiece(b1, PieceType.Pawn, Color.Black);

    match.useSkill(Color.White, 'ruler_close_field', []);
    expect(state.variantState.domainActive).toBe(true);
    expect(state.variantState.domainWhitePiecesInside.length).toBe(2);
    expect(state.variantState.domainBlackPiecesInside.length).toBe(1);

    // Destroy first White piece
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: pw1.id,
      position: w1,
      reason: 'skill',
    });
    expect(state.variantState.domainActive).toBe(true); // Still active (pw2 remains)

    // Destroy second White piece
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: pw2.id,
      position: w2,
      reason: 'skill',
    });
    expect(state.variantState.domainActive).toBe(false); // Deactivated!
  });

  it('RL21: Ultimate — early termination: tất cả quân Black snapshot bị diệt → domain kết thúc', () => {
    const state = setupWhiteRulerTurn();

    const w1 = { col: 4, row: 4 };
    const b1 = { col: 6, row: 6 };

    placePiece(w1, PieceType.Pawn, Color.White);
    const pb1 = placePiece(b1, PieceType.Pawn, Color.Black);

    match.useSkill(Color.White, 'ruler_close_field', []);
    expect(state.variantState.domainActive).toBe(true);

    // Destroy the only snapshotted Black piece
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: pb1.id,
      position: b1,
      reason: 'skill',
    });
    expect(state.variantState.domainActive).toBe(false); // Deactivated!
  });

  // ═══════════════════════════════════════════════════════
  // STACKING & REGRESSION TESTS
  // ═══════════════════════════════════════════════════════

  it('RL22: Law vẫn hoạt động bên trong Domain (Law + Domain stack đúng)', () => {
    const state = setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law2', []);
    match.useSkill(Color.White, 'ruler_close_field', []);

    // Both inside the zone
    const from = { col: 5, row: 5 };
    const to = { col: 6, row: 6 };

    placePiece(from, PieceType.Pawn, Color.White);
    placePiece(to, PieceType.Queen, Color.Black);

    // Pawn captures Queen inside zone (Law 2 violation: 1 <= 5) -> Should be blocked
    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(false);
  });

  it('RL23: Regression — Law không ảnh hưởng capture ngoài vùng 9x9', () => {
    const state = setupWhiteRulerTurn();
    match.useSkill(Color.White, 'ruler_law2', []); // Higher eats lower inside zone

    const from = { col: 1, row: 1 }; // outside
    const to = { col: 2, row: 2 };   // outside

    const whitePawn = placePiece(from, PieceType.Pawn, Color.White);
    placePiece(to, PieceType.Queen, Color.Black);

    // Pawn captures Queen outside zone (Law 2 should not apply) -> Should be allowed
    const res = match.makeMove(Color.White, from, to);
    expect(res.success).toBe(true);
    expect(state.board.getPiece(to)).toBe(whitePawn);
  });
});
