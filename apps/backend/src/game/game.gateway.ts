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
import { Color, Position } from 'game-core';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
})
export class GameGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly gameService: GameService) {}

  private emitStateToRoom(roomCode: string, event: string, extraData: Record<string, any> = {}): void {
    const room = this.gameService.getRoom(roomCode);
    if (!room || !room.match) return;

    for (const player of room.players) {
      const playerState = room.match.serializeForPlayer(player.color);
      let payload: any = {
        ...extraData,
        ...playerState,
      };

      if (event === 'move-made' && extraData.isStealthMove && extraData.moverColor !== player.color) {
        payload = {
          ...payload,
          from: null,
          to: null,
          stealthMove: true,
        };
      }

      this.server.to(player.socketId).emit(event, payload);
    }
  }

  private scheduleTurnTimeout(roomCode: string): void {
    const room = this.gameService.getRoom(roomCode);
    if (!room || !room.match) return;
    
    const state = room.match.toSerializable();
    if (state.status !== 'playing') return;
    if (state.moveHistory.length === 0) {
      this.gameService.clearTurnTimeout(roomCode);
      return;
    }

    const matchState = room.match.getGameState();
    const hasTimeoutOverride = matchState.variantState.turnTimeoutOverride !== undefined && matchState.variantState.turnTimeoutOverride !== null;
    const delay = hasTimeoutOverride ? room.match.getTurnTimeoutMs() : (state.currentTurn === Color.White ? state.whiteTimeLeft : state.blackTimeLeft);
    
    this.gameService.setTurnTimeout(roomCode, delay, () => {
      const activeRoom = this.gameService.getRoom(roomCode);
      if (!activeRoom || !activeRoom.match) return;
      
      const activeMatchState = activeRoom.match.getGameState();
      const activeHasOverride = activeMatchState.variantState.turnTimeoutOverride !== undefined && activeMatchState.variantState.turnTimeoutOverride !== null;
      if (activeHasOverride) {
        const currentTurnColor = activeRoom.match.getCurrentTurn();
        const result = this.gameService.handleTimeoutSkip(roomCode, currentTurnColor);
        if (result.success) {
          this.emitStateToRoom(roomCode, 'move-made');
          this.scheduleTurnTimeout(roomCode);
        } else {
          console.error(`Failed to handle timeout skip: ${result.reason}`);
        }
      } else {
        const timeoutWinner = activeRoom.match.checkTimeout();
        if (timeoutWinner) {
          this.server.to(roomCode).emit('match-ended', {
            winner: timeoutWinner,
            reason: 'Time out',
          });
          console.log(`Match ended in room ${roomCode} by timeout. Winner: ${timeoutWinner}`);
        }
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

    // Start Draft phase instead of starting match
    const room = this.gameService.getRoom(data.roomCode);
    if (room && room.players.length === 2 && room.phase === 'waiting') {
      room.phase = 'draft';
      room.draftEndTime = Date.now() + 60000;

      // 60-second draft timeout on server
      room.draftTimer = setTimeout(() => {
        this.handleDraftTimeout(data.roomCode);
      }, 60000);

      this.server.to(data.roomCode).emit('draft-started', {
        roomCode: data.roomCode,
        draftEndTime: room.draftEndTime,
        players: room.players.map(p => ({ id: p.id, color: p.color })),
      });
      console.log(`Draft phase started in room ${data.roomCode}`);
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

  // ─── Select Variant ──────────────────────────────────────
  @SubscribeMessage('select-variant')
  handleSelectVariant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string; variantId: string | null }
  ): void {
    const result = this.gameService.selectVariant(data.roomCode, data.playerId, data.variantId);
    if (!result.success) {
      client.emit('error', { message: result.error });
      return;
    }

    // Broadcast the selection to everyone in the room (variantId is null to keep it hidden during draft)
    this.server.to(data.roomCode).emit('player-variant-selected', {
      playerId: data.playerId,
      variantId: null,
      confirmed: false,
    });
  }

  // ─── Confirm Variant ─────────────────────────────────────
  @SubscribeMessage('confirm-variant')
  handleConfirmVariant(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string }
  ): void {
    const result = this.gameService.confirmVariant(data.roomCode, data.playerId);
    if (!result.success) {
      client.emit('error', { message: result.error });
      return;
    }

    this.server.to(data.roomCode).emit('player-variant-confirmed', {
      playerId: data.playerId,
      confirmed: true,
    });

    if (result.allConfirmed) {
      this.proceedToReveal(data.roomCode);
    }
  }

  // ─── End Turn ────────────────────────────────────────────
  @SubscribeMessage('end-turn')
  handleEndTurn(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string }
  ): void {
    const result = this.gameService.endTurn(data.roomCode, data.playerId);
    if (!result.success) {
      client.emit('error', { message: result.error });
      return;
    }

    this.emitStateToRoom(data.roomCode, 'move-made');
    this.scheduleTurnTimeout(data.roomCode);
  }

  // ─── Move ────────────────────────────────────────────────
  @SubscribeMessage('move')
  handleMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string; from: string; to: string; moveType?: string }
  ): void {
    const result = this.gameService.makeMove(
      data.roomCode,
      data.playerId,
      data.from,
      data.to,
      data.moveType
    );

    if (!result.success) {
      client.emit('move-rejected', { reason: result.error });
      return;
    }

    const room = this.gameService.getRoom(data.roomCode);
    const mover = room?.players.find(p => p.id === data.playerId);

    this.emitStateToRoom(data.roomCode, 'move-made', {
      from: data.from,
      to: data.to,
      capturedPiece: result.capturedPiece,
      isStealthMove: result.isStealthMove,
      moverColor: mover?.color,
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

  // ─── Sacrifice Piece ─────────────────────────────────────
  @SubscribeMessage('sacrifice-piece')
  handleSacrificePiece(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string; position: Position; pieceId: string }
  ): void {
    const room = this.gameService.getRoom(data.roomCode);
    if (!room || !room.match) {
      client.emit('error', { message: 'Room or match not found' });
      return;
    }

    const player = room.players.find(p => p.id === data.playerId);
    if (!player) {
      client.emit('error', { message: 'Player not found in room' });
      return;
    }

    const result = room.match.submitAction({
      type: 'SACRIFICE_PIECE',
      pieceId: data.pieceId,
      position: data.position,
      player: player.color,
    });

    if (!result.success) {
      client.emit('error', { message: result.reason || 'Sacrifice rejected' });
      return;
    }

    this.emitStateToRoom(data.roomCode, 'move-made');
    this.scheduleTurnTimeout(data.roomCode);
  }

  // ─── Get Enemy Piece Moves ───────────────────────────────
  @SubscribeMessage('get-enemy-piece-moves')
  handleGetEnemyPieceMoves(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string; position: Position }
  ): void {
    const room = this.gameService.getRoom(data.roomCode);
    if (!room || !room.match) {
      client.emit('error', { message: 'Room or match not found' });
      return;
    }
    const moves = room.match.getLegalMovesAt(data.position);
    client.emit('enemy-piece-moves', { position: data.position, moves });
  }

  // ─── Use Skill ───────────────────────────────────────────
  @SubscribeMessage('use-skill')
  handleUseSkill(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string; skillId: string; targets: any[] }
  ): void {
    const result = this.gameService.useSkill(
      data.roomCode,
      data.playerId,
      data.skillId,
      data.targets
    );

    if (!result.success) {
      client.emit('skill-rejected', { reason: result.error });
      return;
    }

    this.emitStateToRoom(data.roomCode, 'skill-used', {
      skillId: data.skillId,
      playerId: data.playerId,
      actions: result.actions,
    });

    const room = this.gameService.getRoom(data.roomCode);
    if (room && room.match) {
      const winner = room.match.getWinner();
      if (winner) {
        this.gameService.clearTurnTimeout(data.roomCode);
        this.server.to(data.roomCode).emit('match-ended', {
          winner,
        });
        console.log(`Match ended in room ${data.roomCode} after skill execution. Winner: ${winner}`);
      } else {
        this.scheduleTurnTimeout(data.roomCode);
      }
    }
  }

  // ─── Pass Skill ──────────────────────────────────────────
  @SubscribeMessage('pass-skill')
  handlePassSkill(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomCode: string; playerId: string }
  ): void {
    const result = this.gameService.passSkill(data.roomCode, data.playerId);
    if (!result.success) {
      client.emit('error', { message: result.error });
      return;
    }

    this.emitStateToRoom(data.roomCode, 'move-made');
    this.scheduleTurnTimeout(data.roomCode);
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

    const room = this.gameService.getRoom(data.roomCode);
    const serializedState = room?.match ? room.match.serializeForPlayer(result.playerColor!) : undefined;
    client.join(data.roomCode);
    client.emit('reconnected', {
      roomCode: data.roomCode,
      playerId: data.playerId,
      playerColor: result.playerColor,
      matchState: serializedState,
      roomPhase: room?.phase || 'waiting',
      draftEndTime: room?.draftEndTime,
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

  // ─── Draft Phase Transitions ─────────────────────────────
  private handleDraftTimeout(roomCode: string): void {
    const room = this.gameService.getRoom(roomCode);
    if (!room || room.phase !== 'draft') return;

    // Auto-confirm unconfirmed players
    for (const player of room.players) {
      if (!player.variantConfirmed) {
        this.gameService.confirmVariant(roomCode, player.id);
      }
    }

    this.proceedToReveal(roomCode);
  }

  private proceedToReveal(roomCode: string): void {
    const room = this.gameService.getRoom(roomCode);
    if (!room) return;

    room.phase = 'reveal';
    this.gameService.clearDraftTimers(room);

    const whitePlayer = room.players.find(p => p.color === Color.White);
    const blackPlayer = room.players.find(p => p.color === Color.Black);

    this.server.to(roomCode).emit('draft-completed', {
      whitePlayerId: whitePlayer?.id,
      whiteVariantId: whitePlayer?.variantId || 'lightning',
      blackPlayerId: blackPlayer?.id,
      blackVariantId: blackPlayer?.variantId || 'lightning',
    });

    room.revealTimer = setTimeout(() => {
      this.proceedToLoading(roomCode);
    }, 3000);
  }

  private proceedToLoading(roomCode: string): void {
    const room = this.gameService.getRoom(roomCode);
    if (!room) return;

    room.phase = 'loading';
    this.server.to(roomCode).emit('loading-started');

    room.loadingTimer = setTimeout(() => {
      this.proceedToMatchStart(roomCode);
    }, 5000);
  }

  private proceedToMatchStart(roomCode: string): void {
    const startResult = this.gameService.startMatch(roomCode);
    if (startResult.success) {
      this.emitStateToRoom(roomCode, 'match-started');
      this.scheduleTurnTimeout(roomCode);
      console.log(`Match started after loading in room ${roomCode}`);
    }
  }
}
