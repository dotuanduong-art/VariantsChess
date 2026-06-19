import {
  Match,
  Color,
  Position,
  PieceType,
  Effect,
  Board,
  oppositeColor,
  AngelVariant,
} from 'game-core';

describe('Chess Variant Engine - Angel Variant & Engine Upgrades', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // A1: Passive — quân đồng minh bị capture → +2 AP ngay
  it('A1: Passive — ally piece captured -> +2 AP immediately', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;

    // Place an ally piece to be captured
    const allyPiece = { id: 'w_pawn_sacrificial', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 4, row: 4 }, allyPiece);

    // Place an enemy piece to capture it
    const enemyPiece = { id: 'b_rook_attacker', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 4, row: 5 }, enemyPiece);

    // Set turn to Black (enemy) and perform capture
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    match.makeMove(Color.Black, { col: 4, row: 5 }, { col: 4, row: 4 });

    // White should receive +2 AP from the passive (in addition to any default loss AP if any, but let's isolate and verify it increased)
    expect(state.whiteAP).toBeGreaterThanOrEqual(2);
  });

  // A2: Passive — quân đồng minh bị destroy bởi effect → +2 AP
  it('A2: Passive — ally piece destroyed by effect -> +2 AP', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;

    const allyPiece = state.board.getPiece({ col: 0, row: 1 })!; // White pawn
    
    // Destroy it via effect
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: allyPiece.id,
      position: { col: 0, row: 1 },
      reason: 'skill',
    });

    expect(state.whiteAP).toBe(2);
  });

  // A3: Passive — quân địch chết → không trigger passive
  it('A3: Passive — enemy piece dies -> no trigger', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 0;

    const enemyPiece = state.board.getPiece({ col: 0, row: 13 })!; // Black pawn

    // Destroy enemy piece
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: enemyPiece.id,
      position: { col: 0, row: 13 },
      reason: 'skill',
    });

    expect(state.whiteAP).toBe(0);
  });

  // A4: Skill 1 — apply Stun 6 turns lên quân địch non-King
  it('A4: Skill 1 — apply Stun 6 turns to enemy non-King', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const targetPos = { col: 3, row: 13 }; // Black pawn
    const piece = state.board.getPiece(targetPos)!;

    const res = match.useSkill(Color.White, 'angel_holy_seal', [
      { type: 'piece', position: targetPos, pieceId: piece.id },
    ]);

    expect(res.success).toBe(true);
    expect(piece.effects.length).toBe(1);
    expect(piece.effects[0].type).toBe('stun');
    expect(piece.effects[0].remainingDuration).toBe(6);
  });

  // A5: Skill 1 — không thể dùng lên King
  it('A5: Skill 1 — cannot target King', () => {
    match.setVariants('angel', 'lightning');
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

    const res = match.useSkill(Color.White, 'angel_holy_seal', [
      { type: 'piece', position: kingPos, pieceId: kingId },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Cannot target King');
  });

  // A6: Skill 2 — quân có debuff → tất cả debuff bị cleanse → không có shield
  it('A6: Skill 2 — piece has debuff -> cleanses all debuffs, no shield', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 }; // White pawn
    const piece = state.board.getPiece(allyPos)!;

    // Apply manual stun debuff
    const stun: Effect = {
      id: 'debuff_stun',
      type: 'stun',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: piece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    piece.effects.push(stun);

    const res = match.useSkill(Color.White, 'angel_blessing', [
      { type: 'piece', position: allyPos, pieceId: piece.id },
    ]);

    expect(res.success).toBe(true);
    // Debuff should be removed
    expect(piece.effects.some(e => e.type === 'stun')).toBe(false);
    // Shield should NOT be added
    expect(piece.effects.some(e => e.type === 'shield')).toBe(false);
    // Blessing itself should NOT remain
    expect(piece.effects.some(e => e.type === 'blessing')).toBe(false);
  });

  // A7: Skill 2 — quân có nhiều debuff (Stun + Berserk) → tất cả bị cleanse cùng lúc
  it('A7: Skill 2 — cleanses multiple debuffs at once', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const piece = state.board.getPiece(allyPos)!;

    // Apply manual stun + berserk debuffs
    const stun: Effect = {
      id: 'debuff_stun',
      type: 'stun',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: piece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    const berserk: Effect = {
      id: 'debuff_berserk',
      type: 'berserk',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: piece.id,
      stackingRule: 'ignore',
      isDebuff: true,
      metadata: {},
    };
    piece.effects.push(stun, berserk);

    const res = match.useSkill(Color.White, 'angel_blessing', [
      { type: 'piece', position: allyPos, pieceId: piece.id },
    ]);

    expect(res.success).toBe(true);
    expect(piece.effects.some(e => e.type === 'stun')).toBe(false);
    expect(piece.effects.some(e => e.type === 'berserk')).toBe(false);
    expect(piece.effects.some(e => e.type === 'shield')).toBe(false);
  });

  // A8: Skill 2 — quân không có debuff → nhận Shield 2 turns
  it('A8: Skill 2 — piece has no debuffs -> receives Shield 2 turns', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const piece = state.board.getPiece(allyPos)!;

    const res = match.useSkill(Color.White, 'angel_blessing', [
      { type: 'piece', position: allyPos, pieceId: piece.id },
    ]);

    expect(res.success).toBe(true);
    const shield = piece.effects.find(e => e.type === 'shield');
    expect(shield).toBeDefined();
    expect(shield!.remainingDuration).toBe(2);
    expect(piece.effects.some(e => e.type === 'blessing')).toBe(false);
  });

  // A8_1: Shield applied by Blessing blocks capture
  it('A8_1: Shield applied by Blessing blocks capture', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const piece = state.board.getPiece(allyPos)!;

    // White casts Blessing on itself -> gains Shield
    const res = match.useSkill(Color.White, 'angel_blessing', [
      { type: 'piece', position: allyPos, pieceId: piece.id },
    ]);
    expect(res.success).toBe(true);

    // End turn -> Black turn
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Place Black Rook to capture the shielded White piece
    const enemyPos = { col: 4, row: 2 };
    state.board.setPiece(enemyPos, { id: 'b_rook', type: PieceType.Rook, color: Color.Black, effects: [] });

    // Black attempts to capture the shielded White piece
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes = match.makeMove(Color.Black, enemyPos, allyPos);
    
    // Capture should fail/be blocked by shield
    expect(moveRes.success).toBe(false);
    expect(state.board.getPiece(allyPos)).toBe(piece); // Piece still alive on board
  });

  // A9: Skill 2 — quân có judgment_mark (không phải debuff) → nhận Shield (mark không bị cleanse)
  it('A9: Skill 2 — piece has judgment_mark (not a debuff) -> gets Shield and mark remains', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const piece = state.board.getPiece(allyPos)!;

    // Apply manual judgment_mark
    const mark: Effect = {
      id: 'manual_mark',
      type: 'judgment_mark' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: piece.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    piece.effects.push(mark);

    const res = match.useSkill(Color.White, 'angel_blessing', [
      { type: 'piece', position: allyPos, pieceId: piece.id },
    ]);

    expect(res.success).toBe(true);
    // Shield should be granted since mark is NOT a debuff
    expect(piece.effects.some(e => e.type === 'shield')).toBe(true);
    // Mark should remain
    expect(piece.effects.some(e => e.id === 'manual_mark')).toBe(true);
  });

  // A10: Ultimate — kích hoạt Judgment Window 10 turns
  it('A10: Ultimate — activates Judgment Window 10 turns', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const res = match.useSkill(Color.White, 'angel_divine_judgment', []);
    expect(res.success).toBe(true);
    expect(state.variantState.judgmentWindowActive_White).toBe(true);
    expect(state.variantState.judgmentWindowRemainingTurns_White).toBe(10);
  });

  // A11: Ultimate — trong window: địch ăn quân → nhận judgment_mark
  it('A11: Ultimate — in window: enemy capture -> receives judgment_mark', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Ultimate
    match.useSkill(Color.White, 'angel_divine_judgment', []);

    // End turn -> Black Turn starts
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Place an ally piece to be captured
    const allyPiece = { id: 'w_pawn_target', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 4, row: 4 }, allyPiece);

    // Place enemy piece
    const enemyPiece = { id: 'b_rook_attacker', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 4, row: 5 }, enemyPiece);

    // Black makes capture
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    match.makeMove(Color.Black, { col: 4, row: 5 }, { col: 4, row: 4 });

    // Attacker should have judgment_mark
    expect(enemyPiece.effects.some(e => e.type === 'judgment_mark')).toBe(true);
    expect(enemyPiece.effects[0].sourcePlayer).toBe(Color.White);
  });

  // A12: Ultimate — trong window: địch ăn King → game over ngay (không đợi window)
  it('A12: Ultimate — in window: enemy captures King -> game over immediately', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Ultimate
    match.useSkill(Color.White, 'angel_divine_judgment', []);

    // End turn -> Black Turn starts
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Find White King and position
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

    // Place Black Rook adjacent to White King
    const attackerPos = { col: kingPos.col, row: kingPos.row + 1 };
    state.board.setPiece(attackerPos, { id: 'b_attacker_king', type: PieceType.Rook, color: Color.Black, effects: [] });

    // Black captures White King
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;
    match.makeMove(Color.Black, attackerPos, kingPos);

    expect(state.status).toBe('finished');
    expect(state.winner).toBe(Color.Black);
  });

  // A13: Ultimate — quân bị mark chết trong window → mark biến mất, không bị destroy lần 2
  it('A13: Ultimate — marked piece dies during window -> mark disappears along with piece', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Ultimate
    match.useSkill(Color.White, 'angel_divine_judgment', []);

    // Apply manual mark to a Black piece
    const enemyPos = { col: 5, row: 13 };
    const enemyPiece = state.board.getPiece(enemyPos)!;
    const mark: Effect = {
      id: 'm_mark',
      type: 'judgment_mark' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: enemyPiece.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    enemyPiece.effects.push(mark);

    // Destroy the marked piece via effect
    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: enemyPiece.id,
      position: enemyPos,
      reason: 'manual_kill',
    });

    // The piece is removed from board, so its mark is gone
    expect(state.board.getPiece(enemyPos)).toBeNull();
  });

  // A14: Ultimate — hết 10 turns: tất cả quân có mark bị destroy (kể cả King địch)
  it('A14: Ultimate — after 10 turns: all marked pieces (including enemy King) are destroyed', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Ultimate
    match.useSkill(Color.White, 'angel_divine_judgment', []);

    // Apply manual mark to Black King and a Black Rook
    let kingPos = { col: -1, row: -1 };
    let kingPiece: any = null;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.Black) {
          kingPos = { col: c, row: r };
          kingPiece = p;
          break;
        }
      }
    }

    const rookPos = { col: 0, row: 13 };
    const rookPiece = state.board.getPiece(rookPos)!;

    const mark1: Effect = {
      id: 'k_mark',
      type: 'judgment_mark' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: kingPiece.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    const mark2: Effect = {
      id: 'r_mark',
      type: 'judgment_mark' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rookPiece.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    kingPiece.effects.push(mark1);
    rookPiece.effects.push(mark2);

    // Tick turns down to 1
    state.variantState.judgmentWindowRemainingTurns_White = 1;

    // White ends turn -> ticks remaining turns to 0 and triggers destruction
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Verify pieces are destroyed
    expect(state.board.getPiece(rookPos)).toBeNull();
    expect(state.board.getPiece(kingPos)).toBeNull();
    expect(state.status).toBe('finished');
    expect(state.winner).toBe(Color.White);
  });

  // A15: Ultimate — destroy từ judgment: Shield không block, không thể cancel
  it('A15: Ultimate — judgment destruction bypasses Shield', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Ultimate
    match.useSkill(Color.White, 'angel_divine_judgment', []);

    // Setup Black Rook with Shield + Judgment Mark
    const rookPos = { col: 0, row: 13 };
    const rookPiece = state.board.getPiece(rookPos)!;

    const shield: Effect = {
      id: 'r_shield',
      type: 'shield',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: rookPiece.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    };
    const mark: Effect = {
      id: 'r_mark',
      type: 'judgment_mark' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rookPiece.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    rookPiece.effects.push(shield, mark);

    // Fast-forward remaining turns to 1
    state.variantState.judgmentWindowRemainingTurns_White = 1;

    // White ends turn -> ticks to 0 -> destroys
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Rook should be destroyed even with Shield active
    expect(state.board.getPiece(rookPos)).toBeNull();
  });

  // A16: Ultimate — sau khi destroy: nếu King địch bị destroy → Angel thắng
  it('A16: Ultimate — if enemy King is destroyed at window end, Angel wins', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Ultimate
    match.useSkill(Color.White, 'angel_divine_judgment', []);

    // Mark Black King
    let kingPiece: any = null;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.Black) {
          kingPiece = p;
          break;
        }
      }
    }

    const mark: Effect = {
      id: 'k_mark',
      type: 'judgment_mark' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: kingPiece.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    kingPiece.effects.push(mark);

    state.variantState.judgmentWindowRemainingTurns_White = 1;

    match.submitAction({ type: 'END_TURN', player: Color.White });

    expect(state.status).toBe('finished');
    expect(state.winner).toBe(Color.White);
  });

  // A17: Window tick đúng: sau 10 turns chính xác mới trigger, không sớm hơn
  it('A17: Judgment Window ticks correctly: triggers exactly at 0 remaining turns', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 14;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Activate Ultimate
    match.useSkill(Color.White, 'angel_divine_judgment', []);

    // Setup Black Rook with Judgment Mark
    const rookPos = { col: 0, row: 13 };
    const rookPiece = state.board.getPiece(rookPos)!;
    const mark: Effect = {
      id: 'r_mark',
      type: 'judgment_mark' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rookPiece.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    };
    rookPiece.effects.push(mark);

    // End White Turn -> ticks remaining turns 10 -> 9
    match.submitAction({ type: 'END_TURN', player: Color.White });
    expect(state.variantState.judgmentWindowRemainingTurns_White).toBe(9);
    expect(state.board.getPiece(rookPos)).not.toBeNull(); // Still alive

    // End Black Turn -> ticks remaining turns 9 -> 8
    match.submitAction({ type: 'END_TURN', player: Color.Black });
    expect(state.variantState.judgmentWindowRemainingTurns_White).toBe(8);
    expect(state.board.getPiece(rookPos)).not.toBeNull(); // Still alive
  });
});
