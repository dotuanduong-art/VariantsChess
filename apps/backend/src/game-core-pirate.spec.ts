import {
  Match,
  Color,
  PieceType,
} from 'game-core';

function clearBoard(board: any): void {
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      board.removePiece({ col: c, row: r });
    }
  }
}

describe('Chess Variant Engine - Pirate Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('pirate', 'lightning');
  });

  // P1: AP Debt passive - can borrow up to -10 AP, blocked from casting when in debt, auto-repay on AP gain
  it('P1: AP Debt passive allows borrowing up to -10, blocks casting when in debt, repays on gain', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 3;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const rookPos = { col: 0, row: 0 }; // White Rook
    const rook = state.board.getPiece(rookPos)!;

    // Use Skill 2 (Sailing) costing 7 AP (3 - 7 = -4 AP, within -10 limit)
    let res = match.useSkill(Color.White, 'pirate_sailing', [
      { type: 'piece', position: rookPos, pieceId: rook.id },
      { type: 'cell', position: { col: 4, row: 4 } },
    ]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(-4);

    // Reset skillsUsedThisTurn to allow another skill activation check
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    // Try to cast Skill 1 (Bet) costing 4 AP. Since we are in debt (AP = -4 < 0), it should be blocked.
    res = match.useSkill(Color.White, 'pirate_bet', []);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('Bạn còn nợ AP');

    // Gain AP to repay debt
    match.submitAction({
      type: 'GAIN_AP',
      player: Color.White,
      amount: 5,
      source: 'test_gain',
    });
    expect(state.whiteAP).toBe(1);

    // Now that AP is 1 (>= 0), we can cast Bet (1 - 4 = -3 AP, within -10 limit)
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    res = match.useSkill(Color.White, 'pirate_bet', []);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(-3);
  });

  // P2: Skill 1: Bet guess success on opponent skill use vs failure on expiration
  it('P2: Skill 1 Bet guess yields 8 AP on opponent skill use; ticks and expires otherwise', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Cast Bet skill
    let res = match.useSkill(Color.White, 'pirate_bet', []);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(0);

    const hasBet = state.getPlayerEffects(Color.White).some(e => e.type === 'pirate_bet');
    expect(hasBet).toBe(true);

    // End turn -> Black's turn
    match.submitAction({ type: 'END_TURN', player: Color.White });
    
    // Black uses a skill (e.g. lightning_thunder_trap)
    state.blackAP = 10;
    state.turnPhase = 'action';
    state.hasMoved = true; // Simulating moved so turn can end / skills can be used
    res = match.useSkill(Color.Black, 'lightning_thunder_trap', [
      { type: 'cell', position: { col: 5, row: 5 } }
    ]);
    expect(res.success).toBe(true);

    // Pirate (White) should immediately gain 8 AP and the bet effect should be removed
    expect(state.whiteAP).toBe(8);
    expect(state.getPlayerEffects(Color.White).some(e => e.type === 'pirate_bet')).toBe(false);
  });

  // P3: Skill 2: Sailing movement block and teleportation resolution
  it('P3: Skill 2 Sailing locks movement, then teleports/captures or fails based on target cell occupancy', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    clearBoard(state.board);

    const knight = { id: 'w_knight', type: PieceType.Knight, color: Color.White, effects: [] };
    state.board.setPiece({ col: 1, row: 1 }, knight);

    // Case A: Target cell is empty -> Teleport successfully
    let res = match.useSkill(Color.White, 'pirate_sailing', [
      { type: 'piece', position: { col: 1, row: 1 }, pieceId: 'w_knight' },
      { type: 'cell', position: { col: 3, row: 3 } },
    ]);
    expect(res.success).toBe(true);
    expect(knight.effects.some(e => e.type === 'sailing')).toBe(true);

    // Try to move knight manually -> should fail
    state.hasMoved = false;
    let moveRes = match.makeMove(Color.White, { col: 1, row: 1 }, { col: 2, row: 3 });
    expect(moveRes.success).toBe(false);
    expect(moveRes.reason).toContain('Illegal move for this piece');

    // Wait 2 rounds (5 turns total: White -> Black -> White -> Black -> White)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Knight should now be teleported to (3, 3)
    expect(state.board.getPiece({ col: 1, row: 1 })).toBeNull();
    expect(state.board.getPiece({ col: 3, row: 3 })?.id).toBe('w_knight');
    expect(knight.effects.some(e => e.type === 'sailing')).toBe(false);

    // Case B: Target cell occupied by enemy -> Capture enemy
    state.whiteAP = 10;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    res = match.useSkill(Color.White, 'pirate_sailing', [
      { type: 'piece', position: { col: 3, row: 3 }, pieceId: 'w_knight' },
      { type: 'cell', position: { col: 5, row: 5 } },
    ]);
    expect(res.success).toBe(true);

    // Place enemy pawn at destination during wait time
    const enemyPawn = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 5, row: 5 }, enemyPawn);

    // Wait 2 rounds
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Knight should be at (5, 5), enemy Pawn captured
    expect(state.board.getPiece({ col: 3, row: 3 })).toBeNull();
    expect(state.board.getPiece({ col: 5, row: 5 })?.id).toBe('w_knight');

    // Case C: Target cell occupied by ally -> Stay in place
    state.whiteAP = 10;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    res = match.useSkill(Color.White, 'pirate_sailing', [
      { type: 'piece', position: { col: 5, row: 5 }, pieceId: 'w_knight' },
      { type: 'cell', position: { col: 6, row: 6 } },
    ]);
    expect(res.success).toBe(true);

    // Place ally pawn at destination during wait time
    const allyPawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 6, row: 6 }, allyPawn);

    // Wait 2 rounds
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Knight should remain at (5, 5), ally Pawn at (6, 6)
    expect(state.board.getPiece({ col: 5, row: 5 })?.id).toBe('w_knight');
    expect(state.board.getPiece({ col: 6, row: 6 })?.id).toBe('w_pawn');
  });

  // P4: Ultimate: Broadside cannon firing & 3x3 explosion destroying enemies
  it('P4: Ultimate Broadside fires Rooks forward, capturing enemies and exploding 3x3 area destroying other enemies', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 12;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    clearBoard(state.board);

    // White Rooks
    const rook1 = { id: 'w_rook1', type: PieceType.Rook, color: Color.White, effects: [] };
    const rook2 = { id: 'w_rook2', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, rook1);
    state.board.setPiece({ col: 2, row: 0 }, rook2);

    // Enemy pieces to capture (in columns 0 and 2)
    const enemyKnight = { id: 'b_knight', type: PieceType.Knight, color: Color.Black, effects: [] };
    const enemyBishop = { id: 'b_bishop', type: PieceType.Bishop, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 1 }, enemyKnight); // Directly in front of rook1
    state.board.setPiece({ col: 2, row: 3 }, enemyBishop);

    // Enemy Pawn inside the 3x3 blast region of Bishop (2, 3) -> should be destroyed by blast
    const enemyPawn = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 1, row: 3 }, enemyPawn);

    // Allied Pawn inside the 3x3 blast region of enemyKnight (0, 1) -> should NOT be destroyed
    const allyPawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 0, row: 2 }, allyPawn);

    // Execute Ultimate
    const res = match.useSkill(Color.White, 'pirate_broadside', []);
    expect(res.success).toBe(true);

    // Verification
    // 1. Rooks should still be at their original spots (stayInPlace = true)
    expect(state.board.getPiece({ col: 0, row: 0 })?.id).toBe('w_rook1');
    expect(state.board.getPiece({ col: 2, row: 0 })?.id).toBe('w_rook2');

    // 2. Enemy targets at (0, 1) and (2, 3) should be captured (meaning removed/replaced)
    expect(state.board.getPiece({ col: 0, row: 1 })).toBeNull();
    expect(state.board.getPiece({ col: 2, row: 3 })).toBeNull();

    // 3. Enemy Pawn at (1, 3) should be destroyed by the explosion blast
    expect(state.board.getPiece({ col: 1, row: 3 })).toBeNull();

    // 4. Allied Pawn at (0, 2) should still be alive
    expect(state.board.getPiece({ col: 0, row: 2 })?.id).toBe('w_pawn');
  });
});
