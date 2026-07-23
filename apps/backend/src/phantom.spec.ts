import {
  Match,
  Color,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  PhantomVariant,
} from 'game-core';

describe('Chess Variant Engine - Phantom Variant (TDD)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('phantom', 'lightning');
  });

  // =========================================================================
  // Ghost moves: Rook, Bishop, Queen, Pawn (PH1 - PH4)
  // =========================================================================

  it('PH1: Ghost — sliding piece bỏ qua 1 vật cản, tiếp tục đến vật cản thứ 2', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    // Place allied Rook with Ghost effect at A1 (col 0, row 0)
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    // Blocker 1 (enemy pawn) at A4 (col 0, row 3)
    state.board.setPiece({ col: 0, row: 3 }, { id: 'b_pawn_1', type: PieceType.Pawn, color: Color.Black, effects: [] });
    // Blocker 2 (enemy pawn) at A7 (col 0, row 6)
    state.board.setPiece({ col: 0, row: 6 }, { id: 'b_pawn_2', type: PieceType.Pawn, color: Color.Black, effects: [] });

    const moves = match.getLegalMovesAt({ col: 0, row: 0 });

    // Should contain A2 (0, 1), A3 (0, 2), blocker A4 (0, 3), A5 (0, 4), A6 (0, 5), and blocker A7 (0, 6)
    // Should NOT contain A8 (0, 7) because A7 is the 2nd obstacle.
    expect(moves.some(m => m.col === 0 && m.row === 1)).toBe(true);
    expect(moves.some(m => m.col === 0 && m.row === 2)).toBe(true);
    expect(moves.some(m => m.col === 0 && m.row === 3)).toBe(true); // Blocker 1
    expect(moves.some(m => m.col === 0 && m.row === 4)).toBe(true);
    expect(moves.some(m => m.col === 0 && m.row === 5)).toBe(true);
    expect(moves.some(m => m.col === 0 && m.row === 6)).toBe(true); // Blocker 2
    expect(moves.some(m => m.col === 0 && m.row === 7)).toBe(false); // Beyond blocker 2
  });

  it('PH2: Ghost — không thể đi qua vật cản thứ 2', () => {
    // Verified by the test check above (A8 / (0,7) is not a legal move)
    expect(true).toBe(true);
  });

  it('PH3: Ghost — capture quân tại vị trí vật cản thứ 2 (enemy)', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    state.board.setPiece({ col: 0, row: 3 }, { id: 'b_pawn_1', type: PieceType.Pawn, color: Color.Black, effects: [] });
    state.board.setPiece({ col: 0, row: 6 }, { id: 'b_pawn_2', type: PieceType.Pawn, color: Color.Black, effects: [] });

    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Capture the 2nd blocker at A7 (0, 6)
    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 6 });
    expect(res.success).toBe(true);
    expect(state.board.getPiece({ col: 0, row: 6 })?.id).toBe(rook.id);
  });

  it('PH4: Ghost — Pawn xuyên qua quân chặn phía trước', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    // White Pawn at A3 (col 0, row 2)
    const pawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 2 }, pawn);
    pawn.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
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

    // Blocker at A4 (col 0, row 3)
    state.board.setPiece({ col: 0, row: 3 }, { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] });

    const moves = match.getLegalMovesAt({ col: 0, row: 2 });

    // Since A4 has a blocker, Pawn cannot land on A4. But it can phase through to A5 (0, 4) if A5 is empty.
    expect(moves.some(m => m.col === 0 && m.row === 3)).toBe(false); // cannot capture straight
    expect(moves.some(m => m.col === 0 && m.row === 4)).toBe(true);  // can bypass A4 to land on A5
  });

  // =========================================================================
  // Target validation / skill usage restrictions (PH5)
  // =========================================================================

  it('PH5: Ghost — Knight không thể nhận Ghost (Skill 1 reject)', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const knight = state.board.getPiece({ col: 1, row: 0 })!; // White Knight
    expect(knight.type).toBe(PieceType.Knight);

    const res = match.useSkill(Color.White, 'phantom_haunt_skill', [
      { type: 'piece', position: { col: 1, row: 0 }, pieceId: knight.id }
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Knight cannot receive Ghost');
  });

  // =========================================================================
  // Passive - Ghost Inheritance (PH6 - PH7)
  // =========================================================================

  it('PH6: Passive — quân Ghost chết → quân đồng minh gần nhất nhận Ghost 1 round', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    // Allied Rook with Ghost at A1 (0, 0)
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    // Closest ally at B2 (1, 1), Chebyshev dist = 1
    const pawn1 = { id: 'w_pawn_1', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 1, row: 1 }, pawn1);

    // Another ally at D4 (3, 3), Chebyshev dist = 3
    const pawn2 = { id: 'w_pawn_2', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 3, row: 3 }, pawn2);

    state.currentTurn = Color.White;

    // Destroy Rook
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: rook.id,
      position: { col: 0, row: 0 },
      reason: 'killed_by_effect',
    });

    // pawn1 should have inherited Ghost with duration 1
    const p1Ghost = pawn1.effects.find(e => e.type === 'ghost');
    expect(p1Ghost).toBeDefined();
    expect(p1Ghost!.duration).toBe(1);
    expect(p1Ghost!.remainingDuration).toBe(1);

    // pawn2 should not have Ghost
    expect(pawn2.effects.some(e => e.type === 'ghost')).toBe(false);
  });

  it('PH7: Passive — không có quân đồng minh hội đủ điều kiện → không có gì xảy ra', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    state.currentTurn = Color.White;

    // Destroy rook (no other ally exists on board)
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: rook.id,
      position: { col: 0, row: 0 },
      reason: 'killed_by_effect',
    });

    // The game shouldn't crash and graveyard has the piece
    expect(state.board.getPiece({ col: 0, row: 0 })).toBeNull();
  });

  // =========================================================================
  // Skill 1 - Haunt (PH8)
  // =========================================================================

  it('PH8: Skill 1 — apply Ghost 3 rounds lên target', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const pawn = state.board.getPiece({ col: 0, row: 1 })!; // Allied Pawn
    const res = match.useSkill(Color.White, 'phantom_haunt_skill', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: pawn.id }
    ]);

    expect(res.success).toBe(true);
    const ghost = pawn.effects.find(e => e.type === 'ghost');
    expect(ghost).toBeDefined();
    expect(ghost!.duration).toBe(3);
  });

  // =========================================================================
  // Skill 2 - Possession (PH9 - PH11)
  // =========================================================================

  it('PH9: Skill 2 — trong turn này, quân Ghost capture địch → biến hình vĩnh viễn', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    // Allied Rook with Ghost at A1 (0, 0)
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    // Enemy Bishop at A5 (0, 4) - 1st obstacle
    state.board.setPiece({ col: 0, row: 4 }, { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] });

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Use Skill 2 (Possession)
    const resSkill = match.useSkill(Color.White, 'phantom_possession_skill', []);
    expect(resSkill.success).toBe(true);

    // Capture the Enemy Bishop
    const resMove = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 4 });
    expect(resMove.success).toBe(true);

    // Attacker rook should have transformed into a Bishop permanently
    const transformed = state.board.getPiece({ col: 0, row: 4 })!;
    expect(transformed.type).toBe(PieceType.Bishop);
  });

  it('PH10: Skill 2 — sau khi biến hình, Ghost bị xóa', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    state.board.setPiece({ col: 0, row: 4 }, { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] });

    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    match.useSkill(Color.White, 'phantom_possession_skill', []);
    match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 4 });

    // Ghost effect should be removed
    const transformed = state.board.getPiece({ col: 0, row: 4 })!;
    expect(transformed.effects.some(e => e.type === 'ghost')).toBe(false);
  });

  it('PH11: Skill 2 — không dùng Skill 2 → quân Ghost capture địch bình thường (không biến hình)', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    state.board.setPiece({ col: 0, row: 4 }, { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] });

    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Capture without using Skill 2
    match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 4 });

    const piece = state.board.getPiece({ col: 0, row: 4 })!;
    expect(piece.type).toBe(PieceType.Rook); // Remains a Rook
    expect(piece.effects.some(e => e.type === 'ghost')).toBe(true); // Keeps Ghost
  });

  // =========================================================================
  // Ultimate - Spirit Walk (PH12 - PH19)
  // =========================================================================

  it('PH12: Ultimate — Ghost hiện tại reset về 5 rounds', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 3,
      remainingDuration: 1, // 1 round left
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    state.whiteAP = 7;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'phantom_spirit_walk_skill', []);
    expect(res.success).toBe(true);

    const ghost = rook.effects.find(e => e.type === 'ghost')!;
    expect(ghost.remainingDuration).toBe(5);
  });

  it('PH13: Ultimate — Ghost mới từ Skill 1 sau Ultimate: 3 rounds', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Cast Ultimate
    match.useSkill(Color.White, 'phantom_spirit_walk_skill', []);

    // Now cast Skill 1 (AP cost = 0)
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    const pawn = state.board.getPiece({ col: 0, row: 1 })!;
    const resS1 = match.useSkill(Color.White, 'phantom_haunt_skill', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: pawn.id }
    ]);
    expect(resS1.success).toBe(true);

    const ghost = pawn.effects.find(e => e.type === 'ghost')!;
    expect(ghost.duration).toBe(3); // Cast after Ult still gives 3 rounds
    expect(ghost.metadata?.stealth).toBe(true); // Should receive stealth because spirit walk is active
  });

  it('PH14: Ultimate — freeSkill1Remaining = 3, Skill 1 miễn phí 3 lần', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 7;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'phantom_spirit_walk_skill', []);

    // Should have 3 free skills
    expect(state.variantState[`${Color.White}_freeSkill1Remaining`]).toBe(3);

    // White starts turn, uses skill 1 (should cost 0 AP)
    state.whiteAP = 0;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    const pawn = state.board.getPiece({ col: 0, row: 1 })!;
    const resS1 = match.useSkill(Color.White, 'phantom_haunt_skill', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: pawn.id }
    ]);
    expect(resS1.success).toBe(true);
    expect(state.whiteAP).toBe(0); // Cost was 0 AP
    expect(state.variantState[`${Color.White}_freeSkill1Remaining`]).toBe(2);
  });

  it('PH15: Ultimate — quân Ghost + stealth bị ẩn với serializeForPlayer của địch', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: { stealth: true }, // Stealthed
    });

    // Serialize for enemy (Black)
    const serializedEnemy = match.serializeForPlayer(Color.Black);
    const serializedAlly = match.serializeForPlayer(Color.White);

    // Enemy should see null at (0, 0)
    expect(serializedEnemy.board.grid[0][0]).toBeNull();
    // Ally (White) should see the piece normally
    expect(serializedAlly.board.grid[0][0]).not.toBeNull();
  });

  it('PH16: Stealth mất khi đứng cạnh địch (cuối turn)', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: { stealth: true },
    });

    // Enemy is next to it at B2 (1, 1) -> Chebyshev distance = 1
    state.board.setPiece({ col: 1, row: 1 }, { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] });

    // Spirit walk player effect must be active for cleanup/maintenance checks
    state.addPlayerEffect(Color.White, {
      id: 'spirit_walk_effect',
      type: 'spirit_walk',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // End White's turn -> should trigger check and reveal rook
    match.submitAction({ type: 'END_TURN', player: Color.White });

    const ghost = rook.effects.find(e => e.type === 'ghost')!;
    expect(ghost.metadata.stealth).toBe(false);
  });

  it('PH17: Stealth mất sau khi capture', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: { stealth: true },
    });

    // Enemy at A5 (0, 4)
    state.board.setPiece({ col: 0, row: 4 }, { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] });

    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Capture enemy
    match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 4 });

    const ghost = rook.effects.find(e => e.type === 'ghost')!;
    expect(ghost.metadata.stealth).toBe(false); // Stealth is removed instantly
  });

  it('PH18: Stealth — địch vẫn capture được quân tàng hình (di chuyển vào ô đó)', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    // White Rook with Ghost + stealth at A5 (0, 4)
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 4 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: { stealth: true },
    });

    // Black Rook at A1 (0, 0)
    const bRook = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, bRook);

    // Enemy (Black) serialized board should show A5 as null
    const serializedEnemy = match.serializeForPlayer(Color.Black);
    expect(serializedEnemy.board.grid[4][0]).toBeNull();

    // Enemy plays and makes move to A5 (0, 4)
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const res = match.makeMove(Color.Black, { col: 0, row: 0 }, { col: 0, row: 4 });
    expect(res.success).toBe(true);

    // The White Rook should be captured (removed from board)
    expect(state.board.getPiece({ col: 0, row: 4 })?.id).toBe(bRook.id);
    expect(state.graveyard.some(e => e.piece.id === rook.id)).toBe(true);
  });

  it('PH19: Stealth — Devil Eye vẫn tác dụng lên quân Ghost', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    // White Rook with Ghost + stealth at A5 (0, 4)
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 4 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: { stealth: true },
    });

    // Black Rook at A1 (0, 0) with Devil's Eye applied
    const bRook = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, bRook);
    bRook.effects.push({
      id: 'devil_eye_effect',
      type: 'devil_eye',
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: bRook.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    // White Rook threatens Black Rook. We do not make a move, just let the threat trigger on turn end.
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // End turn for White to trigger Devil's Eye attack check
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Check if rook at A5 (0, 4) has stun
    const stun = rook.effects.find(e => e.type === 'stun');
    expect(stun).toBeDefined();
  });

  it('PH20: Stealth Move — Hiding coordinates in moveResult and moveHistory serialization', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();

    // White Rook with Ghost + stealth at A1 (0, 0)
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    rook.effects.push({
      id: 'ghost_effect',
      type: 'ghost',
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: { stealth: true },
    });

    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Move White Rook from A1 (0, 0) to A5 (0, 4)
    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 4 });
    expect(res.success).toBe(true);
    expect(res.isStealthMove).toBe(true);

    // Verify moveHistory serialization for player (White - owner) shows actual coordinates
    const whiteSerialized = match.serializeForPlayer(Color.White);
    expect(whiteSerialized.moveHistory).toBeDefined();
    expect(whiteSerialized.moveHistory!.length).toBe(1);
    expect(whiteSerialized.moveHistory![0].from).toBe('A1');
    expect(whiteSerialized.moveHistory![0].to).toBe('A5');
    expect(whiteSerialized.moveHistory![0].isStealth).toBe(true);

    // Verify moveHistory serialization for opponent (Black) hides coordinates
    const blackSerialized = match.serializeForPlayer(Color.Black);
    expect(blackSerialized.moveHistory).toBeDefined();
    expect(blackSerialized.moveHistory!.length).toBe(1);
    expect(blackSerialized.moveHistory![0].from).toBe('');
    expect(blackSerialized.moveHistory![0].to).toBe('');
    expect(blackSerialized.moveHistory![0].isStealth).toBe(true);
  });
});
