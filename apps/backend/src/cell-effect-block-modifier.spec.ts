import {
  Match,
  Color,
  PieceType,
  Piece,
} from 'game-core';

describe('CellEffectBlockModifier Refactoring', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  it('should block sliding pieces (Rook/Bishop) from moving through or landing on cells with flame or mountain effects', () => {
    match.setVariants('earth', 'phoenix');
    match.start();

    const state = match.getGameState();

    // 1. Test Mountain cell effect blocking sliding
    state.board.addCellEffect({ col: 3, row: 2 }, {
      id: 'test_mountain',
      type: 'mountain',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '3,2',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    // Clear pawns around white Rook at D1 (col 3, row 0)
    state.board.removePiece({ col: 3, row: 1 });
    state.board.removePiece({ col: 3, row: 2 });
    state.board.removePiece({ col: 3, row: 3 });

    let legalMoves = match.getLegalMovesAt({ col: 3, row: 0 });
    // Should include (3,1) but NOT (3,2) or (3,3) because (3,2) is a mountain and blocks sliding
    expect(legalMoves.some(m => m.col === 3 && m.row === 1)).toBe(true);
    expect(legalMoves.some(m => m.col === 3 && m.row === 2)).toBe(false);
    expect(legalMoves.some(m => m.col === 3 && m.row === 3)).toBe(false);

    // 2. Test Flame cell effect blocking sliding
    state.board.removeCellEffect({ col: 3, row: 2 }, 'test_mountain');

    state.board.addCellEffect({ col: 3, row: 2 }, {
      id: 'test_flame',
      type: 'flame',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '3,2',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    legalMoves = match.getLegalMovesAt({ col: 3, row: 0 });
    // Should include (3,1) but NOT (3,2) or (3,3) because (3,2) has flame and blocks sliding
    expect(legalMoves.some(m => m.col === 3 && m.row === 1)).toBe(true);
    expect(legalMoves.some(m => m.col === 3 && m.row === 2)).toBe(false);
    expect(legalMoves.some(m => m.col === 3 && m.row === 3)).toBe(false);
  });

  it('should allow jumping pieces (Knight) to jump over flame/mountain cells, but not land on flame cells', () => {
    match.setVariants('earth', 'phoenix');
    match.start();

    const state = match.getGameState();

    // Clear pawns around target squares C3, A3, D2
    state.board.removePiece({ col: 2, row: 2 });
    state.board.removePiece({ col: 0, row: 2 });
    state.board.removePiece({ col: 3, row: 1 });

    // Place mountain cell effect on C3 (col 2, row 2)
    state.board.addCellEffect({ col: 2, row: 2 }, {
      id: 'test_mountain_c3',
      type: 'mountain',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '2,2',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    let legalMoves = match.getLegalMovesAt({ col: 1, row: 0 });
    // Knight should be able to land on C3
    expect(legalMoves.some(m => m.col === 2 && m.row === 2)).toBe(true);

    // Place flame cell effect on A3 (col 0, row 2)
    state.board.addCellEffect({ col: 0, row: 2 }, {
      id: 'test_flame_a3',
      type: 'flame',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '0,2',
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    legalMoves = match.getLegalMovesAt({ col: 1, row: 0 });
    // Knight should NOT be able to land on A3 because flame blocks landing globally
    expect(legalMoves.some(m => m.col === 0 && m.row === 2)).toBe(false);
  });
});
