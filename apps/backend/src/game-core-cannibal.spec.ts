import {
  Match,
  Color,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  CannibalVariant,
  getBaseMovesForType,
  posEquals,
} from 'game-core';

describe('Chess Variant Engine - Cannibal Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('cannibal', 'lightning');
    match.start();
  });

  // Helper to clear board and return the new board instance
  function clearBoard(): Board {
    match.getGameState().board = new Board();
    return match.getBoard();
  }

  // Helper to find piece by ID
  function findPiece(id: string) {
    const board = match.getBoard();
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = board.getPiece({ col: c, row: r });
        if (p && p.id === id) return { piece: p, pos: { col: c, row: r } };
      }
    }
    return null;
  }

  // CB1: Passive — King ăn địch → move-set chuyển thành move-set của địch
  it('CB1: King capturing enemy updates move-set to enemy type', () => {
    const state = match.getGameState();
    const board = clearBoard();

    // Place White King and Black Rook
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const enemyRook = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };

    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, enemyRook);

    // White King captures Black Rook
    const res = match.makeMove(Color.White, { col: 5, row: 5 }, { col: 5, row: 6 });
    expect(res.success).toBe(true);

    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Rook);

    // Verify legal moves are Rook moves from { col: 5, row: 6 }
    const moves = match.getLegalMovesAt({ col: 5, row: 6 });
    const expected = getBaseMovesForType(board, { col: 5, row: 6 }, PieceType.Rook, Color.White, true);
    expect(moves.length).toBe(expected.length);
  });

  // CB2: Passive — King ăn ally → nhận cả CAPTURE_AP + LOSS_AP, địch không nhận gì
  it('CB2: King capturing ally awards both capture + loss AP to Cannibal, opponent gets nothing', () => {
    const state = match.getGameState();
    const board = clearBoard();

    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const allyKnight = { id: 'w_knight', type: PieceType.Knight, color: Color.White, effects: [] };

    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, allyKnight); // Place adjacent so King can capture it

    state.whiteAP = 0;
    state.blackAP = 0;

    // Capture ally Knight (CAPTURE_AP[Knight]=3, LOSS_AP[Knight]=2)
    const res = match.makeMove(Color.White, { col: 5, row: 5 }, { col: 5, row: 6 });
    expect(res.success).toBe(true);

    expect(state.whiteAP).toBe(5); // 3 + 2
    expect(state.blackAP).toBe(0);
  });

  // CB3: Passive — King ăn ally có Bomb → Bomb vẫn nổ
  it('CB3: King capturing ally with Bomb triggers bomb explosion', () => {
    // Set white and black variants to cannibal and dynamite so BombHandler is registered
    match = new Match();
    match.setVariants('cannibal', 'dynamite');
    match.start();

    const state = match.getGameState();
    const board = clearBoard();

    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const allyPawn = {
      id: 'w_pawn',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [
        {
          id: 'bomb_effect',
          type: 'bomb' as any,
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd' as any,
          sourcePlayer: Color.White,
          targetType: 'piece' as any,
          targetId: 'w_pawn',
          stackingRule: 'ignore' as any,
          isDebuff: false,
          metadata: {},
        }
      ]
    };

    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, allyPawn);

    // Place surround pawns to detect explosion
    const surround = { id: 'surround', type: PieceType.Pawn, color: Color.Black, effects: [] };
    board.setPiece({ col: 4, row: 6 }, surround);

    // Capture
    const res = match.makeMove(Color.White, { col: 5, row: 5 }, { col: 5, row: 6 });
    expect(res.success).toBe(true);

    // Verify bomb exploded and killed adjacent pieces
    expect(board.getPiece({ col: 4, row: 6 })).toBeNull();
  });

  // CB4: Passive — King ăn Rook rồi ăn Bishop → move-set là Bishop (override liên tục)
  it('CB4: Overrides move-set continuously with latest capture', () => {
    const state = match.getGameState();
    const board = clearBoard();

    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const rook = { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] };
    const bishop = { id: 'w_bishop', type: PieceType.Bishop, color: Color.White, effects: [] };

    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, rook);
    board.setPiece({ col: 5, row: 7 }, bishop); // adjacent to Rook at 5,6

    // Eat Rook
    let res = match.makeMove(Color.White, { col: 5, row: 5 }, { col: 5, row: 6 });
    expect(res.success).toBe(true);
    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Rook);

    // Fake turn state to allow White to move again
    state.currentTurn = Color.White;
    state.hasMoved = false;

    // Eat Bishop
    res = match.makeMove(Color.White, { col: 5, row: 6 }, { col: 5, row: 7 });
    expect(res.success).toBe(true);
    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Bishop);
  });

  // CB5: Passive — King chưa ăn gì → di chuyển như King bình thường
  it('CB5: Moves normally as King when nothing is eaten yet', () => {
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);

    const moves = match.getLegalMovesAt({ col: 5, row: 5 });
    const expected = getBaseMovesForType(board, { col: 5, row: 5 }, PieceType.King, Color.White, true);
    expect(moves.length).toBe(expected.length);
  });

  // CB6: Skill 1 — Shield cho King 2 rounds
  it('CB6: Skill 1 applies Shield to King for 2 rounds', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);

    state.whiteAP = 3;
    const res = match.useSkill(Color.White, 'cannibal_royal_guard', [
      { type: 'piece', position: { col: 5, row: 5 }, pieceId: 'w_king' },
    ]);
    expect(res.success).toBe(true);

    const shield = king.effects.find(e => e.type === 'shield');
    expect(shield).toBeDefined();
    expect(shield!.remainingDuration).toBe(2);
  });

  // CB7: Skill 1 — dùng được khi Skill 2 đang active
  it('CB7: Skill 1 can be used when Devour (Skill 2) is active', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const ally = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, ally);

    state.whiteAP = 8; // 5 + 3

    // Activate Skill 2
    let res = match.useSkill(Color.White, 'cannibal_devour', [
      { type: 'piece', position: { col: 5, row: 6 }, pieceId: 'w_pawn' },
    ]);
    expect(res.success).toBe(true);

    // Reset skills limit for testing
    state.skillsUsedThisTurn = 0;

    // Activate Skill 1
    res = match.useSkill(Color.White, 'cannibal_royal_guard', [
      { type: 'piece', position: { col: 5, row: 5 }, pieceId: 'w_king' },
    ]);
    expect(res.success).toBe(true);
  });

  // CB8: Skill 1 — dùng được khi Ultimate đang active
  it('CB8: Skill 1 can be used when Ultimate is active', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);

    state.whiteAP = 11; // 8 + 3

    // Activate Ultimate
    let res = match.useSkill(Color.White, 'cannibal_apex_predator', []);
    expect(res.success).toBe(true);

    // Reset skills limit for testing
    state.skillsUsedThisTurn = 0;

    // Activate Skill 1
    res = match.useSkill(Color.White, 'cannibal_royal_guard', [
      { type: 'piece', position: { col: 5, row: 5 }, pieceId: 'w_king' },
    ]);
    expect(res.success).toBe(true);
  });

  // CB9: Skill 2 — King nhận move-set của quân đồng minh được chọn
  it('CB9: Skill 2 sets King move-set to target type', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const ally = { id: 'w_knight', type: PieceType.Knight, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, ally);

    state.whiteAP = 5;
    const res = match.useSkill(Color.White, 'cannibal_devour', [
      { type: 'piece', position: { col: 5, row: 6 }, pieceId: 'w_knight' },
    ]);
    expect(res.success).toBe(true);
    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Knight);
  });

  // CB10: Skill 2 — quân được chọn bị Stun 3 rounds
  it('CB10: Devoured target ally gets stunned for 3 rounds', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const ally = { id: 'w_knight', type: PieceType.Knight, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, ally);

    state.whiteAP = 5;
    match.useSkill(Color.White, 'cannibal_devour', [
      { type: 'piece', position: { col: 5, row: 6 }, pieceId: 'w_knight' },
    ]);

    const stun = ally.effects.find(e => e.type === 'stun');
    expect(stun).toBeDefined();
    expect(stun!.remainingDuration).toBe(3);
  });

  // CB11: Skill 2 — King ăn quân khác trong window → passive override move-set
  it('CB11: Devour active, King capturing another piece overrides move-set immediately', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const devourTarget = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    const captureTarget = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };

    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, devourTarget);
    board.setPiece({ col: 6, row: 6 }, captureTarget);

    state.whiteAP = 5;

    // Use Devour on Pawn -> King moves like Pawn
    let res = match.useSkill(Color.White, 'cannibal_devour', [
      { type: 'piece', position: { col: 5, row: 6 }, pieceId: 'w_pawn' },
    ]);
    expect(res.success).toBe(true);
    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Pawn);

    // Capture Rook -> King moves like Rook
    res = match.makeMove(Color.White, { col: 5, row: 5 }, { col: 6, row: 6 });
    expect(res.success).toBe(true);
    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Rook);
  });

  // CB12: Skill 2 — hết 3 rounds → revert về move-set King ăn gần nhất trước Skill 2
  it('CB12: Reverts to pre-devour move-set when devour expires after 3 rounds', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const ally = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };

    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, ally);

    // Pre-devour move-set is Bishop
    state.variantState.kingCurrentMoveType = PieceType.Bishop;
    state.whiteAP = 5;

    // Activate Devour on Pawn
    match.useSkill(Color.White, 'cannibal_devour', [
      { type: 'piece', position: { col: 5, row: 6 }, pieceId: 'w_pawn' },
    ]);
    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Pawn);

    // Tick turns to expire Devour. Since the effect was applied on White's Turn 1,
    // the end of Turn 1 does not tick it. We need 4 White Turn End ticks.
    // End White Turn 1 (applied turn: skipped)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // End White Turn 2 (3 -> 2)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // End White Turn 3 (2 -> 1)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // End White Turn 4 (1 -> 0 -> expires)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Bishop);
  });

  // CB13: Skill 2 — quân được chọn chết → Stun biến mất cùng quân, Skill 2 vẫn tiếp tục
  it('CB13: Devoured ally dies -> stun disappears with it, devour effect on King persists', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const ally = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, ally);

    state.whiteAP = 5;
    match.useSkill(Color.White, 'cannibal_devour', [
      { type: 'piece', position: { col: 5, row: 6 }, pieceId: 'w_pawn' },
    ]);

    // Destroy ally piece
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: 'w_pawn',
      position: { col: 5, row: 6 },
      reason: 'skill'
    });

    expect(board.getPiece({ col: 5, row: 6 })).toBeNull();
    expect(king.effects.some(e => e.type === 'devour')).toBe(true);
  });

  // CB14: Skill 2 — reject khi Ultimate đang active
  it('CB14: Devour fails to activate when Ultimate is active', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const ally = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, ally);

    state.whiteAP = 13;

    // Activate Ultimate
    let res = match.useSkill(Color.White, 'cannibal_apex_predator', []);
    expect(res.success).toBe(true);

    // Reset skills limit for testing
    state.skillsUsedThisTurn = 0;

    // Try Devour
    res = match.useSkill(Color.White, 'cannibal_devour', [
      { type: 'piece', position: { col: 5, row: 6 }, pieceId: 'w_pawn' },
    ]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('Apex Predator');
  });

  // CB15: Ultimate — King di chuyển như Queen + Knight (combined)
  it('CB15: Ultimate allows King to move like Queen + Knight combined', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);

    state.whiteAP = 8;
    match.useSkill(Color.White, 'cannibal_apex_predator', []);

    const moves = match.getLegalMovesAt({ col: 5, row: 5 });

    const queenMoves = getBaseMovesForType(board, { col: 5, row: 5 }, PieceType.Queen, Color.White, true);
    const knightMoves = getBaseMovesForType(board, { col: 5, row: 5 }, PieceType.Knight, Color.White, true);
    const combined = [...queenMoves, ...knightMoves];
    const seen = new Set<string>();
    const expected = combined.filter(p => {
      const key = `${p.col},${p.row}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    expect(moves.length).toBe(expected.length);
  });

  // CB16: Ultimate — passive KHÔNG override trong Ultimate window
  it('CB16: Captures during Ultimate do not change movement capability (Ultimate priority)', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const enemyRook = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 6, row: 7 }, enemyRook);

    state.whiteAP = 8;
    match.useSkill(Color.White, 'cannibal_apex_predator', []);

    // Capture Rook
    const res = match.makeMove(Color.White, { col: 5, row: 5 }, { col: 6, row: 7 });
    expect(res.success).toBe(true);

    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Rook);

    const moves = match.getLegalMovesAt({ col: 6, row: 7 });
    const queenMoves = getBaseMovesForType(board, { col: 6, row: 7 }, PieceType.Queen, Color.White, true);
    const knightMoves = getBaseMovesForType(board, { col: 6, row: 7 }, PieceType.Knight, Color.White, true);
    const combined = [...queenMoves, ...knightMoves];
    const seen = new Set<string>();
    const expected = combined.filter(p => {
      const key = `${p.col},${p.row}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    expect(moves.length).toBe(expected.length);
  });

  // CB17: Ultimate — ăn 2 quân → nhận Shield 1 round
  it('CB17: Capturing 2 pieces during Ultimate applies Shield for 1 round', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const enemy1 = { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    const enemy2 = { id: 'b_knight', type: PieceType.Knight, color: Color.Black, effects: [] };

    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, enemy1);
    board.setPiece({ col: 5, row: 7 }, enemy2);

    state.whiteAP = 8;
    match.useSkill(Color.White, 'cannibal_apex_predator', []);

    let res = match.makeMove(Color.White, { col: 5, row: 5 }, { col: 5, row: 6 });
    expect(res.success).toBe(true);
    expect(state.variantState.ultimateCaptureCount).toBe(1);
    expect(king.effects.some(e => e.type === 'shield')).toBe(false);

    // Fake turn state to allow White to move again
    state.currentTurn = Color.White;
    state.hasMoved = false;

    res = match.makeMove(Color.White, { col: 5, row: 6 }, { col: 5, row: 7 });
    expect(res.success).toBe(true);
    expect(state.variantState.ultimateCaptureCount).toBe(2);

    const shield = king.effects.find(e => e.type === 'shield');
    expect(shield).toBeDefined();
    expect(shield!.remainingDuration).toBe(1);
  });

  // CB18: Ultimate — ăn 4 quân → nhận 2 Shield (tích lũy)
  it('CB18: Capturing 4 pieces during Ultimate applies second Shield (refresh/stack count)', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const e1 = { id: 'b_1', type: PieceType.Rook, color: Color.Black, effects: [] };
    const e2 = { id: 'b_2', type: PieceType.Rook, color: Color.Black, effects: [] };
    const e3 = { id: 'b_3', type: PieceType.Rook, color: Color.Black, effects: [] };
    const e4 = { id: 'b_4', type: PieceType.Rook, color: Color.Black, effects: [] };

    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, e1);
    board.setPiece({ col: 5, row: 7 }, e2);
    board.setPiece({ col: 5, row: 8 }, e3);
    board.setPiece({ col: 5, row: 9 }, e4);

    state.whiteAP = 8;
    match.useSkill(Color.White, 'cannibal_apex_predator', []);

    match.makeMove(Color.White, { col: 5, row: 5 }, { col: 5, row: 6 });

    state.currentTurn = Color.White;
    state.hasMoved = false;
    match.makeMove(Color.White, { col: 5, row: 6 }, { col: 5, row: 7 });
    expect(king.effects.some(e => e.type === 'shield')).toBe(true);

    state.currentTurn = Color.White;
    state.hasMoved = false;
    match.makeMove(Color.White, { col: 5, row: 7 }, { col: 5, row: 8 });

    state.currentTurn = Color.White;
    state.hasMoved = false;
    match.makeMove(Color.White, { col: 5, row: 8 }, { col: 5, row: 9 });

    expect(state.variantState.ultimateCaptureCount).toBe(4);
    const shield = king.effects.find(e => e.type === 'shield');
    expect(shield).toBeDefined();
    expect(shield!.remainingDuration).toBe(1);
  });

  // CB19: Ultimate — hết 10 rounds → revert về move-set trước Ultimate
  it('CB19: Reverts to pre-ultimate move-set when Ultimate expires after 10 rounds', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);

    state.variantState.kingCurrentMoveType = PieceType.Bishop;
    state.whiteAP = 8;

    match.useSkill(Color.White, 'cannibal_apex_predator', []);
    expect(state.variantState.ultimateActive).toBe(true);

    // Turn expiration: applied turn is skipped, so we need 11 cycles.
    for (let i = 0; i < 11; i++) {
      match.submitAction({ type: 'END_TURN', player: Color.White });
      match.submitAction({ type: 'END_TURN', player: Color.Black });
    }

    expect(state.variantState.ultimateActive).toBe(false);
    expect(state.variantState.kingCurrentMoveType).toBe(PieceType.Bishop);
  });

  // CB20: Ultimate — reject khi Skill 2 đang active
  it('CB20: Ultimate fails to activate when Devour (Skill 2) is active', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const ally = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, ally);

    state.whiteAP = 13;

    let res = match.useSkill(Color.White, 'cannibal_devour', [
      { type: 'piece', position: { col: 5, row: 6 }, pieceId: 'w_pawn' },
    ]);
    expect(res.success).toBe(true);

    // Reset skills limit for testing
    state.skillsUsedThisTurn = 0;

    res = match.useSkill(Color.White, 'cannibal_apex_predator', []);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('Devour');
  });

  // CB21: King ăn ally trong Ultimate → vẫn count cho ultimateCaptureCount
  it('CB21: Capturing ally pieces during Ultimate counts towards shield reward', () => {
    const state = match.getGameState();
    const board = clearBoard();
    const king = { id: 'w_king', type: PieceType.King, color: Color.White, effects: [] };
    const ally1 = { id: 'w_pawn1', type: PieceType.Pawn, color: Color.White, effects: [] };
    const ally2 = { id: 'w_pawn2', type: PieceType.Pawn, color: Color.White, effects: [] };

    board.setPiece({ col: 5, row: 5 }, king);
    board.setPiece({ col: 5, row: 6 }, ally1);
    board.setPiece({ col: 5, row: 7 }, ally2);

    state.whiteAP = 8;
    match.useSkill(Color.White, 'cannibal_apex_predator', []);

    let res = match.makeMove(Color.White, { col: 5, row: 5 }, { col: 5, row: 6 });
    expect(res.success).toBe(true);

    state.currentTurn = Color.White;
    state.hasMoved = false;

    res = match.makeMove(Color.White, { col: 5, row: 6 }, { col: 5, row: 7 });
    expect(res.success).toBe(true);

    expect(state.variantState.ultimateCaptureCount).toBe(2);
    expect(king.effects.some(e => e.type === 'shield')).toBe(true);
  });
});
