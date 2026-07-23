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

describe('Chess Variant Engine - Magician Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 1 — Now You See Me (Ally Swap)
  // ═══════════════════════════════════════════════════════

  // M1: Skill 1 — swap vị trí 2 quân thành công ngay lập tức
  it('M1: Skill 1 — swap positions of 2 ally pieces immediately', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const posA = { col: 4, row: 1 }; // White pawn
    const posB = { col: 3, row: 0 }; // White Queen (or Bishop/etc. let's just grab the pieces at those positions)
    const pieceA = state.board.getPiece(posA)!;
    const pieceB = state.board.getPiece(posB)!;

    const res = match.useSkill(Color.White, 'magician_swap_allies', [
      { type: 'piece', position: posA, pieceId: pieceA.id },
      { type: 'piece', position: posB, pieceId: pieceB.id },
    ]);

    expect(res.success).toBe(true);

    // Verify pieces swapped immediately
    expect(state.board.getPiece(posA)).toBe(pieceB);
    expect(state.board.getPiece(posB)).toBe(pieceA);

    // Verify effects applied
    expect(pieceA.effects.some(e => e.type === 'position_swap')).toBe(true);
    expect(pieceB.effects.some(e => e.type === 'position_swap')).toBe(true);
  });

  // M2: Skill 1 — không thể target King
  it('M2: Skill 1 — cannot target King', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Find White King
    let kingPos = { col: -1, row: -1 };
    let kingId = '';
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.White) {
          kingPos = { col: c, row: r };
          kingId = p.id;
          break;
        }
      }
    }

    const posAlly = { col: 4, row: 1 };
    const ally = state.board.getPiece(posAlly)!;

    const res = match.useSkill(Color.White, 'magician_swap_allies', [
      { type: 'piece', position: kingPos, pieceId: kingId },
      { type: 'piece', position: posAlly, pieceId: ally.id },
    ]);

    expect(res.success).toBe(false);
  });

  // M3: Skill 1 — sau 6 turns: auto-revert về vị trí hiện tại
  it('M3: Skill 1 — after 6 turns: swap back current positions', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const posA = { col: 4, row: 1 };
    const posB = { col: 3, row: 1 };
    const pieceA = state.board.getPiece(posA)!;
    const pieceB = state.board.getPiece(posB)!;

    // Swap A and B. A goes to posB, B goes to posA.
    const res = match.useSkill(Color.White, 'magician_swap_allies', [
      { type: 'piece', position: posA, pieceId: pieceA.id },
      { type: 'piece', position: posB, pieceId: pieceB.id },
    ]);
    expect(res.success).toBe(true);

    // Swap B to posC (which is empty) to simulate di chuyển tự do.
    // Wait, let's manually move pieceA (currently at posB) to posC:
    const posC = { col: 5, row: 2 };
    state.board.movePiece(posB, posC); // pieceA is now at posC. pieceB is at posA.

    // Advance 8 turns (since the first White turn end tick is skipped as the effect was applied in the same turn)
    for (let i = 0; i < 8; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Now they should swap their current positions (posC and posA).
    // pieceA (which was at posC) goes to posA. pieceB (which was at posA) goes to posC.
    expect(state.board.getPiece(posA)).toBe(pieceA);
    expect(state.board.getPiece(posC)).toBe(pieceB);

    // Verify effects removed
    expect(pieceA.effects.some(e => e.type === 'position_swap')).toBe(false);
    expect(pieceB.effects.some(e => e.type === 'position_swap')).toBe(false);
  });

  // M4: Skill 1 — 1 quân chết trong window → quân còn lại nhận Shield 4 turns
  it('M4: Skill 1 — 1 piece dies → partner gets Shield for 4 turns', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const posA = { col: 4, row: 1 };
    const posB = { col: 3, row: 1 };
    const pieceA = state.board.getPiece(posA)!;
    const pieceB = state.board.getPiece(posB)!;

    // Swap
    match.useSkill(Color.White, 'magician_swap_allies', [
      { type: 'piece', position: posA, pieceId: pieceA.id },
      { type: 'piece', position: posB, pieceId: pieceB.id },
    ]);

    // Destroy piece A (currently at posB)
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: pieceA.id,
      position: posB,
      reason: 'skill',
    });

    // Piece A is dead
    expect(state.board.getPiece(posB)).toBeNull();

    // Piece B (at posA) should still be alive, swap effect removed, and should have Shield effect applied
    const remainingPieceB = state.board.getPiece(posA)!;
    expect(remainingPieceB).toBe(pieceB);
    expect(remainingPieceB.effects.some(e => e.type === 'position_swap')).toBe(false);

    const shield = remainingPieceB.effects.find(e => e.type === 'shield');
    expect(shield).toBeDefined();
    expect(shield!.duration).toBe(2);
    expect(shield!.remainingDuration).toBe(2);
  });

  // M5: Skill 1 — 1 quân chết trong window → KHÔNG revert
  it('M5: Skill 1 — 1 piece dies → NO swap revert occurs', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const posA = { col: 4, row: 1 };
    const posB = { col: 3, row: 1 };
    const pieceA = state.board.getPiece(posA)!;
    const pieceB = state.board.getPiece(posB)!;

    // Swap
    match.useSkill(Color.White, 'magician_swap_allies', [
      { type: 'piece', position: posA, pieceId: pieceA.id },
      { type: 'piece', position: posB, pieceId: pieceB.id },
    ]);

    // Destroy piece A (at posB)
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: pieceA.id,
      position: posB,
      reason: 'skill',
    });

    // Advance 6 turns
    for (let i = 0; i < 6; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Piece B should still be at posA (no swap revert happened since piece A is dead)
    expect(state.board.getPiece(posA)).toBe(pieceB);
    expect(state.board.getPiece(posB)).toBeNull();
  });

  // ═══════════════════════════════════════════════════════
  // SKILL 2 — Misdirection (Moveset Swap)
  // ═══════════════════════════════════════════════════════

  // M6: Skill 2 — swap move-set, quân di chuyển theo type mới
  it('M6: Skill 2 — swaps moveset of two enemy pieces', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPosA = { col: 4, row: 13 }; // Black Pawn
    const enemyPosB = { col: 6, row: 14 }; // Black Queen
    const pieceA = state.board.getPiece(enemyPosA)!;
    const pieceB = state.board.getPiece(enemyPosB)!;

    const res = match.useSkill(Color.White, 'magician_swap_movements', [
      { type: 'piece', position: enemyPosA, pieceId: pieceA.id },
      { type: 'piece', position: enemyPosB, pieceId: pieceB.id },
    ]);

    expect(res.success).toBe(true);

    // Verify types swapped on board
    expect(pieceA.type).toBe(PieceType.Queen);
    expect(pieceB.type).toBe(PieceType.Pawn);

    // Verify effects applied with originalType metadata
    const effectA = pieceA.effects.find(e => e.type === 'moveset_swap')!;
    const effectB = pieceB.effects.find(e => e.type === 'moveset_swap')!;
    expect(effectA).toBeDefined();
    expect(effectB).toBeDefined();
    expect(effectA.metadata.originalType).toBe(PieceType.Pawn);
    expect(effectB.metadata.originalType).toBe(PieceType.Queen);
    expect(effectA.isDebuff).toBe(false);
    expect(effectB.isDebuff).toBe(false);
  });

  // M7: Skill 2 — không thể target King
  it('M7: Skill 2 — cannot target King', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Find Black King
    let kingPos = { col: -1, row: -1 };
    let kingId = '';
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.Black) {
          kingPos = { col: c, row: r };
          kingId = p.id;
          break;
        }
      }
    }

    const enemyPos = { col: 4, row: 13 };
    const enemy = state.board.getPiece(enemyPos)!;

    const res = match.useSkill(Color.White, 'magician_swap_movements', [
      { type: 'piece', position: kingPos, pieceId: kingId },
      { type: 'piece', position: enemyPos, pieceId: enemy.id },
    ]);

    expect(res.success).toBe(false);
  });

  // M8: Skill 2 — AttackDetection tính theo type mới
  it('M8: Skill 2 — AttackDetection uses swapped type', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPosA = { col: 4, row: 13 }; // Black Pawn
    const enemyPosB = { col: 6, row: 14 }; // Black Queen
    const pieceA = state.board.getPiece(enemyPosA)!;
    const pieceB = state.board.getPiece(enemyPosB)!;

    // Swap movements
    match.useSkill(Color.White, 'magician_swap_movements', [
      { type: 'piece', position: enemyPosA, pieceId: pieceA.id },
      { type: 'piece', position: enemyPosB, pieceId: pieceB.id },
    ]);

    // Check legal moves of the disguised Pawn (now type Queen)
    // Since it's a Queen now, it should have Queen moves, not Pawn moves!
    const legalMoves = match.getLegalMovesAt(enemyPosA);
    // Pawn has only forward moves, but Queen has diagonal/straight paths.
    // It should have way more moves than a pawn (Pawn at row 13 moving down has max 2 moves, Queen has 15+).
    expect(legalMoves.length).toBeGreaterThan(2);
  });

  // M9: Skill 2 — sau 6 turns: auto-revert type về ban đầu
  it('M9: Skill 2 — after 6 turns: auto-revert types back to original', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPosA = { col: 4, row: 13 }; // Black Pawn
    const enemyPosB = { col: 6, row: 14 }; // Black Queen
    const pieceA = state.board.getPiece(enemyPosA)!;
    const pieceB = state.board.getPiece(enemyPosB)!;

    // Swap movements
    match.useSkill(Color.White, 'magician_swap_movements', [
      { type: 'piece', position: enemyPosA, pieceId: pieceA.id },
      { type: 'piece', position: enemyPosB, pieceId: pieceB.id },
    ]);

    // Advance 6 turns
    for (let i = 0; i < 6; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // Verify types reverted
    expect(pieceA.type).toBe(PieceType.Pawn);
    expect(pieceB.type).toBe(PieceType.Queen);
  });

  // M10: Skill 2 — pawn promotion: Pawn-disguised-as-Queen promote / Queen-disguised-as-Pawn no promote
  it('M10: Skill 2 — pawn promotion checks original type and removes swap effect', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Set up a custom state:
    // Black Pawn at row 1, and Black Queen at row 13
    const pawnPos = { col: 2, row: 1 };
    const queenPos = { col: 2, row: 13 };
    const blackPawn = { id: 'b_pawn_promo', type: PieceType.Pawn, color: Color.Black, effects: [] as Effect[] };
    const blackQueen = { id: 'b_queen_promo', type: PieceType.Queen, color: Color.Black, effects: [] as Effect[] };
    state.board.setPiece(pawnPos, blackPawn);
    state.board.setPiece(queenPos, blackQueen);

    // Clear destination square (col: 2, row: 0) so the move is a normal MOVE_PIECE (not capture)
    state.board.removePiece({ col: 2, row: 0 });

    // Swap movements
    // Black Pawn is disguised as Queen. Black Queen is disguised as Pawn.
    const res = match.useSkill(Color.White, 'magician_swap_movements', [
      { type: 'piece', position: pawnPos, pieceId: blackPawn.id },
      { type: 'piece', position: queenPos, pieceId: blackQueen.id },
    ]);
    expect(res.success).toBe(true);

    expect(blackPawn.type).toBe(PieceType.Queen);
    expect(blackQueen.type).toBe(PieceType.Pawn);

    // End White's turn so that Black can move their piece legally
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Move Pawn-disguised-as-Queen (at row 1) to row 0 (Black promotion row)
    const destPromo = { col: 2, row: 0 };
    
    // Trigger promotion check via action pipeline executing MOVE_PIECE
    const moveRes = match.submitAction({
      type: 'MOVE_PIECE',
      pieceId: blackPawn.id,
      from: pawnPos,
      to: destPromo,
    });
    expect(moveRes.success).toBe(true);

    // Black Pawn-disguised-as-Queen should promote and its moveset_swap effect should be removed
    const latestState = match.getGameState();
    const promotedPawn = latestState.board.getPiece(destPromo)!;
    const revertedQueen = latestState.board.getPiece(queenPos)!;

    expect(promotedPawn.type).toBe(PieceType.Queen);
    expect(promotedPawn.effects.some(e => e.type === 'moveset_swap')).toBe(false);
    expect(revertedQueen.effects.some(e => e.type === 'moveset_swap')).toBe(false);
    // Queen disguised as pawn should revert back to Queen
    expect(revertedQueen.type).toBe(PieceType.Queen);
  });

  // M11: Skill 2 — 1 quân chết trong window → quân còn lại nhận Stun 2 rounds + revert type ngay
  it('M11: Skill 2 — 1 piece dies -> partner is Stunned for 4 turns and reverts type immediately', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPosA = { col: 4, row: 13 }; // Black Pawn
    const enemyPosB = { col: 6, row: 14 }; // Black Queen
    const pieceA = state.board.getPiece(enemyPosA)!;
    const pieceB = state.board.getPiece(enemyPosB)!;

    // Swap
    match.useSkill(Color.White, 'magician_swap_movements', [
      { type: 'piece', position: enemyPosA, pieceId: pieceA.id },
      { type: 'piece', position: enemyPosB, pieceId: pieceB.id },
    ]);

    // Destroy piece A (currently at row 13)
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: pieceA.id,
      position: enemyPosA,
      reason: 'skill',
    });

    // Piece A is dead
    expect(state.board.getPiece(enemyPosA)).toBeNull();

    // Piece B should revert to Queen immediately and receive Stun for 4 turns
    const remainingB = state.board.getPiece(enemyPosB)!;
    expect(remainingB).toBe(pieceB);
    expect(remainingB.type).toBe(PieceType.Queen);
    expect(remainingB.effects.some(e => e.type === 'moveset_swap')).toBe(false);

    const stun = remainingB.effects.find(e => e.type === 'stun');
    expect(stun).toBeDefined();
    expect(stun!.duration).toBe(2);
  });

  // ═══════════════════════════════════════════════════════
  // ULTIMATE — Carnival of Fools
  // ═══════════════════════════════════════════════════════

  // M12: Ultimate — apply Fool lên tối đa 5 quân (ally + enemy)
  it('M12: Ultimate — apply Fool to up to 5 pieces (ally + enemy)', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = { col: 4, row: 1 }; // White pawn
    const p2 = { col: 3, row: 1 }; // White pawn
    const p3 = { col: 5, row: 1 }; // White pawn
    const p4 = { col: 4, row: 13 }; // Black pawn
    const p5 = { col: 3, row: 13 }; // Black pawn

    const target1 = state.board.getPiece(p1)!;
    const target2 = state.board.getPiece(p2)!;
    const target3 = state.board.getPiece(p3)!;
    const target4 = state.board.getPiece(p4)!;
    const target5 = state.board.getPiece(p5)!;

    const res = match.useSkill(Color.White, 'magician_fool', [
      { type: 'piece', position: p1, pieceId: target1.id },
      { type: 'piece', position: p2, pieceId: target2.id },
      { type: 'piece', position: p3, pieceId: target3.id },
      { type: 'piece', position: p4, pieceId: target4.id },
      { type: 'piece', position: p5, pieceId: target5.id },
    ]);

    expect(res.success).toBe(true);

    expect(target1.effects.some(e => e.type === 'fool')).toBe(true);
    expect(target2.effects.some(e => e.type === 'fool')).toBe(true);
    expect(target3.effects.some(e => e.type === 'fool')).toBe(true);
    expect(target4.effects.some(e => e.type === 'fool')).toBe(true);
    expect(target5.effects.some(e => e.type === 'fool')).toBe(true);
  });

  // M13: Ultimate — không thể target King
  it('M13: Ultimate — cannot target King', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // White King
    let kingPos = { col: -1, row: -1 };
    let kingId = '';
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.White) {
          kingPos = { col: c, row: r };
          kingId = p.id;
          break;
        }
      }
    }

    const res = match.useSkill(Color.White, 'magician_fool', [
      { type: 'piece', position: kingPos, pieceId: kingId },
    ]);

    expect(res.success).toBe(false);
  });

  // M14: Fool — White piece trigger ở lượt White, di chuyển row tăng
  it('M14: Fool — White piece moves forward (row increases) on White turn start', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const startPos = { col: 4, row: 4 };
    const whitePiece = { id: 'w_fool_pawn', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece(startPos, whitePiece);

    // Apply Fool effect
    match.useSkill(Color.White, 'magician_fool', [
      { type: 'piece', position: startPos, pieceId: whitePiece.id },
    ]);

    // End turn to White
    match.submitAction({ type: 'END_TURN', player: Color.White }); // Black turn
    match.submitAction({ type: 'END_TURN', player: Color.Black }); // White turn (triggers OnTurnStart)

    // Verify it moved from (4, 4) to (4, 5)
    expect(state.board.getPiece(startPos)).toBeNull();
    expect(state.board.getPiece({ col: 4, row: 5 })).toBe(whitePiece);
  });

  // M15: Fool — Black piece trigger ở lượt Black, di chuyển row giảm
  it('M15: Fool — Black piece moves forward (row decreases) on Black turn start', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const startPos = { col: 4, row: 10 };
    const blackPiece = { id: 'b_fool_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] as Effect[] };
    state.board.setPiece(startPos, blackPiece);

    // Apply Fool effect
    match.useSkill(Color.White, 'magician_fool', [
      { type: 'piece', position: startPos, pieceId: blackPiece.id },
    ]);

    // End White turn to trigger Black turn start
    match.submitAction({ type: 'END_TURN', player: Color.White }); // Black turn start!

    // Verify it moved from (4, 10) to (4, 9)
    expect(state.board.getPiece(startPos)).toBeNull();
    expect(state.board.getPiece({ col: 4, row: 9 })).toBe(blackPiece);
  });

  // M16: Fool — ô phía trước có vật cản → đứng yên, không lỗi
  it('M16: Fool — blocked destination -> stands still', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const startPos = { col: 4, row: 4 };
    const whitePiece = { id: 'w_fool_pawn2', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece(startPos, whitePiece);

    // Place obstacle piece directly in front (4, 5)
    const blockPos = { col: 4, row: 5 };
    const blockPiece = { id: 'w_blocker', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece(blockPos, blockPiece);

    // Apply Fool effect
    match.useSkill(Color.White, 'magician_fool', [
      { type: 'piece', position: startPos, pieceId: whitePiece.id },
    ]);

    // End turn and loop back to White turn start
    match.submitAction({ type: 'END_TURN', player: Color.White }); // Black
    match.submitAction({ type: 'END_TURN', player: Color.Black }); // White turn start

    // Both should still be at their positions
    expect(state.board.getPiece(startPos)).toBe(whitePiece);
    expect(state.board.getPiece(blockPos)).toBe(blockPiece);
  });

  // M17: Fool — auto-move không tốn lượt, player vẫn move/skill bình thường sau đó
  it('M17: Fool — does not consume the player\'s move', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const startPos = { col: 4, row: 4 };
    const whitePiece = { id: 'w_fool_pawn3', type: PieceType.Pawn, color: Color.White, effects: [] as Effect[] };
    state.board.setPiece(startPos, whitePiece);

    // Apply Fool effect
    match.useSkill(Color.White, 'magician_fool', [
      { type: 'piece', position: startPos, pieceId: whitePiece.id },
    ]);

    // End turn and loop back to White turn start
    match.submitAction({ type: 'END_TURN', player: Color.White }); // Black
    match.submitAction({ type: 'END_TURN', player: Color.Black }); // White turn start (forces Fool move to 4, 5)

    // Player should NOT have hasMoved set to true
    expect(state.hasMoved).toBe(false);

    // Verify whitePiece is at (4, 5)
    const currentPos = { col: 4, row: 5 };
    expect(state.board.getPiece(currentPos)).toBe(whitePiece);

    // Give White enough AP so the turn does not auto-end after the move
    state.whiteAP = 10;
    // Player can still move whitePiece normally (e.g. from 4, 5 to 4, 6)
    const destPos = { col: 4, row: 6 };
    const moveRes = match.makeMove(Color.White, currentPos, destPos);
    expect(moveRes.success).toBe(true);
    expect(state.board.getPiece(destPos)).toBe(whitePiece);
    expect(state.hasMoved).toBe(true);
  });

  // M18: Fool — quân địch bị Fool (từ Ultimate) trigger đúng lượt của địch, không phải lượt Magician
  it('M18: Fool — enemy piece triggers on enemy turn start, not Magician\'s turn', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Black piece at (4, 13)
    const blackPos = { col: 4, row: 13 };
    const blackPiece = state.board.getPiece(blackPos)!;

    // Apply Fool on Black piece (Magician is White)
    match.useSkill(Color.White, 'magician_fool', [
      { type: 'piece', position: blackPos, pieceId: blackPiece.id },
    ]);

    // Black piece should still be at (4, 10) on White's turn (didn't move yet)
    expect(state.board.getPiece(blackPos)).toBe(blackPiece);

    // End White turn → Black turn starts (triggers Fool move for Black piece)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Verify Black piece moved down to (4, 12)
    expect(state.board.getPiece(blackPos)).toBeNull();
    expect(state.board.getPiece({ col: 4, row: 12 })).toBe(blackPiece);
  });

  // M19: Double-trigger prevention on simultaneous position_swap expiry
  it('M19: Skill 1 — double-trigger prevention on simultaneous position_swap expiry', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const posA = { col: 4, row: 1 }; // White pawn
    const posB = { col: 3, row: 1 }; // White pawn
    const pieceA = state.board.getPiece(posA)!;
    const pieceB = state.board.getPiece(posB)!;

    // A is at posA, B is at posB.
    // Swap A and B: A goes to posB, B goes to posA.
    const res = match.useSkill(Color.White, 'magician_swap_allies', [
      { type: 'piece', position: posA, pieceId: pieceA.id },
      { type: 'piece', position: posB, pieceId: pieceB.id },
    ]);
    expect(res.success).toBe(true);

    // Verify they swapped
    expect(state.board.getPiece(posA)).toBe(pieceB);
    expect(state.board.getPiece(posB)).toBe(pieceA);

    // Keep their positions as posA and posB (do not move them)
    // Advance turns until the effect expires (8 turns)
    for (let i = 0; i < 8; i++) {
      match.submitAction({ type: 'END_TURN', player: state.currentTurn });
    }

    // After expiration, they must swap back EXACTLY ONCE:
    // pieceA goes back to posA, pieceB goes back to posB.
    // If a double-trigger occurred, they would swap twice, leaving pieceA at posB and pieceB at posA.
    expect(state.board.getPiece(posA)).toBe(pieceA);
    expect(state.board.getPiece(posB)).toBe(pieceB);

    // Verify both swap effects are removed
    expect(pieceA.effects.some(e => e.type === 'position_swap')).toBe(false);
    expect(pieceB.effects.some(e => e.type === 'position_swap')).toBe(false);
  });

  // M20: Skill 1 — cannot target pieces already having position_swap or moveset_swap
  it('M20: Skill 1 — cannot target pieces already having position_swap or moveset_swap', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const posA = { col: 4, row: 1 };
    const posB = { col: 3, row: 1 };
    const posC = { col: 5, row: 1 };
    const pieceA = state.board.getPiece(posA)!;
    const pieceB = state.board.getPiece(posB)!;
    const pieceC = state.board.getPiece(posC)!;

    // Swap A and B
    const swapRes = match.useSkill(Color.White, 'magician_swap_allies', [
      { type: 'piece', position: posA, pieceId: pieceA.id },
      { type: 'piece', position: posB, pieceId: pieceB.id },
    ]);
    expect(swapRes.success).toBe(true);

    // Try to swap A (which has position_swap effect) with C
    // Position of A is now posB, position of C is posC.
    const illegalRes = match.useSkill(Color.White, 'magician_swap_allies', [
      { type: 'piece', position: posB, pieceId: pieceA.id },
      { type: 'piece', position: posC, pieceId: pieceC.id },
    ]);
    expect(illegalRes.success).toBe(false);
  });

  // M21: Skill 2 — cannot target pieces already having position_swap or moveset_swap
  it('M21: Skill 2 — cannot target pieces already having position_swap or moveset_swap', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPosA = { col: 4, row: 13 }; // Black pawn
    const enemyPosB = { col: 6, row: 14 }; // Black queen
    const enemyPosC = { col: 3, row: 13 }; // Black knight
    const pieceA = state.board.getPiece(enemyPosA)!;
    const pieceB = state.board.getPiece(enemyPosB)!;
    const pieceC = state.board.getPiece(enemyPosC)!;

    // Swap A and B movesets
    const swapRes = match.useSkill(Color.White, 'magician_swap_movements', [
      { type: 'piece', position: enemyPosA, pieceId: pieceA.id },
      { type: 'piece', position: enemyPosB, pieceId: pieceB.id },
    ]);
    expect(swapRes.success).toBe(true);

    // Try to swap A (which has moveset_swap effect) with C
    const illegalRes = match.useSkill(Color.White, 'magician_swap_movements', [
      { type: 'piece', position: enemyPosA, pieceId: pieceA.id },
      { type: 'piece', position: enemyPosC, pieceId: pieceC.id },
    ]);
    expect(illegalRes.success).toBe(false);
  });

  // M22: availableSkillTargets excludes pieces that are already swapped
  it('M22: availableSkillTargets excludes pieces that are already swapped', () => {
    match.setVariants('magician', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 15;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const posA = { col: 4, row: 1 };
    const posB = { col: 3, row: 1 };
    const pieceA = state.board.getPiece(posA)!;
    const pieceB = state.board.getPiece(posB)!;

    // Initially, both pieceA and pieceB are in the list of valid positions for skill 1
    let serialized = match.serializeForPlayer(Color.White);
    let s1Targets = serialized.availableSkillTargets['magician_swap_allies'];
    expect(s1Targets.validPositions[0].some(p => p.col === posA.col && p.row === posA.row)).toBe(true);
    expect(s1Targets.validPositions[0].some(p => p.col === posB.col && p.row === posB.row)).toBe(true);

    // Swap them
    const swapRes = match.useSkill(Color.White, 'magician_swap_allies', [
      { type: 'piece', position: posA, pieceId: pieceA.id },
      { type: 'piece', position: posB, pieceId: pieceB.id },
    ]);
    expect(swapRes.success).toBe(true);

    // Reset skillsUsedThisTurn to check availableSkillTargets
    state.skillsUsedThisTurn = 0;

    // Now, they have position_swap effects. They should be excluded from validPositions
    serialized = match.serializeForPlayer(Color.White);
    s1Targets = serialized.availableSkillTargets['magician_swap_allies'];
    expect(s1Targets.validPositions[0].some(p => p.col === posA.col && p.row === posA.row)).toBe(false);
    expect(s1Targets.validPositions[0].some(p => p.col === posB.col && p.row === posB.row)).toBe(false);
  });
});
