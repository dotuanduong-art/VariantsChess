import {
  Match,
  Color,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  Position,
} from 'game-core';

describe('Chess Variant Engine - Space Variant Tests', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('space', 'lightning');
  });

  // =========================================================================
  // Cell Effect Side Blocking (SP1)
  // =========================================================================
  it('SP1: Cell effect side blocking — Space player moves freely through Outworld, enemy is blocked', () => {
    match.start();
    const state = match.getGameState();

    // Place Outworld on (0, 3) created by White (Space player)
    state.board.addCellEffect({ col: 0, row: 3 }, {
      id: 'outworld_test_1',
      type: 'outworld',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '0,3',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    // Replace White Pawn at (0, 1) with White Rook
    state.board.setPiece({ col: 0, row: 1 }, {
      id: 'w_rook',
      type: PieceType.Rook,
      color: Color.White,
      effects: [],
    });

    // Replace Black Pawn at (0, 13) with Black Rook
    state.board.setPiece({ col: 0, row: 13 }, {
      id: 'b_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    // White's turn: Rook at (0, 1) can move through/land past (0, 3) to (0, 5)
    let moveRes = match.makeMove(Color.White, { col: 0, row: 1 }, { col: 0, row: 5 });
    expect(moveRes.success).toBe(true);

    // End turn White
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black's turn: Black Rook at (0, 13) tries to slide through (0, 3) to (0, 2)
    state.hasMoved = false;
    let bMoveRes = match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 2 });
    expect(bMoveRes.success).toBe(false); // Blocked sliding through
  });

  // =========================================================================
  // Skill 1 - Dimension Link Creation & Interception (SP2-SP4)
  // =========================================================================
  it('SP2: Skill 1 — Dimension Link portal placement validation', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;

    // Try placing odd portal on opponent's half (row 8-14) instead of own half (row 0-6) -> should fail
    let res = match.useSkill(Color.White, 'space_dimension_link', [
      { type: 'cell', position: { col: 0, row: 8 } },
      { type: 'cell', position: { col: 0, row: 2 } },
    ]);
    expect(res.success).toBe(false);

    // Valid placement: t0 on row 2, t1 on row 12
    res = match.useSkill(Color.White, 'space_dimension_link', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 0, row: 12 } },
    ]);
    expect(res.success).toBe(true);

    // Verify portals exist in variantState
    const pairs = state.variantState.dimensionPairs || [];
    expect(pairs.length).toBe(1);
    expect(pairs[0].odd.position).toEqual({ col: 0, row: 2 });
    expect(pairs[0].even.position).toEqual({ col: 0, row: 12 });

    // Verify board has cell effects
    const effectsOdd = state.board.getCellEffects({ col: 0, row: 2 });
    const effectsEven = state.board.getCellEffects({ col: 0, row: 12 });
    expect(effectsOdd.some(e => e.type === 'dimension')).toBe(true);
    expect(effectsEven.some(e => e.type === 'dimension')).toBe(true);
  });

  it('SP3: Skill 1 — Dimension Link path interception', () => {
    match.start();
    const state = match.getGameState();

    // 1. Create a portal pair: White places odd at (0, 5) and even at (14, 5)
    state.whiteAP = 10;
    let res = match.useSkill(Color.White, 'space_dimension_link', [
      { type: 'cell', position: { col: 0, row: 5 } },
      { type: 'cell', position: { col: 14, row: 12 } }, // opponent's half
    ]);
    expect(res.success).toBe(true);

    // Set up Black Rook at (0, 13)
    state.board.setPiece({ col: 0, row: 13 }, {
      id: 'b_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    // Manually remove outworld to allow enemy to pass through for test
    const effectsOdd = state.board.getCellEffects({ col: 0, row: 5 });
    state.board.setCellEffects({ col: 0, row: 5 }, effectsOdd.filter(e => e.type !== 'outworld'));

    // End turn White
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black's turn: Rook slides from (0, 13) to (0, 2), passing through portal at (0, 5)
    state.hasMoved = false;
    let moveRes = match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 2 });
    expect(moveRes.success).toBe(true);

    // Rook must be teleported to even portal position (14, 12)
    const pieceAtEven = state.board.getPiece({ col: 14, row: 12 });
    expect(pieceAtEven).toBeDefined();
    expect(pieceAtEven?.id).toBe('b_rook');

    // Portal position A must be empty
    expect(state.board.getPiece({ col: 0, row: 5 })).toBeNull();
    // Intended destination must be empty (Rook was intercepted mid-path)
    expect(state.board.getPiece({ col: 0, row: 2 })).toBeNull();

    // Portal pair must be destroyed
    const pairs = state.variantState.dimensionPairs || [];
    expect(pairs.length).toBe(0);
    expect(state.board.getCellEffects({ col: 0, row: 5 }).some(e => e.type === 'dimension')).toBe(false);
    expect(state.board.getCellEffects({ col: 14, row: 12 }).some(e => e.type === 'dimension')).toBe(false);
  });

  it('SP4: Skill 1 — Interception target destination occupied', () => {
    match.start();
    const state = match.getGameState();

    // White creates portal: odd at (0, 5), even at (14, 12)
    state.whiteAP = 10;
    match.useSkill(Color.White, 'space_dimension_link', [
      { type: 'cell', position: { col: 0, row: 5 } },
      { type: 'cell', position: { col: 14, row: 12 } },
    ]);

    // Place a dummy piece at the even portal destination (14, 12)
    state.board.setPiece({ col: 14, row: 12 }, {
      id: 'dummy_target',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [],
    });

    // Set up Black Rook at (0, 13)
    state.board.setPiece({ col: 0, row: 13 }, {
      id: 'b_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    // Manually remove outworld to allow enemy to pass through for test
    const effectsOdd = state.board.getCellEffects({ col: 0, row: 5 });
    state.board.setCellEffects({ col: 0, row: 5 }, effectsOdd.filter(e => e.type !== 'outworld'));

    // End turn White
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black's turn: Rook slides from (0, 13) to (0, 2), passing through portal at (0, 5)
    state.hasMoved = false;
    let moveRes = match.makeMove(Color.Black, { col: 0, row: 13 }, { col: 0, row: 2 });
    expect(moveRes.success).toBe(true);

    // Dummy piece at (14, 12) must be destroyed (in graveyard) and Rook stands at (14, 12)
    expect(state.graveyard.some(e => e.piece.id === 'dummy_target')).toBe(true);
    expect(state.board.getPiece({ col: 14, row: 12 })?.id).toBe('b_rook');
  });

  // =========================================================================
  // Skill 1 - Ally Standing Still Teleportation (SP5)
  // =========================================================================
  it('SP5: Skill 1 — Ally standing still for 1 round teleports to even portal', () => {
    match.start();
    const state = match.getGameState();

    // 1. White creates portal odd at (0, 2), even at (0, 12)
    state.whiteAP = 10;
    match.useSkill(Color.White, 'space_dimension_link', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 0, row: 12 } },
    ]);

    // 2. White moves Pawn to odd portal (0, 2)
    // White Pawn starts at (0, 1)
    let moveRes = match.makeMove(Color.White, { col: 0, row: 1 }, { col: 0, row: 2 });
    expect(moveRes.success).toBe(true);

    // End Turn W1 (Pawn just arrived, not standing still yet)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // End Turn B1 (Opponent's turn ends, Pawn has stood for 1 turn/opponent phase)
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // W2 starts: Pawn is on portal, but hasn't been there at start of previous turn. occupantId is set to pawn.id.
    // End Turn W2
    state.hasMoved = false; // dummy action
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // End Turn B2
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // W3 starts: Pawn has been on (0, 2) since start of W2! Teleport triggers automatically.
    const pieceAtEven = state.board.getPiece({ col: 0, row: 12 });
    expect(pieceAtEven).toBeDefined();
    expect(pieceAtEven?.type).toBe(PieceType.Pawn);

    // Odd portal position (0, 2) must be empty now
    expect(state.board.getPiece({ col: 0, row: 2 })).toBeNull();

    // Portals must be destroyed
    expect((state.variantState.dimensionPairs || []).length).toBe(0);
  });

  // =========================================================================
  // Skill 2 - Spatial Shift Swapping & Destruction (SP6-SP7)
  // =========================================================================
  it('SP6: Skill 2 — Spatial Shift swaps columns correctly (A1/O15 -> A15/O1)', () => {
    match.start();
    const state = match.getGameState();

    // Set active portals at (row 0, col 0) (A1) and (row 14, col 14) (O15)
    const pairId = 'spatial_test_pair';
    state.variantState.dimensionPairs = [{
      odd: { id: 'odd_p', position: { col: 0, row: 0 }, type: 'odd', owner: Color.White, occupantId: null },
      even: { id: 'even_p', position: { col: 14, row: 14 }, type: 'even', owner: Color.White, occupantId: null },
      owner: Color.White,
      createdAtRound: 1,
    }];
    syncDimensionPortalCellEffects(state);

    // Call Spatial Shift targeting cell A1 (0, 0)
    state.whiteAP = 10;
    const res = match.useSkill(Color.White, 'space_spatial_shift', [
      { type: 'cell', position: { col: 0, row: 0 } }
    ]);
    expect(res.success).toBe(true);

    const portals = state.variantState.dimensionPairs[0];
    // odd moves to (rowA, colB) = (0, 14) = A15
    expect(portals.odd.position).toEqual({ col: 14, row: 0 });
    // even moves to (rowB, colA) = (14, 0) = O1
    expect(portals.even.position).toEqual({ col: 0, row: 14 });

    // Verify cell effects updated
    expect(state.board.getCellEffects({ col: 14, row: 0 }).some(e => e.type === 'dimension')).toBe(true);
    expect(state.board.getCellEffects({ col: 0, row: 14 }).some(e => e.type === 'dimension')).toBe(true);
    expect(state.board.getCellEffects({ col: 0, row: 0 }).some(e => e.type === 'dimension')).toBe(false);
  });

  it('SP7: Skill 2 — Spatial Shift destination occupied by enemy piece triggers destruction', () => {
    match.start();
    const state = match.getGameState();

    // Setup portal: odd at (0, 2), even at (14, 12)
    state.variantState.dimensionPairs = [{
      odd: { id: 'odd_p', position: { col: 0, row: 2 }, type: 'odd', owner: Color.White, occupantId: null },
      even: { id: 'even_p', position: { col: 14, row: 12 }, type: 'even', owner: Color.White, occupantId: null },
      owner: Color.White,
      createdAtRound: 1,
    }];
    syncDimensionPortalCellEffects(state);

    // Place an opponent's Pawn at odd destination: (colB, rowA) = (14, 2)
    state.board.setPiece({ col: 14, row: 2 }, {
      id: 'enemy_pawn',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [],
    });

    state.whiteAP = 10;
    const res = match.useSkill(Color.White, 'space_spatial_shift', [
      { type: 'cell', position: { col: 0, row: 2 } }
    ]);
    expect(res.success).toBe(true);

    // Enemy pawn must be destroyed
    expect(state.board.getPiece({ col: 14, row: 2 })).toBeNull();
    expect(state.graveyard.some(e => e.piece.id === 'enemy_pawn')).toBe(true);
  });

  // =========================================================================
  // Ultimate - Cosmic Void (SP8)
  // =========================================================================
  it('SP8: Ultimate — Cosmic Void active captures create Outworld blocks expiring together', () => {
    match.start();
    const state = match.getGameState();

    // Put enemy pawn at (0, 2)
    state.board.setPiece({ col: 0, row: 2 }, {
      id: 'enemy_pawn_cv',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [],
    });

    // Replace White Pawn at (0, 1) with White Rook
    state.board.setPiece({ col: 0, row: 1 }, {
      id: 'w_rook_cv',
      type: PieceType.Rook,
      color: Color.White,
      effects: [],
    });

    // Activate Cosmic Void
    state.whiteAP = 10;
    let res = match.useSkill(Color.White, 'space_cosmic_void', []);
    expect(res.success).toBe(true);
    expect(state.variantState.cosmicVoidExpiryRound).toBe(11); // turnNumber 1 + 10 = 11

    // White captures enemy pawn at (0, 2)
    state.hasMoved = false;
    let capRes = match.makeMove(Color.White, { col: 0, row: 1 }, { col: 0, row: 2 });
    expect(capRes.success).toBe(true);

    // Verify Outworld created at capture position (0, 2)
    let effects = state.board.getCellEffects({ col: 0, row: 2 });
    expect(effects.some(e => e.type === 'outworld')).toBe(true);

    const outworld = effects.find(e => e.type === 'outworld')!;
    // Remaining duration should be 11 - 1 = 10 rounds
    expect(outworld.duration).toBe(10);
    expect(outworld.remainingDuration).toBe(10);
  });

  // =========================================================================
  // Rollback validation (SP9)
  // =========================================================================
  it('SP9: Snapshot and restore handles Space variantState correctly', () => {
    match.start();
    const state = match.getGameState();
    const snapshots = match.getSnapshots();

    // Take snapshot W1 start (empty portals)
    // Make portal link on turn 1
    state.whiteAP = 10;
    match.useSkill(Color.White, 'space_dimension_link', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 0, row: 12 } },
    ]);

    // End turn W1
    match.submitAction({ type: 'END_TURN', player: Color.White });
    
    // Take snapshot B1 start (portals exist)
    expect(state.variantState.dimensionPairs.length).toBe(1);

    // Restore to W1 start (1 turn ago)
    const restored = snapshots.restore(1);
    expect(restored).not.toBeNull();
    // Portal pair should be rolled back to empty
    expect((restored!.variantState.dimensionPairs || []).length).toBe(0);
  });

  // =========================================================================
  // Portal visibility validation (SP10)
  // =========================================================================
  it('SP10: Portal visibility — hidden from opponent on Skill 1 creation, revealed after Skill 2 swap', () => {
    match.start();
    const state = match.getGameState();

    // 1. White uses Skill 1 to place portals at (0, 2) and (14, 12)
    state.whiteAP = 10;
    const s1Res = match.useSkill(Color.White, 'space_dimension_link', [
      { type: 'cell', position: { col: 0, row: 2 } },
      { type: 'cell', position: { col: 14, row: 12 } },
    ]);
    expect(s1Res.success).toBe(true);

    // Serialize for opponent (Black) -> Dimension portals must NOT be visible
    let blackState = state.serializeForPlayer(Color.Black);
    let blackEffectsOdd = blackState.board.cellEffects?.['0,2'] || [];
    let blackEffectsEven = blackState.board.cellEffects?.['14,12'] || [];
    expect(blackEffectsOdd.some(e => e.type === 'dimension')).toBe(false);
    expect(blackEffectsEven.some(e => e.type === 'dimension')).toBe(false);

    // Serialize for owner (White) -> Dimension portals MUST be visible
    let whiteState = state.serializeForPlayer(Color.White);
    let whiteEffectsOdd = whiteState.board.cellEffects?.['0,2'] || [];
    let whiteEffectsEven = whiteState.board.cellEffects?.['14,12'] || [];
    expect(whiteEffectsOdd.some(e => e.type === 'dimension')).toBe(true);
    expect(whiteEffectsEven.some(e => e.type === 'dimension')).toBe(true);

    // 2. White uses Skill 2 (Spatial Shift) to swap portals
    state.whiteAP = 10;
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];
    const s2Res = match.useSkill(Color.White, 'space_spatial_shift', [
      { type: 'cell', position: { col: 0, row: 2 } }
    ]);
    expect(s2Res.success).toBe(true);

    // Swap formula: colA = 0, rowA = 2, colB = 14, rowB = 12
    // odd Dest = (14, 2); even Dest = (0, 12)
    // Both portals should be revealed (isHidden = false) and thus visible to Black now
    blackState = state.serializeForPlayer(Color.Black);
    let blackEffectsOddAfter = blackState.board.cellEffects?.['14,2'] || [];
    let blackEffectsEvenAfter = blackState.board.cellEffects?.['0,12'] || [];
    expect(blackEffectsOddAfter.some(e => e.type === 'dimension')).toBe(true);
    expect(blackEffectsEvenAfter.some(e => e.type === 'dimension')).toBe(true);
  });
});

// Mock syncDimensionPortalCellEffects wrapper to run in spec tests
function syncDimensionPortalCellEffects(state: any): void {
  const board = state.board;
  const allCellEffects = board.getAllCellEffects();
  for (const [key, effects] of allCellEffects.entries()) {
    const kept = effects.filter((e: any) => e.type !== 'dimension');
    const [col, row] = key.split(',').map(Number);
    board.setCellEffects({ col, row }, kept);
  }
  const pairs = state.variantState.dimensionPairs || [];
  for (const pair of pairs) {
    if (pair.odd) {
      board.addCellEffect(pair.odd.position, {
        id: pair.odd.id,
        type: 'dimension',
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: pair.owner,
        targetType: 'cell',
        targetId: `${pair.odd.position.col},${pair.odd.position.row}`,
        stackingRule: 'ignore',
        isDebuff: false,
        isHidden: pair.odd.isHidden ?? false,
        metadata: { portalId: pair.odd.id, portalType: 'odd', owner: pair.owner },
      });
    }
    if (pair.even) {
      board.addCellEffect(pair.even.position, {
        id: pair.even.id,
        type: 'dimension',
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: pair.owner,
        targetType: 'cell',
        targetId: `${pair.even.position.col},${pair.even.position.row}`,
        stackingRule: 'ignore',
        isDebuff: false,
        isHidden: pair.even.isHidden ?? false,
        metadata: { portalId: pair.even.id, portalType: 'even', owner: pair.owner },
      });
    }
  }
}
