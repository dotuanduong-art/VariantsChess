import { Match, Color, Position, HandlerRegistration } from 'game-core';

describe('Chess Variant Engine - Step 3 EventBus Tests', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.start();
  });

  it('should execute registered event handlers in priority order', () => {
    const eventBus = match.getEventBus();
    const executionOrder: string[] = [];

    // Register high priority handler (runs first)
    eventBus.on({
      id: 'high_priority',
      eventType: 'OnMove',
      priority: 100,
      source: 'test',
      handler: (event) => {
        executionOrder.push('high');
      },
    });

    // Register low priority handler (runs second)
    eventBus.on({
      id: 'low_priority',
      eventType: 'OnMove',
      priority: 500,
      source: 'test',
      handler: (event) => {
        executionOrder.push('low');
      },
    });

    // Make a move to trigger OnMove
    match.makeMove(Color.White, { col: 3, row: 1 }, { col: 3, row: 3 });

    expect(executionOrder).toEqual(['high', 'low']);
  });

  it('should allow event handlers to enqueue actions reactively', () => {
    const eventBus = match.getEventBus();
    
    // Register a handler that enqueues GAIN_AP on OnMove
    eventBus.on({
      id: 'gain_ap_handler',
      eventType: 'OnMove',
      priority: 100,
      source: 'test',
      handler: (event, enqueueAction) => {
        enqueueAction({
          type: 'GAIN_AP',
          player: Color.White,
          amount: 5,
          source: 'reactive_test',
        });
      },
    });

    const state = match.getGameState();
    expect(state.whiteAP).toBe(0);

    // Make move, which triggers OnMove, enqueues GAIN_AP, and drains queue
    match.makeMove(Color.White, { col: 3, row: 1 }, { col: 3, row: 3 });

    expect(state.whiteAP).toBe(5);
  });

  it('should cancel actions when event.cancelled is set to true on OnBefore events', () => {
    const eventBus = match.getEventBus();

    // Register a Shield-like handler that cancels OnBeforeMove
    eventBus.on({
      id: 'shield_move_canceler',
      eventType: 'OnBeforeMove',
      priority: 50,
      source: 'test',
      handler: (event) => {
        event.cancelled = true;
      },
    });

    const state = match.getGameState();
    const piece = state.board.getPiece({ col: 3, row: 1 });
    expect(piece).not.toBeNull();

    // Try to move piece
    const result = match.makeMove(Color.White, { col: 3, row: 1 }, { col: 3, row: 3 });
    // Should fail or at least the move shouldn't be applied to the board
    expect(state.board.getPiece({ col: 3, row: 3 })).toBeNull();
    expect(state.board.getPiece({ col: 3, row: 1 })).toBe(piece);
  });
});
