import {
  Match,
  Color,
  Position,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  BOARD_SIZE,
} from 'game-core';

describe('Chess Variant Engine - Wizard Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // Helper to find white or black king position
  function getKingPos(color: Color): Position {
    const state = match.getGameState();
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === color) {
          return { col: c, row: r };
        }
      }
    }
    throw new Error(`King of color ${color} not found`);
  }

  // Helper to prepare state for White Wizard skill usage
  function setupWhiteWizardTurn() {
    match.setVariants('wizard', 'lightning');
    match.start();
    const state = match.getGameState();
    state.whiteAP = 40;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    return state;
  }

  // ═══════════════════════════════════════════════════════
  // PASSIVE - AP ESCALATION
  // ═══════════════════════════════════════════════════════

  // W1: Passive — dùng S1 2 lần → lần dùng skill thứ 3 tốn +2 AP so với base
  it('W1: Passive — using S1 twice -> 3rd skill use costs base + 2 AP', () => {
    const state = setupWhiteWizardTurn();

    const enemyPos1 = { col: 4, row: 13 }; // Black pawn
    const enemyPos2 = { col: 5, row: 13 }; // Black pawn
    const p1 = state.board.getPiece(enemyPos1)!;
    const p2 = state.board.getPiece(enemyPos2)!;

    // Use S1 for the 1st time (costs 5 AP)
    let res = match.useSkill(Color.White, 'wizard_arcane_swap', [
      { type: 'piece', position: enemyPos1, pieceId: p1.id },
      { type: 'piece', position: enemyPos2, pieceId: p2.id },
    ]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(35); // 40 - 5

    // Reset turn limits so we can cast again
    state.skillsUsedThisTurn = 0;
    state.turnPhase = 'action';

    // Use S1 for the 2nd time (costs 5 AP, since we have only 1 completed use)
    res = match.useSkill(Color.White, 'wizard_arcane_swap', [
      { type: 'piece', position: enemyPos1, pieceId: p1.id },
      { type: 'piece', position: enemyPos2, pieceId: p2.id },
    ]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(30); // 35 - 5

    state.skillsUsedThisTurn = 0;
    state.turnPhase = 'action';

    // Use S1 for the 3rd time (now costs 7 AP, since useCount is 2)
    res = match.useSkill(Color.White, 'wizard_arcane_swap', [
      { type: 'piece', position: enemyPos1, pieceId: p1.id },
      { type: 'piece', position: enemyPos2, pieceId: p2.id },
    ]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(23); // 30 - 7
  });

  // W2: Passive — dùng S1+S2 xen kẽ vẫn cộng dồn đúng (không phân biệt loại skill)
  it('W2: Passive — alternating S1 and S2 accumulates skill use counts correctly', () => {
    const state = setupWhiteWizardTurn();

    const enemyPos1 = { col: 4, row: 13 };
    const enemyPos2 = { col: 5, row: 13 };
    const p1 = state.board.getPiece(enemyPos1)!;
    const p2 = state.board.getPiece(enemyPos2)!;

    // Use S1 (1st skill use, costs 5 AP)
    let res = match.useSkill(Color.White, 'wizard_arcane_swap', [
      { type: 'piece', position: enemyPos1, pieceId: p1.id },
      { type: 'piece', position: enemyPos2, pieceId: p2.id },
    ]);
    expect(res.success).toBe(true);

    state.skillsUsedThisTurn = 0;
    state.turnPhase = 'action';

    // Use S2 (2nd skill use, costs 4 AP)
    res = match.useSkill(Color.White, 'wizard_arcane_bind', [
      { type: 'piece', position: enemyPos1, pieceId: p1.id },
    ]);
    expect(res.success).toBe(true);

    state.skillsUsedThisTurn = 0;
    state.turnPhase = 'action';

    // Use S2 for the 3rd skill use (costs 4 + 2 = 6 AP, since useCount is 2)
    const prevAP = state.whiteAP;
    res = match.useSkill(Color.White, 'wizard_arcane_bind', [
      { type: 'piece', position: enemyPos1, pieceId: p1.id },
    ]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(prevAP - 6);
  });

  // ═══════════════════════════════════════════════════════
  // PASSIVE - DEATH COUNTER
  // ═══════════════════════════════════════════════════════

  // W3: Death Counter — quân địch bị chiếu cuối turn → +1 Death Counter
  it('W3: Death Counter — opponent piece under attack at turn end gets +1 Death Counter', () => {
    match.setVariants('wizard', 'lightning');
    match.start();
    const state = match.getGameState();

    // Place a White Rook at (0, 5) and a Black Pawn at (0, 9)
    // Rook attacks Pawn vertically (unblocked on empty row/col)
    const rookPos = { col: 0, row: 5 };
    const pawnPos = { col: 0, row: 9 };
    const whiteRook = { id: 'w_rook_dc', type: PieceType.Rook, color: Color.White, effects: [] };
    const blackPawn = { id: 'b_pawn_dc', type: PieceType.Pawn, color: Color.Black, effects: [] };

    state.board.setPiece(rookPos, whiteRook);
    state.board.setPiece(pawnPos, blackPawn);

    // End turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // The Black Pawn should now have a death_counter effect with count = 1
    const p = state.board.getPiece(pawnPos)!;
    expect(p).toBeDefined();
    const dcEffect = p.effects?.find(e => e.type === 'death_counter');
    expect(dcEffect).toBeDefined();
    expect(dcEffect!.metadata.count).toBe(1);
    expect(dcEffect!.metadata.turnsSinceLastAttacked).toBe(0);
    expect(dcEffect!.isDebuff).toBe(true);
    expect(dcEffect!.sourcePlayer).toBe(Color.White);
  });

  // W4: Death Counter — quân bị 2 quân ta chiếu cùng turn → vẫn chỉ +1 (không +2)
  it('W4: Death Counter — piece attacked by multiple friendly pieces gets only +1 per turn', () => {
    match.setVariants('wizard', 'lightning');
    match.start();
    const state = match.getGameState();

    // White Rook at (0, 5), White Bishop at (1, 8), Black Pawn at (0, 9)
    // Both Rook (0,5) and Bishop (1,8) attack Pawn (0,9) (unblocked)
    const rookPos = { col: 0, row: 5 };
    const bishopPos = { col: 1, row: 8 };
    const pawnPos = { col: 0, row: 9 };

    const whiteRook = { id: 'w_rook_dc2', type: PieceType.Rook, color: Color.White, effects: [] };
    const whiteBishop = { id: 'w_bishop_dc2', type: PieceType.Bishop, color: Color.White, effects: [] };
    const blackPawn = { id: 'b_pawn_dc2', type: PieceType.Pawn, color: Color.Black, effects: [] };

    state.board.setPiece(rookPos, whiteRook);
    state.board.setPiece(bishopPos, whiteBishop);
    state.board.setPiece(pawnPos, blackPawn);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    const p = state.board.getPiece(pawnPos)!;
    const dc = p.effects?.find(e => e.type === 'death_counter');
    expect(dc).toBeDefined();
    expect(dc!.metadata.count).toBe(1);
  });

  // W5: Death Counter — quân không bị chiếu turn này → turnsSinceLastAttacked +1
  it('W5: Death Counter — not attacked this turn -> turnsSinceLastAttacked +1', () => {
    match.setVariants('wizard', 'lightning');
    match.start();
    const state = match.getGameState();

    const pawnPos = { col: 0, row: 5 };
    const blackPawn = {
      id: 'b_pawn_dc3',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [
        {
          id: 'dc_existing',
          type: 'death_counter',
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'b_pawn_dc3',
          stackingRule: 'ignore',
          isDebuff: true,
          metadata: { count: 2, turnsSinceLastAttacked: 0 }
        }
      ]
    };
    state.board.setPiece(pawnPos, blackPawn as any);

    // End turn without any attacker on board
    match.submitAction({ type: 'END_TURN', player: Color.White });

    const p = state.board.getPiece(pawnPos)!;
    const dc = p.effects?.find(e => e.type === 'death_counter');
    expect(dc).toBeDefined();
    expect(dc!.metadata.count).toBe(2); // Count does not change
    expect(dc!.metadata.turnsSinceLastAttacked).toBe(1);
  });

  // W6: Death Counter — quân bị chiếu lại sau khi đã có turnsSinceLastAttacked > 0 → reset về 0
  it('W6: Death Counter — attacked again -> resets turnsSinceLastAttacked to 0 and increments count', () => {
    match.setVariants('wizard', 'lightning');
    match.start();
    const state = match.getGameState();

    const pawnPos = { col: 0, row: 9 };
    const rookPos = { col: 0, row: 5 };
    const whiteRook = { id: 'w_rook_dc4', type: PieceType.Rook, color: Color.White, effects: [] };
    const blackPawn = {
      id: 'b_pawn_dc4',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [
        {
          id: 'dc_existing2',
          type: 'death_counter',
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'b_pawn_dc4',
          stackingRule: 'ignore',
          isDebuff: true,
          metadata: { count: 3, turnsSinceLastAttacked: 2 }
        }
      ]
    };
    state.board.setPiece(pawnPos, blackPawn as any);
    state.board.setPiece(rookPos, whiteRook);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    const p = state.board.getPiece(pawnPos)!;
    const dc = p.effects?.find(e => e.type === 'death_counter');
    expect(dc).toBeDefined();
    expect(dc!.metadata.count).toBe(4); // 3 + 1
    expect(dc!.metadata.turnsSinceLastAttacked).toBe(0); // Reset
  });

  // W7: Death Counter — không bị chiếu đủ 6 turns (3 rounds) liên tục → effect bị remove hoàn toàn
  it('W7: Death Counter — not attacked for 6 consecutive turns -> removed completely', () => {
    match.setVariants('wizard', 'lightning');
    match.start();
    const state = match.getGameState();

    const pawnPos = { col: 0, row: 5 };
    const blackPawn = {
      id: 'b_pawn_dc5',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [
        {
          id: 'dc_existing3',
          type: 'death_counter',
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'b_pawn_dc5',
          stackingRule: 'ignore',
          isDebuff: true,
          metadata: { count: 3, turnsSinceLastAttacked: 5 } // 5 turns already missed
        }
      ]
    };
    state.board.setPiece(pawnPos, blackPawn as any);

    match.submitAction({ type: 'END_TURN', player: Color.White }); // Turn 6 missed -> Removed!

    const p = state.board.getPiece(pawnPos)!;
    expect(p.effects?.some(e => e.type === 'death_counter')).toBe(false);
  });

  // W8: Death Counter — max cap tại 6, không vượt quá dù bị chiếu thêm
  it('W8: Death Counter — count max cap at 6', () => {
    match.setVariants('wizard', 'lightning');
    match.start();
    const state = match.getGameState();

    const pawnPos = { col: 0, row: 5 };
    const rookPos = { col: 0, row: 0 };
    const whiteRook = { id: 'w_rook_dc6', type: PieceType.Rook, color: Color.White, effects: [] };
    const blackPawn = {
      id: 'b_pawn_dc6',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [
        {
          id: 'dc_existing4',
          type: 'death_counter',
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'b_pawn_dc6',
          stackingRule: 'ignore',
          isDebuff: true,
          metadata: { count: 6, turnsSinceLastAttacked: 0 }
        }
      ]
    };
    state.board.setPiece(pawnPos, blackPawn as any);
    state.board.setPiece(rookPos, whiteRook);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    const p = state.board.getPiece(pawnPos)!;
    const dc = p.effects?.find(e => e.type === 'death_counter');
    expect(dc!.metadata.count).toBe(6); // Remains 6
  });

  // W9: Death Counter — isDebuff true → Blessing có thể cleanse Death Counter
  it('W9: Death Counter — isDebuff true -> Blessing can cleanse it', () => {
    match.setVariants('wizard', 'angel');
    match.start();
    const state = match.getGameState();

    // White is Wizard, Black is Angel (has Blessing skill)
    // Give Black AP to use Blessing
    state.blackAP = 10;
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';

    const pawnPos = { col: 0, row: 5 };
    const blackPawn = {
      id: 'b_pawn_dc7',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [
        {
          id: 'dc_existing5',
          type: 'death_counter',
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'b_pawn_dc7',
          stackingRule: 'ignore',
          isDebuff: true,
          metadata: { count: 4, turnsSinceLastAttacked: 0 }
        }
      ]
    };
    state.board.setPiece(pawnPos, blackPawn as any);

    // Angel uses Blessing on the Black Pawn
    const res = match.useSkill(Color.Black, 'angel_blessing', [
      { type: 'piece', position: pawnPos, pieceId: blackPawn.id }
    ]);
    expect(res.success).toBe(true);

    // Verify death_counter is cleansed
    const p = state.board.getPiece(pawnPos)!;
    expect(p.effects?.some(e => e.type === 'death_counter')).toBe(false);
  });

  // W10: Death Counter — quân chết khi đang có Death Counter = 4 → Wizard +4 AP
  it('W10: Death Counter — piece dies -> Wizard gets AP equal to death counter count', () => {
    match.setVariants('wizard', 'lightning');
    match.start();
    const state = match.getGameState();
    state.whiteAP = 0;

    const pawnPos = { col: 0, row: 5 };
    const blackPawn = {
      id: 'b_pawn_dc8',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [
        {
          id: 'dc_existing6',
          type: 'death_counter',
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'b_pawn_dc8',
          stackingRule: 'ignore',
          isDebuff: true,
          metadata: { count: 4, turnsSinceLastAttacked: 0 }
        }
      ]
    };
    state.board.setPiece(pawnPos, blackPawn as any);

    // Destroy the Black Pawn
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: blackPawn.id,
      position: pawnPos,
      reason: 'skill'
    });

    // White Wizard should gain 4 AP
    expect(state.whiteAP).toBe(4);
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 1 - ARCANE SWAP
  // ═══════════════════════════════════════════════════════

  // W11: Skill 1 — swap vị trí 2 quân địch ngay lập tức
  it('W11: Skill 1 — swaps positions of two enemy pieces immediately', () => {
    const state = setupWhiteWizardTurn();

    const enemyPos1 = { col: 4, row: 13 };
    const enemyPos2 = { col: 5, row: 13 };
    const p1 = state.board.getPiece(enemyPos1)!;
    const p2 = state.board.getPiece(enemyPos2)!;

    const res = match.useSkill(Color.White, 'wizard_arcane_swap', [
      { type: 'piece', position: enemyPos1, pieceId: p1.id },
      { type: 'piece', position: enemyPos2, pieceId: p2.id },
    ]);
    expect(res.success).toBe(true);

    // Verify swapped
    expect(state.board.getPiece(enemyPos1)).toBe(p2);
    expect(state.board.getPiece(enemyPos2)).toBe(p1);

    // Verify effects applied
    expect(p1.effects.some(e => e.type === 'enemy_position_swap')).toBe(true);
    expect(p2.effects.some(e => e.type === 'enemy_position_swap')).toBe(true);
  });

  // W12: Skill 1 — sau 4 turns (2 rounds) → revert vị trí hiện tại
  it('W12: Skill 1 — reverts positions after 4 turns', () => {
    const state = setupWhiteWizardTurn();

    const enemyPos1 = { col: 4, row: 13 };
    const enemyPos2 = { col: 5, row: 13 };
    const p1 = state.board.getPiece(enemyPos1)!;
    const p2 = state.board.getPiece(enemyPos2)!;

    match.useSkill(Color.White, 'wizard_arcane_swap', [
      { type: 'piece', position: enemyPos1, pieceId: p1.id },
      { type: 'piece', position: enemyPos2, pieceId: p2.id },
    ]);

    // Simulate moving them to different squares while swapped
    // Move p1 (currently at enemyPos2) to a new cell
    const posC = { col: 6, row: 12 };
    state.board.movePiece(enemyPos2, posC); // p1 is now at posC, p2 is at enemyPos1

    // Advance 5 turns to expire the effect completely on Black pieces
    for (let i = 0; i < 5; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // They should swap current positions: p1 goes to enemyPos1, p2 goes to posC
    expect(state.board.getPiece(enemyPos1)).toBe(p1);
    expect(state.board.getPiece(posC)).toBe(p2);

    // Verify effects removed
    expect(p1.effects.some(e => e.type === 'enemy_position_swap')).toBe(false);
    expect(p2.effects.some(e => e.type === 'enemy_position_swap')).toBe(false);
  });

  // W13: Skill 1 — 1 quân chết trong window → cancel, KHÔNG có Shield/hiệu ứng phụ
  it('W13: Skill 1 — one swap target dies -> cancels swap effect on partner with no side effects', () => {
    const state = setupWhiteWizardTurn();

    const enemyPos1 = { col: 4, row: 13 };
    const enemyPos2 = { col: 5, row: 13 };
    const p1 = state.board.getPiece(enemyPos1)!;
    const p2 = state.board.getPiece(enemyPos2)!;

    match.useSkill(Color.White, 'wizard_arcane_swap', [
      { type: 'piece', position: enemyPos1, pieceId: p1.id },
      { type: 'piece', position: enemyPos2, pieceId: p2.id },
    ]);

    // Destroy p1 (currently at enemyPos2)
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: p1.id,
      position: enemyPos2,
      reason: 'skill'
    });

    // Verify partner p2 still alive at enemyPos1, swap effect removed, and no shield applied
    const remainingP2 = state.board.getPiece(enemyPos1)!;
    expect(remainingP2).toBe(p2);
    expect(remainingP2.effects.some(e => e.type === 'enemy_position_swap')).toBe(false);
    expect(remainingP2.effects.some(e => e.type === 'shield')).toBe(false);
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 2 - ARCANE BIND
  // ═══════════════════════════════════════════════════════

  // W14: Skill 2 — apply Bind lên quân địch, vùng 5x5 giới hạn legal moves
  it('W14: Skill 2 — applies bind and limits moves to a 5x5 area', () => {
    const state = setupWhiteWizardTurn();

    // Place a Black Rook at (7, 7) (middle of the board)
    const rookPos = { col: 7, row: 7 };
    const blackRook = { id: 'b_rook_bind', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(rookPos, blackRook as any);

    // Get normal moves baseline
    const normalMoves = match.getLegalMovesAt(rookPos);
    expect(normalMoves.length).toBeGreaterThan(0);

    // Apply Bind
    const res = match.useSkill(Color.White, 'wizard_arcane_bind', [
      { type: 'piece', position: rookPos, pieceId: blackRook.id }
    ]);
    expect(res.success).toBe(true);

    // Bound Rook's moves should be restricted
    const boundMoves = match.getLegalMovesAt(rookPos);
    expect(boundMoves.length).toBeLessThan(normalMoves.length);
    for (const m of boundMoves) {
      expect(Math.abs(m.col - 7)).toBeLessThanOrEqual(2);
      expect(Math.abs(m.row - 7)).toBeLessThanOrEqual(2);
    }
  });

  // W15: Skill 2 — quân bị Bind di chuyển trong vùng vẫn hợp lệ, ra ngoài vùng bị chặn
  it('W15: Skill 2 — movement within the 5x5 bind zone is allowed', () => {
    const state = setupWhiteWizardTurn();

    const rookPos = { col: 7, row: 7 };
    const blackRook = { id: 'b_rook_bind2', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(rookPos, blackRook as any);

    match.useSkill(Color.White, 'wizard_arcane_bind', [
      { type: 'piece', position: rookPos, pieceId: blackRook.id }
    ]);

    // End White turn so Black can move
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Move to (7, 9) (within 5x5) -> Success
    const destIn = { col: 7, row: 9 };
    const moveRes = match.makeMove(Color.Black, rookPos, destIn);
    expect(moveRes.success).toBe(true);

    // Try to move from (7, 9) to (7, 5) (Rook is now at 7,9; 5x5 center is 7,9; 7,5 is col-diff=0, row-diff=4 > 2) -> Blocked
    const destOut = { col: 7, row: 5 };
    const illegalMove = match.makeMove(Color.Black, destIn, destOut);
    expect(illegalMove.success).toBe(false);
  });

  // W16: Skill 2 — quân bị Bind di chuyển (trong vùng), vùng 5x5 tính lại theo vị trí mới
  it('W16: Skill 2 — bind zone center follows the piece to its new position', () => {
    const state = setupWhiteWizardTurn();

    const rookPos = { col: 7, row: 7 };
    const blackRook = { id: 'b_rook_bind3', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(rookPos, blackRook as any);

    match.useSkill(Color.White, 'wizard_arcane_bind', [
      { type: 'piece', position: rookPos, pieceId: blackRook.id }
    ]);

    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Move Rook to (7, 8)
    const newPos = { col: 7, row: 8 };
    match.makeMove(Color.Black, rookPos, newPos);

    // Now bind zone is centered at (7,8). Range: col [5, 9], row [6, 10]
    // Rook at (7,8) wants to move to (7,10) (row-diff=2) -> Allowed
    const moves = match.getLegalMovesAt(newPos);
    expect(moves.some(m => m.col === 7 && m.row === 10)).toBe(true);

    // Rook at (7,8) wants to move to (7,5) (row-diff=3) -> Not allowed
    expect(moves.some(m => m.col === 7 && m.row === 5)).toBe(false);
  });

  // W17: Skill 2 — sau 6 turns (3 rounds) → Bind hết, quân di chuyển tự do trở lại
  it('W17: Skill 2 — bind effect expires after 6 turns', () => {
    const state = setupWhiteWizardTurn();

    const rookPos = { col: 7, row: 7 };
    const blackRook = { id: 'b_rook_bind4', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece(rookPos, blackRook as any);

    const normalMoves = match.getLegalMovesAt(rookPos);

    match.useSkill(Color.White, 'wizard_arcane_bind', [
      { type: 'piece', position: rookPos, pieceId: blackRook.id }
    ]);

    // Advance 7 turns to expire effect
    for (let i = 0; i < 7; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Rook should have full movement freedom again
    const moves = match.getLegalMovesAt(rookPos);
    expect(moves.length).toBe(normalMoves.length);
  });

  // ═══════════════════════════════════════════════════════
  // ULTIMATE - ARCANE ANNIHILATION
  // ═══════════════════════════════════════════════════════

  // W18: Ultimate — 0 quân Death Counter=6 → canActivate reject
  it('W18: Ultimate — cannot activate with 0 targets at 6 Death Counter', () => {
    const state = setupWhiteWizardTurn();

    // No pieces with death_counter=6
    const res = match.useSkill(Color.White, 'wizard_arcane_annihilation', []);
    expect(res.success).toBe(false);
  });

  // W19: Ultimate — 1 quân Death Counter=6 → cost 14 AP, destroy đúng quân đó
  it('W19: Ultimate — 1 target at 6 Death Counter costs 14 AP and destroys it', () => {
    const state = setupWhiteWizardTurn();
    state.whiteAP = 20;

    const pawnPos = { col: 4, row: 13 };
    const blackPawn = state.board.getPiece(pawnPos)!;
    blackPawn.effects = [
      {
        id: 'dc_max',
        type: 'death_counter',
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: blackPawn.id,
        stackingRule: 'ignore',
        isDebuff: true,
        metadata: { count: 6, turnsSinceLastAttacked: 0 }
      }
    ];

    const res = match.useSkill(Color.White, 'wizard_arcane_annihilation', []);
    expect(res.success).toBe(true);

    // Target is destroyed
    expect(state.board.getPiece(pawnPos)).toBeNull();

    // Cost 14 AP spent, plus gained 6 AP from death counter of pawn dying
    expect(state.whiteAP).toBe(20 - 14 + 6); // 12 AP remaining
  });

  // W20: Ultimate — 3 quân Death Counter=6 → cost 12 AP, destroy cả 3
  it('W20: Ultimate — 3 targets at 6 Death Counter cost 12 AP and destroys all 3', () => {
    const state = setupWhiteWizardTurn();
    state.whiteAP = 30;

    const p1 = { col: 4, row: 13 };
    const p2 = { col: 3, row: 13 };
    const p3 = { col: 5, row: 13 };
    const pawn1 = state.board.getPiece(p1)!;
    const pawn2 = state.board.getPiece(p2)!;
    const pawn3 = state.board.getPiece(p3)!;

    const makeDcMax = (id: string) => ({
      id: `dc_max_${id}`,
      type: 'death_counter' as const,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd' as const,
      sourcePlayer: Color.White,
      targetType: 'piece' as const,
      targetId: id,
      stackingRule: 'ignore' as const,
      isDebuff: true,
      metadata: { count: 6, turnsSinceLastAttacked: 0 }
    });

    pawn1.effects = [makeDcMax(pawn1.id)];
    pawn2.effects = [makeDcMax(pawn2.id)];
    pawn3.effects = [makeDcMax(pawn3.id)];

    const res = match.useSkill(Color.White, 'wizard_arcane_annihilation', []);
    expect(res.success).toBe(true);

    // All three are destroyed
    expect(state.board.getPiece(p1)).toBeNull();
    expect(state.board.getPiece(p2)).toBeNull();
    expect(state.board.getPiece(p3)).toBeNull();

    // Cost 12 AP, and gain 18 AP (3 * 6)
    expect(state.whiteAP).toBe(30 - 12 + 18);
  });

  // W21: Ultimate — 5 quân Death Counter=6 → cost 10 AP
  it('W21: Ultimate — 5 targets at 6 Death Counter cost 10 AP', () => {
    const state = setupWhiteWizardTurn();
    state.whiteAP = 30;

    const positions = [
      { col: 4, row: 13 },
      { col: 3, row: 13 },
      { col: 5, row: 13 },
      { col: 2, row: 13 },
      { col: 6, row: 13 }
    ];

    positions.forEach(pos => {
      const piece = state.board.getPiece(pos)!;
      piece.effects = [
        {
          id: `dc_max_${piece.id}`,
          type: 'death_counter',
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: piece.id,
          stackingRule: 'ignore',
          isDebuff: true,
          metadata: { count: 6, turnsSinceLastAttacked: 0 }
        }
      ];
    });

    const res = match.useSkill(Color.White, 'wizard_arcane_annihilation', []);
    expect(res.success).toBe(true);
    // Cost 10 AP, and gain 30 AP (5 * 6)
    expect(state.whiteAP).toBe(30 - 10 + 30);
  });

  // W22: Ultimate — 6+ quân Death Counter=6 → cost 8 AP
  it('W22: Ultimate — 6 targets at 6 Death Counter cost 8 AP', () => {
    const state = setupWhiteWizardTurn();
    state.whiteAP = 30;

    const positions = [
      { col: 4, row: 13 },
      { col: 3, row: 13 },
      { col: 5, row: 13 },
      { col: 2, row: 13 },
      { col: 6, row: 13 },
      { col: 1, row: 13 }
    ];

    positions.forEach(pos => {
      const piece = state.board.getPiece(pos)!;
      piece.effects = [
        {
          id: `dc_max_${piece.id}`,
          type: 'death_counter',
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: piece.id,
          stackingRule: 'ignore',
          isDebuff: true,
          metadata: { count: 6, turnsSinceLastAttacked: 0 }
        }
      ];
    });

    const res = match.useSkill(Color.White, 'wizard_arcane_annihilation', []);
    expect(res.success).toBe(true);
    // Cost 8 AP, and gain 36 AP (6 * 6)
    expect(state.whiteAP).toBe(30 - 8 + 36);
  });

  // ═══════════════════════════════════════════════════════
  // MIRROR MATCH - WIZARD VS WIZARD
  // ═══════════════════════════════════════════════════════

  // W23: Wizard vs Wizard
  it('W23: Wizard vs Wizard — independent death counters and ultimate targets', () => {
    match.setVariants('wizard', 'wizard');
    match.start();
    const state = match.getGameState();

    state.whiteAP = 20;
    state.blackAP = 20;

    // Place White Rook at (0, 5) attacking Black Pawn at (0, 9)
    const whiteRook = { id: 'w_rook_mirror', type: PieceType.Rook, color: Color.White, effects: [] };
    const blackPawn = { id: 'b_pawn_mirror', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 5 }, whiteRook);
    state.board.setPiece({ col: 0, row: 9 }, blackPawn);

    // Place Black Rook at (7, 5) attacking White Pawn at (7, 9)
    const blackRook2 = { id: 'b_rook_mirror2', type: PieceType.Rook, color: Color.Black, effects: [] };
    const whitePawn2 = { id: 'w_pawn_mirror2', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 7, row: 5 }, blackRook2);
    state.board.setPiece({ col: 7, row: 9 }, whitePawn2);

    // End turn White -> triggers Death Counter for White attacking Black
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Verify Black Pawn has a death_counter with sourcePlayer = White
    const bp = state.board.getPiece({ col: 0, row: 9 })!;
    const bpDc = bp.effects?.find(e => e.type === 'death_counter');
    expect(bpDc).toBeDefined();
    expect(bpDc!.sourcePlayer).toBe(Color.White);
    expect(bpDc!.metadata.count).toBe(1);

    // End turn Black -> triggers Death Counter for Black attacking White
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Verify White Pawn has a death_counter with sourcePlayer = Black
    const wp = state.board.getPiece({ col: 7, row: 9 })!;
    const wpDc = wp.effects?.find(e => e.type === 'death_counter');
    expect(wpDc).toBeDefined();
    expect(wpDc!.sourcePlayer).toBe(Color.Black);
    expect(wpDc!.metadata.count).toBe(2);

    // Check Ultimate restriction: Let's manually set count to 6
    bpDc!.metadata.count = 6; // Black Pawn has 6 DC from White
    wpDc!.metadata.count = 6; // White Pawn has 6 DC from Black

    // Currently it's White's turn again.
    // White Wizard has 20 AP and uses Ultimate. It should only target bp (which has DC=6 from White)
    // and NOT WP (which has DC=6 from Black).
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const resWhite = match.useSkill(Color.White, 'wizard_arcane_annihilation', []);
    expect(resWhite.success).toBe(true);

    // Verify Black Pawn is destroyed, but White Pawn is still alive
    expect(state.board.getPiece({ col: 0, row: 9 })).toBeNull();
    expect(state.board.getPiece({ col: 7, row: 9 })).toBe(wp);

    // White Wizard should gain 6 AP for destroying bp, and spend 14 AP
    expect(state.whiteAP).toBe(20 - 14 + 6);
  });
});
