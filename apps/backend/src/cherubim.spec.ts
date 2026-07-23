import {
  Match,
  Color,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  CherubimVariant,
} from 'game-core';

describe('Chess Variant Engine - Cherubim Variant (TDD)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('cherubim', 'lightning');
  });

  // =========================================================================
  // Passive - Dual Casting tests (C1-C4)
  // =========================================================================

  it('C1: Passive — dùng S1 + S2 trong cùng 1 lượt → cả 2 đều thành công', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Target ally pawn at (0, 1)
    const allyPawn = state.board.getPiece({ col: 0, row: 1 })!;
    const resS1 = match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: allyPawn.id },
    ]);
    expect(resS1.success).toBe(true);

    // Target empty cell at (5, 5)
    const resS2 = match.useSkill(Color.White, 'cherubim_fountain_of_youth', [
      { type: 'cell', position: { col: 5, row: 5 } },
    ]);
    expect(resS2.success).toBe(true);

    expect(state.skillsUsedThisTurn).toBe(2);
  });

  it('C2: Passive — dùng S1 + S1 trong cùng 1 lượt → lần 2 bị reject', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = state.board.getPiece({ col: 0, row: 1 })!;
    const p2 = state.board.getPiece({ col: 1, row: 1 })!;

    const res1 = match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: p1.id },
    ]);
    expect(res1.success).toBe(true);

    const res2 = match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 1, row: 1 }, pieceId: p2.id },
    ]);
    expect(res2.success).toBe(false);
    expect(res2.reason).toContain('already used this turn');
  });

  it('C3: Passive — dùng S1 + Ultimate trong cùng 1 lượt → cả 2 đều thành công', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPawn = state.board.getPiece({ col: 0, row: 1 })!;
    const resS1 = match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: allyPawn.id },
    ]);
    expect(resS1.success).toBe(true);

    // Case B ultimate (spawns pawn in player's half)
    const resUlt = match.useSkill(Color.White, 'cherubim_divine_ascension', [
      { type: 'cell', position: { col: 3, row: 3 } },
    ]);
    expect(resUlt.success).toBe(true);
    expect(state.skillsUsedThisTurn).toBe(2);
  });

  it('C4: Passive — dùng 3 skill trong cùng lượt → lần 3 bị reject', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 20;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = state.board.getPiece({ col: 0, row: 1 })!;
    const resS1 = match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: p1.id },
    ]);
    expect(resS1.success).toBe(true);

    const resS2 = match.useSkill(Color.White, 'cherubim_fountain_of_youth', [
      { type: 'cell', position: { col: 5, row: 5 } },
    ]);
    expect(resS2.success).toBe(true);

    const resUlt = match.useSkill(Color.White, 'cherubim_divine_ascension', [
      { type: 'cell', position: { col: 3, row: 3 } },
    ]);
    expect(resUlt.success).toBe(false);
    expect(resUlt.reason).toContain('maximum skills');
  });

  // =========================================================================
  // Skill 1 - Ascend tests (C5-C9)
  // =========================================================================

  it('C5: Skill 1 — apply Ascend lên Pawn đồng minh', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const pawn = state.board.getPiece({ col: 0, row: 1 })!;
    const res = match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: pawn.id },
    ]);

    expect(res.success).toBe(true);
    expect(pawn.effects).toBeDefined();
    const ascend = pawn.effects.find(e => e.type === 'ascend');
    expect(ascend).toBeDefined();
    expect(ascend!.metadata.roundsElapsed).toBe(0);
    expect(ascend!.metadata.completed).toBe(false);
  });

  it('C6: Skill 1 — không thể target quân không phải Pawn', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const rook = state.board.getPiece({ col: 0, row: 0 })!; // White Rook
    expect(rook.type).toBe(PieceType.Rook);

    const res = match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 0 }, pieceId: rook.id },
    ]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('Only Pawns');
  });

  it('C7: Ascend — sau 5 rounds: metadata.completed = true', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const pawn = state.board.getPiece({ col: 0, row: 1 })!;
    match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: pawn.id },
    ]);

    // Fast-forward 5 completed rounds.
    // Since the turn it is cast is skipped, we need 6 turn ends to count 5 rounds.
    for (let round = 1; round <= 6; round++) {
      // White ends turn
      match.submitAction({ type: 'END_TURN', player: Color.White });
      // Black ends turn
      match.submitAction({ type: 'END_TURN', player: Color.Black });
    }

    const ascend = pawn.effects.find(e => e.type === 'ascend')!;
    expect(ascend.metadata.roundsElapsed).toBe(5);
    expect(ascend.metadata.completed).toBe(true);
  });

  it('C8: Ascend — Pawn bị ăn trước 5 rounds: effect tự biến mất cùng quân', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const pawn = state.board.getPiece({ col: 0, row: 1 })!;
    match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: pawn.id },
    ]);

    // Destroy the piece
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: pawn.id,
      position: { col: 0, row: 1 },
      reason: 'capture',
    });

    const boardPiece = state.board.getPiece({ col: 0, row: 1 });
    expect(boardPiece).toBeNull();
  });

  it('C9: Ascend — Pawn tự promote bình thường (đến cuối bàn): Ascend bị remove', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Setup Pawn near back rank
    state.board = new Board();
    const pawn = { id: 'w_pawn_test', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 0, row: 13 }, pawn);

    // Apply ascend
    match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 13 }, pieceId: pawn.id },
    ]);

    expect(pawn.effects.some(e => e.type === 'ascend')).toBe(true);

    // Move to rank 15 (row 14) to promote
    state.hasMoved = false;
    const moveRes = match.makeMove(Color.White, { col: 0, row: 13 }, { col: 0, row: 14 });
    expect(moveRes.success).toBe(true);

    const promoted = state.board.getPiece({ col: 0, row: 14 })!;
    expect(promoted.type).toBe(PieceType.Queen);
    // Ascend should be removed
    expect(promoted.effects.some(e => e.type === 'ascend')).toBe(false);
  });

  // =========================================================================
  // Skill 2 - Fountain of Youth tests (C10-C18)
  // =========================================================================

  it('C10: Skill 2 — spawn Totem tại ô trống → Totem xuất hiện trên board', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'cherubim_fountain_of_youth', [
      { type: 'cell', position: { col: 5, row: 5 } },
    ]);

    expect(res.success).toBe(true);
    const piece = state.board.getPiece({ col: 5, row: 5 })!;
    expect(piece).toBeDefined();
    expect(piece.specialType).toBe('totem');
    expect(piece.effects.some(e => e.type === 'totem_timer')).toBe(true);
  });

  it('C11: Totem — địch không thể đi vào ô có Totem trừ khi capture nó', () => {
    match.start();
    const state = match.getGameState();
    
    // Spawn Totem for White at (5, 5)
    state.board.setPiece({ col: 5, row: 5 }, { id: 'totem_w', type: 'totem', color: Color.White, specialType: 'totem', effects: [] });

    // Place Black Knight at (4, 3)
    const knight = { id: 'b_knight_test', type: PieceType.Knight, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 4, row: 3 }, knight);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Black Knight moves onto Totem -> this is a capture, which is allowed.
    // If it was an ally moving onto it, it would be rejected.
    const res = match.makeMove(Color.Black, { col: 4, row: 3 }, { col: 5, row: 5 });
    expect(res.success).toBe(true);
  });

  it('C12: Totem — địch capture Totem → Totem biến mất, không bên nào nhận AP', () => {
    match.start();
    const state = match.getGameState();
    
    // Spawn Totem at (5, 5)
    state.board.setPiece({ col: 5, row: 5 }, { id: 'totem_w', type: 'totem', color: Color.White, specialType: 'totem', effects: [] });

    // Place Black Knight at (4, 3)
    const knight = { id: 'b_knight_test', type: PieceType.Knight, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 4, row: 3 }, knight);

    state.whiteAP = 10;
    state.blackAP = 10;
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Black Rook captures
    match.makeMove(Color.Black, { col: 4, row: 3 }, { col: 5, row: 5 });

    expect(state.board.getPiece({ col: 5, row: 5 })!.id).toBe(knight.id); // Knight occupies the cell
    expect(state.whiteAP).toBe(10); // White lost 0 AP
    expect(state.blackAP).toBe(10); // Black gained 0 AP
  });

  it('C13: Totem — cleanse mỗi turn: board effect trong 3x3 bị xóa', () => {
    match.start();
    const state = match.getGameState();

    // Spawn Totem at (5, 5)
    state.board.setPiece({ col: 5, row: 5 }, { id: 'totem_w', type: 'totem', color: Color.White, specialType: 'totem', effects: [] });

    // Place cell effect near totem
    state.board.addCellEffect({ col: 4, row: 5 }, {
      id: 'trap_test',
      type: 'thunder_trap',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'cell',
      targetId: '4,5',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    expect(state.board.getCellEffects({ col: 4, row: 5 }).length).toBe(1);

    // End turn -> cleanse should trigger
    match.submitAction({ type: 'END_TURN', player: Color.White });

    expect(state.board.getCellEffects({ col: 4, row: 5 }).length).toBe(0);
  });

  it('C14: Totem — cleanse mỗi turn: debuff trên quân đồng minh trong 3x3 bị xóa', () => {
    match.start();
    const state = match.getGameState();

    // Spawn Totem for White at (5, 5)
    state.board.setPiece({ col: 5, row: 5 }, { id: 'totem_w', type: 'totem', color: Color.White, specialType: 'totem', effects: [] });

    // Ally piece near Totem
    const ally = { id: 'w_ally', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 4, row: 5 }, ally);

    // Add debuff (stun) and buff (shield) to ally
    const stun: Effect = {
      id: 'stun_ally',
      type: 'stun',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: ally.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    const shield: Effect = {
      id: 'shield_ally',
      type: 'shield',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: ally.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    };
    ally.effects.push(stun, shield);

    // End turn -> triggers cleanse
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Stun should be removed, Shield should remain (only debuffs removed for ally)
    expect(ally.effects.some(e => e.id === 'stun_ally')).toBe(false);
    expect(ally.effects.some(e => e.id === 'shield_ally')).toBe(true);
  });

  it('C15: Totem — cleanse mỗi turn: TẤT CẢ effects trên quân địch trong 3x3 bị xóa', () => {
    match.start();
    const state = match.getGameState();

    // Spawn Totem for White at (5, 5)
    state.board.setPiece({ col: 5, row: 5 }, { id: 'totem_w', type: 'totem', color: Color.White, specialType: 'totem', effects: [] });

    // Enemy piece near Totem
    const enemy = { id: 'b_enemy', type: PieceType.Pawn, color: Color.Black, effects: [] as Effect[] };
    state.board.setPiece({ col: 4, row: 5 }, enemy);

    const shield: Effect = {
      id: 'shield_enemy',
      type: 'shield',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: enemy.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    };
    enemy.effects.push(shield);

    // End turn -> cleanse
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Shield should be removed (all effects removed for enemy)
    expect(enemy.effects.some(e => e.id === 'shield_enemy')).toBe(false);
  });

  it('C16: Totem — Ascend KHÔNG bị xóa bởi Fountain of Youth cleanse', () => {
    match.start();
    const state = match.getGameState();

    // Spawn Totem for White at (5, 5)
    state.board.setPiece({ col: 5, row: 5 }, { id: 'totem_w', type: 'totem', color: Color.White, specialType: 'totem', effects: [] });

    // Ally Pawn with ascend near Totem
    const ally = { id: 'w_ally', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece({ col: 4, row: 5 }, ally);

    const ascend: Effect = {
      id: 'ascend_ally',
      type: 'ascend',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: ally.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    ally.effects.push(ascend);

    // End turn -> cleanse
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Ascend must not be removed!
    expect(ally.effects.some(e => e.id === 'ascend_ally')).toBe(true);
  });

  it('C17: Totem — tự destroy sau 3 rounds', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'cherubim_fountain_of_youth', [
      { type: 'cell', position: { col: 5, row: 5 } },
    ]);

    const totem = state.board.getPiece({ col: 5, row: 5 })!;
    expect(totem).toBeDefined();

    // End 3 rounds of duration. Since first turn end is skipped, we need 4 turn ends.
    for (let round = 1; round <= 4; round++) {
      match.submitAction({ type: 'END_TURN', player: Color.White });
      match.submitAction({ type: 'END_TURN', player: Color.Black });
    }

    const deadTotem = state.board.getPiece({ col: 5, row: 5 });
    expect(deadTotem).toBeNull(); // Totem timer expired and destroyed
  });

  it('C18: Totem — bị capture trước 3 rounds → cleanse dừng ngay', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'cherubim_fountain_of_youth', [
      { type: 'cell', position: { col: 5, row: 5 } },
    ]);

    const totem = state.board.getPiece({ col: 5, row: 5 })!;

    // Destroy Totem manually (simulate capture)
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: totem.id,
      position: { col: 5, row: 5 },
      reason: 'capture',
    });

    // Add a cell effect near dead Totem
    state.board.addCellEffect({ col: 4, row: 5 }, {
      id: 'trap_test',
      type: 'thunder_trap',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'cell',
      targetId: '4,5',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    // End turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Cell effect must NOT be removed because Totem is dead
    expect(state.board.getCellEffects({ col: 4, row: 5 }).length).toBe(1);
  });

  // =========================================================================
  // Ultimate - Divine Ascension tests (C19-C23)
  // =========================================================================

  it('C19: Ultimate (case A) — Pawn có completed Ascend → trở thành Queen vĩnh viễn', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 12;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const pawn = state.board.getPiece({ col: 0, row: 1 })!;
    pawn.effects.push({
      id: 'manual_ascend',
      type: 'ascend',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: pawn.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: { roundsElapsed: 5, completed: true },
    });

    // Use Ultimate (requires 0 targets as Case A is active)
    const res = match.useSkill(Color.White, 'cherubim_divine_ascension', []);
    expect(res.success).toBe(true);

    const promotedPiece = state.board.getPiece({ col: 0, row: 1 })!;
    expect(promotedPiece.type).toBe(PieceType.Queen);
  });

  it('C20: Ultimate (case A) — Ascend bị remove sau khi promote', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 12;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const pawn = state.board.getPiece({ col: 0, row: 1 })!;
    pawn.effects.push({
      id: 'manual_ascend',
      type: 'ascend',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: pawn.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: { roundsElapsed: 5, completed: true },
    });

    match.useSkill(Color.White, 'cherubim_divine_ascension', []);

    const promotedPiece = state.board.getPiece({ col: 0, row: 1 })!;
    expect(promotedPiece.effects.some(e => e.type === 'ascend')).toBe(false);
  });

  it('C21: Ultimate (case A) — Queen mới không thể promote thêm (đã là Queen)', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 12;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // White Pawn at A2 -> White Queen at A2
    const pawn = state.board.getPiece({ col: 0, row: 1 })!;
    pawn.effects.push({
      id: 'manual_ascend',
      type: 'ascend',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: pawn.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: { roundsElapsed: 5, completed: true },
    });

    match.useSkill(Color.White, 'cherubim_divine_ascension', []);

    const promotedPiece = state.board.getPiece({ col: 0, row: 1 })!;
    expect(promotedPiece.type).toBe(PieceType.Queen);

    // Give some more AP and try to target it with S1 (Ascend)
    state.whiteAP = 5;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    const res = match.useSkill(Color.White, 'cherubim_ascend', [
      { type: 'piece', position: { col: 0, row: 1 }, pieceId: promotedPiece.id },
    ]);
    expect(res.success).toBe(false); // Only Pawns can be targeted by Ascend!
  });

  it('C22: Ultimate (case B) — không có Pawn đủ điều kiện → spawn Pawn mới tại ô player chọn', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 12;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Cell at (3, 3) is empty and in White's half (row <= 6)
    const res = match.useSkill(Color.White, 'cherubim_divine_ascension', [
      { type: 'cell', position: { col: 3, row: 3 } },
    ]);

    expect(res.success).toBe(true);
    const spawnedPiece = state.board.getPiece({ col: 3, row: 3 })!;
    expect(spawnedPiece).toBeDefined();
    expect(spawnedPiece.type).toBe(PieceType.Pawn);
    expect(spawnedPiece.color).toBe(Color.White);
  });

  it('C23: Ultimate (case B) — ô spawn phải thuộc nửa sân của player (invalid ô bị reject)', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 12;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Target is cell (3, 10), which is in Black's half (row >= 8)
    const res = match.useSkill(Color.White, 'cherubim_divine_ascension', [
      { type: 'cell', position: { col: 3, row: 10 } },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('own half');
  });

  it('C24: Ultimate (case B) — availableSkillTargets chỉ chứa các ô thuộc nửa sân của player', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 12;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const serialized = match.serializeForPlayer(Color.White);
    const ultTargets = serialized.availableSkillTargets['cherubim_divine_ascension'];
    expect(ultTargets).toBeDefined();

    const validPositions = ultTargets.validPositions[0];
    expect(validPositions.length).toBeGreaterThan(0);
    for (const pos of validPositions) {
      expect(pos.row).toBeLessThanOrEqual(6);
    }
  });
});
