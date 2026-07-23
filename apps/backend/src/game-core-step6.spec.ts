import { Match, Color, Position, PieceType } from 'game-core';

describe('Chess Variant Engine - Step 6 Tests (Variant Registry & Lightning E2E)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    // Setup Lightning variant for both players
    match.setVariants('lightning', 'lightning');
    match.start();
  });

  it('should place a Thunder Trap and trigger Stun on enemy landing', () => {
    const state = match.getGameState();
    
    // Give White some AP to start
    state.whiteAP = 5;

    // 1. White places a Thunder Trap on E5 (4, 4)
    const trapPos: Position = { col: 4, row: 4 };
    const skillResult = match.useSkill(Color.White, 'lightning_thunder_trap', [{
      type: 'cell',
      position: trapPos
    }]);

    expect(skillResult.success).toBe(true);
    // AP deducted: 5 - 3 = 2 AP
    expect(state.whiteAP).toBe(2);

    // Verify cell effects on (4, 4)
    const cellEffects = state.board.getCellEffects(trapPos);
    expect(cellEffects.length).toBe(1);
    expect(cellEffects[0].type).toBe('thunder_trap');
    expect(cellEffects[0].sourcePlayer).toBe(Color.White);

    // 2. Black moves a Rook onto E5 (4, 4)
    // Clear E5 (4,4) piece if any, set up Black Rook on E6 (4, 5)
    state.board.setPiece({ col: 4, row: 5 }, {
      id: 'b_rook_trap_test',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    // Manually end White's turn to switch to Black
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.currentTurn).toBe(Color.Black);

    // Give Black AP so the turn does not automatically end after moving
    state.blackAP = 5;

    // Black moves Rook from E6 (4, 5) to E5 (4, 4)
    const moveResult = match.makeMove(Color.Black, { col: 4, row: 5 }, trapPos);
    expect(moveResult.success).toBe(true);

    // 3. Trap should trigger reactively
    // Trap cell effect should be removed
    expect(state.board.getCellEffects(trapPos).length).toBe(0);

    // Black Rook should be stunned
    const rook = state.board.getPiece(trapPos);
    expect(rook).not.toBeNull();
    expect(rook!.effects.length).toBe(1);
    expect(rook!.effects[0].type).toBe('stun');
    expect(rook!.effects[0].remainingDuration).toBe(2);

    // 4. Black Rook has no legal moves and cannot move
    expect(match.getLegalMovesAt(trapPos)).toEqual([]);

    // Black submits END_TURN to manually end Black's turn (Stun does not tick down yet as it was applied this turn)
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Turn switches back to White
    expect(state.currentTurn).toBe(Color.White);

    // Black Rook is still stunned on White's turn (enabling Raigeki!)
    expect(rook!.effects.length).toBe(1);
    expect(rook!.effects[0].remainingDuration).toBe(2);

    // White ends turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Turn switches back to Black
    expect(state.currentTurn).toBe(Color.Black);

    // Black Rook is still stunned on Black's turn start, so no legal moves
    expect(match.getLegalMovesAt(trapPos)).toEqual([]);

    // Black ends turn, which ticks down the Rook's stun to 1
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Turn switches back to White
    expect(state.currentTurn).toBe(Color.White);

    // Black Rook is still stunned on White's turn
    expect(rook!.effects.length).toBe(1);
    expect(rook!.effects[0].remainingDuration).toBe(1);

    // White ends turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Turn switches back to Black
    expect(state.currentTurn).toBe(Color.Black);

    // Black ends turn again, which ticks stun to 0
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Black Rook is no longer stunned now
    expect(rook!.effects.length).toBe(0);
    expect(match.getLegalMovesAt(trapPos).length).toBeGreaterThan(0);
  });

  it('should execute Raigeki ultimate, destroying stunned Pawns but only removing stun from Kings', () => {
    const state = match.getGameState();

    // 1. Manually place and stun some Black pieces
    const blackKingPos: Position = { col: 7, row: 14 }; // Black King is at col 7
    const blackPawnPos: Position = { col: 4, row: 13 };
    const blackKing = state.board.getPiece(blackKingPos);
    const blackPawn = state.board.getPiece(blackPawnPos);
    expect(blackKing).not.toBeNull();
    expect(blackPawn).not.toBeNull();

    // Stun both pieces
    blackKing!.effects.push({
      id: 'stun_king',
      type: 'stun' as any,
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd' as any,
      sourcePlayer: Color.White,
      targetType: 'piece' as any,
      targetId: blackKing!.id,
      stackingRule: 'refresh' as any,
      isDebuff: true,
      metadata: {},
    });

    blackPawn!.effects.push({
      id: 'stun_pawn',
      type: 'stun' as any,
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd' as any,
      sourcePlayer: Color.White,
      targetType: 'piece' as any,
      targetId: blackPawn!.id,
      stackingRule: 'refresh' as any,
      isDebuff: true,
      metadata: {},
    });

    // 2. White has 12 AP, currentTurn is White, turnPhase is action
    state.whiteAP = 12;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // 3. White uses Raigeki
    const res = match.useSkill(Color.White, 'lightning_raigeki', []);
    expect(res.success).toBe(true);

    // Stunned Pawn should be destroyed
    expect(state.board.getPiece(blackPawnPos)).toBeNull();
    // Recorded in graveyard
    const gravePawn = state.graveyard.find(g => g.piece.id === blackPawn!.id);
    expect(gravePawn).toBeDefined();
    expect(gravePawn!.killedBy).toBe('effect');

    // 4. Stunned King should NOT be destroyed, but Stun should be removed
    const kingAfter = state.board.getPiece(blackKingPos);
    expect(kingAfter).not.toBeNull();
    expect(kingAfter!.effects.length).toBe(0); // Stun removed
  });

  it('should activate Electric Terrain, block skill usage, decrease clock/turns, and stun on timeout', () => {
    const state = match.getGameState();
    state.whiteAP = 10;

    // 1. Activate Electric Terrain
    const skillResult = match.useSkill(Color.White, 'lightning_electric_terrain', []);
    expect(skillResult.success).toBe(true);
    expect(state.whiteAP).toBe(2); // 10 - 8 = 2 AP
    expect(state.variantState.turnTimeoutOverride).toBe(3000);

    // Verify cell effect on 0,0
    const cellEffects = state.board.getCellEffects({ col: 0, row: 0 });
    expect(cellEffects.length).toBe(1);
    expect(cellEffects[0].type).toBe('electric_terrain');

    // 2. Block skill usage
    // End White's turn to switch to Black
    match.submitAction({ type: 'END_TURN', player: Color.White });
    state.blackAP = 10;
    
    const trapResult = match.useSkill(Color.Black, 'lightning_thunder_trap', [{
      type: 'cell',
      position: { col: 4, row: 4 }
    }]);
    expect(trapResult.success).toBe(false);
    expect(trapResult.reason).toContain('Cannot use skills while skills are disabled');

    // 3. Test handleTimeoutSkip stuns a random non-King piece and forces turn transition
    const beforeTurn = state.currentTurn;
    const skipResult = match.handleTimeoutSkip(beforeTurn);
    expect(skipResult.success).toBe(true);
    
    // Check turn switched
    expect(state.currentTurn).toBe(Color.White);

    // Verify a random Black piece got stunned
    let stunnedPieceCount = 0;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.color === beforeTurn && p.effects.some(e => e.type === 'stun')) {
          expect(p.type).not.toBe(PieceType.King); // Excludes King
          stunnedPieceCount++;
        }
      }
    }
    expect(stunnedPieceCount).toBe(1);

    // 4. Verify ticking down and expiry (5 rounds total = 5 ticks on caster turnEnd)
    // White cast it, so we need 5 White turn ends to expire it.
    // White currently has the turn.
    let activeTurn = state.currentTurn;
    for (let i = 0; i < 9; i++) {
      match.submitAction({ type: 'END_TURN', player: activeTurn });
      activeTurn = state.currentTurn;
    }

    // Now it should be expired
    expect(state.variantState.turnTimeoutOverride).toBeNull();
    expect(state.board.getCellEffects({ col: 0, row: 0 }).length).toBe(0);
  });

  it('should award +2 AP to the trap owner when an enemy lands on a Thunder Trap', () => {
    const state = match.getGameState();
    
    // Set White AP to 0 initially
    state.whiteAP = 0;

    // Place Thunder Trap at E5 (4, 4) with White as owner
    const trapPos: Position = { col: 4, row: 4 };
    state.board.addCellEffect(trapPos, {
      id: 'trap_test',
      type: 'thunder_trap',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '4,4',
      stackingRule: 'ignore',
      isDebuff: false,
      isHidden: true,
      metadata: {},
    });

    // Place Black Rook at E6 (4, 5)
    state.board.setPiece({ col: 4, row: 5 }, {
      id: 'b_rook_trap_test',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    // Switch to Black turn
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Black moves Rook onto the trap E5 (4, 4)
    const moveResult = match.makeMove(Color.Black, { col: 4, row: 5 }, trapPos);
    expect(moveResult.success).toBe(true);

    // White should receive +2 AP
    expect(state.whiteAP).toBe(2);
  });
});

