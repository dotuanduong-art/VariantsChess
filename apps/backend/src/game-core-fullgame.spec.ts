import { Match, Color, Position, PieceType } from 'game-core';

describe('Chess Variant Engine - Full Game Playthrough Integration Test', () => {
  it('should run a full game simulation exercising all Step 1 & 2 requirements', () => {
    // 1. Initialize Match
    const match = new Match();
    match.start();
    const state = match.getGameState();

    expect(state.status).toBe('playing');
    expect(state.currentTurn).toBe(Color.White);
    expect(state.turnPhase).toBe('action');
    expect(state.turnNumber).toBe(1);

    // 2. White moves a pawn (MOVE_PIECE) from D2 (3,1) to D4 (3,3)
    const move1 = match.makeMove(Color.White, { col: 3, row: 1 }, { col: 3, row: 3 });
    expect(move1.success).toBe(true);
    expect(state.hasMoved).toBe(true);
    expect(state.actionHistory.getAll().some(entry => entry.action.type === 'MOVE_PIECE')).toBe(true);

    // 3. White passes skill (PASS_SKILL) -> should trigger auto end-turn -> Black's turn starts
    const pass1 = match.submitAction({ type: 'PASS_SKILL', player: Color.White });
    expect(pass1.success).toBe(true);
    expect(state.currentTurn).toBe(Color.Black);
    expect(state.turnPhase).toBe('action');
    expect(state.turnNumber).toBe(1);
    expect(state.hasMoved).toBe(false);

    // 4. Black captures White Pawn at D4 (3,3) using Black Pawn from E7 (4,13) - wait, E7 pawn is at row 13.
    // Let's set up a custom capture scenario directly on the board to avoid legal move generation constraints for other pieces.
    state.board.setPiece({ col: 5, row: 5 }, { id: 'w_pawn_cap', type: PieceType.Pawn, color: Color.White, effects: [] });
    state.board.setPiece({ col: 4, row: 6 }, { id: 'b_bishop_cap', type: PieceType.Bishop, color: Color.Black, effects: [] });

    // Black Bishop captures White Pawn: (4,6) -> (5,5)
    // First, let's make sure Black's turn is active
    expect(state.currentTurn).toBe(Color.Black);
    const captureResult = match.makeMove(Color.Black, { col: 4, row: 6 }, { col: 5, row: 5 });
    expect(captureResult.success).toBe(true);
    expect(captureResult.capturedPiece).toEqual({ type: PieceType.Pawn, color: Color.White });

    // Assert AP accumulation: Black captures (Pawn = 2 AP), White loses (Pawn = 1 AP)
    expect(state.blackAP).toBe(2);
    expect(state.whiteAP).toBe(1);

    // Assert Graveyard entry correctness
    expect(state.graveyard.length).toBe(1);
    const graveEntry = state.graveyard[0];
    expect(graveEntry.piece.id).toBe('w_pawn_cap');
    expect(graveEntry.piece.type).toBe(PieceType.Pawn);
    expect(graveEntry.piece.color).toBe(Color.White);
    expect(graveEntry.position).toEqual({ col: 5, row: 5 });
    expect(graveEntry.turnDied).toBe(1);
    expect(graveEntry.killedBy).toBe('capture');
    expect(graveEntry.killerId).toBe('b_bishop_cap');

    // Black passes skill to end turn
    match.submitAction({ type: 'PASS_SKILL', player: Color.Black });
    expect(state.currentTurn).toBe(Color.White);
    expect(state.turnNumber).toBe(2);

    // 5. Pawn Promotion: Let's put a White Pawn at D13 (3, 13) and move to D14 (3, 14)
    state.board.setPiece({ col: 3, row: 14 }, null); // Clear target cell to make straight move legal
    state.board.setPiece({ col: 3, row: 13 }, { id: 'w_pawn_promo', type: PieceType.Pawn, color: Color.White, effects: [] });
    const promoResult = match.makeMove(Color.White, { col: 3, row: 13 }, { col: 3, row: 14 });
    expect(promoResult.success).toBe(true);

    // Verify it is promoted to Queen and got AP bonus (White currently has 1 AP + PROMOTION_AP (3) = 4 AP)
    const promotedPiece = state.board.getPiece({ col: 3, row: 14 });
    expect(promotedPiece).not.toBeNull();
    expect(promotedPiece!.type).toBe(PieceType.Queen);
    expect(state.whiteAP).toBe(4);
    expect(state.actionHistory.getAll().some(entry => entry.action.type === 'PAWN_PROMOTION')).toBe(true);

    // White passes skill to end turn
    match.submitAction({ type: 'PASS_SKILL', player: Color.White });
    expect(state.currentTurn).toBe(Color.Black);

    // 6. Snapshot restore: current turn is Black turn 2. We want to restore White's turn 2 (turnsBack = 0, current = 2) or White's turn 1 (turnsBack = 1, current = 2)
    const snapshots = match.getSnapshots();
    const restoredState = snapshots.restore(1); // Restore back to turn 1 start
    expect(restoredState).not.toBeNull();
    expect(restoredState!.turnNumber).toBe(1);
    expect(restoredState!.currentTurn).toBe(Color.White);
    // Pawn should not be promoted yet in the restored state
    expect(restoredState!.board.getPiece({ col: 3, row: 14 })?.color).toBe(Color.Black);

    // Phoenix/Time ultimate clamp check: restore 5 turns back on turn 2 should clamp to turn 1
    const clampedState = snapshots.restore(5);
    expect(clampedState).not.toBeNull();
    expect(clampedState!.turnNumber).toBe(1);
    expect(clampedState!.currentTurn).toBe(Color.White);

    // 7. Game Over check by King capture
    // Put White King at F5 (5, 5) and Black Rook at F6 (5, 6)
    state.board.setPiece({ col: 5, row: 5 }, { id: 'w_king_test', type: PieceType.King, color: Color.White, effects: [] });
    state.board.setPiece({ col: 5, row: 6 }, { id: 'b_rook_test', type: PieceType.Rook, color: Color.Black, effects: [] });

    // Black Rook captures White King
    const checkmateResult = match.makeMove(Color.Black, { col: 5, row: 6 }, { col: 5, row: 5 });
    expect(checkmateResult.success).toBe(true);
    expect(checkmateResult.isKingCaptured).toBe(true);
    expect(state.status).toBe('finished');
    expect(state.winner).toBe(Color.Black);
    expect(state.actionHistory.getAll().some(entry => entry.action.type === 'GAME_OVER')).toBe(true);
  });
});
