import {
  Match,
  Color,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  VerdantDragonVariant,
} from 'game-core';

describe('Chess Variant Engine - Verdant Dragon Variant (TDD)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('verdant_dragon', 'lightning');
  });

  // =========================================================================
  // Passive & AP Counter tests (VD1 - VD3)
  // =========================================================================

  it('VD1: Passive — địch dùng skill → Verdant Dragon nhận +3 AP', () => {
    match.start();
    const state = match.getGameState();
    state.blackAP = 10;
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';

    const initialWhiteAP = state.whiteAP;

    // Opponent uses a skill
    const res = match.useSkill(Color.Black, 'lightning_thunder_trap', [{ type: 'cell', position: { col: 5, row: 5 } }]);
    expect(res.success).toBe(true);

    // Verdant Dragon player (White) should receive +3 AP immediately
    expect(state.whiteAP).toBe(initialWhiteAP + 3);
  });

  it('VD2: Passive — mọi nguồn AP đều tăng dragonCounter đúng amount', () => {
    match.start();
    const state = match.getGameState();
    
    // Manually gain AP via pipeline
    state.variantState.dragonCounter = 0;
    match.submitAction({
      type: 'GAIN_AP',
      player: Color.White,
      amount: 5,
      source: 'test',
    });

    expect(state.variantState.dragonCounter).toBe(5);

    match.submitAction({
      type: 'GAIN_AP',
      player: Color.White,
      amount: 15,
      source: 'test_2',
    });

    expect(state.variantState.dragonCounter).toBe(20);
  });

  it('VD3: Passive — dragonCounter không giảm khi dùng skills', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.variantState.dragonCounter = 42;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPawn = state.board.getPiece({ col: 0, row: 1 })!;
    const res = match.useSkill(Color.White, 'verdant_dragon_verdant_shelter', [{ type: 'piece', position: { col: 0, row: 1 }, pieceId: allyPawn.id }]);
    expect(res.success).toBe(true);

    // AP is deducted, but dragonCounter is untouched
    expect(state.whiteAP).toBe(7); // 10 - 3
    expect(state.variantState.dragonCounter).toBe(42);
  });

  // =========================================================================
  // Skill 1 - Verdant Shelter tests (VD4 - VD7)
  // =========================================================================

  it('VD4: Skill 1 — apply Verdant Shelter lên quân đồng minh', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 5;

    const allyPawn = state.board.getPiece({ col: 0, row: 1 })!;
    const res = match.useSkill(Color.White, 'verdant_dragon_verdant_shelter', [{ type: 'piece', position: { col: 0, row: 1 }, pieceId: allyPawn.id }]);
    expect(res.success).toBe(true);

    expect(allyPawn.effects.some(e => e.type === 'verdant_shelter')).toBe(true);
    const shelter = allyPawn.effects.find(e => e.type === 'verdant_shelter')!;
    expect(shelter.duration).toBe(4); // 4 rounds
    expect(shelter.isDebuff).toBe(false);
  });

  it('VD5: Skill 1 — địch capture quân có Shelter → địch nhận CAPTURE_AP/2 (floor)', () => {
    match.start();
    const state = match.getGameState();

    // Spawn a White Bishop at (4, 4) and give it Verdant Shelter
    const whiteBishop = { id: 'w_bishop_test', type: PieceType.Bishop, color: Color.White, effects: [] as any[] };
    state.board.setPiece({ col: 4, row: 4 }, whiteBishop);
    whiteBishop.effects.push({
      id: 'shelter_test',
      type: 'verdant_shelter',
      duration: 4,
      remainingDuration: 4,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: whiteBishop.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    // Place a Black Rook at (4, 5) to capture it
    state.board.setPiece({ col: 4, row: 5 }, { id: 'b_rook_test', type: PieceType.Rook, color: Color.Black, effects: [] });

    // Turn is Black
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.blackAP = 0;

    // Black Rook captures White Bishop
    const moveRes = match.makeMove(Color.Black, { col: 4, row: 5 }, { col: 4, row: 4 });
    expect(moveRes.success).toBe(true);

    // Normal Bishop CAPTURE_AP is 3. Halved (Math.floor(3/2)) = 1 AP reward for Black
    expect(state.blackAP).toBe(1);
  });

  it('VD6: Skill 1 — ta nhận LOSS_AP bình thường khi quân Shelter bị ăn', () => {
    match.start();
    const state = match.getGameState();

    // Spawn a White Bishop at (4, 4) and shelter it
    const whiteBishop = { id: 'w_bishop_test', type: PieceType.Bishop, color: Color.White, effects: [] as any[] };
    state.board.setPiece({ col: 4, row: 4 }, whiteBishop);
    whiteBishop.effects.push({
      id: 'shelter_test',
      type: 'verdant_shelter',
      duration: 4,
      remainingDuration: 4,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: whiteBishop.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    // Place a Black Rook at (4, 5)
    state.board.setPiece({ col: 4, row: 5 }, { id: 'b_rook_test', type: PieceType.Rook, color: Color.Black, effects: [] });

    // Turn is Black
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.whiteAP = 0;

    // Black captures White Bishop
    match.makeMove(Color.Black, { col: 4, row: 5 }, { col: 4, row: 4 });

    // Bishop LOSS_AP is 2. White should receive 2 AP
    expect(state.whiteAP).toBe(2);
  });

  it('VD7: Skill 1 — quân Shelter bị Bomb destroy → Shelter vẫn trigger (half AP cho địch)', () => {
    match.start();
    const state = match.getGameState();

    // Spawn White Bishop at (4, 4) and shelter it
    const whiteBishop = { id: 'w_bishop_test', type: PieceType.Bishop, color: Color.White, effects: [] as any[] };
    state.board.setPiece({ col: 4, row: 4 }, whiteBishop);
    whiteBishop.effects.push({
      id: 'shelter_test',
      type: 'verdant_shelter',
      duration: 4,
      remainingDuration: 4,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: whiteBishop.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    });

    state.blackAP = 0;
    state.whiteAP = 0;

    // Simulate effect-based destruction
    const res = match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: whiteBishop.id,
      position: { col: 4, row: 4 },
      reason: 'explosion',
    });
    expect(res.success).toBe(true);

    // Opponent (Black) receives Math.floor(3 / 2) = 1 AP
    expect(state.blackAP).toBe(1);
    // Owner (White) receives standard loss reward = 2 AP
    expect(state.whiteAP).toBe(2);
  });

  // =========================================================================
  // Skill 2 - Dragon's Gaze tests (VD8 - VD11)
  // =========================================================================

  it('VD8: Skill 2 — apply Dragon\'s Gaze lên quân địch', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const enemyPawn = state.board.getPiece({ col: 0, row: 13 })!;
    const res = match.useSkill(Color.White, 'verdant_dragon_dragons_gaze', [{ type: 'piece', position: { col: 0, row: 13 }, pieceId: enemyPawn.id }]);
    expect(res.success).toBe(true);

    expect(enemyPawn.effects.some(e => e.type === 'dragon_gaze')).toBe(true);
    const gaze = enemyPawn.effects.find(e => e.type === 'dragon_gaze')!;
    expect(gaze.duration).toBe(2); // 2 rounds
    expect(gaze.isDebuff).toBe(false);
  });

  it('VD9: Skill 2 — địch di chuyển quân Gaze → Verdant Dragon +2 AP, effect expire ngay', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const enemyPawn = state.board.getPiece({ col: 0, row: 13 })!;
    match.useSkill(Color.White, 'verdant_dragon_dragons_gaze', [{ type: 'piece', position: { col: 0, row: 13 }, pieceId: enemyPawn.id }]);

    // End White turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black's turn: move gazed pawn
    state.hasMoved = false;
    const initialWhiteAP = state.whiteAP;
    const moveRes = match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 12 });
    expect(moveRes.success).toBe(true);

    // Verdant Dragon (White) gets +2 AP, gaze effect is removed
    expect(state.whiteAP).toBe(initialWhiteAP + 2);
    expect(enemyPawn.effects.some(e => e.type === 'dragon_gaze')).toBe(false);
  });

  it('VD10: Skill 2 — địch di chuyển quân Gaze bằng capture → cũng trigger +2 AP', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    // Black Rook at (4, 5) and White Pawn at (4, 4)
    state.board.setPiece({ col: 4, row: 5 }, { id: 'b_rook_test', type: PieceType.Rook, color: Color.Black, effects: [] });
    state.board.setPiece({ col: 4, row: 4 }, { id: 'w_pawn_test', type: PieceType.Pawn, color: Color.White, effects: [] });

    const enemyRook = state.board.getPiece({ col: 4, row: 5 })!;
    match.useSkill(Color.White, 'verdant_dragon_dragons_gaze', [{ type: 'piece', position: { col: 4, row: 5 }, pieceId: enemyRook.id }]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black rook captures
    state.hasMoved = false;
    const initialWhiteAP = state.whiteAP;
    const moveRes = match.makeMove(Color.Black, { col: 4, row: 5 }, { col: 4, row: 4 });
    expect(moveRes.success).toBe(true);

    // Verdant Dragon (White) gets +2 AP, gaze effect is removed, +1 AP for Pawn loss reward
    expect(state.whiteAP).toBe(initialWhiteAP + 3);
    expect(enemyRook.effects.some(e => e.type === 'dragon_gaze')).toBe(false);
  });

  it('VD11: Skill 2 — địch không di chuyển trong 2 vòng → địch bị trừ 2 AP khi expire', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const enemyPawn = state.board.getPiece({ col: 0, row: 13 })!;
    match.useSkill(Color.White, 'verdant_dragon_dragons_gaze', [{ type: 'piece', position: { col: 0, row: 13 }, pieceId: enemyPawn.id }]);

    state.blackAP = 5;

    // Fast-forward 2 rounds without moving that piece (4 ticks)
    // T1: End White 1
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // T2: End Black 1
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    
    // T3: End White 2
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // T4: End Black 2
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Expired. Opponent (Black) AP should be reduced by 2
    expect(state.blackAP).toBe(3); // 5 - 2
    expect(enemyPawn.effects.some(e => e.type === 'dragon_gaze')).toBe(false);
  });

  // =========================================================================
  // Ultimate - Emerald Domain tests (VD12 - VD14)
  // =========================================================================

  it('VD12: Ultimate (Emerald Domain) — 3 quân địch bị Root 3 vòng', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const target1 = state.board.getPiece({ col: 0, row: 13 })!;
    const target2 = state.board.getPiece({ col: 1, row: 13 })!;
    const target3 = state.board.getPiece({ col: 2, row: 13 })!;

    const res = match.useSkill(Color.White, 'verdant_dragon_ultimate', [
      { type: 'piece', position: { col: 0, row: 13 }, pieceId: target1.id },
      { type: 'piece', position: { col: 1, row: 13 }, pieceId: target2.id },
      { type: 'piece', position: { col: 2, row: 13 }, pieceId: target3.id },
    ]);
    expect(res.success).toBe(true);

    // Stun applied
    expect(target1.effects.some(e => e.type === 'stun')).toBe(true);
    expect(target2.effects.some(e => e.type === 'stun')).toBe(true);
    expect(target3.effects.some(e => e.type === 'stun')).toBe(true);

    const stun = target1.effects.find(e => e.type === 'stun')!;
    expect(stun.duration).toBe(3); // 3 rounds

  });

  it('VD13: Ultimate (Emerald Domain) — địch dùng skill tốn +1 AP (cost modifier active)', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const target1 = state.board.getPiece({ col: 0, row: 13 })!;
    const target2 = state.board.getPiece({ col: 1, row: 13 })!;
    const target3 = state.board.getPiece({ col: 2, row: 13 })!;

    match.useSkill(Color.White, 'verdant_dragon_ultimate', [
      { type: 'piece', position: { col: 0, row: 13 }, pieceId: target1.id },
      { type: 'piece', position: { col: 1, row: 13 }, pieceId: target2.id },
      { type: 'piece', position: { col: 2, row: 13 }, pieceId: target3.id },
    ]);

    // Opponent player (Black) should carry 'emerald_domain' player effect
    expect(state.blackPlayerEffects.some(e => e.type === 'emerald_domain')).toBe(true);

    // Turn switches to Black
    match.submitAction({ type: 'END_TURN', player: Color.White });

    state.blackAP = 10;
    state.hasMoved = false;

    // Normal lightning_thunder_trap costs 3 AP. Under Emerald Domain, it should cost 4 AP.
    const skillRes = match.useSkill(Color.Black, 'lightning_thunder_trap', [{ type: 'cell', position: { col: 5, row: 5 } }]);
    expect(skillRes.success).toBe(true);

    expect(state.blackAP).toBe(6); // 10 - 4
  });

  it('VD14: Ultimate (Emerald Domain) — Verdant Dragon nhận ceil(actualCost/2) AP khi địch dùng skill', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    const target1 = state.board.getPiece({ col: 0, row: 13 })!;
    const target2 = state.board.getPiece({ col: 1, row: 13 })!;
    const target3 = state.board.getPiece({ col: 2, row: 13 })!;

    match.useSkill(Color.White, 'verdant_dragon_ultimate', [
      { type: 'piece', position: { col: 0, row: 13 }, pieceId: target1.id },
      { type: 'piece', position: { col: 1, row: 13 }, pieceId: target2.id },
      { type: 'piece', position: { col: 2, row: 13 }, pieceId: target3.id },
    ]);

    // End White's turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    state.blackAP = 10;
    state.hasMoved = false;

    const initialWhiteAP = state.whiteAP; // Gained some AP from turn switches/etc.

    // Opponent (Black) uses skill (actualCost = 4)
    match.useSkill(Color.Black, 'lightning_thunder_trap', [{ type: 'cell', position: { col: 5, row: 5 } }]);

    // Verdant Dragon (White) should receive Math.ceil(4 / 2) = 2 AP plus 3 AP passive skill check
    expect(state.whiteAP).toBe(initialWhiteAP + 5);
  });

  // =========================================================================
  // Ultimate Hidden - Dragon's Wrath tests (VD15 - VD18)
  // =========================================================================

  it('VD15: Ultimate (Dragon\'s Wrath) — available khi dragonCounter >= 100, cost 0 AP', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 0;
    state.variantState.dragonCounter = 100;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const reqs = match.getVariantRegistry().get('verdant_dragon')?.skills.find(s => s.id === 'verdant_dragon_ultimate')?.getTargetRequirements(state, Color.White);
    // Dragon's Wrath requirements should be empty (no targets)
    expect(reqs).toEqual([]);

    // Execute with 0 AP
    const res = match.useSkill(Color.White, 'verdant_dragon_ultimate', []);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(0); // Cost 0 AP
  });

  it('VD16: Dragon\'s Wrath — Stun tất cả địch trong hàng 6-9 (15x4) trong 2 vòng', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.variantState.dragonCounter = 100;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Spawn some Black pieces in row 7 (inside rows 6-9)
    const enemy1 = { id: 'b1', type: PieceType.Pawn, color: Color.Black, effects: [] as any[] };
    const enemy2 = { id: 'b2', type: PieceType.Rook, color: Color.Black, effects: [] as any[] };
    state.board.setPiece({ col: 2, row: 7 }, enemy1);
    state.board.setPiece({ col: 5, row: 8 }, enemy2);

    // Spawn a White piece in row 7 (should NOT be stunned)
    const ally1 = { id: 'w1', type: PieceType.Pawn, color: Color.White, effects: [] as any[] };
    state.board.setPiece({ col: 3, row: 7 }, ally1);

    // Execute
    match.useSkill(Color.White, 'verdant_dragon_ultimate', []);

    // Enemies stunned for 2 rounds (duration 4)
    expect(enemy1.effects.some(e => e.type === 'stun')).toBe(true);
    expect(enemy2.effects.some(e => e.type === 'stun')).toBe(true);
    expect(enemy1.effects.find(e => e.type === 'stun')?.duration).toBe(4);

    // Ally NOT stunned
    expect(ally1.effects.some(e => e.type === 'stun')).toBe(false);
  });

  it('VD17: Dragon\'s Wrath — địch bị trừ 3 AP ngay lập tức', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.variantState.dragonCounter = 100;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.blackAP = 8;

    match.useSkill(Color.White, 'verdant_dragon_ultimate', []);

    // Black AP should be 8 - 3 = 5
    expect(state.blackAP).toBe(5);
  });

  it('VD18: Dragon\'s Wrath — dragonCounter reset về 0, Ultimate trở về Emerald Domain', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.variantState.dragonCounter = 100;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'verdant_dragon_ultimate', []);

    // Counter resets to 0
    expect(state.variantState.dragonCounter).toBe(0);

    // Cost goes back to 9 AP
    const ultCost = match.getVariantRegistry().get('verdant_dragon')?.skills.find(s => s.id === 'verdant_dragon_ultimate')?.apCost(state, Color.White);
    expect(ultCost).toBe(9);
  });

  // =========================================================================
  // Regression Check (VD19)
  // =========================================================================

  it('VD19: Regression — AP từ nguồn khác không bị ảnh hưởng', () => {
    match.start();
    const state = match.getGameState();

    // Standard capture reward should award normal CAPTURE_AP if target not sheltered
    const whitePawn = { id: 'w_pawn_test', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 5, row: 5 }, whitePawn);
    state.board.setPiece({ col: 5, row: 6 }, { id: 'b_rook_test', type: PieceType.Rook, color: Color.Black, effects: [] });

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.blackAP = 0;

    match.makeMove(Color.Black, { col: 5, row: 6 }, { col: 5, row: 5 });

    // Black Rook captures unsheltered White Pawn. Attacker receives normal CAPTURE_AP (2)
    expect(state.blackAP).toBe(2);
  });
});
