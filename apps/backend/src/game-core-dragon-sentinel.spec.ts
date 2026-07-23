import {
  Match,
  Color,
  Position,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  BOARD_SIZE,
} from 'game-core';

describe('Chess Variant Engine - Dragon Sentinel Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  function setupWhiteDragonSentinelTurn() {
    match.setVariants('dragon_sentinel', 'lightning');
    match.start();
    const state = match.getGameState();
    state.whiteAP = 40;
    state.blackAP = 40;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    return state;
  }

  // Helper to find King position
  function findKingPos(state: any, color: Color): Position {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === color) {
          return { col: c, row: r };
        }
      }
    }
    throw new Error('King not found');
  }

  // ═══════════════════════════════════════════════════════
  // PASSIVE - DRAGON GUARD
  // ═══════════════════════════════════════════════════════

  it('V1: Passive triggers after 2 rounds: Nearest ally to King receives Shield', () => {
    const state = setupWhiteDragonSentinelTurn();
    
    // Clear board except White King and one White Pawn
    state.board = new Board();
    const kingPos = { col: 7, row: 0 };
    const pawnPos = { col: 7, row: 1 };
    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(pawnPos, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });

    // Round 1 End (White Turn End + Black Turn End)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Pawn should not have shield yet
    let p = state.board.getPiece(pawnPos);
    expect(p!.effects?.some(e => e.type === 'shield')).toBe(false);

    // Round 2 End (White Turn End + Black Turn End)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Now pawn should have shield
    p = state.board.getPiece(pawnPos);
    expect(p!.effects?.some(e => e.type === 'shield')).toBe(true);
  });

  it('V2: Passive selects correct piece (nearest by Manhattan distance)', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();
    
    const kingPos = { col: 7, row: 0 };
    const nearPawnPos = { col: 7, row: 2 }; // distance = 2
    const farPawnPos = { col: 7, row: 5 }; // distance = 5

    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(nearPawnPos, { id: 'w_near', type: PieceType.Pawn, color: Color.White, effects: [] });
    state.board.setPiece(farPawnPos, { id: 'w_far', type: PieceType.Pawn, color: Color.White, effects: [] });

    // Simulate 2 rounds (4 turns)
    for (let i = 0; i < 4; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    const near = state.board.getPiece(nearPawnPos);
    const far = state.board.getPiece(farPawnPos);

    expect(near!.effects?.some(e => e.type === 'shield')).toBe(true);
    expect(far!.effects?.some(e => e.type === 'shield')).toBe(false);
  });

  it('V3: Passive Shield duration is exactly 1 round (which is 1 tick on owner turn end)', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    const kingPos = { col: 7, row: 0 };
    const pawnPos = { col: 7, row: 1 };
    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(pawnPos, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });

    // End 2 rounds to apply shield
    for (let i = 0; i < 4; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Now turn is White again. Pawn has shield.
    let p = state.board.getPiece(pawnPos);
    expect(p!.effects?.some(e => e.type === 'shield')).toBe(true);

    // End White turn (shield ticks and expires)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Now shield should be gone.
    p = state.board.getPiece(pawnPos);
    expect(p!.effects?.some(e => e.type === 'shield')).toBe(false);
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 1 - SUBTERRANEAN ESCAPE
  // ═══════════════════════════════════════════════════════

  it('V4: Skill 1: Target ally receives subterranean_escape effect', () => {
    const state = setupWhiteDragonSentinelTurn();
    const pawnPos = { col: 7, row: 1 };

    const res = match.useSkill(Color.White, 'dragon_sentinel_subterranean_escape', [
      { type: 'piece', position: pawnPos, pieceId: state.board.getPiece(pawnPos)!.id }
    ]);
    expect(res.success).toBe(true);

    const p = state.board.getPiece(pawnPos);
    expect(p!.effects?.some(e => e.type === 'subterranean_escape')).toBe(true);
  });

  it('V5: Skill 1: When ally with effect is captured, it goes underground and returns after 2 rounds', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    const kingPos = { col: 0, row: 0 };
    const pawnPos = { col: 1, row: 1 };
    const enemyRookPos = { col: 1, row: 5 };

    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(pawnPos, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });
    state.board.setPiece(enemyRookPos, { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] });

    // Buff the pawn
    match.useSkill(Color.White, 'dragon_sentinel_subterranean_escape', [
      { type: 'piece', position: pawnPos, pieceId: 'w_pawn' }
    ]);

    // Opponent captures the pawn
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.blackAP = 40;
    const moveRes = match.makeMove(Color.Black, enemyRookPos, pawnPos);
    expect(moveRes.success).toBe(true);

    // Attacker should be at pawnPos
    const rook = state.board.getPiece(pawnPos);
    expect(rook).toBeDefined();
    expect(rook!.id).toBe('b_rook');

    // The underground list should have the pawn
    expect(state.variantState.undergroundPieces).toHaveLength(1);
    expect(state.variantState.undergroundPieces[0].pieceSnapshot.id).toBe('w_pawn');
    expect(state.variantState.undergroundPieces[0].returnRound).toBe(3);

    // Turn is Black. End Black turn (Round 1 ends) -> starts White round 2
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Pawn is still underground in round 2
    expect(state.board.getPiece(pawnPos)!.id).toBe('b_rook');

    // End White round 2, then End Black round 2 -> starts White round 3
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White Turn starts (Round 3) - return should trigger!
    // Since b_rook is occupying the cell, it should be destroyed, and w_pawn should spawn.
    expect(state.board.getPiece(pawnPos)!.id).toBe('w_pawn');
    // b_rook should be dead (not at pawnPos or any other cell)
    expect(state.board.getPiece(enemyRookPos)).toBeNull();
  });

  it('V6 & V7: Skill 1: Returned piece spawns normally if cell is empty, destroys occupier otherwise', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    const kingPos = { col: 0, row: 0 };
    const pawnPos = { col: 1, row: 1 };
    const enemyRookPos = { col: 1, row: 5 };

    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(pawnPos, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });
    state.board.setPiece(enemyRookPos, { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] });

    // Buff the pawn
    match.useSkill(Color.White, 'dragon_sentinel_subterranean_escape', [
      { type: 'piece', position: pawnPos, pieceId: 'w_pawn' }
    ]);

    // Opponent captures the pawn
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.blackAP = 40;
    match.makeMove(Color.Black, enemyRookPos, pawnPos);

    // Move opponent rook away to leave cell empty
    match.submitAction({ type: 'END_TURN', player: Color.Black }); // End Black turn
    
    // White turn
    state.whiteAP = 10;
    match.submitAction({ type: 'END_TURN', player: Color.White }); // End White turn

    // Black turn - move rook away
    state.blackAP = 10;
    match.makeMove(Color.Black, pawnPos, enemyRookPos);
    expect(state.board.getPiece(pawnPos)).toBeNull(); // Empty now
    match.submitAction({ type: 'END_TURN', player: Color.Black }); // End Black turn

    // White Turn starts (Round N+2) - returns in empty cell
    expect(state.board.getPiece(pawnPos)!.id).toBe('w_pawn');
  });

  it('V8: Skill 1: Effect expires without capture → no underground behavior', () => {
    const state = setupWhiteDragonSentinelTurn();
    const pawnPos = { col: 7, row: 1 };

    match.useSkill(Color.White, 'dragon_sentinel_subterranean_escape', [
      { type: 'piece', position: pawnPos, pieceId: 'w_pawn' }
    ]);

    // End 3 rounds without capture to allow expiration (due to skip on application turn)
    for (let i = 0; i < 6; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Effect should be expired
    const p = state.board.getPiece(pawnPos);
    expect(p!.effects?.some(e => e.type === 'subterranean_escape')).toBe(false);
    expect(state.variantState.undergroundPieces).toHaveLength(0);
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 2 - SHOCKWAVE
  // ═══════════════════════════════════════════════════════

  it('V9 & V12: Skill 2: Enemies in 3x3 are pushed outward 1 cell (including diagonal corner pushes)', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    const kingPos = { col: 5, row: 5 };
    const enemyN = { col: 5, row: 4 };
    const enemySE = { col: 6, row: 6 };

    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(enemyN, { id: 'b_n', type: PieceType.Pawn, color: Color.Black, effects: [] });
    state.board.setPiece(enemySE, { id: 'b_se', type: PieceType.Pawn, color: Color.Black, effects: [] });

    const res = match.useSkill(Color.White, 'dragon_sentinel_shockwave', [
      { type: 'piece', position: kingPos, pieceId: 'w_king' }
    ]);
    expect(res.success).toBe(true);

    // enemyN should be pushed North to (5, 3)
    expect(state.board.getPiece(enemyN)).toBeNull();
    expect(state.board.getPiece({ col: 5, row: 3 })!.id).toBe('b_n');

    // enemySE should be pushed Southeast (diagonal) to (7, 7)
    expect(state.board.getPiece(enemySE)).toBeNull();
    expect(state.board.getPiece({ col: 7, row: 7 })!.id).toBe('b_se');
  });

  it('V10 & V11: Skill 2: Pushed enemy blocked by board edge or another piece stays in place', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    // Epicenter at (0, 1)
    const centerPos = { col: 0, row: 1 };
    const enemyAtEdge = { col: 0, row: 0 }; // push direction is North (0, -1) -> out of bounds
    const enemyBlocked = { col: 1, row: 1 }; // push direction is East (1, 0) -> (2, 1)
    const blockPos = { col: 2, row: 1 };

    state.board.setPiece(centerPos, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });
    state.board.setPiece(enemyAtEdge, { id: 'b_edge', type: PieceType.Pawn, color: Color.Black, effects: [] });
    state.board.setPiece(enemyBlocked, { id: 'b_blocked', type: PieceType.Pawn, color: Color.Black, effects: [] });
    state.board.setPiece(blockPos, { id: 'w_blocker', type: PieceType.Pawn, color: Color.White, effects: [] });

    const res = match.useSkill(Color.White, 'dragon_sentinel_shockwave', [
      { type: 'piece', position: centerPos, pieceId: 'w_pawn' }
    ]);
    expect(res.success).toBe(true);

    // Both should stay in place
    expect(state.board.getPiece(enemyAtEdge)!.id).toBe('b_edge');
    expect(state.board.getPiece(enemyBlocked)!.id).toBe('b_blocked');
  });

  // ═══════════════════════════════════════════════════════
  // ULTIMATE - DRAGON'S ROAR
  // ═══════════════════════════════════════════════════════

  it('V13 & V18: Ultimate: King cannot move during channeling and beam phase', () => {
    const state = setupWhiteDragonSentinelTurn();
    const kingPos = findKingPos(state, Color.White);

    // Target a cell directly North to fire North
    const targetCell = { col: kingPos.col, row: kingPos.row + 2 };

    const res = match.useSkill(Color.White, 'dragon_sentinel_dragons_roar', [
      { type: 'cell', position: targetCell }
    ]);
    expect(res.success).toBe(true);

    // King should have dragons_roar_channeling effect
    const kingPiece = state.board.getPiece(kingPos)!;
    expect(kingPiece.effects?.some(e => e.type === 'dragons_roar_channeling')).toBe(true);

    // Verify King has no legal moves
    const moves = match.getLegalMovesAt(kingPos);
    expect(moves).toHaveLength(0);
  });

  it('V14 & V16: Ultimate: Channeling completes after 5 rounds, beam destroys all enemy pieces in line', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    const kingPos = { col: 5, row: 5 };
    const enemyPos = { col: 5, row: 3 }; // North of king
    const enemyFarPos = { col: 5, row: 1 }; // North of king
    const allyPos = { col: 5, row: 2 }; // Ally North of king (should NOT be destroyed)

    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(enemyPos, { id: 'b_enemy', type: PieceType.Pawn, color: Color.Black, effects: [] });
    state.board.setPiece(enemyFarPos, { id: 'b_far', type: PieceType.Pawn, color: Color.Black, effects: [] });
    state.board.setPiece(allyPos, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });

    // Start roaring North (orthogonal target)
    const targetCell = { col: 5, row: 4 };
    match.useSkill(Color.White, 'dragon_sentinel_dragons_roar', [
      { type: 'cell', position: targetCell }
    ]);

    // End 5 rounds (10 turns total)
    for (let i = 0; i < 10; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Enemies on the North beam line should be destroyed
    expect(state.board.getPiece(enemyPos)).toBeNull();
    expect(state.board.getPiece(enemyFarPos)).toBeNull();

    // Ally should be safe
    expect(state.board.getPiece(allyPos)!.id).toBe('w_pawn');

    // Beam cell effects should be present on the cells
    const cellEffects = state.board.getCellEffects(enemyPos);
    expect(cellEffects.some(e => e.type === 'dragons_roar_beam')).toBe(true);
  });

  it('V15: Ultimate: Sacrificing/killing ally reduces channeling by 1 round', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    const kingPos = { col: 5, row: 5 };
    const allyPos = { col: 4, row: 4 };
    const enemyPos = { col: 5, row: 2 };

    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(allyPos, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });
    state.board.setPiece(enemyPos, { id: 'b_enemy', type: PieceType.Pawn, color: Color.Black, effects: [] });

    match.useSkill(Color.White, 'dragon_sentinel_dragons_roar', [
      { type: 'cell', position: { col: 5, row: 4 } }
    ]);

    // Channeling remaining rounds starts at 5
    expect(state.variantState.dragonsRoar.channelRoundsRemaining).toBe(5);

    // Destroy the ally piece using DESTROY_PIECE action
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: 'w_pawn',
      position: allyPos,
      reason: 'sacrifice',
    });

    // Should decrease by 1 round
    expect(state.variantState.dragonsRoar.channelRoundsRemaining).toBe(4);

    // Advance 4 rounds (8 turns)
    for (let i = 0; i < 8; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Beam should be fired and enemy destroyed
    expect(state.board.getPiece(enemyPos)).toBeNull();
  });

  it('V17: Ultimate: Beam persists for 5 rounds, destroying enemies entering beam cells', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    const kingPos = { col: 5, row: 5 };
    const enemyRookPos = { col: 4, row: 3 }; // Off-beam initially

    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(enemyRookPos, { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] });

    // Roar North
    match.useSkill(Color.White, 'dragon_sentinel_dragons_roar', [
      { type: 'cell', position: { col: 5, row: 4 } }
    ]);

    // End 5 rounds to trigger beam
    for (let i = 0; i < 10; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Now beam is active. Let opponent Rook move onto the beam cell (5, 3)
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.blackAP = 40;
    
    const beamCell = { col: 5, row: 3 };
    const moveRes = match.makeMove(Color.Black, enemyRookPos, beamCell);
    expect(moveRes.success).toBe(true);

    // Rook should be immediately destroyed upon entering the beam cell
    expect(state.board.getPiece(beamCell)).toBeNull();
  });

  // ═══════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════

  it('V19: Edge case: Subterranean Escape + Shield interaction', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    const kingPos = { col: 0, row: 0 };
    const pawnPos = { col: 1, row: 1 };
    const enemyRookPos = { col: 1, row: 5 };

    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(pawnPos, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });
    state.board.setPiece(enemyRookPos, { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] });

    // Apply shield to the pawn
    match.submitAction({
      type: 'APPLY_EFFECT',
      effect: {
        id: 's1',
        type: 'shield',
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: 'w_pawn',
        stackingRule: 'ignore',
        isDebuff: false,
        metadata: {},
      }
    });

    // Apply Subterranean Escape to the pawn
    match.useSkill(Color.White, 'dragon_sentinel_subterranean_escape', [
      { type: 'piece', position: pawnPos, pieceId: 'w_pawn' }
    ]);

    // Opponent captures the pawn. Shield should block it, leaving pawn on board.
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.blackAP = 40;
    
    // Capture will fail because it is protected by shield
    const moveRes = match.makeMove(Color.Black, enemyRookPos, pawnPos);
    expect(moveRes.success).toBe(false);

    // Pawn should still be on board and NOT in underground pieces list
    expect(state.board.getPiece(pawnPos)!.id).toBe('w_pawn');
    expect(state.variantState.undergroundPieces).toHaveLength(0);
  });

  it('V20: Edge case: Underground return destroys King → game over', () => {
    const state = setupWhiteDragonSentinelTurn();
    state.board = new Board();

    const kingPos = { col: 0, row: 0 };
    const pawnPos = { col: 1, row: 1 };
    const enemyKingPos = { col: 1, row: 2 }; // Legal king move distance

    state.board.setPiece(kingPos, { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece(pawnPos, { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] });
    state.board.setPiece(enemyKingPos, { id: 'b_king', type: PieceType.King, color: Color.Black, effects: [] });

    // Buff the pawn
    match.useSkill(Color.White, 'dragon_sentinel_subterranean_escape', [
      { type: 'piece', position: pawnPos, pieceId: 'w_pawn' }
    ]);

    // Opponent King captures the pawn
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.blackAP = 40;
    const captureRes = match.makeMove(Color.Black, enemyKingPos, pawnPos);
    expect(captureRes.success).toBe(true);

    // Opponent King is now at pawnPos
    expect(state.board.getPiece(pawnPos)!.id).toBe('b_king');

    // End 2 rounds to make the pawn return
    match.submitAction({ type: 'END_TURN', player: Color.Black }); // End Black turn
    
    // White turn
    state.whiteAP = 10;
    match.submitAction({ type: 'END_TURN', player: Color.White }); // End White turn

    // Black turn
    state.blackAP = 10;
    match.submitAction({ type: 'END_TURN', player: Color.Black }); // End Black turn

    // White Turn starts (Round N+2) - returns in cell, destroying the occupying opponent King!
    // Since opponent King is destroyed, the game should end and White wins!
    expect(state.status).toBe('finished');
    expect(state.winner).toBe(Color.White);
  });
});
