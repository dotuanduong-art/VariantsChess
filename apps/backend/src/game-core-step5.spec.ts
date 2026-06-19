import { Match, Color, Position, PieceType } from 'game-core';

describe('Chess Variant Engine - Step 5 Tests (Effects & Stun Handler)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.start();
  });

  it('should prevent movement of a stunned piece', () => {
    const state = match.getGameState();
    const pawnPos: Position = { col: 3, row: 1 }; // White pawn at D2
    const pawn = state.board.getPiece(pawnPos);
    expect(pawn).not.toBeNull();

    // 1. Initially pawn has moves
    expect(match.getLegalMovesAt(pawnPos).length).toBeGreaterThan(0);

    // 2. Apply Stun effect to the Pawn
    const applyResult = match.submitAction({
      type: 'APPLY_EFFECT',
      effect: {
        id: 'test_stun_1',
        type: 'stun',
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: pawn!.id,
        stackingRule: 'ignore',
        isDebuff: true,
        metadata: {},
      }
    });

    expect(applyResult.success).toBe(true);

    // Verify pawn is stunned (its legal moves should be empty)
    expect(match.getLegalMovesAt(pawnPos)).toEqual([]);

    // Try to move it - should fail
    const moveResult = match.makeMove(Color.White, pawnPos, { col: 3, row: 3 });
    expect(moveResult.success).toBe(false);
    expect(moveResult.reason).toContain('stunned');
  });

  it('should decrease remaining duration at turn end and expire stun', () => {
    const state = match.getGameState();
    const pawnPos: Position = { col: 3, row: 1 };
    const pawn = state.board.getPiece(pawnPos);

    // Apply Stun with duration 1
    match.submitAction({
      type: 'APPLY_EFFECT',
      effect: {
        id: 'test_stun_2',
        type: 'stun',
        duration: 1,
        remainingDuration: 1,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: pawn!.id,
        stackingRule: 'ignore',
        isDebuff: true,
        metadata: {},
      }
    });

    // It is White's turn. We make a valid move with another piece and then pass skill to end turn.
    // White Rook/Knight at B1 (1, 0) -> C3 (2, 2)
    const knightPos: Position = { col: 1, row: 0 };
    const knightResult = match.makeMove(Color.White, knightPos, { col: 2, row: 2 });
    expect(knightResult.success).toBe(true);

    // End turn by passing skill
    const passResult = match.submitAction({ type: 'PASS_SKILL', player: Color.White });
    expect(passResult.success).toBe(true);

    // The turn switches to Black.
    expect(state.currentTurn).toBe(Color.Black);

    // Stun is still active because it doesn't tick down on the turn it was applied.
    expect(match.getLegalMovesAt(pawnPos).length).toBe(0);

    // Black ends turn
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Turn switches back to White
    expect(state.currentTurn).toBe(Color.White);

    // White ends turn, ticking down the White Pawn's stun
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // The Stun should have expired now
    expect(match.getLegalMovesAt(pawnPos).length).toBeGreaterThan(0);
  });

  it('should handle stacking rules (refresh and ignore)', () => {
    const state = match.getGameState();
    const pawnPos: Position = { col: 3, row: 1 };
    const pawn = state.board.getPiece(pawnPos);

    // Apply Stun with duration 2
    match.submitAction({
      type: 'APPLY_EFFECT',
      effect: {
        id: 'stun_ref_1',
        type: 'stun',
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: pawn!.id,
        stackingRule: 'refresh',
        isDebuff: true,
        metadata: {},
      }
    });

    // Apply same Stun type with duration 5 and stackingRule 'refresh'
    match.submitAction({
      type: 'APPLY_EFFECT',
      effect: {
        id: 'stun_ref_2',
        type: 'stun',
        duration: 5,
        remainingDuration: 5,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: pawn!.id,
        stackingRule: 'refresh',
        isDebuff: true,
        metadata: {},
      }
    });

    // Stun should be refreshed to duration 5
    expect(pawn!.effects[0].remainingDuration).toBe(5);

    // Apply another one with stackingRule 'ignore' and duration 10
    match.submitAction({
      type: 'APPLY_EFFECT',
      effect: {
        id: 'stun_ref_3',
        type: 'stun',
        duration: 10,
        remainingDuration: 10,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: pawn!.id,
        stackingRule: 'ignore',
        isDebuff: true,
        metadata: {},
      }
    });

    // Stun should still be duration 5 (ignore stacking rule ignored it)
    expect(pawn!.effects[0].remainingDuration).toBe(5);
  });
});
