import { Match, Color, Position, GameState } from 'game-core';

describe('Chess Variant Engine - Step 2 Tests', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.start();
  });

  it('should initialize match state, turn, and turn phase correctly', () => {
    const state = match.getGameState();
    expect(state.status).toBe('playing');
    expect(state.currentTurn).toBe(Color.White);
    expect(state.turnNumber).toBe(1);
    expect(state.turnPhase).toBe('action');
    expect(state.hasMoved).toBe(false);
    expect(state.skillsUsedThisTurn).toBe(0);
    expect(state.passSkillSubmitted).toBe(false);
  });

  it('should allow a legal move and set hasMoved flag', () => {
    // Move White Pawn from D2 (3, 1) to D4 (3, 3)
    const from: Position = { col: 3, row: 1 };
    const to: Position = { col: 3, row: 3 };

    const result = match.makeMove(Color.White, from, to);
    expect(result.success).toBe(true);

    const state = match.getGameState();
    expect(state.hasMoved).toBe(true);
    // Move happened but skill was not used, so turn shouldn't auto-end yet
    expect(state.currentTurn).toBe(Color.White);
  });

  it('should switch turn when both move and pass-skill are done', () => {
    // 1. Move Pawn
    const moveResult = match.makeMove(Color.White, { col: 3, row: 1 }, { col: 3, row: 3 });
    expect(moveResult.success).toBe(true);

    // 2. Submit PASS_SKILL action
    const actionResult = match.submitAction({ type: 'PASS_SKILL', player: Color.White });
    expect(actionResult.success).toBe(true);

    const state = match.getGameState();
    // Turn should auto-switch to Black
    expect(state.currentTurn).toBe(Color.Black);
    expect(state.turnNumber).toBe(1);
    expect(state.turnPhase).toBe('action');
    expect(state.hasMoved).toBe(false);
    expect(state.skillsUsedThisTurn).toBe(0);
  });

  it('should accumulate AP correctly on capture', () => {
    const state = match.getGameState();
    
    // Clear the cells and put a White Rook and a Black Knight nearby
    const whiteRookPos: Position = { col: 4, row: 4 };
    const blackKnightPos: Position = { col: 4, row: 6 };

    state.board.setPiece(whiteRookPos, { id: 'w_rook_test', type: 'Rook' as any, color: Color.White, effects: [] });
    state.board.setPiece(blackKnightPos, { id: 'b_knight_test', type: 'Knight' as any, color: Color.Black, effects: [] });

    // Capture the Knight with the Rook
    const result = match.makeMove(Color.White, whiteRookPos, blackKnightPos);
    expect(result.success).toBe(true);
    expect(result.capturedPiece).toEqual({ type: 'Knight', color: Color.Black });

    // White should gain 3 AP for capturing Knight, Black should gain 2 AP for losing Knight
    expect(state.whiteAP).toBe(3);
    expect(state.blackAP).toBe(2);
  });

  it('should capture snapshots and support state restoration', () => {
    // White turn 1: Make move + pass skill
    match.makeMove(Color.White, { col: 3, row: 1 }, { col: 3, row: 3 });
    match.submitAction({ type: 'PASS_SKILL', player: Color.White });

    // Black turn 1: Make move
    match.makeMove(Color.Black, { col: 3, row: 13 }, { col: 3, row: 11 });

    const snapshots = match.getSnapshots();
    
    // Restore back to White turn 1 start state
    const restoredState = snapshots.restore(1); // restore 1 turn back → turn 1
    expect(restoredState).not.toBeNull();
    expect(restoredState!.currentTurn).toBe(Color.White);
    expect(restoredState!.turnNumber).toBe(1);
    expect(restoredState!.board.getPiece({ col: 3, row: 1 })).not.toBeNull(); // Pawn should still be at D2
  });
});
