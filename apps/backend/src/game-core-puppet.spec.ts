import {
  Match,
  Color,
  PieceType,
  getPieceOwner,
  oppositeColor,
} from 'game-core';

function clearBoard(board: any): void {
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      board.removePiece({ col: c, row: r });
    }
  }
}

describe('Chess Variant Engine - Puppet Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('puppet', 'lightning');
  });

  // P1: Skill 1 places Main+Voodoo; re-casting replaces previous pair; Voodoo death removes Main effect.
  it('P1: Skill 1 places Main+Voodoo, re-casting replaces pair, Voodoo death cleans up Main', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1Pos = { col: 0, row: 0 }; // White Rook
    const p2Pos = { col: 1, row: 0 }; // White Knight
    const p3Pos = { col: 2, row: 0 }; // White Bishop

    const p1 = state.board.getPiece(p1Pos)!;
    const p2 = state.board.getPiece(p2Pos)!;
    const p3 = state.board.getPiece(p3Pos)!;

    // Use Skill 1 on p1 (Main) and p2 (Voodoo)
    let res = match.useSkill(Color.White, 'puppet_soul_binding', [
      { type: 'piece', position: p1Pos, pieceId: p1.id },
      { type: 'piece', position: p2Pos, pieceId: p2.id },
    ]);
    expect(res.success).toBe(true);
    expect(p1.effects.some(e => e.type === 'main')).toBe(true);
    expect(p2.effects.some(e => e.type === 'voodoo')).toBe(true);

    // Re-cast Skill 1 on p2 (Main) and p3 (Voodoo)
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    state.whiteAP = 10;

    res = match.useSkill(Color.White, 'puppet_soul_binding', [
      { type: 'piece', position: p2Pos, pieceId: p2.id },
      { type: 'piece', position: p3Pos, pieceId: p3.id },
    ]);
    expect(res.success).toBe(true);

    // Old main (p1) and old voodoo (p2 as voodoo) should be removed
    expect(p1.effects.some(e => e.type === 'main')).toBe(false);
    expect(p2.effects.some(e => e.type === 'main')).toBe(true);
    expect(p2.effects.some(e => e.type === 'voodoo')).toBe(false);
    expect(p3.effects.some(e => e.type === 'voodoo')).toBe(true);

    // Execute a DESTROY_PIECE action via match.submitAction
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: p3.id,
      position: p3Pos,
      reason: 'manual_test_kill',
    });

    expect(p2.effects.some(e => e.type === 'main')).toBe(false);
  });

  // P2: Soul Binding redirection on capture
  it('P2: Capture targeting Main is redirected to Voodoo; Voodoo dies, Main lives, Attacker is Binded', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    clearBoard(state.board);

    const mainPiece = { id: 'w_main', type: PieceType.Rook, color: Color.White, effects: [] };
    const voodooPiece = { id: 'w_voodoo', type: PieceType.Bishop, color: Color.White, effects: [] };
    const attackerPiece = { id: 'b_attacker', type: PieceType.Rook, color: Color.Black, effects: [] };

    state.board.setPiece({ col: 0, row: 0 }, mainPiece);
    state.board.setPiece({ col: 3, row: 3 }, voodooPiece);
    state.board.setPiece({ col: 0, row: 7 }, attackerPiece);

    // Apply main/voodoo effects
    mainPiece.effects.push({
      id: 'm1',
      type: 'main',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: 'w_main',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });
    voodooPiece.effects.push({
      id: 'v1',
      type: 'voodoo',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: 'w_voodoo',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    // Opponent black rook moves to capture White Main at (0, 0)
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    const res = match.makeMove(Color.Black, { col: 0, row: 7 }, { col: 0, row: 0 });
    if (!res.success) {
      console.log('P2 fail reason:', res.reason);
    }
    expect(res.success).toBe(true);

    // Attacker should end up at Voodoo position (3, 3)
    expect(state.board.getPiece({ col: 3, row: 3 })?.id).toBe('b_attacker');
    // Main at (0, 0) should still be alive
    expect(state.board.getPiece({ col: 0, row: 0 })?.id).toBe('w_main');
    // Voodoo at (3, 3) is dead (replaced by attacker)
    // Main's main effect should have vanished because Voodoo died
    expect(mainPiece.effects.some(e => e.type === 'main')).toBe(false);

    // Attacker should be Binded (2 rounds)
    const attackerOnBoard = state.board.getPiece({ col: 3, row: 3 })!;
    expect(attackerOnBoard.effects.some(e => e.type === 'bind')).toBe(true);
    const bindEffect = attackerOnBoard.effects.find(e => e.type === 'bind')!;
    expect(bindEffect.remainingDuration).toBe(2);
  });

  // P3: Skill 2 places trap; enemy stepping on it gets Stun (2 rounds)
  it('P3: Skill 2 places trap, enemy lands on it and gets Stun', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    clearBoard(state.board);

    // Place trap at (2, 2)
    const resSkill = match.useSkill(Color.White, 'puppet_strings', [
      { type: 'cell', position: { col: 2, row: 2 } }
    ]);
    expect(resSkill.success).toBe(true);
    expect(state.board.getCellEffects({ col: 2, row: 2 }).some(e => e.type === 'puppet_trap')).toBe(true);

    // Enemy Black Rook at (2, 5) moves to (2, 2)
    const enemyRook = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 2, row: 5 }, enemyRook);

    state.currentTurn = Color.Black;
    const resMove = match.makeMove(Color.Black, { col: 2, row: 5 }, { col: 2, row: 2 });
    expect(resMove.success).toBe(true);

    // Trap cell effect should be removed
    expect(state.board.getCellEffects({ col: 2, row: 2 }).some(e => e.type === 'puppet_trap')).toBe(false);

    // Enemy Rook should be stunned for 2 rounds
    const stunnedRook = state.board.getPiece({ col: 2, row: 2 })!;
    expect(stunnedRook.effects.some(e => e.type === 'stun')).toBe(true);
    const stunEff = stunnedRook.effects.find(e => e.type === 'stun')!;
    expect(stunEff.remainingDuration).toBe(2);
    expect(stunEff.metadata.sourceSkill).toBe('puppet_strings');
  });

  // P4: Stun end chains to Bind and puppet_no_capture
  it('P4: When Skill 2 Stun expires, target is Binded and cannot capture on first move', () => {
    match.start();
    const state = match.getGameState();

    clearBoard(state.board);

    const enemyRook = {
      id: 'b_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [{
        id: 's1',
        type: 'stun' as any,
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'b_rook',
        stackingRule: 'refresh' as any,
        isDebuff: true,
        metadata: {
          sourceSkill: 'puppet_strings',
          puppetPlayer: Color.White,
        },
      }],
    };
    state.board.setPiece({ col: 2, row: 2 }, enemyRook);

    // Ticking down: Black's turn ends, stun ticks to 1
    state.currentTurn = Color.Black;
    match.submitAction({
      type: 'TICK_EFFECTS',
      timing: 'turnEnd',
      player: Color.Black,
    });
    expect(enemyRook.effects.find(e => e.type === 'stun')?.remainingDuration).toBe(1);

    // Black's turn ends again, stun ticks to 0 and is removed.
    // That triggers OnEffectExpired, which should apply bind (2 rounds) and puppet_no_capture (null duration)
    match.submitAction({
      type: 'TICK_EFFECTS',
      timing: 'turnEnd',
      player: Color.Black,
    });

    // Verify stun is removed
    expect(enemyRook.effects.some(e => e.type === 'stun')).toBe(false);
    // Verify bind is applied (remainingDuration: 2)
    expect(enemyRook.effects.some(e => e.type === 'bind')).toBe(true);
    expect(enemyRook.effects.find(e => e.type === 'bind')?.remainingDuration).toBe(2);
    // Verify puppet_no_capture is applied
    expect(enemyRook.effects.some(e => e.type === 'puppet_no_capture')).toBe(true);

    // Let's place an enemy pawn for Black Rook to capture at (2, 4)
    const whitePawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 2, row: 4 }, whitePawn);

    // Attempting capture should fail
    state.turnPhase = 'action';
    state.hasMoved = false;
    let res = match.makeMove(Color.Black, { col: 2, row: 2 }, { col: 2, row: 4 });
    expect(res.success).toBe(false); // blocked by no capture

    // Moving to an empty cell (2, 1) should succeed
    res = match.makeMove(Color.Black, { col: 2, row: 2 }, { col: 2, row: 1 });
    expect(res.success).toBe(true);

    // After move, puppet_no_capture effect should be removed
    const movedRook = state.board.getPiece({ col: 2, row: 1 })!;
    expect(movedRook.effects.some(e => e.type === 'puppet_no_capture')).toBe(false);
    // Bind effect should still be present
    expect(movedRook.effects.some(e => e.type === 'bind')).toBe(true);
  });

  // P5: Ultimate dynamic AP cost
  it('P5: Puppet Master Ultimate dynamic AP validation', () => {
    match.start();
    const state = match.getGameState();

    clearBoard(state.board);

    const enemyPawn = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    const enemyQueen = { id: 'b_queen', type: PieceType.Queen, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 5 }, enemyPawn);
    state.board.setPiece({ col: 5, row: 5 }, enemyQueen);

    // White AP is 4
    state.whiteAP = 4;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Target Queen requires 11 AP -> should fail canActivate
    let res = match.useSkill(Color.White, 'puppet_master', [
      { type: 'piece', position: { col: 5, row: 5 }, pieceId: 'b_queen' }
    ]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('requires 11 AP');

    // Target Pawn requires 2 AP -> should succeed
    res = match.useSkill(Color.White, 'puppet_master', [
      { type: 'piece', position: { col: 0, row: 5 }, pieceId: 'b_pawn' }
    ]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(2); // 4 - 2
  });

  // P6: Ultimate control phases & Pawn promotion block
  it('P6: Puppet Master Ultimate pre-control / full-control logic & pawn promotion block', () => {
    match.start();
    const state = match.getGameState();

    clearBoard(state.board);

    // b_pawn is Black pawn. Forward direction is -row.
    // Place at (1, 2). Moving forward (1, 1) is legal. Back rank/promotion is row 0.
    const enemyPawn = { id: 'b_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 1, row: 2 }, enemyPawn);

    // White AP is 10
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Control the pawn
    let resSkill = match.useSkill(Color.White, 'puppet_master', [
      { type: 'piece', position: { col: 1, row: 2 }, pieceId: 'b_pawn' }
    ]);
    expect(resSkill.success).toBe(true);
    expect(getPieceOwner(enemyPawn)).toBe(Color.White);

    // Initial duration is 7
    const controlEff = enemyPawn.effects.find(e => e.type === 'puppet_control')!;
    expect(controlEff.remainingDuration).toBe(7);

    // Pre-control check: cannot capture. Place a Black piece at (2, 1) (diagonal capture for Black Pawn)
    const originalBlackAlly = { id: 'b_ally', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 2, row: 1 }, originalBlackAlly);

    state.turnPhase = 'action';
    state.hasMoved = false;
    let resMove = match.makeMove(Color.White, { col: 1, row: 2 }, { col: 2, row: 1 });
    expect(resMove.success).toBe(false); // capture blocked in pre-control

    // Move purely to empty square (1, 1)
    state.turnPhase = 'action';
    state.hasMoved = false;
    resMove = match.makeMove(Color.White, { col: 1, row: 2 }, { col: 1, row: 1 });
    expect(resMove.success).toBe(true);

    // Pawn is now at (1, 1)

    // White ends turn (turn goes to Black)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // Black ends turn (turn goes to White, control duration ticks 7 -> 6)
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(controlEff.remainingDuration).toBe(6);

    // Place another Black piece at (2, 0) (diagonal capture from (1, 1))
    const enemyRook = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 2, row: 0 }, enemyRook);

    // White tries to capture at duration 6 -> should fail (capture blocked in pre-control)
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;
    resMove = match.makeMove(Color.White, { col: 1, row: 1 }, { col: 2, row: 0 });
    expect(resMove.success).toBe(false);

    // White ends turn again (turn goes to Black)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // Black ends turn again (turn goes to White, control duration ticks 6 -> 5)
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(controlEff.remainingDuration).toBe(5);

    // White should now be able to capture it with the controlled Pawn because remainingDuration is 5 (full-control)
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;
    resMove = match.makeMove(Color.White, { col: 1, row: 1 }, { col: 2, row: 0 });
    expect(resMove.success).toBe(true);
    expect(state.board.getPiece({ col: 2, row: 0 })?.id).toBe('b_pawn');

    // Promotion check: Pawn reached row 0 (Black promotion row) but is controlled by Puppet master -> should NOT promote!
    const controlledPawn = state.board.getPiece({ col: 2, row: 0 })!;
    expect(controlledPawn.type).toBe(PieceType.Pawn); // remains Pawn, not Queen!
  });

  // P7: Cleanse compatibility
  it('P7: Cleansing Skill 2 Stun early still triggers Bind from Passive', () => {
    match.start();
    const state = match.getGameState();

    clearBoard(state.board);

    const enemyRook = {
      id: 'b_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [{
        id: 's1',
        type: 'stun' as any,
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'b_rook',
        stackingRule: 'refresh' as any,
        isDebuff: true,
        metadata: {
          sourceSkill: 'puppet_strings',
          puppetPlayer: Color.White,
        },
      }],
    };
    state.board.setPiece({ col: 2, row: 2 }, enemyRook);

    // Remove the stun effect manually (simulating a cleanse)
    match.submitAction({
      type: 'REMOVE_EFFECT',
      effectId: 's1',
      targetId: 'b_rook',
      targetType: 'piece',
      reason: 'cleansed',
    });

    // Verify stun is removed
    expect(enemyRook.effects.some(e => e.type === 'stun')).toBe(false);
    // Passive Bind should trigger immediately upon stun removal (even though duration wasn't 0)
    expect(enemyRook.effects.some(e => e.type === 'bind')).toBe(true);
    expect(enemyRook.effects.find(e => e.type === 'bind')?.remainingDuration).toBe(2);
  });

  // P8: Control stacking block validation
  it('P8: Puppet Master Ultimate cannot control pieces already under control effects', () => {
    match.start();
    const state = match.getGameState();

    clearBoard(state.board);

    const enemyRook = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 2, row: 2 }, enemyRook);

    // White AP is 10
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // 1. Stacking check with 'walker' effect
    enemyRook.effects.push({
      id: 'w1',
      type: 'walker' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd' as any,
      sourcePlayer: Color.White,
      targetType: 'piece' as any,
      targetId: 'b_rook',
      stackingRule: 'ignore' as any,
      isDebuff: false,
      metadata: {},
    });

    let res = match.useSkill(Color.White, 'puppet_master', [
      { type: 'piece', position: { col: 2, row: 2 }, pieceId: 'b_rook' }
    ]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('already under control');

    // Remove walker effect
    enemyRook.effects = [];

    // 2. Stacking check with 'puppet_control' effect
    enemyRook.effects.push({
      id: 'p1',
      type: 'puppet_control' as any,
      duration: 7,
      remainingDuration: 7,
      tickTiming: 'turnEnd' as any,
      sourcePlayer: Color.White,
      targetType: 'piece' as any,
      targetId: 'b_rook',
      stackingRule: 'ignore' as any,
      isDebuff: true,
      metadata: { controlledBy: Color.White },
    });

    res = match.useSkill(Color.White, 'puppet_master', [
      { type: 'piece', position: { col: 2, row: 2 }, pieceId: 'b_rook' }
    ]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('already under control');

    // Remove puppet_control effect
    enemyRook.effects = [];

    // 3. Normal cast succeeds
    res = match.useSkill(Color.White, 'puppet_master', [
      { type: 'piece', position: { col: 2, row: 2 }, pieceId: 'b_rook' }
    ]);
    expect(res.success).toBe(true);
  });
});
