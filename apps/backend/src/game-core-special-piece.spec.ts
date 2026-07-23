import { Match, Color, Position, PieceType, getBaseLegalMoves, getAttackedPieces } from 'game-core';
// @ts-ignore: We import these even though they might not be exported yet (Step A/B)
import { specialPieceRegistry, countSpecialPieces } from 'game-core';

describe('Special Piece System (SP1-SP8)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.start();

    // Clear registry before each test to avoid leakage
    try {
      (specialPieceRegistry as any).clear(); // We'll add a helper or clear method for tests if needed, or just let it override
    } catch (e) {}
  });

  it('SP1: Spawn special piece via SPAWN_PIECE action', () => {
    const state = match.getGameState();
    const spawnPos: Position = { col: 5, row: 5 };

    // Spawn a special piece 'totem'
    const spawnAction = {
      type: 'SPAWN_PIECE' as any,
      piece: {
        id: 'test_totem_1',
        type: 'totem',
        color: Color.White,
        effects: [],
        specialType: 'totem',
      } as any,
      position: spawnPos,
    };

    const res = match.submitAction(spawnAction);
    expect(res.success).toBe(true);

    const pieceOnBoard = state.board.getPiece(spawnPos);
    expect(pieceOnBoard).not.toBeNull();
    expect(pieceOnBoard!.id).toBe('test_totem_1');
    expect(pieceOnBoard!.type).toBe('totem');
    expect(pieceOnBoard!.specialType).toBe('totem');
  });

  it('SP2: Special piece without legal moves returns []', () => {
    const state = match.getGameState();
    const spawnPos: Position = { col: 5, row: 5 };

    // Register totem with no getLegalMoves
    specialPieceRegistry.register({
      id: 'totem',
      displayName: 'Fountain of Youth',
    });

    state.board.setPiece(spawnPos, {
      id: 'test_totem_2',
      type: 'totem',
      color: Color.White,
      effects: [],
      specialType: 'totem',
    } as any);

    const moves = getBaseLegalMoves(state.board, spawnPos);
    expect(moves).toEqual([]);
  });

  it('SP3: Special piece with custom moves returns them', () => {
    const state = match.getGameState();
    const spawnPos: Position = { col: 5, row: 5 };

    // Register a walker with custom moves (1 step orthogonal)
    specialPieceRegistry.register({
      id: 'walker',
      displayName: 'Zombie Walker',
      getLegalMoves: (board, pos, piece) => {
        return [
          { col: pos.col + 1, row: pos.row },
          { col: pos.col - 1, row: pos.row },
        ];
      },
    });

    state.board.setPiece(spawnPos, {
      id: 'test_walker_1',
      type: 'walker',
      color: Color.White,
      effects: [],
      specialType: 'walker',
    } as any);

    const moves = getBaseLegalMoves(state.board, spawnPos);
    expect(moves).toContainEqual({ col: 6, row: 5 });
    expect(moves).toContainEqual({ col: 4, row: 5 });
    expect(moves.length).toBe(2);
  });

  it('SP4: Capturing a special piece triggers correct AP rewards (Totem = 0/0, Custom = 3/2)', () => {
    const state = match.getGameState();
    
    // Register Totem (0/0 AP rewards)
    specialPieceRegistry.register({
      id: 'totem',
      displayName: 'Fountain of Youth',
      captureApReward: 0,
      lossApReward: 0,
    });

    // Register Walker (3/2 AP rewards)
    specialPieceRegistry.register({
      id: 'walker',
      displayName: 'Zombie Walker',
      captureApReward: 3,
      lossApReward: 2,
    });

    const rookPos: Position = { col: 4, row: 4 };
    const totemPos: Position = { col: 4, row: 5 };
    const walkerPos: Position = { col: 4, row: 6 };

    // Setup Rook
    state.board.setPiece(rookPos, { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] });
    // Setup enemy Totem
    state.board.setPiece(totemPos, { id: 'b_totem', type: 'totem', color: Color.Black, effects: [], specialType: 'totem' } as any);
    // Setup enemy Walker
    state.board.setPiece(walkerPos, { id: 'b_walker', type: 'walker', color: Color.Black, effects: [], specialType: 'walker' } as any);

    // Initial AP
    state.whiteAP = 0;
    state.blackAP = 0;

    // Capture Totem
    const resTotem = match.makeMove(Color.White, rookPos, totemPos);
    expect(resTotem.success).toBe(true);
    expect(state.whiteAP).toBe(0); // 0 capture AP
    expect(state.blackAP).toBe(0); // 0 loss AP

    // Reset turn state to White to make a second move in the test
    state.currentTurn = Color.White;
    state.hasMoved = false;

    // Capture Walker (move Rook from totemPos to walkerPos)
    const resWalker = match.makeMove(Color.White, totemPos, walkerPos);
    expect(resWalker.success).toBe(true);
    expect(state.whiteAP).toBe(3); // 3 capture AP
    expect(state.blackAP).toBe(2); // 2 loss AP
  });

  it('SP5: Special piece without moves does not contribute to attacked squares', () => {
    const state = match.getGameState();
    const totemPos: Position = { col: 5, row: 5 };

    specialPieceRegistry.register({
      id: 'totem',
      displayName: 'Fountain of Youth',
    });

    state.board.setPiece(totemPos, {
      id: 'b_totem',
      type: 'totem',
      color: Color.Black,
      effects: [],
      specialType: 'totem',
    } as any);

    const attacked = getAttackedPieces(state.board, Color.Black, state);
    const hasTotemAsAttacker = attacked.some(a => a.attacker.id === 'b_totem');
    expect(hasTotemAsAttacker).toBe(false);
  });

  it('SP6: Special piece with canBeAttacked: false cannot be attacked/captured', () => {
    const state = match.getGameState();

    specialPieceRegistry.register({
      id: 'immortal_totem',
      displayName: 'Immortal Totem',
      canBeAttacked: false,
    });

    const rookPos: Position = { col: 4, row: 4 };
    const totemPos: Position = { col: 4, row: 5 };

    state.board.setPiece(rookPos, { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] });
    state.board.setPiece(totemPos, {
      id: 'b_immortal',
      type: 'immortal_totem',
      color: Color.Black,
      effects: [],
      specialType: 'immortal_totem',
    } as any);

    // 1. Verify getAttackedPieces doesn't contain it
    const attacked = getAttackedPieces(state.board, Color.White, state);
    const hasImmortalAsTarget = attacked.some(a => a.target.id === 'b_immortal');
    expect(hasImmortalAsTarget).toBe(false);

    // 2. Verify makeMove/capture fails
    const res = match.makeMove(Color.White, rookPos, totemPos);
    expect(res.success).toBe(false);
  });

  it('SP7: onDestroyed hook enqueues actions when captured, destroyed, or sacrificed', () => {
    const state = match.getGameState();

    let destroyTriggeredCount = 0;
    let lastPosition: Position | null = null;

    specialPieceRegistry.register({
      id: 'exploding_totem',
      displayName: 'Exploding Totem',
      onDestroyed: (piece, pos, enqueueAction) => {
        destroyTriggeredCount++;
        lastPosition = pos;
        // Enqueue a GAIN_AP action as a proof that enqueueAction works
        enqueueAction({
          type: 'GAIN_AP',
          player: piece.color,
          amount: 5,
          source: 'explosion_death',
        });
      },
    });

    const wRookPos: Position = { col: 4, row: 4 };
    const totem1Pos: Position = { col: 4, row: 5 };
    const totem2Pos: Position = { col: 6, row: 6 };
    const totem3Pos: Position = { col: 7, row: 7 };

    state.board.setPiece(wRookPos, { id: 'w_rook', type: PieceType.Rook, color: Color.White, effects: [] });
    state.board.setPiece(totem1Pos, { id: 'b_t1', type: 'exploding_totem', color: Color.Black, effects: [], specialType: 'exploding_totem' } as any);
    state.board.setPiece(totem2Pos, { id: 'b_t2', type: 'exploding_totem', color: Color.Black, effects: [], specialType: 'exploding_totem' } as any);
    state.board.setPiece(totem3Pos, { id: 'b_t3', type: 'exploding_totem', color: Color.Black, effects: [], specialType: 'exploding_totem' } as any);

    state.blackAP = 0;

    // 1. Capture totem1
    const resCap = match.makeMove(Color.White, wRookPos, totem1Pos);
    expect(resCap.success).toBe(true);
    expect(destroyTriggeredCount).toBe(1);
    expect(lastPosition).toEqual(totem1Pos);
    expect(state.blackAP).toBe(5); // AP gained from hook

    // 2. Destroy totem2 via DESTROY_PIECE
    const resDest = match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: 'b_t2',
      position: totem2Pos,
      reason: 'effect',
    });
    expect(resDest.success).toBe(true);
    expect(destroyTriggeredCount).toBe(2);
    expect(lastPosition).toEqual(totem2Pos);
    expect(state.blackAP).toBe(10); // 5 + 5

    // 3. Sacrifice totem3 via SACRIFICE_PIECE
    match.submitAction({ type: 'PASS_SKILL', player: Color.White });
    const resSac = match.submitAction({
      type: 'SACRIFICE_PIECE',
      pieceId: 'b_t3',
      position: totem3Pos,
      player: Color.Black,
    });
    expect(resSac.success).toBe(true);
    expect(destroyTriggeredCount).toBe(3);
    expect(lastPosition).toEqual(totem3Pos);
    expect(state.blackAP).toBe(15); // 10 + 5
  });

  it('SP8: Regression - Standard pieces are unaffected', () => {
    const state = match.getGameState();
    const wRookPos: Position = { col: 4, row: 4 };
    const bKnightPos: Position = { col: 4, row: 6 };

    state.board.setPiece(wRookPos, { id: 'w_rook_reg', type: PieceType.Rook, color: Color.White, effects: [] });
    state.board.setPiece(bKnightPos, { id: 'b_knight_reg', type: PieceType.Knight, color: Color.Black, effects: [] });

    state.whiteAP = 0;
    state.blackAP = 0;

    // Move check
    const moves = getBaseLegalMoves(state.board, wRookPos);
    expect(moves).toContainEqual(bKnightPos);

    // Capture check
    const res = match.makeMove(Color.White, wRookPos, bKnightPos);
    expect(res.success).toBe(true);

    // AP reward check (Rook captured Knight -> White +3 AP, Black +2 AP)
    expect(state.whiteAP).toBe(3);
    expect(state.blackAP).toBe(2);
  });

  it('Helper: countSpecialPieces counts correctly', () => {
    const state = match.getGameState();
    state.board.setPiece({ col: 1, row: 1 }, { id: 't1', type: 'totem', color: Color.White, effects: [], specialType: 'totem' } as any);
    state.board.setPiece({ col: 2, row: 2 }, { id: 't2', type: 'totem', color: Color.White, effects: [], specialType: 'totem' } as any);
    state.board.setPiece({ col: 3, row: 3 }, { id: 't3', type: 'totem', color: Color.Black, effects: [], specialType: 'totem' } as any);

    expect(countSpecialPieces(state.board, Color.White, 'totem')).toBe(2);
    expect(countSpecialPieces(state.board, Color.Black, 'totem')).toBe(1);
    expect(countSpecialPieces(state.board, Color.White, 'walker')).toBe(0);
  });
});
