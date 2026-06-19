import { Match, Color, Position, PieceType, EventBus, HandlerRegistration, GameEvent } from 'game-core';

describe('Chess Variant Engine - Step 3 Extended Tests (B1, B2, B3)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.start();
  });

  // B1: OnTurnStart / OnTurnEnd events fire at correct times
  it('B1: should fire OnTurnStart and OnTurnEnd events during turn cycle', () => {
    const eventBus = match.getEventBus();
    const firedEvents: { type: string; player: Color }[] = [];

    // Register handler for OnTurnStart
    eventBus.on({
      id: 'b1_turn_start',
      eventType: 'OnTurnStart',
      priority: 100,
      source: 'test',
      handler: (event) => {
        firedEvents.push({ type: 'OnTurnStart', player: event.activePlayer });
      },
    });

    // Register handler for OnTurnEnd
    eventBus.on({
      id: 'b1_turn_end',
      eventType: 'OnTurnEnd',
      priority: 100,
      source: 'test',
      handler: (event) => {
        firedEvents.push({ type: 'OnTurnEnd', player: event.activePlayer });
      },
    });

    // White moves + passes skill → triggers END_TURN (OnTurnEnd) → SWITCH_TURN → START_TURN (OnTurnStart for Black)
    match.makeMove(Color.White, { col: 3, row: 1 }, { col: 3, row: 3 });
    match.submitAction({ type: 'PASS_SKILL', player: Color.White });

    // OnTurnEnd should have fired for White, OnTurnStart should have fired for Black
    const turnEndEvents = firedEvents.filter(e => e.type === 'OnTurnEnd');
    const turnStartEvents = firedEvents.filter(e => e.type === 'OnTurnStart');

    expect(turnEndEvents.length).toBeGreaterThanOrEqual(1);
    expect(turnEndEvents[0].player).toBe(Color.White);

    expect(turnStartEvents.length).toBeGreaterThanOrEqual(1);
    // The last OnTurnStart should be for Black
    const lastStart = turnStartEvents[turnStartEvents.length - 1];
    expect(lastStart.player).toBe(Color.Black);
  });

  // B2: EventBus.emit() does NOT throw when there are no handlers registered
  it('B2: should not throw when emitting event with no registered handlers', () => {
    const bus = new EventBus();

    const event: GameEvent = {
      type: 'OnCapture',
      turnNumber: 1,
      activePlayer: Color.White,
      payload: { attackerId: 'test', capturedPieceId: 'test2' },
    };

    // This should NOT throw
    expect(() => {
      bus.emit(event, () => {});
    }).not.toThrow();
  });

  it('B2: EventBus emits all event types without handler during normal gameplay (no crash)', () => {
    // A full move + pass skill cycle fires OnBeforeMove, OnMove, OnTurnEnd, OnTurnStart, etc.
    // With no custom handlers registered, none of these should throw.
    const freshMatch = new Match();
    freshMatch.start();

    expect(() => {
      freshMatch.makeMove(Color.White, { col: 3, row: 1 }, { col: 3, row: 3 });
      freshMatch.submitAction({ type: 'PASS_SKILL', player: Color.White });
    }).not.toThrow();

    expect(freshMatch.getGameState().currentTurn).toBe(Color.Black);
  });

  // B3: OnCapture payload contains correct attacker and captured piece IDs
  it('B3: should fire OnCapture with correct attacker and captured piece in payload', () => {
    const eventBus = match.getEventBus();
    let capturedPayload: Record<string, any> | null = null;

    // Register handler for OnCapture
    eventBus.on({
      id: 'b3_capture_payload',
      eventType: 'OnCapture',
      priority: 100,
      source: 'test',
      handler: (event) => {
        capturedPayload = event.payload;
      },
    });

    const state = match.getGameState();

    // Set up a custom capture scenario: White Rook captures Black Pawn
    const whiteRookPos: Position = { col: 7, row: 4 };
    const blackPawnPos: Position = { col: 7, row: 6 };

    state.board.setPiece(whiteRookPos, {
      id: 'w_rook_b3',
      type: PieceType.Rook,
      color: Color.White,
      effects: [],
    });
    state.board.setPiece(blackPawnPos, {
      id: 'b_pawn_b3',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [],
    });

    // White Rook captures Black Pawn
    const result = match.makeMove(Color.White, whiteRookPos, blackPawnPos);
    expect(result.success).toBe(true);
    expect(result.capturedPiece).toEqual({ type: PieceType.Pawn, color: Color.Black });

    // Verify OnCapture payload
    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload!.attackerId).toBe('w_rook_b3');
    expect(capturedPayload!.capturedPieceId).toBe('b_pawn_b3');
    expect(capturedPayload!.from).toEqual(whiteRookPos);
    expect(capturedPayload!.to).toEqual(blackPawnPos);
  });
});
