import {
  Match,
  Color,
  PieceType,
  Effect,
  Piece,
  oppositeColor,
} from 'game-core';

describe('Chess Variant Engine - Turtle Variant', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
  });

  // === Passive — Turtle's Retaliation ===
  it('[V1] Passive - captured Aegis piece binds the attacker', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    
    // Set up ally (White) piece with Aegis
    const allyPos = { col: 4, row: 4 };
    const allyPiece: Piece = {
      id: 'w_pawn_aegis',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [
        {
          id: 'manual_aegis',
          type: 'aegis',
          duration: 2,
          remainingDuration: 2,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'w_pawn_aegis',
          stackingRule: 'refresh',
          isDebuff: false,
          metadata: {},
        },
      ],
    };
    state.board.setPiece(allyPos, allyPiece);

    // Set up enemy (Black) piece to capture
    const enemyPos = { col: 4, row: 5 };
    const enemyPiece: Piece = {
      id: 'b_rook_attacker',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, enemyPiece);

    // Perform capture
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const res = match.makeMove(Color.Black, enemyPos, allyPos);
    expect(res.success).toBe(true);

    // Attacker should receive Bind debuff
    const updatedAttacker = state.board.getPiece(allyPos);
    expect(updatedAttacker).toBeDefined();
    expect(updatedAttacker!.id).toBe('b_rook_attacker');
    const bindEffect = updatedAttacker!.effects?.find(e => e.type === 'bind');
    expect(bindEffect).toBeDefined();
    expect(bindEffect!.remainingDuration).toBe(2);
    expect(bindEffect!.isDebuff).toBe(true);
  });

  it('[V2] Passive - capturing a non-Aegis piece does not trigger passive', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    
    const allyPos = { col: 4, row: 4 };
    const allyPiece: Piece = {
      id: 'w_pawn_no_aegis',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [],
    };
    state.board.setPiece(allyPos, allyPiece);

    const enemyPos = { col: 4, row: 5 };
    const enemyPiece: Piece = {
      id: 'b_rook_attacker',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const res = match.makeMove(Color.Black, enemyPos, allyPos);
    expect(res.success).toBe(true);

    const updatedAttacker = state.board.getPiece(allyPos);
    expect(updatedAttacker).toBeDefined();
    expect(updatedAttacker!.effects?.some(e => e.type === 'bind')).toBe(false);
  });

  it('[V3] Passive - Shield absorbs capture, preventing passive trigger', () => {
    match.setVariants('turtle', 'guardian');
    match.start();

    const state = match.getGameState();
    
    const allyPos = { col: 4, row: 4 };
    const allyPiece: Piece = {
      id: 'w_pawn_shield_aegis',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [
        {
          id: 'manual_aegis',
          type: 'aegis',
          duration: 2,
          remainingDuration: 2,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'w_pawn_shield_aegis',
          stackingRule: 'refresh',
          isDebuff: false,
          metadata: {},
        },
        {
          id: 'manual_shield',
          type: 'shield',
          duration: 2,
          remainingDuration: 2,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'w_pawn_shield_aegis',
          stackingRule: 'refresh',
          isDebuff: false,
          metadata: {},
        },
      ],
    };
    state.board.setPiece(allyPos, allyPiece);

    const enemyPos = { col: 4, row: 5 };
    const enemyPiece: Piece = {
      id: 'b_rook_attacker',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Capture fails (blocked by shield)
    const res = match.makeMove(Color.Black, enemyPos, allyPos);
    expect(res.success).toBe(false);

    // Defender still alive, attacker does not get Bind
    const defender = state.board.getPiece(allyPos);
    expect(defender).toBe(allyPiece);
    const attacker = state.board.getPiece(enemyPos);
    expect(attacker!.effects?.some(e => e.type === 'bind')).toBe(false);
  });

  // === Skill 1 — Transference ===
  it('[V4] Skill 1 - transfer buff from enemy to ally preserving duration', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Enemy piece with Shield (buff, duration 2 rounds)
    const enemyPos = { col: 4, row: 13 }; // Black pawn
    const enemyPiece = state.board.getPiece(enemyPos)!;
    const shieldEffect: Effect = {
      id: 'enemy_shield',
      type: 'shield',
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: enemyPiece.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    };
    enemyPiece.effects = [shieldEffect];

    // Ally piece (White pawn)
    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;

    const res = match.useSkill(Color.White, 'turtle_transference', [
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
    ]);

    expect(res.success).toBe(true);

    // Shield removed from enemy, added to ally
    expect(enemyPiece.effects.some(e => e.type === 'shield')).toBe(false);
    const newShield = allyPiece.effects.find(e => e.type === 'shield');
    expect(newShield).toBeDefined();
    expect(newShield!.remainingDuration).toBe(2);
  });

  it('[V5] Skill 1 - transfer debuff from ally to enemy preserving duration', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Ally piece with Stun (debuff, duration 3 rounds)
    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;
    const stunEffect: Effect = {
      id: 'ally_stun',
      type: 'stun',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: allyPiece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    allyPiece.effects = [stunEffect];

    // Enemy piece
    const enemyPos = { col: 4, row: 13 };
    const enemyPiece = state.board.getPiece(enemyPos)!;

    const res = match.useSkill(Color.White, 'turtle_transference', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    expect(res.success).toBe(true);

    // Stun removed from ally, added to enemy
    expect(allyPiece.effects.some(e => e.type === 'stun')).toBe(false);
    const newStun = enemyPiece.effects.find(e => e.type === 'stun');
    expect(newStun).toBeDefined();
    expect(newStun!.remainingDuration).toBe(3);
  });

  it('[V6] Skill 1 - cannot transfer non-basic effect', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;
    
    // Non-basic effect like aegis
    const aegisEffect: Effect = {
      id: 'ally_aegis',
      type: 'aegis',
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: allyPiece.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    };
    allyPiece.effects = [aegisEffect];

    const enemyPos = { col: 4, row: 13 };
    const enemyPiece = state.board.getPiece(enemyPos)!;

    const res = match.useSkill(Color.White, 'turtle_transference', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('No transferable effect found');
  });

  it('[V7] Skill 1 - cannot transfer buff from ally', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;
    
    // Buff on ally
    const shieldEffect: Effect = {
      id: 'ally_shield',
      type: 'shield',
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: allyPiece.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    };
    allyPiece.effects = [shieldEffect];

    const enemyPos = { col: 4, row: 13 };
    const enemyPiece = state.board.getPiece(enemyPos)!;

    const res = match.useSkill(Color.White, 'turtle_transference', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('No transferable effect found');
  });

  it('[V8] Skill 1 - cannot transfer debuff from enemy', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPos = { col: 4, row: 13 };
    const enemyPiece = state.board.getPiece(enemyPos)!;
    
    // Debuff on enemy
    const stunEffect: Effect = {
      id: 'enemy_stun',
      type: 'stun',
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: enemyPiece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    enemyPiece.effects = [stunEffect];

    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;

    const res = match.useSkill(Color.White, 'turtle_transference', [
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('No transferable effect found');
  });

  it('[V9] Skill 1 - cannot transfer debuff to enemy with Aegis', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Ally with debuff
    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;
    const stunEffect: Effect = {
      id: 'ally_stun',
      type: 'stun',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: allyPiece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    allyPiece.effects = [stunEffect];

    // Enemy with Aegis
    const enemyPos = { col: 4, row: 13 };
    const enemyPiece = state.board.getPiece(enemyPos)!;
    const aegisEffect: Effect = {
      id: 'enemy_aegis',
      type: 'aegis',
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: enemyPiece.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    };
    enemyPiece.effects = [aegisEffect];

    const res = match.useSkill(Color.White, 'turtle_transference', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Aegis immunity');
  });

  it('[V10] Skill 1 - transfer buff to ally with same buff type resets duration', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPos = { col: 4, row: 13 };
    const enemyPiece = state.board.getPiece(enemyPos)!;
    const shieldEffect: Effect = {
      id: 'enemy_shield',
      type: 'shield',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: enemyPiece.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    };
    enemyPiece.effects = [shieldEffect];

    // Ally already has Shield but duration is 1
    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;
    const allyShieldEffect: Effect = {
      id: 'ally_shield',
      type: 'shield',
      duration: 1,
      remainingDuration: 1,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: allyPiece.id,
      stackingRule: 'refresh',
      isDebuff: false,
      metadata: {},
    };
    allyPiece.effects = [allyShieldEffect];

    const res = match.useSkill(Color.White, 'turtle_transference', [
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
    ]);

    expect(res.success).toBe(true);

    // Ally shield should refresh duration to 3 (transferred shield duration)
    const finalShield = allyPiece.effects.find(e => e.type === 'shield');
    expect(finalShield).toBeDefined();
    expect(finalShield!.remainingDuration).toBe(3);
  });

  it('[V11] Skill 1 - cannot transfer to the same piece', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;
    const stunEffect: Effect = {
      id: 'ally_stun',
      type: 'stun',
      duration: 2,
      remainingDuration: 2,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: allyPiece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };
    allyPiece.effects = [stunEffect];

    const res = match.useSkill(Color.White, 'turtle_transference', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('different');
  });

  // === Skill 2 — Aegis Blessing ===
  it('[V12] Skill 2 - apply Aegis to ally for 2 rounds', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;

    const res = match.useSkill(Color.White, 'turtle_aegis_blessing', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
    ]);

    expect(res.success).toBe(true);
    const aegis = allyPiece.effects.find(e => e.type === 'aegis');
    expect(aegis).toBeDefined();
    expect(aegis!.remainingDuration).toBe(2);
    expect(aegis!.isDebuff).toBe(false);
  });

  it('[V13] Skill 2 - cannot target King', () => {
    match.setVariants('turtle', 'lightning');
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

    const res = match.useSkill(Color.White, 'turtle_aegis_blessing', [
      { type: 'piece', position: kingPos, pieceId: kingId },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Cannot target King');
  });

  it('[V14] Aegis piece is immune to enemy stun effect', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    
    // Ally has Aegis
    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;
    allyPiece.effects = [
      {
        id: 'aegis_manual',
        type: 'aegis',
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: allyPiece.id,
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: {},
      },
    ];

    // Attempt to apply Stun by enemy (Black)
    const stunEffect: Effect = {
      id: 'enemy_stun_apply',
      type: 'stun',
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: allyPiece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };

    match.submitAction({
      type: 'APPLY_EFFECT',
      effect: stunEffect,
    });

    // Stun application should be skipped
    expect(allyPiece.effects.some(e => e.type === 'stun')).toBe(false);
  });

  it('[V15] Aegis piece is immune to enemy bomb apply', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    
    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;
    allyPiece.effects = [
      {
        id: 'aegis_manual',
        type: 'aegis',
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: allyPiece.id,
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: {},
      },
    ];

    // Attempt to apply Bomb by enemy (Black)
    const bombEffect: Effect = {
      id: 'enemy_bomb_apply',
      type: 'bomb',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'piece',
      targetId: allyPiece.id,
      stackingRule: 'refresh',
      isDebuff: true,
      metadata: {},
    };

    match.submitAction({
      type: 'APPLY_EFFECT',
      effect: bombEffect,
    });

    expect(allyPiece.effects.some(e => e.type === 'bomb')).toBe(false);
  });

  it('[V16] Aegis piece is not immune to regular capture', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();

    const allyPos = { col: 4, row: 4 };
    const allyPiece: Piece = {
      id: 'w_pawn_aegis',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [
        {
          id: 'manual_aegis',
          type: 'aegis',
          duration: 2,
          remainingDuration: 2,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'w_pawn_aegis',
          stackingRule: 'refresh',
          isDebuff: false,
          metadata: {},
        },
      ],
    };
    state.board.setPiece(allyPos, allyPiece);

    const enemyPos = { col: 4, row: 5 };
    const enemyPiece: Piece = {
      id: 'b_rook_attacker',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [],
    };
    state.board.setPiece(enemyPos, enemyPiece);

    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Capture goes through
    const res = match.makeMove(Color.Black, enemyPos, allyPos);
    expect(res.success).toBe(true);
    expect(state.board.getPiece(allyPos)).toBe(enemyPiece);
  });

  it('[V17] Aegis piece is not immune to direct DESTROY_PIECE action', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();

    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;
    allyPiece.effects = [
      {
        id: 'manual_aegis',
        type: 'aegis',
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: allyPiece.id,
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: {},
      },
    ];

    match.submitAction({
      type: 'DESTROY_PIECE',
      pieceId: allyPiece.id,
      position: allyPos,
      reason: 'skill',
    });

    expect(state.board.getPiece(allyPos)).toBeNull();
  });

  it('[V18] Aegis piece is immune to cell trap effects (e.g. Thunder Trap)', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();

    // Place an enemy Thunder Trap on cell (4,4)
    const trapEffect: Effect = {
      id: 'trap_thunder',
      type: 'thunder_trap' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'cell',
      targetId: '4,4',
      stackingRule: 'ignore',
      isDebuff: true,
      metadata: {},
    };
    state.board.addCellEffect({ col: 4, row: 4 }, trapEffect);

    // Setup White piece with Aegis at (4,3)
    const allyPos = { col: 4, row: 3 };
    const allyPiece: Piece = {
      id: 'w_pawn_aegis',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [
        {
          id: 'manual_aegis',
          type: 'aegis',
          duration: 2,
          remainingDuration: 2,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'w_pawn_aegis',
          stackingRule: 'refresh',
          isDebuff: false,
          metadata: {},
        },
      ],
    };
    state.board.setPiece(allyPos, allyPiece);

    // Move White piece into Thunder Trap
    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    const moveRes = match.makeMove(Color.White, allyPos, { col: 4, row: 4 });
    expect(moveRes.success).toBe(true);

    // Stun application should be blocked, piece does not get Stunned
    expect(allyPiece.effects.some(e => e.type === 'stun')).toBe(false);
  });

  it('[V19] Aegis piece cannot be targeted by enemy skill directly', () => {
    // We will test using Angel's Holy Seal which targets an enemy piece
    match.setVariants('turtle', 'angel');
    match.start();

    const state = match.getGameState();
    
    // White is Turtle, Black is Angel.
    // Give White piece Aegis
    const whitePos = { col: 4, row: 1 };
    const whitePiece = state.board.getPiece(whitePos)!;
    whitePiece.effects = [
      {
        id: 'manual_aegis',
        type: 'aegis',
        duration: 2,
        remainingDuration: 2,
        tickTiming: 'turnEnd',
        sourcePlayer: Color.White,
        targetType: 'piece',
        targetId: whitePiece.id,
        stackingRule: 'refresh',
        isDebuff: false,
        metadata: {},
      },
    ];

    // Set turn to Black (Angel)
    state.currentTurn = Color.Black;
    state.turnPhase = 'action';
    state.blackAP = 10;

    // Black tries to use Holy Seal (skill1) on White Aegis piece
    const res = match.useSkill(Color.Black, 'angel_holy_seal', [
      { type: 'piece', position: whitePos, pieceId: whitePiece.id },
    ]);

    expect(res.success).toBe(false);
    expect(res.reason).toContain('Aegis immunity');
  });

  it('[V20] Aegis piece is immune to Repel pushback', () => {
    match.setVariants('turtle', 'kaze');
    match.start();

    const state = match.getGameState();

    // Place an enemy Repel on cell (4,4)
    const repelEffect: Effect = {
      id: 'trap_repel',
      type: 'repel' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'cell',
      targetId: '4,4',
      stackingRule: 'ignore',
      isDebuff: true,
      metadata: { batchId: 'batch_repel' },
    };
    state.board.addCellEffect({ col: 4, row: 4 }, repelEffect);

    // Setup White piece with Aegis at (4,3)
    const allyPos = { col: 4, row: 3 };
    const allyPiece: Piece = {
      id: 'w_pawn_aegis',
      type: PieceType.Pawn,
      color: Color.White,
      effects: [
        {
          id: 'manual_aegis',
          type: 'aegis',
          duration: 2,
          remainingDuration: 2,
          tickTiming: 'turnEnd',
          sourcePlayer: Color.White,
          targetType: 'piece',
          targetId: 'w_pawn_aegis',
          stackingRule: 'refresh',
          isDebuff: false,
          metadata: {},
        },
      ],
    };
    state.board.setPiece(allyPos, allyPiece);

    state.currentTurn = Color.White;
    state.turnPhase = 'action';
    state.hasMoved = false;

    // Move White piece into Repel cell
    const moveRes = match.makeMove(Color.White, allyPos, { col: 4, row: 4 });
    expect(moveRes.success).toBe(true);

    // It should stay on (4,4) since pushback was blocked
    expect(state.board.getPiece({ col: 4, row: 4 })).toBe(allyPiece);
    // Repel trap should still be consumed
    expect(state.board.getCellEffects({ col: 4, row: 4 }).some(e => e.type === 'repel')).toBe(false);
  });

  // === Ultimate — Great Sanctuary ===
  it('[V21/V22] Ultimate - apply Aegis for 5 rounds to all allies except Pawn and King', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Verify board has different types of allies: Pawn, Knight, King
    const pawn = state.board.getPiece({ col: 4, row: 1 })!; // Pawn
    const knight = state.board.getPiece({ col: 1, row: 0 })!; // Knight
    
    let king: any = null;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const p = state.board.getPiece({ col: c, row: r });
        if (p && p.type === PieceType.King && p.color === Color.White) {
          king = p;
          break;
        }
      }
    }

    const res = match.useSkill(Color.White, 'turtle_great_sanctuary', []);
    expect(res.success).toBe(true);

    // Knight should receive Aegis, Pawn and King should NOT
    const knightAegis = knight.effects.find(e => e.type === 'aegis');
    expect(knightAegis).toBeDefined();
    expect(knightAegis!.remainingDuration).toBe(5);

    expect(pawn.effects.some(e => e.type === 'aegis')).toBe(false);
    expect(king.effects.some(e => e.type === 'aegis')).toBe(false);
  });

  it('[V23] Ultimate - newly spawned pieces after cast do NOT get Aegis', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    // Cast Ultimate
    const res = match.useSkill(Color.White, 'turtle_great_sanctuary', []);
    expect(res.success).toBe(true);

    // Spawn a new piece
    const newPiece: Piece = {
      id: 'w_new_knight',
      type: PieceType.Knight,
      color: Color.White,
      effects: [],
    };
    state.board.setPiece({ col: 4, row: 5 }, newPiece);

    expect(newPiece.effects.some(e => e.type === 'aegis')).toBe(false);
  });

  // === Regression ===
  it('[V24] Other variants function normally', () => {
    match.setVariants('angel', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const enemyPos = { col: 3, row: 13 };
    const enemyPiece = state.board.getPiece(enemyPos)!;

    // Angel Holy Seal should work normally on lightning enemy
    const res = match.useSkill(Color.White, 'angel_holy_seal', [
      { type: 'piece', position: enemyPos, pieceId: enemyPiece.id },
    ]);
    expect(res.success).toBe(true);
    expect(enemyPiece.effects.some(e => e.type === 'stun')).toBe(true);
  });

  it('[V25] Aegis effect expires correctly after duration', () => {
    match.setVariants('turtle', 'lightning');
    match.start();

    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 4, row: 1 };
    const allyPiece = state.board.getPiece(allyPos)!;

    // Apply Aegis Blessing (duration 2 rounds)
    const res = match.useSkill(Color.White, 'turtle_aegis_blessing', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id },
    ]);
    expect(res.success).toBe(true);
    expect(allyPiece.effects.some(e => e.type === 'aegis')).toBe(true);

    // Round 1 end (White ends turn)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // Black ends turn
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Since it was applied this turn, the first TICK_EFFECTS is skipped.
    // So remaining duration is still 2.
    expect(allyPiece.effects.some(e => e.type === 'aegis')).toBe(true);
    expect(allyPiece.effects.find(e => e.type === 'aegis')!.remainingDuration).toBe(2);

    // Round 2 end (White ends turn)
    match.submitAction({ type: 'END_TURN', player: Color.White });
    // Black ends turn
    match.submitAction({ type: 'END_TURN', player: Color.Black });

    // Remaining duration should now be 1
    expect(allyPiece.effects.some(e => e.type === 'aegis')).toBe(true);
    expect(allyPiece.effects.find(e => e.type === 'aegis')!.remainingDuration).toBe(1);

    // Round 3 end (White ends turn)
    match.submitAction({ type: 'END_TURN', player: Color.White });

    // Aegis should now be expired and removed
    expect(allyPiece.effects.some(e => e.type === 'aegis')).toBe(false);
  });
});
