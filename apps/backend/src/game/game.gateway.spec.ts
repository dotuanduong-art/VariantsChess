import { Test, TestingModule } from '@nestjs/testing';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { Color } from 'game-core';
import { Socket } from 'socket.io';

describe('GameGateway', () => {
  let gateway: GameGateway;
  let service: GameService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameGateway, GameService],
    }).compile();

    gateway = module.get<GameGateway>(GameGateway);
    service = module.get<GameService>(GameService);

    // Mock Socket.IO server
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as any;
  });

  it('should allow selecting variants in lobby and loading them when match starts', () => {
    jest.useFakeTimers();
    // 1. Create a room for White player
    const clientWhite = { id: 'socket_white', join: jest.fn(), emit: jest.fn() } as any as Socket;
    gateway.handleCreateRoom(clientWhite);
    expect(clientWhite.emit).toHaveBeenCalledWith('room-created', expect.any(Object));
    const roomCreatedData = (clientWhite.emit as jest.Mock).mock.calls[0][1];
    const roomCode = roomCreatedData.roomCode;
    const whitePlayerId = roomCreatedData.playerId;

    // 2. Select variant 'lightning' for White
    gateway.handleSelectVariant(clientWhite, { roomCode, playerId: whitePlayerId, variantId: 'lightning' });
    expect(gateway.server.to).toHaveBeenCalledWith(roomCode);
    expect(gateway.server.emit).toHaveBeenCalledWith('player-variant-selected', {
      playerId: whitePlayerId,
      variantId: null,
      confirmed: false,
    });

    // Verify variant is saved on White player
    const room = service.getRoom(roomCode);
    expect(room).toBeDefined();
    const whitePlayer = room!.players.find(p => p.id === whitePlayerId);
    expect(whitePlayer?.variantId).toBe('lightning');

    // 3. Join room with Black player (auto-starts match)
    const clientBlack = { id: 'socket_black', join: jest.fn(), emit: jest.fn(), to: jest.fn().mockReturnThis() } as any as Socket;
    // We mock clientBlack.to to return an object with emit
    (clientBlack.to as jest.Mock).mockReturnValue({ emit: jest.fn() });

    gateway.handleJoinRoom(clientBlack, { roomCode });
    expect(clientBlack.emit).toHaveBeenCalledWith('room-joined', expect.any(Object));
    const blackPlayerId = (clientBlack.emit as jest.Mock).mock.calls[0][1].playerId;

    // Confirm variant choices for both players to start match
    gateway.handleConfirmVariant(clientWhite, { roomCode, playerId: whitePlayerId });
    gateway.handleConfirmVariant(clientBlack, { roomCode, playerId: blackPlayerId });

    // Advance timers for 3s reveal + 5s loading
    jest.advanceTimersByTime(8000);

    // Verify match is created and variants are loaded on Match
    expect(room!.match).not.toBeNull();
    const gameState = room!.match!.getGameState();
    expect(gameState.whiteVariantId).toBe('lightning');
    expect(gameState.blackVariantId).toBe('lightning'); // Defaulted to lightning
    jest.useRealTimers();
  });

  it('should execute a skill and broadcast state', () => {
    jest.useFakeTimers();
    // 1. Create room and join Black
    const clientWhite = { id: 'socket_white', join: jest.fn(), emit: jest.fn() } as any as Socket;
    gateway.handleCreateRoom(clientWhite);
    const roomCode = (clientWhite.emit as jest.Mock).mock.calls[0][1].roomCode;
    const whitePlayerId = (clientWhite.emit as jest.Mock).mock.calls[0][1].playerId;

    const clientBlack = { id: 'socket_black', join: jest.fn(), emit: jest.fn(), to: jest.fn().mockReturnThis() } as any as Socket;
    (clientBlack.to as jest.Mock).mockReturnValue({ emit: jest.fn() });
    
    // Select variant 'lightning' for White before start
    gateway.handleSelectVariant(clientWhite, { roomCode, playerId: whitePlayerId, variantId: 'lightning' });

    gateway.handleJoinRoom(clientBlack, { roomCode });
    const blackPlayerId = (clientBlack.emit as jest.Mock).mock.calls[0][1].playerId;

    // Confirm variant choices to trigger reveal -> loading -> play
    gateway.handleConfirmVariant(clientWhite, { roomCode, playerId: whitePlayerId });
    gateway.handleConfirmVariant(clientBlack, { roomCode, playerId: blackPlayerId });

    // Advance timers (3s reveal + 5s loading)
    jest.advanceTimersByTime(8000);

    const room = service.getRoom(roomCode)!;
    const match = room.match!;
    const state = match.getGameState();
    state.whiteAP = 5; // Give AP to White player

    // 2. White uses Thunder Trap
    gateway.handleUseSkill(clientWhite, {
      roomCode,
      playerId: whitePlayerId,
      skillId: 'lightning_thunder_trap',
      targets: [{ type: 'cell', position: { col: 4, row: 4 } }],
    });

    // Verify skill broadcast was made
    expect(gateway.server.to).toHaveBeenCalledWith(roomCode);
    expect(gateway.server.emit).toHaveBeenCalledWith('skill-used', expect.objectContaining({
      skillId: 'lightning_thunder_trap',
      playerId: whitePlayerId,
    }));

    // Verify state effect is applied
    const cellEffects = state.board.getCellEffects({ col: 4, row: 4 });
    expect(cellEffects.length).toBe(1);
    expect(cellEffects[0].type).toBe('thunder_trap');
    expect(state.whiteAP).toBe(2); // AP deducted
    jest.useRealTimers();
  });

  it('should reject invalid skill activations', () => {
    jest.useFakeTimers();
    // 1. Create and start match
    const clientWhite = { id: 'socket_white', join: jest.fn(), emit: jest.fn() } as any as Socket;
    gateway.handleCreateRoom(clientWhite);
    const roomCode = (clientWhite.emit as jest.Mock).mock.calls[0][1].roomCode;
    const whitePlayerId = (clientWhite.emit as jest.Mock).mock.calls[0][1].playerId;

    const clientBlack = { id: 'socket_black', join: jest.fn(), emit: jest.fn(), to: jest.fn().mockReturnThis() } as any as Socket;
    (clientBlack.to as jest.Mock).mockReturnValue({ emit: jest.fn() });
    
    gateway.handleSelectVariant(clientWhite, { roomCode, playerId: whitePlayerId, variantId: 'lightning' });
    gateway.handleJoinRoom(clientBlack, { roomCode });
    const blackPlayerId = (clientBlack.emit as jest.Mock).mock.calls[0][1].playerId;

    // Confirm variant choices to trigger reveal -> loading -> play
    gateway.handleConfirmVariant(clientWhite, { roomCode, playerId: whitePlayerId });
    gateway.handleConfirmVariant(clientBlack, { roomCode, playerId: blackPlayerId });

    // Advance timers (3s reveal + 5s loading)
    jest.advanceTimersByTime(8000);

    const room = service.getRoom(roomCode)!;
    const match = room.match!;
    const state = match.getGameState();
    state.whiteAP = 0; // Not enough AP

    // 2. White uses Thunder Trap
    gateway.handleUseSkill(clientWhite, {
      roomCode,
      playerId: whitePlayerId,
      skillId: 'lightning_thunder_trap',
      targets: [{ type: 'cell', position: { col: 4, row: 4 } }],
    });

    // Should emit skill-rejected to clientWhite
    expect(clientWhite.emit).toHaveBeenCalledWith('skill-rejected', expect.objectContaining({
      reason: expect.any(String),
    }));
    jest.useRealTimers();
  });
});
