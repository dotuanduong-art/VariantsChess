// ============================================================
// Game Gateway - Socket.IO WebSocket handler
// ============================================================

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service.js';
import { Color } from 'game-core';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
  },
})
export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly gameService: GameService) {}

  private scheduleTurnTimeout(roomCode: string): void {
    const room = this.gameService.getRoom(roomCode);
    if (!room || !room.match) return;
    
    const state = room.match.toSerializable();
    if (state.status !== 'playing') return;
    if (state.moveHistory.length === 0) {
      this.gameService.clearTurnTimeout(roomCode);
      return;
    }

    const delay = state.currentTurn === Color.White ? state.whiteTimeLeft : state.blackTimeLeft;
    
    this.gameService.setTurnTimeout(roomCode, delay, () => {
      const match = this.gameService.getRoom(roomCode)?.match;
      if (!match) return;
      
      const timeoutWinner = match.checkTimeout();
      if (timeoutWinner) {
        this.server.to(roomCode).emit('match-ended', {
          winner: timeoutWinner,
          reason: 'Time out',
        });
        console.log(`Match ended in room ${roomCode} by timeout. Winner: ${timeoutWinner}`);
      }
    });
  }

  // ─── Create Room ─────────────────────────────────────────
  @SubscribeMessage('create-room')
  handleCreateRoom(@ConnectedSocket() client: Socket): void {
    const { roomCode, playerId } = this.gameService.createRoom(client.id);
    client.join(roomCode);
    client.emit('room-created', { roomCode, playerId });
    console.log(`Room ${roomCode} created by ${playerId}`);
  }

  // ─── Join Room ───────────────────────────────────────────
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string }
  ): void {
    const result = this.gameService.joinRoom(data.roomCode, client.id);

    if (!result.success) {
      client.emit('error', { message: result.error });
      return;
    }

    const playerObj = result.players?.find(p => p.socketId === client.id);
    client.join(data.roomCode);
    client.emit('room-joined', {
      roomCode: data.roomCode,
      playerId: result.playerId,
      playerColor: playerObj ? playerObj.color : Color.Black,
      players: result.players?.map(p => ({ id: p.id, color: p.color })),
    });

    // Notify existing player
    client.to(data.roomCode).emit('player-joined', {
      playerId: result.playerId,
      players: result.players?.map(p => ({ id: p.id, color: p.color })),
    });

    // Auto-start match when 2 players are in
    const startResult = this.gameService.startMatch(data.roomCode);
    if (startResult.success) {
      this.server.to(data.roomCode).emit('match-started', {
        board: startResult.matchState!.board,
        currentTurn: startResult.matchState!.currentTurn,
        status: startResult.matchState!.status,
        whiteTimeLeft: startResult.matchState!.whiteTimeLeft,
        blackTimeLeft: startResult.matchState!.blackTimeLeft,
        lastMoveTimestamp: startResult.matchState!.lastMoveTimestamp,
      });
      this.scheduleTurnTimeout(data.roomCode);
      console.log(`Match started in room ${data.roomCode}`);
    }
  }

  // ─── Change Color ────────────────────────────────────────
  @SubscribeMessage('change-color')
  handleChangeColor(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string; color: string }
  ): void {
    const colorVal = data.color === 'White' ? Color.White : Color.Black;
    const result = this.gameService.changePlayerColor(data.roomCode, data.playerId, colorVal);
    if (!result.success) {
      client.emit('error', { message: result.error });
      return;
    }

    // Broadcast the color change to all clients in the room
    this.server.to(data.roomCode).emit('player-color-changed', {
      playerId: data.playerId,
      color: data.color,
    });
  }

  // ─── Move ────────────────────────────────────────────────
  @SubscribeMessage('move')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string; from: string; to: string }
  ): void {
    const result = this.gameService.makeMove(
      data.roomCode,
      data.playerId,
      data.from,
      data.to
    );

    if (!result.success) {
      client.emit('move-rejected', { reason: result.error });
      return;
    }

    this.server.to(data.roomCode).emit('move-made', {
      from: data.from,
      to: data.to,
      board: result.matchState!.board,
      currentTurn: result.matchState!.currentTurn,
      capturedPiece: result.capturedPiece,
      whiteTimeLeft: result.matchState!.whiteTimeLeft,
      blackTimeLeft: result.matchState!.blackTimeLeft,
      lastMoveTimestamp: result.matchState!.lastMoveTimestamp,
    });

    // Check for game over
    if (result.isKingCaptured && result.winner) {
      this.gameService.clearTurnTimeout(data.roomCode);
      this.server.to(data.roomCode).emit('match-ended', {
        winner: result.winner,
      });
      console.log(`Match ended in room ${data.roomCode}. Winner: ${result.winner}`);
    } else if (result.matchState?.status === 'finished') {
      // Game over by timeout processed in makeMove
      this.gameService.clearTurnTimeout(data.roomCode);
      this.server.to(data.roomCode).emit('match-ended', {
        winner: result.matchState.winner,
        reason: 'Time out',
      });
    } else {
      this.scheduleTurnTimeout(data.roomCode);
    }
  }

  // ─── Reconnect ───────────────────────────────────────────
  @SubscribeMessage('reconnect-room')
  handleReconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string }
  ): void {
    const result = this.gameService.handleReconnect(
      data.roomCode,
      data.playerId,
      client.id
    );

    if (!result.success) {
      client.emit('error', { message: result.error });
      return;
    }

    client.join(data.roomCode);
    client.emit('reconnected', {
      roomCode: data.roomCode,
      playerId: data.playerId,
      playerColor: result.playerColor,
      matchState: result.matchState,
    });

    client.to(data.roomCode).emit('player-reconnected', {
      playerId: data.playerId,
    });

    console.log(`Player ${data.playerId} reconnected to room ${data.roomCode}`);
  }

  // ─── Surrender ───────────────────────────────────────────
  @SubscribeMessage('surrender')
  handleSurrender(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string }
  ): void {
    const room = this.gameService.getRoom(data.roomCode);
    if (!room) return;

    const surrenderedPlayer = room.players.find(p => p.id === data.playerId);
    if (!surrenderedPlayer) return;

    const winnerColor = surrenderedPlayer.color === Color.White ? Color.Black : Color.White;

    this.gameService.clearTurnTimeout(data.roomCode);
    this.server.to(data.roomCode).emit('match-ended', {
      winner: winnerColor,
      reason: 'Opponent surrendered',
    });
    console.log(`Player ${data.playerId} surrendered in room ${data.roomCode}. Winner: ${winnerColor}`);
  }

  // ─── Disconnect ──────────────────────────────────────────
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const info = this.gameService.handleDisconnect(client.id);
    if (!info) return;

    console.log(`Player ${info.playerId} disconnected from room ${info.roomCode}`);

    // Notify the other player
    client.to(info.roomCode).emit('player-disconnected', {
      playerId: info.playerId,
    });

    // Start 60-second forfeit timer
    this.gameService.setDisconnectTimer(info.roomCode, info.playerId, () => {
      console.log(`Player ${info.playerId} forfeited (timeout) in room ${info.roomCode}`);
      this.server.to(info.roomCode).emit('match-ended', {
        winner: info.playerId === this.gameService.getRoom(info.roomCode)?.players[0]?.id
          ? 'Black'
          : 'White',
        reason: 'Opponent disconnected',
      });
      this.gameService.removeRoom(info.roomCode);
    });
  }
}
