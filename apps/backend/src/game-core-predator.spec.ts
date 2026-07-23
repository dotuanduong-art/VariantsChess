import {
  Match,
  Color,
  PieceType,
  Effect,
  Board,
  oppositeColor,
} from 'game-core';

describe('Chess Variant Engine - Predator Variant (TDD)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('predator', 'lightning');
  });

  // =========================================================================
  // Passive & Cost tests (PR1-PR3)
  // =========================================================================

  it('PR1: Passive — ăn Pawn địch -> +2 AP', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const pawn = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    state.board.setPiece({ col: 0, row: 5 }, pawn);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 5 });
    expect(res.success).toBe(true);
    // Base Pawn capture = 2 AP, Passive hook = 2 AP, so 5 + 2 + 2 = 9 AP
    expect(state.whiteAP).toBe(9); 
  });

  it('PR2: Passive — ăn non-Pawn địch -> không trigger', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const bishop = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    state.board.setPiece({ col: 0, row: 5 }, bishop);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 5 });
    expect(res.success).toBe(true);
    // Base Bishop capture = 3 AP, so 5 + 3 = 8 AP
    expect(state.whiteAP).toBe(8); 
  });

  it('PR3: Passive — ăn Pawn đã Evolution (type đã đổi) -> không trigger', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const knight = { id: 'b_knight', type: PieceType.Knight, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    state.board.setPiece({ col: 0, row: 5 }, knight);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 5 });
    expect(res.success).toBe(true);
    // Base Knight capture = 3 AP, so 5 + 3 = 8 AP
    expect(state.whiteAP).toBe(8); 
  });

  // =========================================================================
  // Skill 1 - Evolution Spore (PR4-PR11)
  // =========================================================================

  it('PR4: Skill 1 — apply Evolution lên Pawn đồng minh', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.useSkill(Color.White, 'predator_evolution_spore', [{ type: 'piece', pieceId: 'w_pawn', position: { col: 1, row: 1 } }]);
    expect(res.success).toBe(true);
    
    const updatedPawn = state.board.getPiece({ col: 1, row: 1 });
    expect(updatedPawn?.effects?.some(e => e.type === 'evolution')).toBe(true);
    expect(state.whiteAP).toBe(2); // 5 - 3
  });

  it('PR5: Skill 1 — không thể target non-Pawn', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, rook);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.useSkill(Color.White, 'predator_evolution_spore', [{ type: 'piece', pieceId: 'w_rook', position: { col: 1, row: 1 } }]);
    expect(res.success).toBe(false);
  });

  it('PR6: Evolution — ăn quân trước 2 rounds -> mất Evolution, không tiến hóa', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = {
      id: 'w_pawn',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [{
        id: 'evo_id',
        type: 'evolution' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: 'w_pawn',
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: { roundsWithEvolution: 1 } // < 2
      }]
    };
    const enemy = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    state.board.setPiece({ col: 2, row: 2 }, enemy);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.makeMove(Color.White, { col: 1, row: 1 }, { col: 2, row: 2 });
    expect(res.success).toBe(true);
    
    const finalPiece = state.board.getPiece({ col: 2, row: 2 });
    expect(finalPiece?.type).toBe(PieceType.Pawn);
    expect(finalPiece?.effects?.some(e => e.type === 'evolution')).toBe(false);
  });

  it('PR7: Evolution — ăn quân ở round 2 -> tiến hóa thành Knight', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = {
      id: 'w_pawn',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [{
        id: 'evo_id',
        type: 'evolution' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: 'w_pawn',
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: { roundsWithEvolution: 2 } // == 2
      }]
    };
    const enemy = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    state.board.setPiece({ col: 2, row: 2 }, enemy);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.makeMove(Color.White, { col: 1, row: 1 }, { col: 2, row: 2 });
    expect(res.success).toBe(true);
    
    const finalPiece = state.board.getPiece({ col: 2, row: 2 });
    expect(finalPiece?.type).toBe(PieceType.Knight);
    expect(finalPiece?.effects?.some(e => e.type === 'evolution')).toBe(false);
  });

  it('PR8: Evolution — ăn quân ở round 3 -> tiến hóa thành Bishop', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = {
      id: 'w_pawn',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [{
        id: 'evo_id',
        type: 'evolution' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: 'w_pawn',
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: { roundsWithEvolution: 3 } // == 3
      }]
    };
    const enemy = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    state.board.setPiece({ col: 2, row: 2 }, enemy);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.makeMove(Color.White, { col: 1, row: 1 }, { col: 2, row: 2 });
    expect(res.success).toBe(true);
    
    const finalPiece = state.board.getPiece({ col: 2, row: 2 });
    expect(finalPiece?.type).toBe(PieceType.Bishop);
  });

  it('PR9: Evolution — ăn quân ở round 5 -> tiến hóa thành Queen', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = {
      id: 'w_pawn',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [{
        id: 'evo_id',
        type: 'evolution' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: 'w_pawn',
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: { roundsWithEvolution: 5 } // == 5
      }]
    };
    const enemy = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    state.board.setPiece({ col: 2, row: 2 }, enemy);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.makeMove(Color.White, { col: 1, row: 1 }, { col: 2, row: 2 });
    expect(res.success).toBe(true);
    
    const finalPiece = state.board.getPiece({ col: 2, row: 2 });
    expect(finalPiece?.type).toBe(PieceType.Queen);
  });

  it('PR10: Evolution — Pawn không auto-promote khi đến cuối bàn (block promotion)', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = {
      id: 'w_pawn',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [{
        id: 'evo_id',
        type: 'evolution' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: 'w_pawn',
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: { roundsWithEvolution: 1 }
      }]
    };
    state.board.setPiece({ col: 1, row: 13 }, pawn);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.makeMove(Color.White, { col: 1, row: 13 }, { col: 1, row: 14 });
    expect(res.success).toBe(true);
    
    const finalPiece = state.board.getPiece({ col: 1, row: 14 });
    expect(finalPiece?.type).toBe(PieceType.Pawn); // Did not auto-promote to Queen
  });

  it('PR11: Evolution — sau khi tiến hóa, không thể tiến hóa tiếp (Evolution biến mất)', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = {
      id: 'w_pawn',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [{
        id: 'evo_id',
        type: 'evolution' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: 'w_pawn',
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: { roundsWithEvolution: 2 }
      }]
    };
    const enemy1 = { id: 'b_bishop_1', type: PieceType.Bishop, color: Color.Black, effects: [] };
    const enemy2 = { id: 'b_bishop_2', type: PieceType.Bishop, color: Color.Black, effects: [] };
    
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    state.board.setPiece({ col: 2, row: 2 }, enemy1);
    state.board.setPiece({ col: 3, row: 4 }, enemy2); // Knight can jump L-shape from {2,2} to {3,4}
    
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    // First move (Pawn capturing enemy1 -> evolves to Knight)
    let res = match.makeMove(Color.White, { col: 1, row: 1 }, { col: 2, row: 2 });
    expect(res.success).toBe(true);
    
    const evolvedPiece = state.board.getPiece({ col: 2, row: 2 });
    expect(evolvedPiece?.type).toBe(PieceType.Knight);
    expect(evolvedPiece?.effects?.some(e => e.type === 'evolution')).toBe(false);
    
    // Reset move lock for the turn
    state.hasMoved = false;
    
    // Second move (Knight capturing enemy2 at {3, 4})
    res = match.makeMove(Color.White, { col: 2, row: 2 }, { col: 3, row: 4 });
    expect(res.success).toBe(true);
    
    const finalPiece = state.board.getPiece({ col: 3, row: 4 });
    expect(finalPiece?.type).toBe(PieceType.Knight); // remains Knight, doesn't evolve further
  });

  // =========================================================================
  // Skill 2 - Shadow Prowl & Soulless Cell (PR12-PR15)
  // =========================================================================

  it('PR12: Skill 2 — đặt Soulless cell trên ô trong attack range của ally', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.useSkill(Color.White, 'predator_shadow_prowl', [{ type: 'cell', position: { col: 0, row: 5 } }]);
    expect(res.success).toBe(true);
    expect(state.board.getCellEffects({ col: 0, row: 5 }).some(e => e.type === 'soulless_cell')).toBe(true);
  });

  it('PR13: Skill 2 — reject ô không trong attack range của bất kỳ ally nào', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.useSkill(Color.White, 'predator_shadow_prowl', [{ type: 'cell', position: { col: 2, row: 2 } }]);
    expect(res.success).toBe(false);
  });

  it('PR14: Soulless — địch đi vào -> Stun, cell effect biến mất', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    // Place allied Rook to enable attack range
    const wRook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, wRook);

    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    // Use Shadow Prowl to place soulless_cell at {0, 5}
    const skillRes = match.useSkill(Color.White, 'predator_shadow_prowl', [{ type: 'cell', position: { col: 0, row: 5 } }]);
    expect(skillRes.success).toBe(true);

    // End White Turn
    match.submitAction({ type: 'END_TURN', player: Color.White });
    
    // Place enemy Rook at {0, 6}
    const enemyPos = { col: 0, row: 6 };
    const sCell = { col: 0, row: 5 };
    const enemyPiece = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);
    
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    
    // Enemy moves onto the Soulless Cell
    const res = match.makeMove(Color.Black, enemyPos, sCell);
    expect(res.success).toBe(true);
    
    const pieceOnCell = state.board.getPiece(sCell);
    expect(pieceOnCell?.effects?.some(e => e.type === 'soulless')).toBe(true);
    expect(state.board.getCellEffects(sCell).some(e => e.type === 'soulless_cell')).toBe(false);
  });

  it('PR15: Soulless — gỡ bằng cách quân địch khác đi vào originalPosition', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    // Place White Rook to allow placing a Soulless trap at {5,5}
    const wRook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece({ col: 5, row: 0 }, wRook);
    
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    // Place Soulless trap at {5,5}
    const skillRes = match.useSkill(Color.White, 'predator_shadow_prowl', [{ type: 'cell', position: { col: 5, row: 5 } }]);
    expect(skillRes.success).toBe(true);
    
    // End White Turn
    match.submitAction({ type: 'END_TURN', player: Color.White });
    
    // Move enemy Bishop from originalPosition {6,6} to trap at {5,5} -> triggers Stun
    // Use Bishop since it moves diagonally!
    const enemyPos = { col: 6, row: 6 };
    const sCell = { col: 5, row: 5 };
    const enemyPiece = { id: 'b_bishop_1', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece(enemyPos, enemyPiece);
    
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    
    const moveRes = match.makeMove(Color.Black, enemyPos, sCell);
    expect(moveRes.success).toBe(true);
    
    // Stun is active
    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(true);
    
    // End Black Turn
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    
    // End White Turn (White does nothing)
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    match.submitAction({ type: 'END_TURN', player: Color.White });
    
    // Place another enemy Rook at {7,6} and move it to {6,6} (originalPosition, horizontal move)
    const anotherEnemyPos = { col: 7, row: 6 };
    const anotherEnemyPiece = { id: 'b_rook_2', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(anotherEnemyPos, anotherEnemyPiece);
    
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    
    const moveRes2 = match.makeMove(Color.Black, anotherEnemyPos, enemyPos);
    expect(moveRes2.success).toBe(true);
    
    // Stun should be released on b_bishop_1
    expect(enemyPiece.effects.some(e => e.type === 'soulless')).toBe(false);
  });

  // =========================================================================
  // Ultimate - Apex Camouflage (PR16-PR22)
  // =========================================================================

  it('PR16 & PR18: Ultimate — tất cả quân (trừ King) trở nên tàng hình', () => {
    match.start();
    const state = match.getGameState();
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    
    state.whiteAP = 9;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    const res = match.useSkill(Color.White, 'predator_apex_camouflage', []);
    expect(res.success).toBe(true);
    expect(state.getPlayerEffects(Color.White).some(e => e.type === 'apex_camouflage')).toBe(true);
    
    // Opponent serialization
    const serialized = match.serializeForPlayer(Color.Black);
    
    // Pawn should be hidden
    expect(serialized.board.grid[1][1]).toBeNull();
    // King should remain visible
    expect(serialized.board.grid[0][7]).not.toBeNull();
    expect(serialized.board.grid[0][7]?.type).toBe(PieceType.King);
  });

  it('PR17: Ultimate — serializeForPlayer ẩn tàng hình quân với địch', () => {
    match.start();
    const state = match.getGameState();
    
    // Apply apex_camouflage
    state.addPlayerEffect(Color.White, {
      id: 'apex_camo_id',
      type: 'apex_camouflage' as any,
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {}
    });
    
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    
    // Opponent view
    const opponentView = match.serializeForPlayer(Color.Black);
    expect(opponentView.board.grid[1][1]).toBeNull();
    
    // Allied view
    const alliedView = match.serializeForPlayer(Color.White);
    expect(alliedView.board.grid[1][1]).not.toBeNull();
  });

  it('PR19: Stealth mất khi đứng cạnh địch (cuối turn)', () => {
    match.start();
    const state = match.getGameState();
    
    // Apply camo
    state.addPlayerEffect(Color.White, {
      id: 'apex_camo_id',
      type: 'apex_camouflage' as any,
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {}
    });
    
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    // Place White Pawn adjacent to Black Pawn (col 1, row 1 vs col 1, row 2)
    const pawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    const enemy = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    state.board.setPiece({ col: 1, row: 2 }, enemy);
    
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    // Verify it is initially stealthy to opponent
    let serialized = match.serializeForPlayer(Color.Black);
    expect(serialized.board.grid[1][1]).toBeNull();
    
    // End turn -> triggers OnTurnEnd adjacency check
    match.submitAction({ type: 'END_TURN', player: Color.White });
    
    // Now it should be revealed (in revealedPieceIds) and visible
    expect(state.variantState.revealedPieceIds).toContain('w_pawn');
    serialized = match.serializeForPlayer(Color.Black);
    expect(serialized.board.grid[1][1]).not.toBeNull();
  });

  it('PR20: Stealth mất sau khi capture', () => {
    match.start();
    const state = match.getGameState();
    
    state.addPlayerEffect(Color.White, {
      id: 'apex_camo_id',
      type: 'apex_camouflage' as any,
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {}
    });
    
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const enemy = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    state.board.setPiece({ col: 0, row: 5 }, enemy);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    // Capture enemy
    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 5 });
    expect(res.success).toBe(true);
    
    // Attacking Rook is revealed immediately after capture
    expect(state.variantState.revealedPieceIds).toContain('w_rook');
    const serialized = match.serializeForPlayer(Color.Black);
    expect(serialized.board.grid[5][0]).not.toBeNull();
  });

  it('PR21: Tàng hình movement: move is marked as stealthMove', () => {
    match.start();
    const state = match.getGameState();
    
    state.addPlayerEffect(Color.White, {
      id: 'apex_camo_id',
      type: 'apex_camouflage' as any,
      duration: 5,
      remainingDuration: 5,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {}
    });
    
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, rook);
    
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    
    // Move the Rook (stealth move)
    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 5 });
    expect(res.success).toBe(true);
    expect(res.isStealthMove).toBe(true); // marked as stealth move!
  });

  it('PR22: Ultimate expire sau 5 rounds -> tất cả quân visible trở lại', () => {
    match.start();
    const state = match.getGameState();
    
    state.addPlayerEffect(Color.White, {
      id: 'apex_camo_id',
      type: 'apex_camouflage' as any,
      duration: 1, // Will expire in 1 round
      remainingDuration: 1,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'player',
      targetId: Color.White,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {}
    });
    
    state.board = new Board();
    state.board.setPiece({ col: 7, row: 0 }, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 7, row: 14 }, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });
    
    const pawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, pawn);
    
    state.currentTurn = Color.White;
    state.variantState.revealedPieceIds = ['some_other_id']; // simulate some revealed pieces
    
    // End Turn to trigger tick and removal
    match.submitAction({ type: 'END_TURN', player: Color.White });
    
    // Verify effect is gone
    expect(state.getPlayerEffects(Color.White).some(e => e.type === 'apex_camouflage')).toBe(false);
    // Verify revealedPieceIds is cleared
    expect(state.variantState.revealedPieceIds).toEqual([]);
    
    // Pawn should be visible again
    const serialized = match.serializeForPlayer(Color.Black);
    expect(serialized.board.grid[1][1]).not.toBeNull();
  });
});
