import {
  Match,
  Color,
  Position,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  BOARD_SIZE,
  getAttackedSquares,
} from 'game-core';

describe('Chess Variant Engine - Earth Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // Helper to prepare state for White Earth turn
  function setupWhiteEarthTurn() {
    match.setVariants('earth', 'lightning');
    match.start();
    const state = match.getGameState();
    state.whiteAP = 40;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    return state;
  }

  // ═══════════════════════════════════════════════════════
  // SKILL 1 - RAISE THE MOUNTAIN
  // ═══════════════════════════════════════════════════════

  // E1: Skill 1 — spawn Mountain tại ô trống, duration 5 rounds
  it('E1: Skill 1 — spawns Mountain at empty cell with 5 rounds duration', () => {
    const state = setupWhiteEarthTurn();
    const targetCell: Position = { col: 5, row: 5 };

    const res = match.useSkill(Color.White, 'earth_raise_mountain', [
      { type: 'cell', position: targetCell }
    ]);
    expect(res.success).toBe(true);

    const piece = state.board.getPiece(targetCell);
    expect(piece).toBeDefined();
    expect(piece!.specialType).toBe('mountain');
    expect(piece!.color).toBe(Color.White);

    const timer = piece!.effects?.find(e => e.type === 'mountain_timer');
    expect(timer).toBeDefined();
    expect(timer!.remainingDuration).toBe(5);
  });

  // E2: Mountain — quân không thể di chuyển vào ô Mountain
  it('E2: Mountain — pieces cannot move into the Mountain cell', () => {
    const state = setupWhiteEarthTurn();
    const mountainCell: Position = { col: 4, row: 4 };

    // Place a mountain at (4, 4)
    state.board.setPiece(mountainCell, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    // Place a White Rook at (4, 2)
    const rookPos = { col: 4, row: 2 };
    state.board.setPiece(rookPos, {
      id: 'w_rook',
      type: PieceType.Rook,
      color: Color.White,
      effects: [],
    });

    const moves = match.getLegalMovesAt(rookPos);
    // (4, 4) should not be a legal move
    const canMoveToMountain = moves.some(m => m.col === 4 && m.row === 4);
    expect(canMoveToMountain).toBe(false);
  });

  // E3: Mountain — sliding piece bị chặn bởi Mountain (không thể attack xuyên qua)
  it('E3: Mountain — sliding attacks are blocked at the Mountain cell', () => {
    const state = setupWhiteEarthTurn();
    state.board = new Board();
    const mountainCell: Position = { col: 0, row: 4 }; // A5
    const rookPos: Position = { col: 0, row: 0 }; // A1
    const kingPos: Position = { col: 0, row: 7 }; // A8

    state.board.setPiece(rookPos, {
      id: 'w_rook',
      type: PieceType.Rook,
      color: Color.White,
      effects: [],
    });
    state.board.setPiece(kingPos, {
      id: 'b_king',
      type: PieceType.King,
      color: Color.Black,
      effects: [],
    });
    state.board.setPiece(mountainCell, {
      id: 'm2',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    const attacked = getAttackedSquares(state.board, Color.White, state);
    expect(attacked.has('0,1')).toBe(true); // A2
    expect(attacked.has('0,2')).toBe(true); // A3
    expect(attacked.has('0,3')).toBe(true); // A4
    expect(attacked.has('0,4')).toBe(false); // A5 (blocked at Mountain itself)
    expect(attacked.has('0,7')).toBe(false); // A8 (cannot go past)
  });

  // E4: Mountain — canBeAttacked: false → CAPTURE bị block
  it('E4: Mountain — capture is blocked due to canBeAttacked: false', () => {
    const state = setupWhiteEarthTurn();
    const mountainCell: Position = { col: 4, row: 4 };

    // Spawn White Mountain
    state.board.setPiece(mountainCell, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    // Spawn Black Rook at (4, 5)
    const rookPos = { col: 4, row: 5 };
    state.board.setPiece(rookPos, {
      id: 'b_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    // Make it Black turn
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';

    const res = match.makeMove(Color.Black, rookPos, mountainCell);
    expect(res.success).toBe(false); // cannot capture/move to Mountain
  });

  // E5: Mountain — canBeAttacked: false → DESTROY_PIECE bị block (kể cả Bomb AoE)
  it('E5: Mountain — DESTROY_PIECE is blocked for Mountain (indestructible)', () => {
    const state = setupWhiteEarthTurn();
    const mountainCell: Position = { col: 4, row: 4 };

    state.board.setPiece(mountainCell, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    // Attempt direct DESTROY_PIECE with generic reason
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: 'm1',
      position: mountainCell,
      reason: 'explosion', // e.g. Bomb AoE
    });

    // Mountain should still be on board
    expect(state.board.getPiece(mountainCell)).toBeDefined();

    // Attempt SACRIFICE_PIECE
    match.submitAction({
      type: 'SACRIFICE_PIECE',
      pieceId: 'm1',
      position: mountainCell,
      player: Color.White,
    });

    expect(state.board.getPiece(mountainCell)).toBeDefined();
  });

  // E6: Mountain — tự destroy sau 5 rounds
  it('E6: Mountain — automatically self-destructs after 5 rounds', () => {
    const state = setupWhiteEarthTurn();
    const targetCell: Position = { col: 5, row: 5 };

    match.useSkill(Color.White, 'earth_raise_mountain', [
      { type: 'cell', position: targetCell }
    ]);
    const mountain = state.board.getPiece(targetCell)!;

    // Simulate 5 rounds (12 turns to allow tick timing expiration)
    for (let i = 0; i < 12; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Mountain should be destroyed
    expect(state.board.getPiece(targetCell)).toBeNull();
  });

  // ═══════════════════════════════════════════════════════
  // PASSIVE - GROUND DOMINION
  // ═══════════════════════════════════════════════════════

  // E7: Passive — 2 Mountain → Skill 2 cost 4 AP (6-2=4)
  it('E7: Passive — 2 Mountains reduce Skill 2 cost to 4 AP', () => {
    const state = setupWhiteEarthTurn();

    // Spawn 2 ally Mountains
    state.board.setPiece({ col: 1, row: 1 }, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });
    state.board.setPiece({ col: 2, row: 2 }, {
      id: 'm2',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    // End turn and start turn again to trigger TurnStart hook
    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // White turn starts: cost should be calculated
    expect(state.variantState.skill2CostThisTurn).toBe(4);
  });

  // E8: Passive — 3+ Mountain → Skill 2 cost 3 AP (floor)
  it('E8: Passive — 3+ Mountains reduce Skill 2 cost to 3 AP floor', () => {
    const state = setupWhiteEarthTurn();

    // Spawn 4 ally Mountains
    for (let i = 1; i <= 4; i++) {
      state.board.setPiece({ col: i, row: i }, {
        id: `m_${i}`,
        type: 'mountain' as any,
        color: Color.White,
        specialType: 'mountain',
        effects: [],
      });
    }

    match.submitAction({ type: 'END_TURN', player: Color.White });
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    expect(state.variantState.skill2CostThisTurn).toBe(3);
  });

  // E9: Passive — cost cố định đầu turn (spawn Mountain giữa turn không ảnh hưởng cost hiện tại)
  it('E9: Passive — AP cost is fixed at turn start and does not fluctuate mid-turn', () => {
    const state = setupWhiteEarthTurn();
    state.variantState.skill2CostThisTurn = 6;

    // Use Skill 1 to spawn a Mountain mid-turn
    match.useSkill(Color.White, 'earth_raise_mountain', [
      { type: 'cell', position: { col: 5, row: 5 } }
    ]);

    // Cost should still be 6 (does not change immediately mid-turn)
    expect(state.variantState.skill2CostThisTurn).toBe(6);
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 2 - SHIFTING PEAKS
  // ═══════════════════════════════════════════════════════

  // E10: Skill 2 — Mountain di chuyển đến ô đích hợp lệ theo Queen path
  it('E10: Skill 2 — moves Mountain to valid destination cell along Queen path', () => {
    const state = setupWhiteEarthTurn();
    const fromCell = { col: 3, row: 3 };
    const toCell = { col: 3, row: 6 };

    // Place mountain at A (3,3)
    state.board.setPiece(fromCell, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [
        {
          id: 'mt1',
          type: 'mountain_timer',
          duration: 5,
          remainingDuration: 4,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'm1',
          stackingRule: 'ignore',
          isDebuff: false,
          metadata: {},
        }
      ],
    });

    const res = match.useSkill(Color.White, 'earth_shifting_peaks', [
      { type: 'piece', position: fromCell, pieceId: 'm1' },
      { type: 'cell', position: toCell }
    ]);

    expect(res.success).toBe(true);

    // B (3, 6) should have Mountain with remainingDuration = 4
    const pieceB = state.board.getPiece(toCell);
    expect(pieceB).toBeDefined();
    expect(pieceB!.specialType).toBe('mountain');
    const timerB = pieceB!.effects?.find(e => e.type === 'mountain_timer');
    expect(timerB!.remainingDuration).toBe(4);
  });

  // E11: Skill 2 — ô nguồn được tạo Mountain mới với remainingDuration giống Mountain gốc
  it('E11: Skill 2 — spawns new Mountain at source cell with same remaining duration', () => {
    const state = setupWhiteEarthTurn();
    const fromCell = { col: 3, row: 3 };
    const toCell = { col: 3, row: 6 };

    state.board.setPiece(fromCell, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [
        {
          id: 'mt1',
          type: 'mountain_timer',
          duration: 5,
          remainingDuration: 3,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'm1',
          stackingRule: 'ignore',
          isDebuff: false,
          metadata: {},
        }
      ],
    });

    const res = match.useSkill(Color.White, 'earth_shifting_peaks', [
      { type: 'piece', position: fromCell, pieceId: 'm1' },
      { type: 'cell', position: toCell }
    ]);
    expect(res.success).toBe(true);

    // Source cell (3, 3) should also contain a Mountain with remainingDuration = 3
    const pieceA = state.board.getPiece(fromCell);
    expect(pieceA).toBeDefined();
    expect(pieceA!.specialType).toBe('mountain');
    const timerA = pieceA!.effects?.find(e => e.type === 'mountain_timer');
    expect(timerA!.remainingDuration).toBe(3);
  });

  // E12: Skill 2 — quân địch trên đường đi bị đẩy đến vật cản
  // E12: Skill 2 — quân địch trên đường đi bị đẩy đến vật cản (vật cản gần hơn 3 ô)
  it('E12: Skill 2 — pushes enemy pieces along direction of movement to obstacle if obstacle is closer than 3 cells', () => {
    const state = setupWhiteEarthTurn();
    const fromCell = { col: 3, row: 3 };
    const toCell = { col: 3, row: 6 };
    const enemyPos = { col: 3, row: 5 }; // Enemy pawn on path

    state.board.setPiece(fromCell, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    state.board.setPiece(enemyPos, {
      id: 'b_pawn',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [],
    });

    // Let's place a static obstacle (e.g. another piece) at (3, 8)
    const obstaclePos = { col: 3, row: 8 };
    state.board.setPiece(obstaclePos, {
      id: 'b_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    const res = match.useSkill(Color.White, 'earth_shifting_peaks', [
      { type: 'piece', position: fromCell, pieceId: 'm1' },
      { type: 'cell', position: toCell }
    ]);
    expect(res.success).toBe(true);

    // The enemy pawn should be pushed from (3, 5) in direction (0, +1) until hitting obstacle at (3, 8)
    // Thus it should land at (3, 7) (pressed against (3, 8))
    expect(state.board.getPiece(enemyPos)).toBeNull();
    const pushedPawn = state.board.getPiece({ col: 3, row: 7 });
    expect(pushedPawn).toBeDefined();
    expect(pushedPawn!.id).toBe('b_pawn');
  });

  // E12_limit: Skill 2 — quân địch trên đường đi chỉ bị đẩy tối đa 3 ô nếu không có vật cản gần
  it('E12_limit: Skill 2 — pushes enemy pieces at most 3 cells if no close obstacle', () => {
    const state = setupWhiteEarthTurn();
    const fromCell = { col: 3, row: 3 };
    const toCell = { col: 3, row: 6 };
    const enemyPos = { col: 3, row: 5 }; // Enemy pawn on path

    state.board.setPiece(fromCell, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    state.board.setPiece(enemyPos, {
      id: 'b_pawn',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [],
    });

    // Place obstacle far away, e.g. at (3, 10)
    const obstaclePos = { col: 3, row: 10 };
    state.board.setPiece(obstaclePos, {
      id: 'b_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    const res = match.useSkill(Color.White, 'earth_shifting_peaks', [
      { type: 'piece', position: fromCell, pieceId: 'm1' },
      { type: 'cell', position: toCell }
    ]);
    expect(res.success).toBe(true);

    // The enemy pawn starts at (3, 5). Direction is (0, +1).
    // It should be pushed by at most 3 cells, landing at (3, 8).
    expect(state.board.getPiece(enemyPos)).toBeNull();
    const pushedPawn = state.board.getPiece({ col: 3, row: 8 });
    expect(pushedPawn).toBeDefined();
    expect(pushedPawn!.id).toBe('b_pawn');
  });

  // E13: Skill 2 — quân địch không có chỗ đẩy (vật cản ngay sát) → ép sát, không destroy
  it('E13: Skill 2 — fails/blocks move if enemy cannot be pushed beyond destination', () => {
    const state = setupWhiteEarthTurn();
    const fromCell = { col: 3, row: 3 };
    const toCell = { col: 3, row: 5 };
    const enemyPos = { col: 3, row: 4 };

    state.board.setPiece(fromCell, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    state.board.setPiece(enemyPos, {
      id: 'b_pawn',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [],
    });

    // Place obstacle at (3, 5) (which is the destination cell B!)
    // Wait, B must be empty initially, so obstacle cannot be at B.
    // Place obstacle at (3, 6) (which is B + D).
    const obstaclePos = { col: 3, row: 6 };
    state.board.setPiece(obstaclePos, {
      id: 'b_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    });

    // Simulation: enemy at (3, 4) is pushed in direction (0, +1).
    // next is (3, 5) - empty. Moves to (3, 5).
    // next is (3, 6) - blocked. Stops at (3, 5).
    // final position is (3, 5), which is B (destination).
    // Since final position is B, B is blocked, so the move should be invalid.
    const res = match.useSkill(Color.White, 'earth_shifting_peaks', [
      { type: 'piece', position: fromCell, pieceId: 'm1' },
      { type: 'cell', position: toCell }
    ]);
    expect(res.success).toBe(false);
  });

  // E14: Skill 2 — không thể di chuyển Mountain qua quân đồng minh (path bị chặn)
  it('E14: Skill 2 — blocked if an ally piece is on the path', () => {
    const state = setupWhiteEarthTurn();
    const fromCell = { col: 3, row: 3 };
    const toCell = { col: 3, row: 6 };
    const allyPos = { col: 3, row: 5 };

    state.board.setPiece(fromCell, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    state.board.setPiece(allyPos, {
      id: 'w_pawn',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [],
    });

    const res = match.useSkill(Color.White, 'earth_shifting_peaks', [
      { type: 'piece', position: fromCell, pieceId: 'm1' },
      { type: 'cell', position: toCell }
    ]);
    expect(res.success).toBe(false);
  });

  // ═══════════════════════════════════════════════════════
  // ULTIMATE - EARTH-BURST HEAVENLY STAR
  // ═══════════════════════════════════════════════════════

  // E15: Ultimate — reject nếu < 3 Mountain
  it('E15: Ultimate — rejects if < 3 Mountains on the board', () => {
    const state = setupWhiteEarthTurn();
    const enemyPos = { col: 4, row: 13 }; // Black pawn
    const enemy = state.board.getPiece(enemyPos)!;

    // Spawn only 2 Mountains
    state.board.setPiece({ col: 1, row: 1 }, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });
    state.board.setPiece({ col: 2, row: 2 }, {
      id: 'm2',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    const res = match.useSkill(Color.White, 'earth_earth_burst', [
      { type: 'piece', position: enemyPos, pieceId: enemy.id }
    ]);
    expect(res.success).toBe(false);
  });

  // E16: Ultimate — không thể target King
  it('E16: Ultimate — cannot target the opponent King', () => {
    const state = setupWhiteEarthTurn();

    // Spawn 3 Mountains
    for (let i = 1; i <= 3; i++) {
      state.board.setPiece({ col: i, row: i }, {
        id: `m_${i}`,
        type: 'mountain' as any,
        color: Color.White,
        specialType: 'mountain',
        effects: [],
      });
    }

    // Find Black King position
    let kingPos: Position = { col: 7, row: 14 }; // standard position
    let king = state.board.getPiece(kingPos);
    if (!king || king.type !== PieceType.King || king.color !== Color.Black) {
      // Find King manually
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          const p = state.board.getPiece({ col: c, row: r });
          if (p && p.type === PieceType.King && p.color === Color.Black) {
            kingPos = { col: c, row: r };
            king = p;
            break;
          }
        }
      }
    }

    const res = match.useSkill(Color.White, 'earth_earth_burst', [
      { type: 'piece', position: kingPos, pieceId: king!.id }
    ]);
    expect(res.success).toBe(false);
  });

  // E17: Ultimate — quân địch bị target biến mất khỏi board
  it('E17: Ultimate — target enemy piece disappears from the board', () => {
    const state = setupWhiteEarthTurn();
    const enemyPos = { col: 4, row: 13 };
    const enemy = state.board.getPiece(enemyPos)!;

    // Spawn 3 Mountains
    for (let i = 1; i <= 3; i++) {
      state.board.setPiece({ col: i, row: i }, {
        id: `m_${i}`,
        type: 'mountain' as any,
        color: Color.White,
        specialType: 'mountain',
        effects: [],
      });
    }

    const res = match.useSkill(Color.White, 'earth_earth_burst', [
      { type: 'piece', position: enemyPos, pieceId: enemy.id }
    ]);
    expect(res.success).toBe(true);

    // Enemy piece should be removed from board
    const boardPiece = state.board.getPiece(enemyPos);
    expect(boardPiece).toBeDefined();
    expect(boardPiece!.specialType).toBe('earth_reservation'); // replaced by reservation
  });

  // E18: Ultimate — earth_reservation xuất hiện tại ô quân biến mất (indestructible)
  it('E18: Ultimate — earth_reservation spawns at targeted cell and is indestructible', () => {
    const state = setupWhiteEarthTurn();
    const enemyPos = { col: 4, row: 13 };
    const enemy = state.board.getPiece(enemyPos)!;

    // Spawn 3 Mountains
    for (let i = 1; i <= 3; i++) {
      state.board.setPiece({ col: i, row: i }, {
        id: `m_${i}`,
        type: 'mountain' as any,
        color: Color.White,
        specialType: 'mountain',
        effects: [],
      });
    }

    match.useSkill(Color.White, 'earth_earth_burst', [
      { type: 'piece', position: enemyPos, pieceId: enemy.id }
    ]);

    const reservation = state.board.getPiece(enemyPos);
    expect(reservation).toBeDefined();
    expect(reservation!.specialType).toBe('earth_reservation');

    // Attempt direct DESTROY_PIECE
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: reservation!.id,
      position: enemyPos,
      reason: 'explosion',
    });

    // Should still be there
    expect(state.board.getPiece(enemyPos)).toBeDefined();
    expect(state.board.getPiece(enemyPos)!.specialType).toBe('earth_reservation');
  });

  // E19: Ultimate — tất cả Mountain bị xóa ngay khi kích hoạt
  it('E19: Ultimate — destroys all friendly Mountain pieces immediately on activation', () => {
    const state = setupWhiteEarthTurn();
    const enemyPos = { col: 4, row: 13 };
    const enemy = state.board.getPiece(enemyPos)!;

    // Spawn 3 Mountains
    const mPositions = [{ col: 1, row: 1 }, { col: 2, row: 2 }, { col: 3, row: 3 }];
    mPositions.forEach((pos, idx) => {
      state.board.setPiece(pos, {
        id: `m_${idx}`,
        type: 'mountain' as any,
        color: Color.White,
        specialType: 'mountain',
        effects: [],
      });
    });

    match.useSkill(Color.White, 'earth_earth_burst', [
      { type: 'piece', position: enemyPos, pieceId: enemy.id }
    ]);

    // All mountains should be removed
    mPositions.forEach(pos => {
      expect(state.board.getPiece(pos)).toBeNull();
    });
  });

  // E20: Ultimate — N = số Mountain lúc kích hoạt, quân quay về sau N rounds
  // E21: Ultimate — khi hết N rounds: earth_reservation biến mất, quân địch quay về ô cũ
  it('E20 & E21: Ultimate — exiled piece returns to its original position after N rounds', () => {
    const state = setupWhiteEarthTurn();
    const enemyPos = { col: 4, row: 13 };
    const enemy = state.board.getPiece(enemyPos)!;

    // Spawn 3 Mountains (N = 3)
    for (let i = 1; i <= 3; i++) {
      state.board.setPiece({ col: i, row: i }, {
        id: `m_${i}`,
        type: 'mountain' as any,
        color: Color.White,
        specialType: 'mountain',
        effects: [],
      });
    }

    match.useSkill(Color.White, 'earth_earth_burst', [
      { type: 'piece', position: enemyPos, pieceId: enemy.id }
    ]);

    // Exiled for 3 rounds (8 turns total to allow tick timing expiration)
    // Advance 8 turns
    for (let i = 0; i < 8; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // After 3 rounds (6 turns), the reservation should be gone, and the original enemy piece should be restored
    const finalPiece = state.board.getPiece(enemyPos);
    expect(finalPiece).toBeDefined();
    expect(finalPiece!.id).toBe(enemy.id);
    expect(finalPiece!.type).toBe(enemy.type);
    expect(finalPiece!.color).toBe(enemy.color);
  });

  // E22: Regression — Mountain blocking không ảnh hưởng variant khác không phải Earth
  it('E22: Regression — Mountain blocking does not leak if Earth is not active (except that Mountain piece itself blocks, which is correct)', () => {
    // Start match without Earth variant (e.g. Lightning vs Dynamite)
    match.setVariants('lightning', 'dynamite');
    match.start();
    const state = match.getGameState();

    const rookPos = { col: 0, row: 0 };
    const mountainPos = { col: 0, row: 4 };
    const kingPos = { col: 0, row: 7 };

    state.board.setPiece(rookPos, {
      id: 'w_rook',
      type: PieceType.Rook,
      color: Color.White,
      effects: [],
    });
    state.board.setPiece(kingPos, {
      id: 'b_king',
      type: PieceType.King,
      color: Color.Black,
      effects: [],
    });
    // Set a Mountain Special Piece on board
    state.board.setPiece(mountainPos, {
      id: 'm1',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });

    // Even though Earth is not active, the Mountain piece STILL blocks sliding moves because it is a piece on the board.
    const attacked = getAttackedSquares(state.board, Color.White, state);
    expect(attacked.has('0,1')).toBe(true);
    expect(attacked.has('0,4')).toBe(false); // blocked at Mountain piece
    expect(attacked.has('0,7')).toBe(false); // cannot reach past Mountain piece
  });

  // E23: Skill 2 — target requirements validation restrict index 0 to only own Mountains
  it('E23: Skill 2 — target requirements validation restrict index 0 to only own Mountains', () => {
    const state = setupWhiteEarthTurn();
    
    // Spawn 1 own Mountain, 1 enemy Mountain, and 1 own regular pawn
    state.board.setPiece({ col: 1, row: 1 }, {
      id: 'own_m',
      type: 'mountain' as any,
      color: Color.White,
      specialType: 'mountain',
      effects: [],
    });
    
    state.board.setPiece({ col: 2, row: 2 }, {
      id: 'enemy_m',
      type: 'mountain' as any,
      color: Color.Black,
      specialType: 'mountain',
      effects: [],
    });

    state.board.setPiece({ col: 3, row: 3 }, {
      id: 'own_pawn',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [],
    });

    const serialized = match.serializeForPlayer(Color.White);
    const validPositionsForS2_T0 = serialized.availableSkillTargets['earth_shifting_peaks'].validPositions[0];

    // Should only contain { col: 1, row: 1 } (own Mountain)
    expect(validPositionsForS2_T0).toHaveLength(1);
    expect(validPositionsForS2_T0[0]).toEqual({ col: 1, row: 1 });
  });
});
