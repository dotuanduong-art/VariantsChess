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

describe('Chess Variant Engine - Kazehime Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // K1: Passive — dùng skill khi windSigils > 0 → thành công, windSigils giảm 1
  it('K1: Passive — dùng skill khi windSigils > 0 -> thành công, windSigils giảm 1', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    expect(state.variantState.windSigils).toBe(6);

    const res = match.useSkill(Color.White, 'kaze_repel', [
      { type: 'cell', position: { col: 4, row: 4 } },
    ]);

    expect(res.success).toBe(true);
    expect(state.variantState.windSigils).toBe(5);
  });

  // K2: Passive — dùng skill khi windSigils = 0 → reject
  it('K2: Passive — dùng skill khi windSigils = 0 -> reject', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.variantState.windSigils = 0;

    const res = match.useSkill(Color.White, 'kaze_repel', [
      { type: 'cell', position: { col: 4, row: 4 } },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('No Wind Sigils remaining');
  });

  // K3: Passive — Skill 1 batch expire (trigger) → windSigils tăng 1 trở lại
  it('K3: Passive — Skill 1 batch expire (trigger) -> windSigils tăng 1 trở lại', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // White casts repel
    const res = match.useSkill(Color.White, 'kaze_repel', [
      { type: 'cell', position: { col: 4, row: 4 } },
    ]);
    expect(res.success).toBe(true);
    expect(state.variantState.windSigils).toBe(5);

    // End White Turn -> Black turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Place Black Rook adjacent to a repel cell (center is {4,4}, orthogonal is {4,5})
    const enemyPos = { col: 4, row: 6 };
    const repelCell = { col: 4, row: 5 };
    const enemyPiece: Piece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Black moves into repel cell
    const moveRes = match.makeMove(Color.Black, enemyPos, repelCell);

    // Assert: repel triggered, pushed back
    expect(moveRes.success).toBe(true);
    expect(state.board.getPiece(enemyPos)).toBe(enemyPiece);
    expect(state.board.getPiece(repelCell)).toBeNull();

    // Assert: windSigils refunded back to 6
    expect(state.variantState.windSigils).toBe(6);
  });

  // K4: Passive — 2 batch Skill 1 độc lập: batch 1 expire không ảnh hưởng batch 2
  it('K4: Passive — 2 batch Skill 1 độc lập: batch 1 expire không ảnh hưởng batch 2', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // White casts repel on {4,4} (Batch 1)
    let res = match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);
    expect(res.success).toBe(true);

    // Reset action state to allow another skill use in testing
    state.skillsUsedThisTurn = 0;
    if (state.skillsUsedThisTurnIds) state.skillsUsedThisTurnIds = [];

    // White casts repel on {10,10} (Batch 2)
    res = match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 10, row: 10 } }]);
    expect(res.success).toBe(true);
    expect(state.variantState.windSigils).toBe(4);

    // End White Turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Move enemy into Batch 1 repel cell {4,5}
    const enemyPos = { col: 4, row: 6 };
    const repelCell = { col: 4, row: 5 };
    const enemyPiece: Piece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    match.makeMove(Color.Black, enemyPos, repelCell);

    // Assert: windSigils is 5 (refunded 1)
    expect(state.variantState.windSigils).toBe(5);

    // Assert Batch 2 cells are still on the board
    const batch2Effects = state.board.getCellEffects({ col: 10, row: 10 });
    expect(batch2Effects.some(e => e.type === 'repel')).toBe(true);
  });

  // K5: Skill 1 — 5 ô chữ thập có Repel cell effect với cùng batchId
  it('K5: Skill 1 — 5 ô chữ thập có Repel cell effect với cùng batchId', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    const cells = [
      { col: 4, row: 4 },
      { col: 5, row: 4 },
      { col: 3, row: 4 },
      { col: 4, row: 5 },
      { col: 4, row: 3 },
    ];

    let firstBatchId = '';
    for (const c of cells) {
      const effects = state.board.getCellEffects(c);
      const repel = effects.find(e => e.type === 'repel');
      expect(repel).toBeDefined();
      if (!firstBatchId) {
        firstBatchId = repel!.metadata.batchId;
      } else {
        expect(repel!.metadata.batchId).toBe(firstBatchId);
      }
    }
  });

  // K6: Skill 1 — reject nếu không phải 5 ô đều trống
  it('K6: Skill 1 — reject nếu không phải 5 ô đều trống', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Place a piece at {4,5}
    state.board.setPiece({ col: 4, row: 5 }, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });

    const res = match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('All 5 target cells must be empty');
  });

  // K6_1: Skill 1 — reject nếu đè lên trap có sẵn (repel / soulless_cell)
  it('K6_1: Skill 1 — reject nếu đè lên trap có sẵn (repel / soulless_cell)', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 20;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Place first repel trap at {4,4}
    let res = match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);
    expect(res.success).toBe(true);

    // Reset action state to allow another skill use in testing
    state.skillsUsedThisTurn = 0;
    if (state.skillsUsedThisTurnIds) state.skillsUsedThisTurnIds = [];

    // Place second repel trap overlapping at {5,5} -> should fail
    res = match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 5, row: 5 } }]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('Cannot overlap existing traps');
  });

  // K10_1: Skill 2 — reject nếu đè lên trap có sẵn (repel / soulless_cell)
  it('K10_1: Skill 2 — reject nếu đè lên trap có sẵn (repel / soulless_cell)', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 20;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Place repel trap at {4,4}
    let res = match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);
    expect(res.success).toBe(true);

    // Reset action state to allow another skill use in testing
    state.skillsUsedThisTurn = 0;
    if (state.skillsUsedThisTurnIds) state.skillsUsedThisTurnIds = [];

    // Place soulless trap overlapping at {5,5} -> should fail
    res = match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 5, row: 5 } }]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('Cannot overlap existing traps');
  });


  // K7: Skill 1 — địch bước vào 1 ô Repel → bị đẩy về from position
  it('K7: Skill 1 — địch bước vào 1 ô Repel -> bị đẩy về from position', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    const enemyPos = { col: 4, row: 6 };
    const repelCell = { col: 4, row: 5 };
    const enemyPiece: Piece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    match.makeMove(Color.Black, enemyPos, repelCell);

    // Piece pushed back to enemyPos
    expect(state.board.getPiece(enemyPos)).toBe(enemyPiece);
    expect(state.board.getPiece(repelCell)).toBeNull();
  });

  // K8: Skill 1 — địch bước vào 1 ô Repel → TẤT CẢ 5 ô Repel cùng batch bị remove
  it('K8: Skill 1 — địch bước vào 1 ô Repel -> TẤT CẢ 5 ô Repel cùng batch bị remove', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    const enemyPos = { col: 4, row: 6 };
    const repelCell = { col: 4, row: 5 };
    const enemyPiece: Piece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    match.makeMove(Color.Black, enemyPos, repelCell);

    // All cross cells are empty of repel
    const cells = [
      { col: 4, row: 4 },
      { col: 5, row: 4 },
      { col: 3, row: 4 },
      { col: 4, row: 5 },
      { col: 4, row: 3 },
    ];
    for (const c of cells) {
      const effects = state.board.getCellEffects(c);
      expect(effects.some(e => e.type === 'repel')).toBe(false);
    }
  });

  // K9: Skill 1 — đồng minh bước vào ô Repel → KHÔNG trigger
  it('K9: Skill 1 — đồng minh bước vào ô Repel -> KHÔNG trigger', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    // Place White Rook adjacent to repel cell {4,5}
    const allyPos = { col: 4, row: 6 };
    const repelCell = { col: 4, row: 5 };
    const allyPiece = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece(allyPos, allyPiece);

    state.hasMoved = false;
    const moveRes = match.makeMove(Color.White, allyPos, repelCell);
    expect(moveRes.success).toBe(true);

    // White rook successfully moves to repelCell (no pushback)
    expect(state.board.getPiece(repelCell)).toBe(allyPiece);
    // Repel cell remains
    const effects = state.board.getCellEffects(repelCell);
    expect(effects.some(e => e.type === 'repel')).toBe(true);
  });

  // K10: Skill 2 — 5 ô chữ X có soulless_cell effect
  it('K10: Skill 2 — 5 ô chữ X có soulless_cell effect', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    const cells = [
      { col: 4, row: 4 },
      { col: 5, row: 5 },
      { col: 3, row: 3 },
      { col: 5, row: 3 },
      { col: 3, row: 5 },
    ];

    let firstBatchId = '';
    for (const c of cells) {
      const effects = state.board.getCellEffects(c);
      const sCell = effects.find(e => e.type === 'soulless_cell');
      expect(sCell).toBeDefined();
      if (!firstBatchId) {
        firstBatchId = sCell!.metadata.batchId;
      } else {
        expect(sCell!.metadata.batchId).toBe(firstBatchId);
      }
    }
  });

  // K11: Skill 2 — địch bước vào ô soulless_cell → nhận Soulless Stun 2 rounds
  it('K11: Skill 2 — địch bước vào ô soulless_cell -> nhận Soulless Stun 2 rounds', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Use Bishop since it moves diagonally
    const enemyPos = { col: 6, row: 6 };
    const sCell = { col: 5, row: 5 };
    const enemyPiece: Piece = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes = match.makeMove(Color.Black, enemyPos, sCell);
    expect(moveRes.success).toBe(true);

    // Enemy piece has 'soulless' effect with duration 2 rounds
    const effect = enemyPiece.effects.find(e => e.type === 'soulless');
    expect(effect).toBeDefined();
    expect(effect!.remainingDuration).toBe(2);
    expect(effect!.isDebuff).toBe(true);
    expect(effect!.metadata.originalPosition).toEqual(enemyPos);
  });

  // K12: Skill 2 — soulless_cell trigger → TẤT CẢ 5 ô cùng batch bị remove
  it('K12: Skill 2 — soulless_cell trigger -> TẤT CẢ 5 ô cùng batch bị remove', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Use Bishop
    const enemyPos = { col: 6, row: 6 };
    const sCell = { col: 5, row: 5 };
    const enemyPiece: Piece = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes = match.makeMove(Color.Black, enemyPos, sCell);
    expect(moveRes.success).toBe(true);

    const cells = [
      { col: 4, row: 4 },
      { col: 5, row: 5 },
      { col: 3, row: 3 },
      { col: 5, row: 3 },
      { col: 3, row: 5 },
    ];
    for (const c of cells) {
      const effects = state.board.getCellEffects(c);
      expect(effects.some(e => e.type === 'soulless_cell')).toBe(false);
    }
  });

  // K13: Skill 2 — quân khác đi vào originalPosition → Soulless bị gỡ sớm
  it('K13: Skill 2 — quân khác đi vào originalPosition -> Soulless bị gỡ sớm', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    const enemyPos = { col: 6, row: 6 }; // originalPosition
    const sCell = { col: 5, row: 5 };
    const enemyPiece: Piece = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes = match.makeMove(Color.Black, enemyPos, sCell);
    expect(moveRes.success).toBe(true);

    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(true);

    // End Black Turn
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White does nothing and ends turn
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Place another enemy Rook adjacent to originalPosition {6,6}
    const anotherEnemyPos = { col: 7, row: 6 };
    const anotherEnemyPiece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(anotherEnemyPos, anotherEnemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Another enemy moves into originalPosition (horizontal move, legal for Rook)
    const moveRes2 = match.makeMove(Color.Black, anotherEnemyPos, enemyPos);
    expect(moveRes2.success).toBe(true);

    // Assert: 'soulless' effect is removed
    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(false);
  });

  // K13_1: Địch (Kazehime) di chuyển vào originalPosition → KHÔNG gỡ
  it('K13_1: Địch (Kazehime) di chuyển vào originalPosition -> KHÔNG gỡ', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    const enemyPos = { col: 6, row: 6 }; // originalPosition
    const sCell = { col: 5, row: 5 };
    const enemyPiece: Piece = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes = match.makeMove(Color.Black, enemyPos, sCell);
    expect(moveRes.success).toBe(true);

    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(true);

    // End Black Turn
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Kazehime (White) moves an ally Rook to originalPosition {6,6}
    const allyPos = { col: 7, row: 6 };
    const allyPiece = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece(allyPos, allyPiece);

    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes2 = match.makeMove(Color.White, allyPos, enemyPos);
    expect(moveRes2.success).toBe(true);

    // Assert: 'soulless' effect is NOT removed because it was a White piece that entered
    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(true);
  });

  // K14: Skill 2 — Blessing cleanse → Soulless bị gỡ
  it('K14: Skill 2 — Blessing cleanse -> Soulless bị gỡ', () => {
    // White = 'kaze', Black = 'angel'
    match.setVariants('kaze', 'angel');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    const enemyPos = { col: 6, row: 6 };
    const sCell = { col: 5, row: 5 };
    const enemyPiece: Piece = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes = match.makeMove(Color.Black, enemyPos, sCell);
    expect(moveRes.success).toBe(true);

    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(true);

    // Now, Angel uses Blessing skill on the Bishop
    state.blackAP = 10;
    state.skillsUsedThisTurn = 0;
    if (state.skillsUsedThisTurnIds) state.skillsUsedThisTurnIds = [];
    
    const res = match.useSkill(Color.Black, 'angel_blessing', [
      { type: 'piece', position: sCell, pieceId: enemyPiece.id },
    ]);

    expect(res.success).toBe(true);
    // Soulless should be cleansed because it is a debuff
    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(false);
  });

  // K15: Skill 2 — không gỡ trong 2 rounds → Soulless tự expire, quân giải phóng
  it('K15: Skill 2 — không gỡ trong 2 rounds -> Soulless tự expire', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    const enemyPos = { col: 6, row: 6 };
    const sCell = { col: 5, row: 5 };
    const enemyPiece: Piece = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes = match.makeMove(Color.Black, enemyPos, sCell);
    expect(moveRes.success).toBe(true);

    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(true);

    // End Black Turn (does not tick down yet because it was applied on this turn)
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    
    const eff1 = enemyPiece.effects.find(e => e.type === 'soulless');
    expect(eff1!.remainingDuration).toBe(2);

    // White Turn ends
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black Turn ends (ticks down from 2 to 1)
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    const eff2 = enemyPiece.effects.find(e => e.type === 'soulless');
    expect(eff2!.remainingDuration).toBe(1);

    // White Turn ends
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black Turn ends (ticks down from 1 to 0 -> removed)
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(false);
  });

  // K16: Ultimate — windSigils reset về 6
  it('K16: Ultimate — windSigils reset về 6', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.variantState.windSigils = 3;

    const res = match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);
    expect(res.success).toBe(true);
    expect(state.variantState.windSigils).toBe(6);
  });

  // K17: Ultimate — tất cả repel/soulless_cell của Kazehime bị remove
  it('K17: Ultimate — tất cả repel/soulless_cell của Kazehime bị remove', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 20;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Spawn repel at {4,4}
    match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    state.skillsUsedThisTurn = 0;
    if (state.skillsUsedThisTurnIds) state.skillsUsedThisTurnIds = [];

    // Spawn soulless_cell at {10,10}
    match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 10, row: 10 } }]);

    state.skillsUsedThisTurn = 0;
    if (state.skillsUsedThisTurnIds) state.skillsUsedThisTurnIds = [];

    // Cast Ultimate
    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    // Assert: all repel and soulless_cells are gone
    expect(state.board.getCellEffects({ col: 4, row: 4 }).some(e => e.type === 'repel')).toBe(false);
    expect(state.board.getCellEffects({ col: 10, row: 10 }).some(e => e.type === 'soulless_cell')).toBe(false);
  });

  // K18: Ultimate — Soulless piece effects trên quân địch KHÔNG bị remove
  it('K18: Ultimate — Soulless piece effects trên quân địch KHÔNG bị remove', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPiece: Piece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 7, row: 7 }, enemyPiece);
    enemyPiece.effects.push({
      id: 'manual_soulless',
      type: 'soulless',
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: enemyPiece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    });

    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(true);
  });

  // K19: Ultimate — storm xuất hiện, round 1 radius 3 (7×7)
  it('K19: Ultimate — storm xuất hiện, round 1 radius 3 (7×7)', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    const storm = state.variantState.storm;
    expect(storm).toBeDefined();
    expect(storm.center).toEqual({ col: 7, row: 7 });
    expect(storm.currentRadius).toBe(3);
  });

  // K20: Storm — quân địch trong vùng 2 rounds liên tiếp → DESTROY_PIECE
  it('K20: Storm — quân địch trong vùng 2 rounds liên tiếp -> DESTROY_PIECE', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Spawn storm at {7,7}
    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    // Place enemy Rook in storm at {7,6} (Chebyshev dist = 1 <= 3)
    const enemyPos = { col: 7, row: 6 };
    const enemyPiece: Piece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    // End Kazehime Turn 1 -> storm ticks, records Rook round 1
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.activePieceRounds[enemyPiece.id]).toBe(1);

    // Black Turn starts & ends (does not tick storm)
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Kazehime Turn 2 starts & ends -> storm ticks, records Rook round 2 -> destroys
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Rook should be destroyed
    expect(state.board.getPiece(enemyPos)).toBeNull();
  });

  // K21: Storm — quân địch ra ngoài vùng → roundsInStorm reset về 0
  it('K21: Storm — quân địch ra ngoài vùng -> roundsInStorm reset về 0', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    const enemyPos = { col: 7, row: 6 };
    const enemyPiece: Piece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    // End Kazehime Turn 1 -> activePieceRounds becomes 1
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.activePieceRounds[enemyPiece.id]).toBe(1);

    // Black moves Rook outside storm (e.g. to {12,6} Chebyshev dist = 5 > 3)
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    const safePos = { col: 12, row: 6 };
    const moveRes = match.makeMove(Color.Black, enemyPos, safePos);
    expect(moveRes.success).toBe(true);

    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Kazehime Turn 2 ends -> storm ticks, since Rook is outside, reset to 0
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });

    expect(state.variantState.storm.activePieceRounds[enemyPiece.id]).toBe(0);
    expect(state.board.getPiece(safePos)).toBe(enemyPiece); // Still alive
  });

  // K22: Storm — quân ra ngoài rồi vào lại: không tính cumulative
  it('K22: Storm — quân ra ngoài rồi vào lại: không tính cumulative', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    const enemyPos = { col: 7, row: 6 };
    const enemyPiece: Piece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    // Turn 1 end: Rook in storm -> activePieceRounds = 1
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.activePieceRounds[enemyPiece.id]).toBe(1);

    // Black turn: Rook moves to safe position {12,6}
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    const safePos = { col: 12, row: 6 };
    const moveRes = match.makeMove(Color.Black, enemyPos, safePos);
    expect(moveRes.success).toBe(true);
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Turn 2 end: Rook outside -> activePieceRounds reset to 0
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.activePieceRounds[enemyPiece.id]).toBe(0);

    // Black turn: Rook moves back into storm to {7,6} (along row 6, horizontal, legal for Rook!)
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    const moveRes2 = match.makeMove(Color.Black, safePos, { col: 7, row: 6 });
    expect(moveRes2.success).toBe(true);
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Turn 3 end: Rook inside storm -> activePieceRounds becomes 1 (not 2!)
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.activePieceRounds[enemyPiece.id]).toBe(1);
    expect(state.board.getPiece({ col: 7, row: 6 })).toBe(enemyPiece); // Still alive
  });

  // K23: Storm — thu hẹp đúng: round 2 → 5×5, round 3 → 3×3, round 4 → 1 ô
  it('K23: Storm — thu hẹp đúng: round 2 -> 5x5, round 3 -> 3x3, round 4 -> 1 ô', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    // End Kazehime Turn 1 -> shrinks to radius 2 (5x5)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.currentRadius).toBe(2);

    // End Kazehime Turn 2 -> shrinks to radius 1 (3x3)
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.currentRadius).toBe(1);

    // End Kazehime Turn 3 -> shrinks to radius 0 (1x1)
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.currentRadius).toBe(0);
  });

  // K24: Storm — tự biến mất sau 4 rounds
  it('K24: Storm — tự biến mất sau 4 rounds', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    // Turn 1 end -> radius 2
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // Turn 2 end -> radius 1
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // Turn 3 end -> radius 0
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });
    
    expect(state.variantState.storm).toBeDefined();

    // Turn 4 end -> storm removed
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });

    expect(state.variantState.storm).toBeUndefined();
  });

  // K25: Storm — King immune (không bị destroy dù ở trong storm bao lâu)
  it('K25: Storm — King immune (không bị destroy dù ở trong storm bao lâu)', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Spawn storm at {7,7}
    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    // Find Black King and place it at {7,7}
    let kingPos = { col: -1, row: -1 };
    let kingPiece: any = null;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.Black) {
          kingPos = { col: c, row: r };
          kingPiece = p;
          break;
        }
      }
    }
    
    state.board.removePiece(kingPos);
    state.board.setPiece({ col: 7, row: 7 }, kingPiece);

    // End Kazehime Turn 1
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // End Black Turn
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // End Kazehime Turn 2
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // King is still alive
    expect(state.board.getPiece({ col: 7, row: 7 })).toBe(kingPiece);
  });

  // K26: Storm — chỉ tick sau lượt của Kazehime player, không tick sau lượt địch
  it('K26: Storm — chỉ tick sau lượt của Kazehime player, không tick sau lượt địch', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    expect(state.variantState.storm.currentRadius).toBe(3);
    expect(state.variantState.storm.roundsElapsed).toBe(0);

    // End turn White (Kazehime player) -> storm ticks
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.currentRadius).toBe(2);
    expect(state.variantState.storm.roundsElapsed).toBe(1);

    // End turn Black (lightning player) -> storm should NOT tick
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    expect(state.variantState.storm.currentRadius).toBe(2);
    expect(state.variantState.storm.roundsElapsed).toBe(1);
  });

  // K27: Storm — destroy xảy ra sau 2 lượt Kazehime mà quân địch liên tiếp trong vùng
  it('K27: Storm — destroy xảy ra sau 2 lượt Kazehime mà quân địch liên tiếp trong vùng', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    match.useSkill(Color.White, 'kaze_storm', [{ type: 'cell', position: { col: 7, row: 7 } }]);

    const enemyPos = { col: 7, row: 6 };
    const enemyPiece: Piece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);

    // End Kazehime Turn 1 -> storm ticks, activePieceRounds = 1
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.storm.activePieceRounds[enemyPiece.id]).toBe(1);
    expect(state.board.getPiece(enemyPos)).toBe(enemyPiece); // Still alive

    // Black turn ends
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // End Kazehime Turn 2 -> storm ticks, activePieceRounds = 2 -> destroyed
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });

    expect(state.board.getPiece(enemyPos)).toBeNull(); // Destroyed!
  });

  // K28: Traps — repel và soulless_cell phải ẩn với đối thủ (serializeForPlayer)
  it('K28: Traps — repel và soulless_cell phải ẩn với đối thủ (serializeForPlayer)', () => {
    match.setVariants('kaze', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 20;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // White casts repel at {4,4}
    match.useSkill(Color.White, 'kaze_repel', [{ type: 'cell', position: { col: 4, row: 4 } }]);

    state.skillsUsedThisTurn = 0;
    if (state.skillsUsedThisTurnIds) state.skillsUsedThisTurnIds = [];

    // White casts soulless at {10,10}
    match.useSkill(Color.White, 'kaze_soulless', [{ type: 'cell', position: { col: 10, row: 10 } }]);

    // Owner (White) should see both
    const whiteSerialized = match.serializeForPlayer(Color.White);
    expect(whiteSerialized.board.cellEffects['4,4']?.some(e => e.type === 'repel')).toBe(true);
    expect(whiteSerialized.board.cellEffects['10,10']?.some(e => e.type === 'soulless_cell')).toBe(true);

    // Enemy (Black) should NOT see either
    const blackSerialized = match.serializeForPlayer(Color.Black);
    expect(blackSerialized.board.cellEffects['4,4']?.some(e => e.type === 'repel')).toBeFalsy();
    expect(blackSerialized.board.cellEffects['10,10']?.some(e => e.type === 'soulless_cell')).toBeFalsy();
  });
});
