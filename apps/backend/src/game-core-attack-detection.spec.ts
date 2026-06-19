import { Match, Color, Position, GameState, PieceType, Effect, getAttackedSquares, getAttackedPieces, Board } from 'game-core';

describe('Game Core Attack Detection - Effects Integration', () => {
  // Test 1 — Stun không contribute attacked squares
  it('should ignore stunned pieces when calculating attacked squares with state', () => {
    const state = new GameState();
    state.board = new Board(); // Clear initial board to keep it clean

    const rookPos: Position = { col: 4, row: 4 }; // E5
    const stunEffect: Effect = {
      id: 'stun_rook_test',
      type: 'stun',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: 'w_rook_test',
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };

    const rook = {
      id: 'w_rook_test',
      type: PieceType.Rook,
      color: Color.White,
      effects: [stunEffect],
    };
    state.board.setPiece(rookPos, rook);

    // Assert: getAttackedSquares(board, Color.White, state) KHÔNG bao gồm các ô trên đường E-file và rank-5
    const attackedWithState = getAttackedSquares(state.board, Color.White, state);
    expect(attackedWithState.size).toBe(0);

    // Assert: (so sánh) getAttackedSquares(board, Color.White) KHÔNG có state → vẫn tính như cũ (backward compat)
    const attackedWithoutState = getAttackedSquares(state.board, Color.White);
    expect(attackedWithoutState.size).toBeGreaterThan(0);
    expect(attackedWithoutState.has('4,5')).toBe(true); // E6 should be attacked without state
  });

  // Test 2 — Walker không thể chiếu King
  it('should prevent Walker from checking the King and emitting OnCheck', () => {
    const match = new Match();
    const state = match.getGameState();
    state.board = new Board(); // Clear initial board

    // Setup: Black Walker (pawn với walker effect) tại D4 (col: 3, row: 3)
    // Black King tại A1 (col: 0, row: 0)
    // White King tại C2 (col: 2, row: 2) — which is diagonally attacked by Black Pawn at D4 (row 3 -> row 2)
    const walkerPos: Position = { col: 3, row: 3 }; // D4
    const whiteKingPos: Position = { col: 2, row: 2 }; // C2
    const blackKingPos: Position = { col: 0, row: 0 }; // A1

    const walkerEffect: Effect = {
      id: 'walker_effect_test',
      type: 'walker',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: 'b_walker_test',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };

    const walkerPawn = {
      id: 'b_walker_test',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [walkerEffect],
    };

    const whiteKing = {
      id: 'w_king_test',
      type: PieceType.King,
      color: Color.White,
      effects: [],
    };

    const blackKing = {
      id: 'b_king_test',
      type: PieceType.King,
      color: Color.Black,
      effects: [],
    };

    state.board.setPiece(walkerPos, walkerPawn);
    state.board.setPiece(whiteKingPos, whiteKing);
    state.board.setPiece(blackKingPos, blackKing);

    // Assert: getAttackedPieces(board, Color.Black, state) → KHÔNG có entry với target = White King
    const attackedPieces = getAttackedPieces(state.board, Color.Black, state);
    const hasWhiteKingAttack = attackedPieces.some(a => a.target.id === 'w_king_test');
    expect(hasWhiteKingAttack).toBe(false);

    // Assert without state: should still attack White King
    const attackedPiecesWithoutState = getAttackedPieces(state.board, Color.Black);
    const hasWhiteKingAttackWithoutState = attackedPiecesWithoutState.some(a => a.target.id === 'w_king_test');
    expect(hasWhiteKingAttackWithoutState).toBe(true);

    // Setup event listener on event bus
    let onCheckTriggered = false;
    match.getEventBus().on({
      id: 'test_check_listener',
      eventType: 'OnCheck',
      priority: 1,
      source: 'test',
      handler: () => {
        onCheckTriggered = true;
      },
    });

    // We start the match
    state.status = 'playing';
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Reset board for movement check
    // Move the Walker pawn from D4 (3, 3) to D3 (3, 2).
    // The White King is placed at C1 (col: 2, row: 1), which is attacked by Black Pawn at D3.
    state.board = new Board();
    state.board.setPiece({ col: 3, row: 3 }, walkerPawn); // D4
    state.board.setPiece({ col: 2, row: 1 }, whiteKing); // C1
    state.board.setPiece(blackKingPos, blackKing);

    const moveResult = match.makeMove(Color.Black, { col: 3, row: 3 }, { col: 3, row: 2 });
    expect(moveResult.success).toBe(true);

    // Assert: OnCheck event KHÔNG được emit sau khi Black Walker di chuyển
    expect(onCheckTriggered).toBe(false);
  });

  // Test 3 — Mountain blocks sliding
  it('should block sliding attacks by Mountain effect', () => {
    const state = new GameState();
    state.board = new Board();

    // Setup: White Rook tại A1 (0, 0), Mountain effect tại A5 (0, 4), Black King tại A8 (0, 7)
    const rookPos: Position = { col: 0, row: 0 }; // A1
    const mountainPos: Position = { col: 0, row: 4 }; // A5
    const kingPos: Position = { col: 0, row: 7 }; // A8

    const rook = {
      id: 'w_rook_test',
      type: PieceType.Rook,
      color: Color.White,
      effects: [],
    };

    const king = {
      id: 'b_king_test',
      type: PieceType.King,
      color: Color.Black,
      effects: [],
    };

    const mountainEffect: Effect = {
      id: 'mountain_test',
      type: 'mountain',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '0,4',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };

    state.board.setPiece(rookPos, rook);
    state.board.setPiece(kingPos, king);
    state.board.addCellEffect(mountainPos, mountainEffect);

    // Assert: getAttackedSquares(board, Color.White, state) → bao gồm A2, A3, A4 nhưng KHÔNG bao gồm A5, A6, A7, A8
    const attacked = getAttackedSquares(state.board, Color.White, state);
    expect(attacked.has('0,1')).toBe(true); // A2
    expect(attacked.has('0,2')).toBe(true); // A3
    expect(attacked.has('0,3')).toBe(true); // A4
    expect(attacked.has('0,4')).toBe(false); // A5 (Mountain cell itself)
    expect(attacked.has('0,5')).toBe(false); // A6
    expect(attacked.has('0,6')).toBe(false); // A7
    expect(attacked.has('0,7')).toBe(false); // A8
  });

  // Test 4 — Không có effect → kết quả giống cũ (regression)
  it('should behave identically when no state/effects are present (regression check)', () => {
    const state = new GameState();
    state.board = new Board();

    const rookPos: Position = { col: 4, row: 4 };
    const rook = {
      id: 'w_rook_test',
      type: PieceType.Rook,
      color: Color.White,
      effects: [],
    };
    state.board.setPiece(rookPos, rook);

    const attackedWithState = getAttackedSquares(state.board, Color.White, state);
    const attackedWithoutState = getAttackedSquares(state.board, Color.White);

    expect(attackedWithState).toEqual(attackedWithoutState);
  });
});
