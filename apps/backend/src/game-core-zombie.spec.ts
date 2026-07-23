import {
  Match,
  Color,
  PieceType,
  getPieceOwner,
  oppositeColor,
} from 'game-core';

function clearBoard(board: any): void {
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      board.removePiece({ col: c, row: r });
    }
  }
}

describe('Chess Variant Engine - Zombie Variant (Z1-Z16)', () => {
  let match: Match;

  beforeEach(() => {
    match = new Match();
    match.setVariants('zombie', 'lightning');
  });

  // Z1: Skill 1 applies Zombie effect to ally.
  it('Z1: Skill 1 applies Zombie effect to ally', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const allyPos = { col: 0, row: 1 }; // White pawn
    const allyPiece = state.board.getPiece(allyPos)!;

    const res = match.useSkill(Color.White, 'zombie_infection', [
      { type: 'piece', position: allyPos, pieceId: allyPiece.id }
    ]);

    expect(res.success).toBe(true);
    expect(allyPiece.effects.some(e => e.type === 'zombie')).toBe(true);
  });

  // Z2: Skill 1 is free for the first 3 activations and then costs 5 AP.
  it('Z2: Skill 1 is free for the first 3 activations and then costs 5 AP', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = state.board.getPiece({ col: 0, row: 1 })!;
    const p2 = state.board.getPiece({ col: 1, row: 1 })!;
    const p3 = state.board.getPiece({ col: 2, row: 1 })!;
    const p4 = state.board.getPiece({ col: 3, row: 1 })!;

    // 1st use - free
    let res = match.useSkill(Color.White, 'zombie_infection', [{ type: 'piece', position: { col: 0, row: 1 }, pieceId: p1.id }]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(10);
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    // 2nd use - free
    res = match.useSkill(Color.White, 'zombie_infection', [{ type: 'piece', position: { col: 1, row: 1 }, pieceId: p2.id }]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(10);
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    // 3rd use - free
    res = match.useSkill(Color.White, 'zombie_infection', [{ type: 'piece', position: { col: 2, row: 1 }, pieceId: p3.id }]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(10);
    state.skillsUsedThisTurn = 0;
    state.skillsUsedThisTurnIds = [];

    // 4th use - costs 5 AP
    res = match.useSkill(Color.White, 'zombie_infection', [{ type: 'piece', position: { col: 3, row: 1 }, pieceId: p4.id }]);
    expect(res.success).toBe(true);
    expect(state.whiteAP).toBe(5); // 10 - 5
  });

  // Z3: Zombie piece can move normally + has bite targets.
  it('Z3: Zombie piece can move normally + has bite targets', () => {
    match.start();
    const state = match.getGameState();
    
    // Set up a white rook as a Zombie at (0, 0)
    const rook = state.board.getPiece({ col: 0, row: 0 })!;
    rook.effects.push({
      id: 'zombie_rook',
      type: 'zombie' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    // Make the board empty except for our rook and an enemy pawn at (0, 5)
    clearBoard(state.board);
    state.board.setPiece({ col: 0, row: 0 }, rook);

    const enemyPawn = { id: 'enemy_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 5 }, enemyPawn);

    // Get legal moves for rook
    const moves = match.getLegalMovesAt({ col: 0, row: 0 });
    const targetMove = moves.find(m => m.col === 0 && m.row === 5) as any;
    expect(targetMove).toBeDefined();
    expect(targetMove.moveType).toBe('zombie_bite');

    // Mover check empty space (0, 3)
    const normalMove = moves.find(m => m.col === 0 && m.row === 3) as any;
    expect(normalMove).toBeDefined();
    expect(normalMove.moveType).toBe('normal');
  });

  // Z4: Zombie bite does not move attacker, target becomes Walker.
  it('Z4: Zombie bite does not move attacker, target becomes Walker', () => {
    match.start();
    const state = match.getGameState();

    const rook = state.board.getPiece({ col: 0, row: 0 })!;
    rook.effects.push({
      id: 'zombie_rook',
      type: 'zombie' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    clearBoard(state.board);
    state.board.setPiece({ col: 0, row: 0 }, rook);

    const enemyPawn = { id: 'enemy_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 5 }, enemyPawn);

    // Make the bite move
    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 5 }, 'zombie_bite');
    if (!res.success) {
      console.log('Z4 bite move failed reason:', res.reason);
    }
    expect(res.success).toBe(true);

    // Attacker should stay at (0, 0)
    expect(state.board.getPiece({ col: 0, row: 0 })?.id).toBe(rook.id);
    // Target is still at (0, 5) but now has walker effect
    const bittenPiece = state.board.getPiece({ col: 0, row: 5 })!;
    expect(bittenPiece.id).toBe('enemy_pawn');
    expect(bittenPiece.effects.some(e => e.type === 'walker')).toBe(true);
    expect(getPieceOwner(bittenPiece)).toBe(Color.White);
  });

  // Z5: Cannot bite a piece that already has Walker.
  it('Z5: Cannot bite a piece that already has Walker', () => {
    match.start();
    const state = match.getGameState();

    const rook = state.board.getPiece({ col: 0, row: 0 })!;
    rook.effects.push({
      id: 'zombie_rook',
      type: 'zombie' as any,
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'piece',
      targetId: rook.id,
      stackingRule: 'ignore',
      isDebuff: false,
      metadata: {},
    });

    clearBoard(state.board);
    state.board.setPiece({ col: 0, row: 0 }, rook);

    // Enemy pawn with walker effect already
    const enemyPawn = {
      id: 'enemy_pawn',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [{
        id: 'walker_pawn',
        type: 'walker' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'enemy_pawn',
        stackingRule: 'ignore' as any,
        isDebuff: true,
        metadata: { controlledBy: Color.White },
      }],
    };
    state.board.setPiece({ col: 0, row: 5 }, enemyPawn);

    // Try to bite it
    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 5 }, 'zombie_bite');
    expect(res.success).toBe(false); // Should fail validation in action pipeline
  });

  // Z6: Walker Type 1 retains original enemy color but is controllable by Zombie player.
  it('Z6: Walker Type 1 retains original enemy color but is controllable by Zombie player', () => {
    match.start();
    const state = match.getGameState();

    const walker = {
      id: 'walker_1',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [{
        id: 'w1_effect',
        type: 'walker' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'walker_1',
        stackingRule: 'ignore' as any,
        isDebuff: true,
        metadata: { controlledBy: Color.White },
      }],
    };
    state.board.setPiece({ col: 0, row: 5 }, walker);

    expect(walker.color).toBe(Color.Black); // original enemy color
    expect(getPieceOwner(walker)).toBe(Color.White); // controlled by White Zombie player
  });

  // Z7: Walker cannot capture (must only move to empty squares).
  it('Z7: Walker cannot capture (must only move to empty squares)', () => {
    match.start();
    const state = match.getGameState();

    const walkerRook = {
      id: 'walker_rook',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [{
        id: 'w_rook_effect',
        type: 'walker' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'walker_rook',
        stackingRule: 'ignore' as any,
        isDebuff: true,
        metadata: { controlledBy: Color.White },
      }],
    };
    clearBoard(state.board);
    state.board.setPiece({ col: 0, row: 0 }, walkerRook);

    // Enemy pawn at (0, 5)
    const enemyPawn = { id: 'ep', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 5 }, enemyPawn);

    const moves = match.getLegalMovesAt({ col: 0, row: 0 });
    // Should NOT contain (0, 5) since Walker cannot capture
    expect(moves.some(m => m.col === 0 && m.row === 5)).toBe(false);
  });

  // Z8: Walker can be captured by opponent normal pieces.
  it('Z8: Walker can be captured by opponent normal pieces', () => {
    match.start();
    const state = match.getGameState();

    const walker = {
      id: 'walker_1',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [{
        id: 'w1',
        type: 'walker' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'walker_1',
        stackingRule: 'ignore' as any,
        isDebuff: true,
        metadata: { controlledBy: Color.White },
      }],
    };
    clearBoard(state.board);
    state.board.setPiece({ col: 0, row: 5 }, walker);

    // Opponent black rook at (0, 0)
    const blackRook = { id: 'black_rook', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 0 }, blackRook);

    // Black's turn
    state.currentTurn = Color.Black;

    // Black rook captures Walker at (0, 5)
    const res = match.makeMove(Color.Black, { col: 0, row: 0 }, { col: 0, row: 5 });
    expect(res.success).toBe(true);
    expect(state.board.getPiece({ col: 0, row: 5 })?.id).toBe('black_rook');
  });

  // Z9: Zombie player can move the Walker on their turn.
  it('Z9: Zombie player can move the Walker on their turn', () => {
    match.start();
    const state = match.getGameState();

    const walker = {
      id: 'walker_1',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [{
        id: 'w1',
        type: 'walker' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'walker_1',
        stackingRule: 'ignore' as any,
        isDebuff: true,
        metadata: { controlledBy: Color.White },
      }],
    };
    clearBoard(state.board);
    state.board.setPiece({ col: 0, row: 0 }, walker);

    const res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 5 });
    expect(res.success).toBe(true);
    expect(state.board.getPiece({ col: 0, row: 5 })?.id).toBe('walker_1');
  });

  // Z10: Zombie player can only make 1 move per turn (either normal piece OR Walker).
  it('Z10: Zombie player can only make 1 move per turn', () => {
    match.start();
    const state = match.getGameState();

    const walker = {
      id: 'walker_1',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [{
        id: 'w1',
        type: 'walker' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'walker_1',
        stackingRule: 'ignore' as any,
        isDebuff: true,
        metadata: { controlledBy: Color.White },
      }],
    };
    const whitePawn = { id: 'w_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    clearBoard(state.board);
    state.board.setPiece({ col: 0, row: 0 }, walker);
    state.board.setPiece({ col: 2, row: 1 }, whitePawn);

    // Make first move with Walker
    let res = match.makeMove(Color.White, { col: 0, row: 0 }, { col: 0, row: 2 });
    expect(res.success).toBe(true);

    // Try to make a second move with the white pawn
    res = match.makeMove(Color.White, { col: 2, row: 1 }, { col: 2, row: 2 });
    expect(res.success).toBe(false); // already moved this turn
  });

  // Z11: Skill 2 changes Walker Type 1 color to Zombie player and applies Zombie effect.
  it('Z11: Skill 2 changes Walker Type 1 color to Zombie player and applies Zombie effect', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const walker = {
      id: 'walker_1',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [{
        id: 'w1',
        type: 'walker' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'walker_1',
        stackingRule: 'ignore' as any,
        isDebuff: true,
        metadata: { controlledBy: Color.White },
      }],
    };
    state.board.setPiece({ col: 0, row: 5 }, walker);

    const res = match.useSkill(Color.White, 'zombie_mutation', [
      { type: 'piece', position: { col: 0, row: 5 }, pieceId: 'walker_1' }
    ]);

    expect(res.success).toBe(true);
    const mutated = state.board.getPiece({ col: 0, row: 5 })!;
    expect(mutated.color).toBe(Color.White); // mutated color to White
    expect(mutated.effects.some(e => e.type === 'walker')).toBe(false); // removed walker effect
    expect(mutated.effects.some(e => e.type === 'zombie')).toBe(true); // applied zombie effect
  });

  // Z12: Mutated piece has normal moves + bite targets.
  it('Z12: Mutated piece has normal moves + bite targets', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const walker = {
      id: 'walker_1',
      type: PieceType.Rook,
      color: Color.Black,
      effects: [{
        id: 'w1',
        type: 'walker' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'walker_1',
        stackingRule: 'ignore' as any,
        isDebuff: true,
        metadata: { controlledBy: Color.White },
      }],
    };
    clearBoard(state.board);
    state.board.setPiece({ col: 0, row: 0 }, walker);

    // Enemy pawn at (0, 5)
    const enemyPawn = { id: 'ep', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 5 }, enemyPawn);

    // Mutate
    match.useSkill(Color.White, 'zombie_mutation', [{ type: 'piece', position: { col: 0, row: 0 }, pieceId: 'walker_1' }]);

    // Mutated piece is now Zombie and should have bite moves on (0, 5)
    const moves = match.getLegalMovesAt({ col: 0, row: 0 });
    const targetMove = moves.find(m => m.col === 0 && m.row === 5) as any;
    expect(targetMove).toBeDefined();
    expect(targetMove.moveType).toBe('zombie_bite');
  });

  // Z13: Ultimate resurrects 2 most recent friendly dead pieces.
  it('Z13: Ultimate resurrects 2 most recent friendly dead pieces', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = { id: 'p1', type: PieceType.Pawn, color: Color.White, effects: [] };
    const p2 = { id: 'p2', type: PieceType.Pawn, color: Color.White, effects: [] };

    state.graveyard.push({
      piece: p1,
      position: { col: 2, row: 2 },
      turnDied: 2,
      killedBy: 'capture',
    });
    state.graveyard.push({
      piece: p2,
      position: { col: 3, row: 3 },
      turnDied: 3,
      killedBy: 'capture',
    });

    const res = match.useSkill(Color.White, 'zombie_outbreak', []);
    expect(res.success).toBe(true);

    const resurrected1 = state.board.getPiece({ col: 2, row: 2 })!;
    const resurrected2 = state.board.getPiece({ col: 3, row: 3 })!;

    expect(resurrected1).toBeDefined();
    expect(resurrected1.id).toBe('p1');
    expect(resurrected1.effects.some(e => e.type === 'walker')).toBe(true);

    expect(resurrected2).toBeDefined();
    expect(resurrected2.id).toBe('p2');
    expect(resurrected2.effects.some(e => e.type === 'walker')).toBe(true);
  });

  // Z14: Respawn positions blocked -> skipped.
  it('Z14: Respawn positions blocked -> skipped', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = { id: 'p1', type: PieceType.Pawn, color: Color.White, effects: [] };
    const p2 = { id: 'p2', type: PieceType.Pawn, color: Color.White, effects: [] };

    state.graveyard.push({
      piece: p1,
      position: { col: 2, row: 2 },
      turnDied: 2,
      killedBy: 'capture',
    });
    state.graveyard.push({
      piece: p2,
      position: { col: 3, row: 3 },
      turnDied: 3,
      killedBy: 'capture',
    });

    // Place an obstacle at (2, 2)
    const obstacle = { id: 'obstacle', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 2, row: 2 }, obstacle);

    const res = match.useSkill(Color.White, 'zombie_outbreak', []);
    expect(res.success).toBe(true);

    // (2, 2) should remain obstacle
    expect(state.board.getPiece({ col: 2, row: 2 })?.id).toBe('obstacle');
    // (3, 3) should have resurrected p2
    expect(state.board.getPiece({ col: 3, row: 3 })?.id).toBe('p2');
  });

  // Z15: Resurrected pieces get Walker Type 2 (friendly color, cannot capture).
  it('Z15: Resurrected pieces get Walker Type 2 (friendly color, cannot capture)', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = { id: 'p1', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.graveyard.push({
      piece: p1,
      position: { col: 2, row: 2 },
      turnDied: 2,
      killedBy: 'capture',
    });

    match.useSkill(Color.White, 'zombie_outbreak', []);

    const resurrected = state.board.getPiece({ col: 2, row: 2 })!;
    expect(resurrected.color).toBe(Color.White); // Walker Type 2 friendly color
    expect(resurrected.effects.some(e => e.type === 'walker')).toBe(true);
    expect(getPieceOwner(resurrected)).toBe(Color.White);
  });

  // Z16: Zombie player cannot control standard enemy pieces.
  it('Z16: Zombie player cannot control standard enemy pieces', () => {
    match.start();
    const state = match.getGameState();

    const enemyPawn = { id: 'enemy_pawn', type: PieceType.Pawn, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 0, row: 5 }, enemyPawn);

    // White tries to move the enemy pawn
    const res = match.makeMove(Color.White, { col: 0, row: 5 }, { col: 0, row: 4 });
    expect(res.success).toBe(false);
  });

  // Z17: Skill 1 bị reject khi đã có đúng 5 quân Zombie trên board
  it('Z17: Skill 1 bị reject khi đã có đúng 5 quân Zombie trên board', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    clearBoard(state.board);
    // Add 5 Zombie pieces on board
    for (let i = 0; i < 5; i++) {
      const zombie = {
        id: `z_${i}`,
        type: PieceType.Pawn,
        color: Color.White,
        effects: [{
          id: `z_eff_${i}`,
          type: 'zombie' as any,
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd' as any,
          sourcePlayer: Color.White,
          targetType: 'piece' as any,
          targetId: `z_${i}`,
          stackingRule: 'ignore' as any,
          isDebuff: false,
          metadata: {},
        }],
      };
      state.board.setPiece({ col: i, row: 0 }, zombie);
    }

    // Add another clean pawn to infect
    const targetPawn = { id: 'target_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 5, row: 0 }, targetPawn);

    // Try to infect
    const res = match.useSkill(Color.White, 'zombie_infection', [
      { type: 'piece', position: { col: 5, row: 0 }, pieceId: 'target_pawn' }
    ]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('tối đa 5');
  });

  // Z18: Skill 2 bị reject khi đã có đúng 5 quân Zombie trên board
  it('Z18: Skill 2 bị reject khi đã có đúng 5 quân Zombie trên board', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    clearBoard(state.board);
    // Add 5 Zombie pieces on board
    for (let i = 0; i < 5; i++) {
      const zombie = {
        id: `z_${i}`,
        type: PieceType.Pawn,
        color: Color.White,
        effects: [{
          id: `z_eff_${i}`,
          type: 'zombie' as any,
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd' as any,
          sourcePlayer: Color.White,
          targetType: 'piece' as any,
          targetId: `z_${i}`,
          stackingRule: 'ignore' as any,
          isDebuff: false,
          metadata: {},
        }],
      };
      state.board.setPiece({ col: i, row: 0 }, zombie);
    }

    // Add a Walker piece
    const walker = {
      id: 'walker_1',
      type: PieceType.Pawn,
      color: Color.Black,
      effects: [{
        id: 'w1',
        type: 'walker' as any,
        duration: null,
        remainingDuration: null,
        tickTiming: 'turnEnd' as any,
        sourcePlayer: Color.White,
        targetType: 'piece' as any,
        targetId: 'walker_1',
        stackingRule: 'ignore' as any,
        isDebuff: true,
        metadata: { controlledBy: Color.White },
      }],
    };
    state.board.setPiece({ col: 5, row: 0 }, walker);

    // Try to mutate
    const res = match.useSkill(Color.White, 'zombie_mutation', [
      { type: 'piece', position: { col: 5, row: 0 }, pieceId: 'walker_1' }
    ]);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('tối đa 5');
  });

  // Z19: Khi 1 Zombie chết -> count giảm xuống 4 -> có thể tạo Zombie mới
  it('Z19: Khi 1 Zombie chết -> count giảm xuống 4 -> có thể tạo Zombie mới', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    clearBoard(state.board);
    // Add 5 Zombie pieces on board
    for (let i = 0; i < 5; i++) {
      const zombie = {
        id: `z_${i}`,
        type: PieceType.Pawn,
        color: Color.White,
        effects: [{
          id: `z_eff_${i}`,
          type: 'zombie' as any,
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd' as any,
          sourcePlayer: Color.White,
          targetType: 'piece' as any,
          targetId: `z_${i}`,
          stackingRule: 'ignore' as any,
          isDebuff: false,
          metadata: {},
        }],
      };
      state.board.setPiece({ col: i, row: 0 }, zombie);
    }

    // Add target pawn to infect
    const targetPawn = { id: 'target_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 5, row: 0 }, targetPawn);

    // Kill one Zombie
    state.board.setPiece({ col: 4, row: 0 }, null);

    // Try to infect should now succeed
    const res = match.useSkill(Color.White, 'zombie_infection', [
      { type: 'piece', position: { col: 5, row: 0 }, pieceId: 'target_pawn' }
    ]);
    expect(res.success).toBe(true);
  });

  // Z20: Zombie count đếm đúng theo player (không đếm Zombie của đối thủ nếu có)
  it('Z20: Zombie count đếm đúng theo player (không đếm Zombie của đối thủ nếu có)', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    clearBoard(state.board);
    // Add 4 Zombie pieces belonging to White
    for (let i = 0; i < 4; i++) {
      const zombie = {
        id: `z_w_${i}`,
        type: PieceType.Pawn,
        color: Color.White,
        effects: [{
          id: `zw_eff_${i}`,
          type: 'zombie' as any,
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd' as any,
          sourcePlayer: Color.White,
          targetType: 'piece' as any,
          targetId: `z_w_${i}`,
          stackingRule: 'ignore' as any,
          isDebuff: false,
          metadata: {},
        }],
      };
      state.board.setPiece({ col: i, row: 0 }, zombie);
    }

    // Add 2 Zombie pieces belonging to Black
    for (let i = 0; i < 2; i++) {
      const zombie = {
        id: `z_b_${i}`,
        type: PieceType.Pawn,
        color: Color.Black,
        effects: [{
          id: `zb_eff_${i}`,
          type: 'zombie' as any,
          duration: null,
          remainingDuration: null,
          tickTiming: 'turnEnd' as any,
          sourcePlayer: Color.Black,
          targetType: 'piece' as any,
          targetId: `z_b_${i}`,
          stackingRule: 'ignore' as any,
          isDebuff: false,
          metadata: {},
        }],
      };
      state.board.setPiece({ col: i + 5, row: 0 }, zombie);
    }

    // Add target pawn for White to infect
    const targetPawn = { id: 'target_pawn', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.board.setPiece({ col: 4, row: 0 }, targetPawn);

    // Try to infect should succeed since White only has 4 zombies (despite total 6 zombies on board)
    const res = match.useSkill(Color.White, 'zombie_infection', [
      { type: 'piece', position: { col: 4, row: 0 }, pieceId: 'target_pawn' }
    ]);
    expect(res.success).toBe(true);
  });

  // Z_BUG1: Ultimate bị reject (canActivate trả lỗi) khi graveyard trống
  it('Z_BUG1: Ultimate bị reject (canActivate trả lỗi) khi graveyard trống', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    state.graveyard = [];

    const res = match.useSkill(Color.White, 'zombie_outbreak', []);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('hồi sinh');
  });

  // Z_BUG2: Ultimate bị reject khi graveyard có quân nhưng tất cả ô hồi sinh đều bị chiếm
  it('Z_BUG2: Ultimate bị reject khi graveyard có quân nhưng tất cả ô hồi sinh đều bị chiếm', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = { id: 'p1', type: PieceType.Pawn, color: Color.White, effects: [] };
    state.graveyard = [{
      piece: p1,
      position: { col: 2, row: 2 },
      turnDied: 2,
      killedBy: 'capture',
    }];

    // Place an obstacle at (2, 2)
    const obstacle = { id: 'obstacle', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 2, row: 2 }, obstacle);

    const res = match.useSkill(Color.White, 'zombie_outbreak', []);
    expect(res.success).toBe(false);
    expect(res.reason).toContain('hồi sinh');
  });

  // Z_BUG3: Ultimate thành công khi có ít nhất 1 quân hợp lệ (dù chỉ 1 trong 2)
  it('Z_BUG3: Ultimate thành công khi có ít nhất 1 quân hợp lệ (dù chỉ 1 trong 2)', () => {
    match.start();
    const state = match.getGameState();
    state.whiteAP = 10;
    state.currentTurn = Color.White;
    state.turnPhase = 'action';

    const p1 = { id: 'p1', type: PieceType.Pawn, color: Color.White, effects: [] };
    const p2 = { id: 'p2', type: PieceType.Pawn, color: Color.White, effects: [] };

    state.graveyard = [
      {
        piece: p1,
        position: { col: 2, row: 2 },
        turnDied: 2,
        killedBy: 'capture',
      },
      {
        piece: p2,
        position: { col: 3, row: 3 },
        turnDied: 3,
        killedBy: 'capture',
      }
    ];

    // Block one of the positions (2, 2)
    const obstacle = { id: 'obstacle', type: PieceType.Rook, color: Color.Black, effects: [] };
    state.board.setPiece({ col: 2, row: 2 }, obstacle);
    // Keep (3, 3) empty

    const res = match.useSkill(Color.White, 'zombie_outbreak', []);
    expect(res.success).toBe(true);

    // Obstacle remains at (2, 2)
    expect(state.board.getPiece({ col: 2, row: 2 })?.id).toBe('obstacle');
    // p2 is resurrected at (3, 3)
    const resurrected = state.board.getPiece({ col: 3, row: 3 })!;
    expect(resurrected).toBeDefined();
    expect(resurrected.id).toBe('p2');
  });
});
