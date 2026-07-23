import { Match, Color, Position, PieceType, Effect, Board, GameState, getAttackedSquares, Piece } from 'game-core';

describe('Chess Variant Engine - Guardian Variant (TDD)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    // Setup Guardian variant for White and Lightning (or Guardian) for Black
    match.setVariants('guardian', 'lightning');
    match.start();
  });

  // T1: Apply shield lên piece → piece có effect shield trong effects[], remainingDuration = 2 (rounds)
  it('T1: should apply shield to a piece with remainingDuration = 2 rounds', () => {
    const state = match.getGameState();
    state.whiteAP = 5;

    // Use Skill 1 on White Pawn at D2 (col: 3, row: 1)
    const targetPos: Position = { col: 3, row: 1 };
    const pawn = state.board.getPiece(targetPos);
    expect(pawn).not.toBeNull();

    const result = match.useSkill(Color.White, 'guardian_shield', [{
      type: 'piece',
      position: targetPos,
      pieceId: pawn!.id
    }]);

    expect(result.success).toBe(true);
    expect(pawn!.effects.length).toBe(1);
    expect(pawn!.effects[0].type).toBe('shield');
    expect(pawn!.effects[0].remainingDuration).toBe(2);
    expect(pawn!.effects[0].isHidden).toBe(false);
    expect(pawn!.effects[0].isDebuff).toBe(false);
  });

  // T2: Shield piece bị địch capture → capture bị cancel, shield remainingDuration giảm 1 turn (còn 1)
  it('T2: should cancel capture on a shielded piece and decrement shield duration', () => {
    const state = match.getGameState();
    state.board = new Board();

    // Place White Rook at E5 (4, 4) with shield (remainingDuration = 2)
    const rookPos: Position = { col: 4, row: 4 };
    const shieldEffect: Effect = {
      id: 'shield_rook',
      type: 'shield' as any,
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: 'w_rook_test',
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    };

    const rook = {
      id: 'w_rook_test',
      type: PieceType.Rook,
      color: Color.White,
      effects: [shieldEffect],
    };
    state.board.setPiece(rookPos, rook);

    // Place Black Queen at E6 (4, 5)
    const queenPos: Position = { col: 4, row: 5 };
    const queen = {
      id: 'b_queen_test',
      type: PieceType.Queen,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(queenPos, queen);

    // switch to Black turn
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Black Queen tries to capture White Rook at E5
    const moveResult = match.makeMove(Color.Black, queenPos, rookPos);

    // Capture should be cancelled (success: false or capture cancelled)
    expect(moveResult.success).toBe(false);
    expect(moveResult.reason).toContain('shield');

    // Shield remaining duration should decrement to 1
    expect(rook.effects.length).toBe(1);
    expect(rook.effects[0].remainingDuration).toBe(1);

    // Queen should still be at E6 (4, 5) and Rook at E5 (4, 4)
    expect(state.board.getPiece(queenPos)).toBe(queen);
    expect(state.board.getPiece(rookPos)).toBe(rook);
  });

  // T3: Shield piece hết duration (remainingDuration = 0) → shield expire → piece có thể bị capture bình thường
  it('T3: should allow shielded piece to be captured when shield expires', () => {
    const state = match.getGameState();
    state.board = new Board();

    // White Pawn at E5 with shield duration 1
    const pawnPos: Position = { col: 4, row: 4 };
    const shieldEffect: Effect = {
      id: 'shield_pawn',
      type: 'shield' as any,
      duration: 1,
      remainingDuration: 1,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: 'w_pawn_test',
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    };
    const pawn = {
      id: 'w_pawn_test',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [shieldEffect],
    };
    state.board.setPiece(pawnPos, pawn);

    // Black Rook at E6
    const rookPos: Position = { col: 4, row: 5 };
    const rook = {
      id: 'b_rook_test',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(rookPos, rook);

    // End White turn -> triggers ticks, remainingDuration decreases to 0, which should trigger REMOVE_EFFECT
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Stun / Shield tick timing is turnEnd, so White's turn end ticks the shield off
    expect(pawn.effects.length).toBe(0);

    // Black's turn: Rook captures Pawn at E5
    expect(state.currentTurn).toBe(Color.Black);
    const captureResult = match.makeMove(Color.Black, rookPos, pawnPos);
    expect(captureResult.success).toBe(true);
    expect(state.board.getPiece(pawnPos)).toBe(rook);
  });

  // T4: Shield KHÔNG ngăn effect-based destruction (Bomb 3x3, Fate, Raigeki) → piece có shield bị DESTROY_PIECE action vẫn chết bình thường
  it('T4: should not prevent effect-based destruction', () => {
    const state = match.getGameState();
    state.board = new Board();

    const rookPos: Position = { col: 4, row: 4 };
    const shieldEffect: Effect = {
      id: 'shield_rook',
      type: 'shield' as any,
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: 'w_rook_test',
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    };
    const rook = {
      id: 'w_rook_test',
      type: PieceType.Rook,
      color: Color.White,
      effects: [shieldEffect],
    };
    state.board.setPiece(rookPos, rook);

    // Trigger direct DESTROY_PIECE action on the Rook
    const destroyResult = match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: rook.id,
      position: rookPos,
      reason: 'test_bomb',
    });

    expect(destroyResult.success).toBe(true);
    expect(state.board.getPiece(rookPos)).toBeNull();
  });

  // T5: Shield refresh: apply shield lên piece đã có shield remainingDuration = 1 → duration reset về 2 rounds, không stack 2 shield
  it('T5: should refresh shield duration and not stack shields', () => {
    const state = match.getGameState();
    state.whiteAP = 10;

    const targetPos: Position = { col: 3, row: 1 };
    const pawn = state.board.getPiece(targetPos);
    expect(pawn).not.toBeNull();

    // 1st Shield apply
    match.useSkill(Color.White, 'guardian_shield', [{ type: 'piece', position: targetPos, pieceId: pawn!.id }]);
    expect(pawn!.effects.length).toBe(1);
    expect(pawn!.effects[0].remainingDuration).toBe(2);

    // Set remaining duration to 1 manually
    pawn!.effects[0].remainingDuration = 1;

    // We must reset skillsUsedThisTurn to allow using skill again on the same turn!
    state.skillsUsedThisTurn = 0;

    // 2nd Shield apply
    match.useSkill(Color.White, 'guardian_shield', [{ type: 'piece', position: targetPos, pieceId: pawn!.id }]);
    
    // Expect duration reset to 2, and still only 1 shield effect
    expect(pawn!.effects.length).toBe(1);
    expect(pawn!.effects[0].remainingDuration).toBe(2);
  });

  // T6: Shield tick đúng theo turn: sau 1 turn end của White, remainingDuration = 1. Sau turn end tiếp theo của White, shield biến mất
  it('T6: should tick shield duration down properly on turn ends', () => {
    const state = match.getGameState();
    const targetPos: Position = { col: 3, row: 1 };
    const pawn = state.board.getPiece(targetPos);

    state.whiteAP = 5;
    match.useSkill(Color.White, 'guardian_shield', [{ type: 'piece', position: targetPos, pieceId: pawn!.id }]);
    expect(pawn!.effects[0].remainingDuration).toBe(2);

    // Set appliedTurn to turnNumber - 1 so it ticks down on the same turn end
    pawn!.effects[0].metadata.appliedTurn = state.turnNumber - 1;

    // End White Turn (ticks White effects: duration -1)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(pawn!.effects[0].remainingDuration).toBe(1);

    // End Black Turn (ticks Black effects: White effect does NOT tick on Black turn end because active player is Black and effect is White piece)
    // Wait, let's verify if tickTiming ticks on active player's turnEnd or any turnEnd.
    // In tick timing implementation:
    // "if (found.piece.color !== action.player) { continue; }"
    // Yes! A piece's effects tick ONLY at the end of its owner's turn!
    // So Black's turn end will not tick White Pawn's shield.
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(pawn!.effects[0].remainingDuration).toBe(1);

    // End White Turn again (ticks White effects: duration -1)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(pawn!.effects.length).toBe(0);
  });

  // T7: Skill 2 tạo vùng 3x3 tại trung tâm C3 → 9 ô (B2:D4) có sanctuary cell effect, mỗi ô có remainingDuration = 4 rounds
  it('T7: should create a 3x3 Sanctuary zone with duration = 4 rounds', () => {
    const state = match.getGameState();
    state.whiteAP = 5;

    // Use Skill 2 with center at C3 (col: 2, row: 2)
    const result = match.useSkill(Color.White, 'guardian_sanctuary', [{
      type: 'cell',
      position: { col: 2, row: 2 }
    }]);

    expect(result.success).toBe(true);

    // B2:D4 includes col: 1..3, row: 1..3
    for (let col = 1; col <= 3; col++) {
      for (let row = 1; row <= 3; row++) {
        const effects = state.board.getCellEffects({ col, row });
        expect(effects.length).toBe(1);
        expect(effects[0].type).toBe('sanctuary');
        expect(effects[0].remainingDuration).toBe(4);
      }
    }
  });

  // T8: Địch ăn quân ta trong vùng sanctuary → địch bị stun remainingDuration = 2 rounds
  it('T8: should stun enemies who capture allies inside Sanctuary', () => {
    const state = match.getGameState();
    state.board = new Board();

    // Place White Pawn inside Sanctuary at C3 (col: 2, row: 2)
    const allyPos: Position = { col: 2, row: 2 };
    const allyPawn = {
      id: 'w_pawn_target',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [],
    };
    state.board.setPiece(allyPos, allyPawn);

    // Place Black Rook at C4 (col: 2, row: 3)
    const enemyPos: Position = { col: 2, row: 3 };
    const enemyRook: Piece = {
      id: 'b_rook_attacker',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, enemyRook);

    // Setup Sanctuary on C3
    const sanctuaryEffect: Effect = {
      id: 'sanc_c3',
      type: 'sanctuary' as any,
      duration: 4,
      remainingDuration: 4,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '2,2',
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    };
    state.board.addCellEffect(allyPos, sanctuaryEffect);

    // Black's turn: capture Pawn on C3
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const captureResult = match.makeMove(Color.Black, enemyPos, allyPos);
    expect(captureResult.success).toBe(true);

    // Attacking Black Rook is now at C3 (2, 2)
    expect(state.board.getPiece(allyPos)).toBe(enemyRook);

    // Black Rook should be stunned with duration 2
    expect(enemyRook.effects.length).toBe(1);
    expect(enemyRook.effects[0].type).toBe('stun');
    expect(enemyRook.effects[0].remainingDuration).toBe(2);
    expect(enemyRook.effects[0].sourcePlayer).toBe(Color.White);
  });

  // T9: Địch ăn quân ta NGOÀI vùng sanctuary → địch không bị stun
  it('T9: should not stun enemies who capture allies outside Sanctuary', () => {
    const state = match.getGameState();
    state.board = new Board();

    // White Pawn outside Sanctuary at E5 (4, 4)
    const allyPos: Position = { col: 4, row: 4 };
    const allyPawn = {
      id: 'w_pawn_target',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [],
    };
    state.board.setPiece(allyPos, allyPawn);

    // Black Rook at E6 (4, 5)
    const enemyPos: Position = { col: 4, row: 5 };
    const enemyRook = {
      id: 'b_rook_attacker',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, enemyRook);

    // Sanctuary is on C3 (2,2), not E5 (4,4)
    state.board.addCellEffect({ col: 2, row: 2 }, {
      id: 'sanc_c3',
      type: 'sanctuary' as any,
      duration: 4,
      remainingDuration: 4,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '2,2',
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    });

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const captureResult = match.makeMove(Color.Black, enemyPos, allyPos);
    expect(captureResult.success).toBe(true);
    expect(enemyRook.effects.length).toBe(0); // Not stunned
  });

  // T10: Ta ăn quân địch trong vùng sanctuary → không có stun (chỉ áp dụng khi địch ăn ta)
  it('T10: should not stun if friendly piece captures enemy in Sanctuary', () => {
    const state = match.getGameState();
    state.board = new Board();

    // Black Pawn inside Sanctuary at C3 (col: 2, row: 2)
    const enemyPos: Position = { col: 2, row: 2 };
    const enemyPawn = {
      id: 'b_pawn_target',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, enemyPawn);

    // White Rook at C4 (col: 2, row: 3)
    const allyPos: Position = { col: 2, row: 3 };
    const allyRook = {
      id: 'w_rook_attacker',
      type: PieceType.Rook,
      color: Color.White,
      effects: [],
    };
    state.board.setPiece(allyPos, allyRook);

    // Setup Sanctuary on C3 (sourcePlayer: Color.White)
    const sanctuaryEffect: Effect = {
      id: 'sanc_c3',
      type: 'sanctuary' as any,
      duration: 4,
      remainingDuration: 4,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '2,2',
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    };
    state.board.addCellEffect(enemyPos, sanctuaryEffect);

    // White's turn: captures Black Pawn on C3
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const captureResult = match.makeMove(Color.White, allyPos, enemyPos);
    expect(captureResult.success).toBe(true);

    // Attacking White Rook should NOT be stunned
    expect(allyRook.effects.length).toBe(0);
  });

  // T11: Sanctuary tick đúng: sau 2 turns (1 round), remainingDuration = 2. Sau 4 turns, sanctuary expire và bị xoá
  it('T11: should tick down Sanctuary duration on turn ends and expire it after 4 turns', () => {
    const state = match.getGameState();
    state.board = new Board();

    const pos = { col: 2, row: 2 };
    const sanctuaryEffect: Effect = {
      id: 'sanc_c3',
      type: 'sanctuary' as any,
      duration: 4,
      remainingDuration: 4,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '2,2',
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    };
    state.board.addCellEffect(pos, sanctuaryEffect);

    // End turns. Tick timing is turnEnd.
    // White ends turn: decreases duration by 1
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.board.getCellEffects(pos)[0].remainingDuration).toBe(3);

    // Black ends turn: does not decrease duration because source player is White
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(state.board.getCellEffects(pos)[0].remainingDuration).toBe(3);

    // White ends turn: decreases duration by 1 (total remaining = 2)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.board.getCellEffects(pos)[0].remainingDuration).toBe(2);

    // Black ends turn: does not decrease duration
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(state.board.getCellEffects(pos)[0].remainingDuration).toBe(2);

    // White ends turn: decreases duration by 1 (total remaining = 1)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.board.getCellEffects(pos)[0].remainingDuration).toBe(1);

    // Black ends turn: does not decrease duration
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(state.board.getCellEffects(pos)[0].remainingDuration).toBe(1);

    // White ends turn: decreases duration to 0 -> expires and is removed
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.board.getCellEffects(pos).length).toBe(0);
  });

  // T12: Ultimate → tất cả quân ta (không phải địch) có shield remainingDuration = 10 turns (= 5 rounds)
  it('T12: should apply shield to all friendly pieces for 5 rounds', () => {
    const state = match.getGameState();
    state.whiteAP = 15;

    // Trigger Ultimate
    const result = match.useSkill(Color.White, 'guardian_ultimate', []);
    expect(result.success).toBe(true);

    // Assert that all White pieces have the shield effect with remainingDuration = 5
    // and no Black pieces have it
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const piece = state.board.getPiece({ col: c, row: r });
        if (piece) {
          if (piece.color === Color.White) {
            expect(piece.effects.some(e => e.type === 'shield' && e.remainingDuration === 5)).toBe(true);
          } else {
            expect(piece.effects.some(e => e.type === 'shield')).toBe(false);
          }
        }
      }
    }
  });

  // T13: Ultimate → quân ta đã có shield remainingDuration = 1 round → refresh lên 5 rounds (không stack)
  it('T13: should refresh existing shields on allies to 5 rounds instead of stacking', () => {
    const state = match.getGameState();
    const pawn = state.board.getPiece({ col: 3, row: 1 });
    expect(pawn).not.toBeNull();

    // Setup: Pawn already has shield with duration 1 round
    pawn!.effects.push({
      id: 'existing_shield',
      type: 'shield' as any,
      duration: 2,
      remainingDuration: 1,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: pawn!.id,
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    });

    state.whiteAP = 15;
    const result = match.useSkill(Color.White, 'guardian_ultimate', []);
    expect(result.success).toBe(true);

    // Expect White pawn to have exactly 1 shield effect with duration 5
    expect(pawn!.effects.length).toBe(1);
    expect(pawn!.effects[0].remainingDuration).toBe(5);
  });

  // T14: Ultimate tốn đúng AP theo spec (đề xuất 8 AP và đánh dấu TODO)
  it('T14: should cost 8 AP to use Ultimate', () => {
    const state = match.getGameState();
    state.whiteAP = 8;

    const result = match.useSkill(Color.White, 'guardian_ultimate', []);
    expect(result.success).toBe(true);
    expect(state.whiteAP).toBe(0);
  });

  // T15: Full flow — White dùng Guardian Skill 1, Black capture White piece có shield:
  // capture bị cancel → Black piece không di chuyển → White piece vẫn ở vị trí cũ → shield remainingDuration giảm từ 2 xuống 1
  it('T15: should verify full game flow for a cancelled capture on a shielded piece', () => {
    const state = match.getGameState();
    state.board = new Board();

    const allyPos: Position = { col: 4, row: 4 }; // E5
    const enemyPos: Position = { col: 4, row: 5 }; // E6

    const whitePawn: Piece = {
      id: 'w_pawn_flow',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [],
    };
    state.board.setPiece(allyPos, whitePawn);

    const blackRook = {
      id: 'b_rook_flow',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, blackRook);

    // White uses Skill 1 on Pawn
    state.whiteAP = 5;
    const skillRes = match.useSkill(Color.White, 'guardian_shield', [{
      type: 'piece',
      position: allyPos,
      pieceId: whitePawn.id,
    }]);
    expect(skillRes.success).toBe(true);

    // Set appliedTurn to turnNumber - 1 so it ticks down on the same turn end
    whitePawn.effects[0].metadata.appliedTurn = state.turnNumber - 1;

    // End White Turn
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(whitePawn.effects[0].remainingDuration).toBe(1); // Ticked down on White turnEnd

    // Black Rook tries to capture White Pawn
    const moveRes = match.makeMove(Color.Black, enemyPos, allyPos);
    expect(moveRes.success).toBe(false);
    expect(moveRes.reason).toContain('shield');

    // End Black Turn (triggers OnTurnEnd which cleans up the expired shield)
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(whitePawn.effects.length).toBe(0);

    // Positions unchanged
    expect(state.board.getPiece(allyPos)).toBe(whitePawn);
    expect(state.board.getPiece(enemyPos)).toBe(blackRook);
  });

  // T16: Full flow — White dùng Guardian Skill 2, Black capture White piece trong vùng:
  // capture thành công (không có shield) + Black piece bị stun remainingDuration = 2 rounds ngay sau
  it('T16: should verify full game flow for Sanctuary stun zone', () => {
    const state = match.getGameState();
    state.board = new Board();

    const allyPos: Position = { col: 4, row: 4 }; // E5
    const enemyPos: Position = { col: 4, row: 5 }; // E6

    const whitePawn = {
      id: 'w_pawn_flow',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [],
    };
    state.board.setPiece(allyPos, whitePawn);

    const blackRook: Piece = {
      id: 'b_rook_flow',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, blackRook);

    // White uses Skill 2 centered at E5 (4, 4)
    state.whiteAP = 5;
    const skillRes = match.useSkill(Color.White, 'guardian_sanctuary', [{
      type: 'cell',
      position: allyPos,
    }]);
    expect(skillRes.success).toBe(true);

    // End White Turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Black Rook captures White Pawn
    const moveRes = match.makeMove(Color.Black, enemyPos, allyPos);
    expect(moveRes.success).toBe(true);

    // Capture succeeds, Black Rook is now at E5
    expect(state.board.getPiece(allyPos)).toBe(blackRook);
    expect(state.board.getPiece(enemyPos)).toBeNull();

    // Black Rook is stunned for 2 rounds
    expect(blackRook.effects.length).toBe(1);
    expect(blackRook.effects[0].type).toBe('stun');
    expect(blackRook.effects[0].remainingDuration).toBe(2);
  });

  // T17: Variant load/unload — Guardian unload → tất cả handlers bị remove khỏi EventBus,
  // Shield/Sanctuary effects không còn được xử lý (capture không bị cancel dù piece có shield)
  it('T17: should ignore effects and handler logic when variant is unloaded', () => {
    const state = match.getGameState();
    state.board = new Board();

    const allyPos: Position = { col: 4, row: 4 };
    const enemyPos: Position = { col: 4, row: 5 };

    const shieldEffect: Effect = {
      id: 'shield_test',
      type: 'shield' as any,
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: 'w_pawn_test',
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    };

    const whitePawn = {
      id: 'w_pawn_test',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [shieldEffect],
    };
    state.board.setPiece(allyPos, whitePawn);

    const blackRook = {
      id: 'b_rook_test',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, blackRook);

    // Unload variant
    match.getVariantRegistry().unloadForPlayer('guardian', Color.White, match.getEventBus(), match.getMoveModifierChain());

    // Try capturing shielded Pawn as Black
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes = match.makeMove(Color.Black, enemyPos, allyPos);
    
    // Capture should SUCCEED now because the variant handlers (ShieldHandler) are unloaded
    expect(moveRes.success).toBe(true);
    expect(state.board.getPiece(allyPos)).toBe(blackRook);
  });

  // T18: should verify availableSkillTargets contains correct valid target positions for Guardian S1 and Lightning S1
  it('T18: should verify availableSkillTargets contains correct valid target positions for Guardian S1 and Lightning S1', () => {
    // 1. Check White (Guardian) available targets
    const state = match.getGameState();
    state.whiteAP = 10;
    
    // Initially, White's turn. Serialize for White:
    const whiteSerialized = match.serializeForPlayer(Color.White);
    expect(whiteSerialized.availableSkillTargets).toBeDefined();
    
    const shieldTargets = whiteSerialized.availableSkillTargets['guardian_shield'];
    expect(shieldTargets).toBeDefined();
    expect(shieldTargets.requirements.length).toBe(1);
    expect(shieldTargets.requirements[0].type).toBe('piece');
    expect(shieldTargets.requirements[0].filter).toBe('ally');
    
    // Every White piece on the board should be a valid target
    const allWhitePiecePositions: Position[] = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.color === Color.White) {
          allWhitePiecePositions.push({ col: c, row: r });
        }
      }
    }
    
    expect(shieldTargets.validPositions[0].length).toBe(allWhitePiecePositions.length);
    for (const pos of allWhitePiecePositions) {
      expect(shieldTargets.validPositions[0].some(p => p.col === pos.col && p.row === pos.row)).toBe(true);
    }
    
    // 2. Check Black (Lightning) available targets
    // Switch turn to Black
    match.submitAction({ type: 'END_TURN', player: Color.White }); // Ends White turn, switches to Black
    state.blackAP = 10;
    
    const blackSerialized = match.serializeForPlayer(Color.Black);
    expect(blackSerialized.availableSkillTargets).toBeDefined();
    
    const trapTargets = blackSerialized.availableSkillTargets['lightning_thunder_trap'];
    expect(trapTargets).toBeDefined();
    expect(trapTargets.requirements.length).toBe(1);
    expect(trapTargets.requirements[0].type).toBe('cell');
    expect(trapTargets.requirements[0].filter).toBe('empty');
    
    // Every empty cell on the board should be a valid target
    const allEmptyPositions: Position[] = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (!p) {
          allEmptyPositions.push({ col: c, row: r });
        }
      }
    }
    
    expect(trapTargets.validPositions[0].length).toBe(allEmptyPositions.length);
  });

  it('T19: should reduce Skill 1 AP cost to 2 AP after losing 8 pieces', () => {
    const state = match.getGameState();
    
    // 1. Initially, Skill 1 (guardian_shield) should cost 4 AP
    state.whiteAP = 4;
    const targetPos: Position = { col: 3, row: 1 };
    const pawn = state.board.getPiece(targetPos);
    expect(pawn).not.toBeNull();

    // Check availableSkillTargets shows it is castable (since whiteAP = 4 >= cost 4)
    let whiteSerialized = match.serializeForPlayer(Color.White);
    expect(whiteSerialized.availableSkillTargets['guardian_shield'].validPositions[0].length).toBeGreaterThan(0);

    // 2. Mock losing 8 pieces by adding them to the graveyard
    for (let i = 0; i < 8; i++) {
      state.graveyard.push({
        piece: {
          id: `w_pawn_dead_${i}`,
          type: PieceType.Pawn,
          color: Color.White,
          effects: [],
        },
        position: { col: 0, row: 0 },
        turnDied: 1,
        killedBy: 'capture',
      });
    }

    // Now, the cost should be 2 AP. Setting White AP to 2.
    state.whiteAP = 2;

    // Check availableSkillTargets shows it is still castable with only 2 AP
    whiteSerialized = match.serializeForPlayer(Color.White);
    expect(whiteSerialized.availableSkillTargets['guardian_shield'].validPositions[0].length).toBeGreaterThan(0);

    // Cast it
    const result = match.useSkill(Color.White, 'guardian_shield', [{
      type: 'piece',
      position: targetPos,
      pieceId: pawn!.id
    }]);

    expect(result.success).toBe(true);
    // Cost should be 2 AP, so whiteAP should be 0 (2 - 2)
    expect(state.whiteAP).toBe(0);
  });

  // T14: Shield decrement check in the same turn
  it('T14: should only decrement shield duration once per turn when repeatedly attacked', () => {
    const state = match.getGameState();
    state.board = new Board();

    const rookPos: Position = { col: 4, row: 4 };
    const shieldEffect: Effect = {
      id: 'shield_rook_t14',
      type: 'shield' as any,
      duration: 4,
      remainingDuration: 4,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: 'w_rook_t14',
      stackingRule: 'refresh',
      isDebuff: false,
      isHidden: false,
      metadata: {},
    };

    const rook = {
      id: 'w_rook_t14',
      type: PieceType.Rook,
      color: Color.White,
      effects: [shieldEffect],
    };
    state.board.setPiece(rookPos, rook);

    const queenPos: Position = { col: 4, row: 5 };
    const queen = {
      id: 'b_queen_t14',
      type: PieceType.Queen,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(queenPos, queen);

    // switch to Black turn
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // First attempt: duration decrements to 3
    const moveResult1 = match.makeMove(Color.Black, queenPos, rookPos);
    expect(moveResult1.success).toBe(false);
    expect(rook.effects[0].remainingDuration).toBe(3);

    // Second attempt in the same turn: duration should STILL be 3!
    const moveResult2 = match.makeMove(Color.Black, queenPos, rookPos);
    expect(moveResult2.success).toBe(false);
    expect(rook.effects[0].remainingDuration).toBe(3);
  });
});
