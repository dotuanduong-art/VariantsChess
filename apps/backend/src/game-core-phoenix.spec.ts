import {
  Match,
  Color,
  Position,
  PieceType,
  Piece,
} from 'game-core';

describe('Chess Variant Engine - Phoenix Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // ==========================================
  // P1: Passive — Rebirth triggers on King death
  // ==========================================
  it('P1: Passive — Rebirth triggers on King death, clears allies, teleports enemies, locks skills', () => {
    match.setVariants('phoenix', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Verify initial layout original piece is present
    const blackPawn = state.board.getPiece({ col: 0, row: 13 })!;
    expect(blackPawn.id).toBe('b_pawn_0');

    // Move black pawn to row 7
    state.board.removePiece({ col: 0, row: 13 });
    state.board.setPiece({ col: 0, row: 7 }, blackPawn);

    // Setup an enemy evolved piece (non-initial ID w/o starting layout match)
    const enemySummonedPiece: Piece = {
      id: 'summoned_zombie_b_123',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece({ col: 2, row: 7 }, enemySummonedPiece);

    // Setup some ally White pieces
    const whiteBishop = state.board.getPiece({ col: 2, row: 0 })!;
    expect(whiteBishop.color).toBe(Color.White);

    // Capture White King to trigger Rebirth
    const kingPos = { col: 7, row: 0 };
    const king = state.board.getPiece(kingPos)!;
    expect(king.type).toBe(PieceType.King);

    // Destroy the King via action to simulate capture/kill
    const res = match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: king.id,
      position: kingPos,
      reason: 'capture',
    });

    expect(res.success).toBe(true);

    // Rebirth should have triggered!
    // Match should NOT be finished
    expect(match.getStatus()).toBe('playing');
    expect(state.variantState.phoenixRebirthed?.[Color.White]).toBe(true);
    expect(state.variantState.phoenixSkillsDisabled?.[Color.White]).toBe(true);

    // Phoenix ally bishop on C1 (col 2, row 0) should have been silently deleted
    expect(state.board.getPiece({ col: 2, row: 0 })?.id).not.toBe(whiteBishop.id);

    // Black initial pawn at col 0 should be teleported back to row 13
    expect(state.board.getPiece({ col: 0, row: 7 })).toBeNull();
    const teleportedEnemy = state.board.getPiece({ col: 0, row: 13 });
    expect(teleportedEnemy).toBeDefined();
    expect(teleportedEnemy?.id).toBe('b_pawn_0');

    // Non-initial summoned enemy piece should have been silently destroyed (not teleported)
    expect(state.board.getPiece({ col: 2, row: 7 })).toBeNull();

    // Phoenix new army spawned: King(col 7), Rook(col 0), Bishop(col 2, 5), Knight(col 1) at row 0
    expect(state.board.getPiece({ col: 7, row: 0 })?.type).toBe(PieceType.King);
    expect(state.board.getPiece({ col: 0, row: 0 })?.type).toBe(PieceType.Rook);
    expect(state.board.getPiece({ col: 2, row: 0 })?.type).toBe(PieceType.Bishop);
    expect(state.board.getPiece({ col: 5, row: 0 })?.type).toBe(PieceType.Bishop);
    expect(state.board.getPiece({ col: 1, row: 0 })?.type).toBe(PieceType.Knight);

    // Skills should be permanently locked
    const skillRes = match.useSkill(Color.White, 'phoenix_ashes', [
      { type: 'piece', pieceId: 'any_id' },
      { type: 'cell', position: { col: 0, row: 1 } },
    ]);
    expect(skillRes.success).toBe(false);
    expect(skillRes.reason).toContain('permanently disabled');

    // Destroy King a second time -> game over
    const newKing = state.board.getPiece({ col: 7, row: 0 })!;
    const killRes2 = match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: newKing.id,
      position: { col: 7, row: 0 },
      reason: 'capture',
    });
    expect(killRes2.success).toBe(true);
    expect(match.getStatus()).toBe('finished');
    expect(match.getWinner()).toBe(Color.Black);
  });

  // ==========================================
  // P2: Skill 1 — Ashes of Reanimation AP validation & summon
  // ==========================================
  it('P2: Skill 1 — Ashes of Reanimation works with dynamic AP cost and expires after 4 rounds', () => {
    match.setVariants('phoenix', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Put a White Rook in the graveyard
    const deadRook: Piece = { id: 'w_rook_dead', type: PieceType.Rook, color: Color.White, effects: [] };
    state.graveyard.push({
      piece: deadRook,
      position: { col: 0, row: 0 },
      turnDied: 1,
      killedBy: 'capture',
    });

    // Target empty cell on own half: col 2, row 1 (White half is 0-6)
    const targetCell = { col: 2, row: 1 };
    state.board.removePiece(targetCell);

    // Rook AP cost is 7. We have 10 AP.
    const res = match.useSkill(Color.White, 'phoenix_ashes', [
      { type: 'piece', position: { col: 0, row: 0 }, pieceId: 'w_rook_dead' },
      { type: 'cell', position: targetCell },
    ]);

    expect(res.success).toBe(true);
    // AP should be deducted: 10 - 7 = 3 AP
    expect(state.whiteAP).toBe(3);

    // Piece is spawned
    const spawned = state.board.getPiece(targetCell)!;
    expect(spawned.id).toBe('w_rook_dead');
    expect(spawned.type).toBe(PieceType.Rook);

    // Summon duration applied
    const durationEffect = spawned.effects?.find(e => e.type === 'summon_duration');
    expect(durationEffect).toBeDefined();
    expect(durationEffect?.remainingDuration).toBe(4);

    // Let's tick and check if it gets removed after 4 rounds (which ends on owner's turnEnd)
    // Turn 1 ends for White (not ticked because applied this turn)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // Turn 1 ends for Black
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Turn 2 White ends (ticks 4 -> 3)
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(durationEffect?.remainingDuration).toBe(3);
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Turn 3 White ends (ticks 3 -> 2)
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Turn 4 White ends (ticks 2 -> 1)
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Turn 5 White ends (ticks 1 -> 0 -> destroyed)
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Piece should be destroyed silently (gone from board)
    expect(state.board.getPiece(targetCell)).toBeNull();
  });

  // ==========================================
  // P3: Skill 2 — Solar Flare Bishop requirements, stun, flame
  // ==========================================
  it('P3: Skill 2 — Solar Flare requires 2 Bishops, stuns target, creates 5x5 Flame', () => {
    match.setVariants('phoenix', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Find black pawn at D14 (col 3, row 13)
    const enemyPos = { col: 3, row: 13 };
    const enemy = state.board.getPiece(enemyPos)!;

    // Set up 2 White Bishops attacking C13 (col 3, row 13)
    // White Bishop 1 at C1 (col 2, row 0) -> move to B12 (col 1, row 11)
    // White Bishop 2 at F1 (col 5, row 0) -> move to E11 (col 4, row 11)
    // Clear path first (there are pawns)
    state.board.removePiece({ col: 1, row: 11 });
    state.board.removePiece({ col: 4, row: 11 });
    
    // Set pieces
    const bishop1: Piece = { id: 'w_bishop_test_1', type: PieceType.Bishop, color: Color.White, effects: [] };
    const bishop2: Piece = { id: 'w_bishop_test_2', type: PieceType.Bishop, color: Color.White, effects: [] };
    state.board.setPiece({ col: 1, row: 11 }, bishop1);
    state.board.setPiece({ col: 4, row: 11 }, bishop2);

    // Verify both Bishops attack enemyPos (col 3, row 13)
    // Bishop 1 at (1,11) attacks (3,13) diagonally
    // Bishop 2 at (4,11) attacks (3,13) diagonally or horizontal step. Since it is (3,13) from (4,11), row diff is 2, col diff is -1. 
    // Wait, diagonal from (4,11) is (3,12) -> (2,13). Wait! (4,11) does NOT attack (3,13) diagonally.
    // Let's place Bishop 2 at E12 (col 4, row 12) -> attacks D13 (col 3, row 13) diagonally!
    state.board.removePiece({ col: 4, row: 12 });
    state.board.setPiece({ col: 4, row: 12 }, bishop2);

    // Let's check with 1 Bishop attacking first
    state.board.removePiece({ col: 1, row: 11 }); // remove bishop 1
    const resFail = match.useSkill(Color.White, 'phoenix_solar_flare', [
      { type: 'piece', position: enemyPos, pieceId: enemy.id },
    ]);
    expect(resFail.success).toBe(false);
    expect(resFail.reason).toContain('at least 2 ally Bishops');

    // Put Bishop 1 back
    state.board.setPiece({ col: 1, row: 11 }, bishop1);

    // Activating skill should succeed now
    const resSuccess = match.useSkill(Color.White, 'phoenix_solar_flare', [
      { type: 'piece', position: enemyPos, pieceId: enemy.id },
    ]);
    expect(resSuccess.success).toBe(true);

    // Target is Stunned for 2 rounds
    const stunEffect = enemy.effects?.find(e => e.type === 'stun');
    expect(stunEffect).toBeDefined();
    expect(stunEffect?.remainingDuration).toBe(2);

    // Flame is placed on 5x5 cells around target (col 3, row 13)
    // Cell (3,13) should have flame
    const flameCellEffects = state.board.getCellEffects({ col: 3, row: 13 });
    expect(flameCellEffects.some(e => e.type === 'flame')).toBe(true);

    // Verify sliding blocked by flame
    // Move White Rook to (3, 11) - clear (3,12) first, Rook wants to move to (3,14) through (3,13)
    state.board.removePiece({ col: 3, row: 11 });
    state.board.removePiece({ col: 3, row: 12 });
    state.board.removePiece({ col: 3, row: 14 });
    const whiteRook: Piece = { id: 'w_rook_test', type: PieceType.Rook, color: Color.White, effects: [] };
    state.board.setPiece({ col: 3, row: 11 }, whiteRook);

    const rookMoves = match.getLegalMovesAt({ col: 3, row: 11 });
    // Should be blocked by flame at (3,12) and (3,13), but Rook can move south to (3,10)
    expect(rookMoves.some(m => m.col === 3 && m.row === 10)).toBe(true);
    expect(rookMoves.some(m => m.col === 3 && m.row === 12)).toBe(false);
    expect(rookMoves.some(m => m.col === 3 && m.row === 13)).toBe(false);
    expect(rookMoves.some(m => m.col === 3 && m.row === 14)).toBe(false);
  });

  // ==========================================
  // P4: Ultimate — Supernova 7x7 warn and 6-ply delayed explosion
  // ==========================================
  it('P4: Ultimate — Supernova displays warning and detonates after 6 turns', () => {
    match.setVariants('phoenix', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 11;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const centerCell = { col: 7, row: 7 };

    // Place an enemy pawn at (7, 7)
    const enemyPawn: Piece = { id: 'b_pawn_target', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece(centerCell, enemyPawn);

    // Place White King inside warning zone at (7, 6)
    const whiteKing = state.board.getPiece({ col: 7, row: 0 })!;
    state.board.removePiece({ col: 7, row: 0 });
    state.board.setPiece({ col: 7, row: 6 }, whiteKing);

    // Use skill
    const res = match.useSkill(Color.White, 'phoenix_supernova', [
      { type: 'cell', position: centerCell },
    ]);

    expect(res.success).toBe(true);
    expect(state.variantState.supernova).toBeDefined();
    expect(state.variantState.supernova.active).toBe(true);

    // Warning effects should be visible at (7,7)
    expect(state.board.getCellEffects(centerCell).some(e => e.type === 'supernova_warning')).toBe(true);

    // Trace turn starts (detonates at ply + 6)
    // Cast occurred at White round 1 (ply 0). Detonation ply is 6 (White round 4 start).
    // Let's end White round 1 -> starts Black round 1 (ply 1)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.board.getPiece(centerCell)).not.toBeNull(); // not yet detonated

    // End Black round 1 -> starts White round 2 (ply 2)
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(state.board.getPiece(centerCell)).not.toBeNull();

    // End White round 2 -> starts Black round 2 (ply 3)
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.board.getPiece(centerCell)).not.toBeNull();

    // End Black round 2 -> starts White round 3 (ply 4)
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(state.board.getPiece(centerCell)).not.toBeNull();

    // End White round 3 -> starts Black round 3 (ply 5)
    state.hasMoved = false;
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.board.getPiece(centerCell)).not.toBeNull();

    // End Black round 3 -> starts White round 4 (ply 6 -> DETONATION!)
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Detonation should have occurred!
    // Enemy pawn at (7, 7) should be destroyed
    expect(state.board.getPiece(centerCell)).toBeNull();

    // White King at (7, 6) must survive
    expect(state.board.getPiece({ col: 7, row: 6 })?.type).toBe(PieceType.King);

    // Warnings are cleared
    expect(state.board.getCellEffects(centerCell).some(e => e.type === 'supernova_warning')).toBe(false);
    expect(state.variantState.supernova).toBeNull();
  });

  // ==========================================
  // P5: Passive — Evolved enemy piece retains type and is teleported back during Rebirth
  // ==========================================
  it('P5: Passive — Evolved enemy piece retains type and is teleported back during Rebirth', () => {
    match.setVariants('phoenix', 'predator');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 5;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Get Black Pawn at col 1, row 13 (ID: b_pawn_1)
    const blackPawn = state.board.getPiece({ col: 1, row: 13 })!;
    expect(blackPawn.id).toBe('b_pawn_1');

    // Evolve it to Queen (simulate predator evolution)
    blackPawn.type = PieceType.Queen;

    // Move this evolved Queen to col 5, row 5
    state.board.removePiece({ col: 1, row: 13 });
    state.board.setPiece({ col: 5, row: 5 }, blackPawn);

    // Verify it is on (5,5) as Queen
    const pAt5 = state.board.getPiece({ col: 5, row: 5 })!;
    expect(pAt5.id).toBe('b_pawn_1');
    expect(pAt5.type).toBe(PieceType.Queen);

    // Destroy White King to trigger Rebirth
    const kingPos = { col: 7, row: 0 };
    const king = state.board.getPiece(kingPos)!;

    const res = match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: king.id,
      position: kingPos,
      reason: 'capture',
    });

    expect(res.success).toBe(true);

    // Rebirth should have triggered!
    expect(state.variantState.phoenixRebirthed?.[Color.White]).toBe(true);

    // Evolved enemy piece must be gone from (5,5)
    expect(state.board.getPiece({ col: 5, row: 5 })).toBeNull();

    // It must have been teleported back to its starting position (col 1, row 13) as a Queen
    const teleported = state.board.getPiece({ col: 1, row: 13 })!;
    expect(teleported).toBeDefined();
    expect(teleported.id).toBe('b_pawn_1');
    expect(teleported.type).toBe(PieceType.Queen); // Retains type!
  });
});
