import { Match, Color, Position, PieceType, getAttackedSquares, isSquareAttackedBy, isKingAttacked, getRegion, isInRegion, MoveModifier, getLegalMoves } from 'game-core';

describe('Chess Variant Engine - Step 4 Tests (Combat, Region, Modifier)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.start();
  });

  // 1. Attack Detection
  describe('Attack Detection', () => {
    it('should correctly calculate attacked squares', () => {
      const state = match.getGameState();
      // Setup a White Rook on E4 (4, 4) on an empty board area
      const rookPos: Position = { col: 4, row: 4 };
      state.board.setPiece(rookPos, {
        id: 'w_rook_atk',
        type: PieceType.Rook,
        color: Color.White,
        effects: [],
      });

      const attacked = getAttackedSquares(state.board, Color.White);
      
      // Rook controls orthogonal lines. E.g., (4, 5) and (5, 4) should be attacked.
      expect(attacked.has('4,5')).toBe(true);
      expect(attacked.has('5,4')).toBe(true);
      expect(attacked.has('4,3')).toBe(true);
      expect(attacked.has('3,4')).toBe(true);

      // (5, 5) is diagonal, shouldn't be attacked by Rook
      expect(attacked.has('5,5')).toBe(false);

      expect(isSquareAttackedBy(state.board, { col: 4, row: 5 }, Color.White)).toBe(true);
      expect(isSquareAttackedBy(state.board, { col: 5, row: 5 }, Color.White)).toBe(false);
    });

    it('should correctly detect check on the King', () => {
      const state = match.getGameState();
      
      // Place Black King at D15 (3, 14) manually
      state.board.setPiece({ col: 3, row: 14 }, {
        id: 'b_king_check_test',
        type: PieceType.King,
        color: Color.Black,
        effects: [],
      });

      // Clear pieces between D12 (3, 11) and D15 (3, 14)
      state.board.setPiece({ col: 3, row: 12 }, null);
      state.board.setPiece({ col: 3, row: 13 }, null);
      
      expect(isKingAttacked(state.board, Color.Black)).toBe(false);

      // Place a White Rook on D12 (3, 11) -> attacking D15 (3, 14) vertically
      state.board.setPiece({ col: 3, row: 11 }, {
        id: 'w_rook_check',
        type: PieceType.Rook,
        color: Color.White,
        effects: [],
      });

      expect(isKingAttacked(state.board, Color.Black)).toBe(true);
    });

    it('should emit OnPieceAttacked and OnCheck events on moves', () => {
      const eventBus = match.getEventBus();
      let checkFired = false;
      let pieceAttackedFired = false;

      eventBus.on({
        id: 'test_check',
        eventType: 'OnCheck',
        priority: 100,
        source: 'test',
        handler: (event) => {
          checkFired = true;
          expect(event.payload.targetPiece.type).toBe(PieceType.King);
          expect(event.payload.targetPiece.color).toBe(Color.Black);
        },
      });

      eventBus.on({
        id: 'test_piece_attacked',
        eventType: 'OnPieceAttacked',
        priority: 100,
        source: 'test',
        handler: (event) => {
          pieceAttackedFired = true;
          expect(event.payload.attacker.color).toBe(Color.White);
        },
      });

      const state = match.getGameState();
      // Setup a White Rook on E3 (4, 2)
      // Place Black Knight on E7 (4, 6)
      const whiteRookPos: Position = { col: 4, row: 2 };
      const blackKnightPos: Position = { col: 4, row: 6 };

      state.board.setPiece(whiteRookPos, { id: 'w_rook_evt', type: PieceType.Rook, color: Color.White, effects: [] });
      state.board.setPiece(blackKnightPos, { id: 'b_knight_evt', type: PieceType.Knight, color: Color.Black, effects: [] });

      // Move Rook to E5 (4, 4) -> This attacks Knight on E7 (4, 6) and also King (since path is open or rook controls file)
      // Let's align White Rook with Black King. White Rook E5 (4, 4) to D5 (3, 4) doesn't check.
      // Let's place Black King at D7 (3, 6).
      state.board.setPiece({ col: 3, row: 6 }, { id: 'b_king_evt', type: PieceType.King, color: Color.Black, effects: [] });

      // Move White Rook from E3 (4, 2) to D3 (3, 2) -> checks King at D7 (3, 6)
      const moveResult = match.makeMove(Color.White, whiteRookPos, { col: 3, row: 2 });
      expect(moveResult.success).toBe(true);

      expect(pieceAttackedFired).toBe(true);
      expect(checkFired).toBe(true);
    });
  });

  // 2. Region Utilities
  describe('Region Utilities', () => {
    it('should generate square regions correctly', () => {
      const center: Position = { col: 5, row: 5 };
      // 3x3 square centered at (5, 5) -> col 4..6, row 4..6 (9 cells)
      const region = getRegion({ center, shape: 'square', size: 3 });
      expect(region.length).toBe(9);
      expect(isInRegion({ col: 4, row: 4 }, region)).toBe(true);
      expect(isInRegion({ col: 5, row: 5 }, region)).toBe(true);
      expect(isInRegion({ col: 6, row: 6 }, region)).toBe(true);
      expect(isInRegion({ col: 7, row: 5 }, region)).toBe(false);
    });

    it('should generate cross regions correctly', () => {
      const center: Position = { col: 5, row: 5 };
      // cross centered at (5, 5) with arm length 1 -> size: 3 (so Math.floor(3 / 2) = 1) -> (5,5), (5,6), (5,4), (6,5), (4,5) (5 cells)
      const region = getRegion({ center, shape: 'cross', size: 3 });
      expect(region.length).toBe(5);
      expect(isInRegion({ col: 5, row: 6 }, region)).toBe(true);
      expect(isInRegion({ col: 4, row: 5 }, region)).toBe(true);
      expect(isInRegion({ col: 6, row: 6 }, region)).toBe(false);
    });

    it('should generate x_shape regions correctly', () => {
      const center: Position = { col: 5, row: 5 };
      // X-shape centered at (5, 5) with arm length 1 -> size: 3 -> (5,5), (4,4), (6,6), (4,6), (6,4) (5 cells)
      const region = getRegion({ center, shape: 'x_shape', size: 3 });
      expect(region.length).toBe(5);
      expect(isInRegion({ col: 4, row: 4 }, region)).toBe(true);
      expect(isInRegion({ col: 6, row: 6 }, region)).toBe(true);
      expect(isInRegion({ col: 5, row: 6 }, region)).toBe(false);
    });

    it('should clamp regions to board boundaries', () => {
      const center: Position = { col: 0, row: 0 };
      // 3x3 square centered at (0,0) -> only 4 cells in bounds (0,0), (0,1), (1,0), (1,1)
      const region = getRegion({ center, shape: 'square', size: 3 });
      expect(region.length).toBe(4);
    });

    // Explicit test for 3x3 and 5x5 centered at corner/edge/center
    it('should correctly handle 3x3 and 5x5 regions at center, edge, and corner', () => {
      // 1. Center (7, 7)
      const centerPos: Position = { col: 7, row: 7 };
      expect(getRegion({ center: centerPos, shape: 'square', size: 3 }).length).toBe(9);
      expect(getRegion({ center: centerPos, shape: 'square', size: 5 }).length).toBe(25);

      // 2. Edge (7, 0)
      const edgePos: Position = { col: 7, row: 0 };
      // 3x3 at edge: rows -1, 0, 1 -> only 0 and 1 in bounds. cols 6, 7, 8 in bounds. Total 2 * 3 = 6 cells.
      expect(getRegion({ center: edgePos, shape: 'square', size: 3 }).length).toBe(6);
      // 5x5 at edge: rows -2..2 -> only 0, 1, 2 in bounds. cols 5..9 in bounds. Total 3 * 5 = 15 cells.
      expect(getRegion({ center: edgePos, shape: 'square', size: 5 }).length).toBe(15);

      // 3. Corner (0, 0)
      const cornerPos: Position = { col: 0, row: 0 };
      // 3x3 at corner: cols 0, 1; rows 0, 1. Total 2 * 2 = 4 cells.
      expect(getRegion({ center: cornerPos, shape: 'square', size: 3 }).length).toBe(4);
      // 5x5 at corner: cols 0, 1, 2; rows 0, 1, 2. Total 3 * 3 = 9 cells.
      expect(getRegion({ center: cornerPos, shape: 'square', size: 5 }).length).toBe(9);
    });
  });

  // 3. Move Modifier Chain
  describe('Move Modifier Chain', () => {
    it('should return identical results to old getLegalMoves when no modifiers registered', () => {
      const pawnPos: Position = { col: 3, row: 1 };
      const chainMoves = match.getLegalMovesAt(pawnPos);
      const oldMoves = getLegalMoves(match.getBoard(), pawnPos);
      expect(chainMoves).toEqual(oldMoves);
    });

    it('should apply modifier filter successfully', () => {
      const chain = match.getMoveModifierChain();
      
      const pawnPos: Position = { col: 3, row: 1 }; // White pawn at D2
      const baseMoves = match.getLegalMovesAt(pawnPos);

      // Register a modifier that blocks moving to D4 (3, 3)
      const blockD4Modifier: MoveModifier = {
        id: 'block_d4',
        priority: 100,
        source: 'test',
        modify: (moves, context) => {
          return moves.filter(m => !(m.col === 3 && m.row === 3));
        }
      };

      chain.register(blockD4Modifier);

      const modifiedMoves = match.getLegalMovesAt(pawnPos);
      expect(baseMoves.some(m => m.col === 3 && m.row === 3)).toBe(true);
      expect(modifiedMoves.some(m => m.col === 3 && m.row === 3)).toBe(false);

      // Verify validator rejects blocked move
      const result = match.makeMove(Color.White, pawnPos, { col: 3, row: 3 });
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Illegal move');

      // Unregister and verify it is allowed again
      chain.unregister('block_d4');
      const restoredMoves = match.getLegalMovesAt(pawnPos);
      expect(restoredMoves.some(m => m.col === 3 && m.row === 3)).toBe(true);
    });
  });
});
