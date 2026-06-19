import { Test, TestingModule } from '@nestjs/testing';
import { GameGateway } from './game/game.gateway';
import { GameService } from './game/game.service';
import { Color, GameState, Match, Position, Effect } from 'game-core';

describe('Game Core Security - Map Hack Prevention', () => {
  let gateway: GameGateway;
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameGateway, GameService],
    }).compile();

    gateway = module.get<GameGateway>(GameGateway);
    service = module.get<GameService>(GameService);
  });

  // Test 1 — Thunder Trap ẩn với đối thủ
  it('should hide Thunder Trap from opponent player', () => {
    const state = new GameState();
    
    // Setup: White places thunder_trap at E5 (col: 4, row: 4)
    const trapPos: Position = { col: 4, row: 4 };
    const trapEffect: Effect = {
      id: 'trap_e5_test',
      type: 'thunder_trap',
      duration: null,
      remainingDuration: null,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.White,
      targetType: 'cell',
      targetId: '4,4',
      stackingRule: 'ignore',
      isDebuff: false,
      isHidden: true, // Standardized property
      metadata: {},
    };
    state.board.addCellEffect(trapPos, trapEffect);

    // Assert: serializeForPlayer(Color.White) -> E5 has thunder_trap
    const whiteState = state.serializeForPlayer(Color.White);
    const whiteE5Effects = whiteState.board.cellEffects?.['4,4'] || [];
    expect(whiteE5Effects.some(e => e.type === 'thunder_trap')).toBe(true);

    // Assert: serializeForPlayer(Color.Black) -> E5 cellEffects does not have thunder_trap
    const blackState = state.serializeForPlayer(Color.Black);
    const blackE5Effects = blackState.board.cellEffects?.['4,4'] || [];
    expect(blackE5Effects.some(e => e.type === 'thunder_trap')).toBe(false);
  });

  // Test 2 — Board effect của chính mình vẫn thấy
  it('should show public effects to both players', () => {
    const state = new GameState();

    // Setup: Black creates smoke at D5 (col: 3, row: 4)
    const smokePos: Position = { col: 3, row: 4 };
    const smokeEffect: Effect = {
      id: 'smoke_d5_test',
      type: 'smoke' as any, // Cast to any since smoke is a custom type
      duration: 3,
      remainingDuration: 3,
      tickTiming: 'turnEnd',
      sourcePlayer: Color.Black,
      targetType: 'cell',
      targetId: '3,4',
      stackingRule: 'ignore',
      isDebuff: false,
      isHidden: false, // Smoke is public
      metadata: {},
    };
    state.board.addCellEffect(smokePos, smokeEffect);

    // Assert: serializeForPlayer(Color.Black) -> D5 has smoke effect
    const blackState = state.serializeForPlayer(Color.Black);
    const blackD5Effects = blackState.board.cellEffects?.['3,4'] || [];
    expect(blackD5Effects.some(e => e.type === 'smoke' as any)).toBe(true);

    // Assert: serializeForPlayer(Color.White) -> D5 also has smoke effect (public)
    const whiteState = state.serializeForPlayer(Color.White);
    const whiteD5Effects = whiteState.board.cellEffects?.['3,4'] || [];
    expect(whiteD5Effects.some(e => e.type === 'smoke' as any)).toBe(true);
  });

  // Test 3 — Socket emit đúng per-player
  it('should emit correct per-player serialized data over the sockets', () => {
    jest.useFakeTimers();

    // Assign White and Black clients with mocked server.to().emit
    const mockEmitWhite = jest.fn();
    const mockEmitBlack = jest.fn();

    const mockTo = jest.fn((socketId: string) => {
      if (socketId === 'socket-white') {
        return { emit: mockEmitWhite };
      }
      if (socketId === 'socket-black') {
        return { emit: mockEmitBlack };
      }
      return { emit: jest.fn() };
    });

    gateway.server = {
      to: mockTo,
    } as any;

    // Create room
    const clientWhite = { id: 'socket-white', join: jest.fn(), emit: jest.fn() } as any;
    gateway.handleCreateRoom(clientWhite);
    const roomCreatedData = clientWhite.emit.mock.calls[0][1];
    const roomCode = roomCreatedData.roomCode;
    const whitePlayerId = roomCreatedData.playerId;

    // Join room with Black
    const clientBlack = { id: 'socket-black', join: jest.fn(), emit: jest.fn(), to: jest.fn().mockReturnThis() } as any;
    clientBlack.to.mockReturnValue({ emit: jest.fn() });
    gateway.handleJoinRoom(clientBlack, { roomCode });
    const blackPlayerId = clientBlack.emit.mock.calls[0][1].playerId;

    // Set variants and confirm to start match
    gateway.handleSelectVariant(clientWhite, { roomCode, playerId: whitePlayerId, variantId: 'lightning' });
    gateway.handleConfirmVariant(clientWhite, { roomCode, playerId: whitePlayerId });
    gateway.handleConfirmVariant(clientBlack, { roomCode, playerId: blackPlayerId });

    // Advance 8s for transitions to start match
    jest.advanceTimersByTime(8000);

    const room = service.getRoom(roomCode)!;
    const state = room.match!.getGameState();
    state.whiteAP = 5;

    // Reset calls before skill
    mockEmitWhite.mockClear();
    mockEmitBlack.mockClear();

    // White places thunder_trap at H8 (col: 7, row: 7)
    gateway.handleUseSkill(clientWhite, {
      roomCode,
      playerId: whitePlayerId,
      skillId: 'lightning_thunder_trap',
      targets: [{ type: 'cell', position: { col: 7, row: 7 } }],
    });

    // Assert: server.to was called with player socket IDs
    expect(mockTo).toHaveBeenCalledWith('socket-white');
    expect(mockTo).toHaveBeenCalledWith('socket-black');

    // Assert: payload sent to socket-white has the thunder_trap
    const whiteEmitData = mockEmitWhite.mock.calls.find(c => c[0] === 'skill-used')?.[1];
    expect(whiteEmitData).toBeDefined();
    expect(whiteEmitData.board.cellEffects?.['7,7']?.some((e: any) => e.type === 'thunder_trap')).toBe(true);

    // Assert: payload sent to socket-black does NOT have the thunder_trap
    const blackEmitData = mockEmitBlack.mock.calls.find(c => c[0] === 'skill-used')?.[1];
    expect(blackEmitData).toBeDefined();
    const blackH8Effects = blackEmitData.board.cellEffects?.['7,7'] || [];
    expect(blackH8Effects.some((e: any) => e.type === 'thunder_trap')).toBe(false);

    jest.useRealTimers();
  });
});
