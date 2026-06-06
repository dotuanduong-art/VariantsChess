// ============================================================
// Game Service - Room and match management
// ============================================================

import { Injectable } from '@nestjs/common';
import { Match, Color, fromAlgebraic, type SerializedMatch } from 'game-core';

export interface Player {
  id: string;
  socketId: string;
  color: Color;
  connected: boolean;
}

export interface Room {
  code: string;
  players: Player[];
  match: Match | null;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  turnTimeout?: NodeJS.Timeout;
}

@Injectable()
export class GameService {
  private rooms: Map<string, Room> = new Map();

  /**
   * Generate a random 6-character room code
   */
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
    let code: string;
    do {
      code = Array.from({ length: 6 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
      ).join('');
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Generate a unique player ID
   */
  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Create a new room and add the creator as the first player
   */
  createRoom(socketId: string): { roomCode: string; playerId: string } {
    const code = this.generateRoomCode();
    const playerId = this.generatePlayerId();
    const player: Player = {
      id: playerId,
      socketId,
      color: Color.White,
      connected: true,
    };

    const room: Room = {
      code,
      players: [player],
      match: null,
      disconnectTimers: new Map(),
    };

    this.rooms.set(code, room);
    return { roomCode: code, playerId };
  }

  /**
   * Join an existing room
   */
  joinRoom(
    roomCode: string,
    socketId: string
  ): { success: boolean; playerId?: string; error?: string; players?: Player[] } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    if (room.players.length >= 2) {
      return { success: false, error: 'Room is full' };
    }

    const playerId = this.generatePlayerId();
    const hostColor = room.players[0]?.color ?? Color.White;
    const guestColor = hostColor === Color.White ? Color.Black : Color.White;

    const player: Player = {
      id: playerId,
      socketId,
      color: guestColor,
      connected: true,
    };

    room.players.push(player);
    return { success: true, playerId, players: room.players };
  }

  /**
   * Change color of a player in a room (only allowed if match hasn't started)
   */
  changePlayerColor(
    roomCode: string,
    playerId: string,
    color: Color
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    if (room.match) {
      return { success: false, error: 'Cannot change color after match starts' };
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found in room' };
    }

    player.color = color;

    // If there is a second player, they must get the opposite color
    const otherPlayer = room.players.find(p => p.id !== playerId);
    if (otherPlayer) {
      otherPlayer.color = color === Color.White ? Color.Black : Color.White;
    }

    return { success: true };
  }

  /**
   * Start the match in a room
   */
  startMatch(roomCode: string): { success: boolean; matchState?: SerializedMatch; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    if (room.players.length !== 2) {
      return { success: false, error: 'Need exactly 2 players' };
    }
    if (room.match) {
      return { success: false, error: 'Match already started' };
    }

    room.match = new Match();
    room.match.start();

    return { success: true, matchState: room.match.toSerializable() };
  }

  /**
   * Process a move from a player
   */
  makeMove(
    roomCode: string,
    playerId: string,
    from: string,
    to: string
  ): {
    success: boolean;
    matchState?: SerializedMatch;
    error?: string;
    capturedPiece?: { type: string; color: string };
    isKingCaptured?: boolean;
    winner?: Color;
  } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    if (!room.match) {
      return { success: false, error: 'Match not started' };
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found in room' };
    }

    const fromPos = fromAlgebraic(from);
    const toPos = fromAlgebraic(to);

    const result = room.match.makeMove(player.color, fromPos, toPos);
    if (!result.success) {
      return { success: false, error: result.reason };
    }

    return {
      success: true,
      matchState: room.match.toSerializable(),
      capturedPiece: result.capturedPiece,
      isKingCaptured: result.isKingCaptured,
      winner: room.match.getWinner() ?? undefined,
    };
  }

  /**
   * Get the room a socket belongs to
   */
  getRoomBySocketId(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.socketId === socketId)) {
        return room;
      }
    }
    return undefined;
  }

  /**
   * Get a player by socket ID
   */
  getPlayerBySocketId(socketId: string): Player | undefined {
    for (const room of this.rooms.values()) {
      const player = room.players.find(p => p.socketId === socketId);
      if (player) return player;
    }
    return undefined;
  }

  /**
   * Handle player disconnect - starts a 60-second timer
   */
  handleDisconnect(
    socketId: string
  ): { roomCode: string; playerId: string } | null {
    const room = this.getRoomBySocketId(socketId);
    if (!room) return null;

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return null;

    player.connected = false;
    return { roomCode: room.code, playerId: player.id };
  }

  /**
   * Set a disconnect timer for a player
   */
  setDisconnectTimer(roomCode: string, playerId: string, callback: () => void): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const timer = setTimeout(callback, 60_000);
    room.disconnectTimers.set(playerId, timer);
  }

  /**
   * Clear the current turn timeout
   */
  clearTurnTimeout(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room?.turnTimeout) {
      clearTimeout(room.turnTimeout);
      room.turnTimeout = undefined;
    }
  }

  /**
   * Set a timeout for the current turn
   */
  setTurnTimeout(roomCode: string, delay: number, callback: () => void): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    
    this.clearTurnTimeout(roomCode);
    room.turnTimeout = setTimeout(callback, delay);
  }

  /**
   * Handle player reconnect
   */
  handleReconnect(
    roomCode: string,
    playerId: string,
    newSocketId: string
  ): { success: boolean; matchState?: SerializedMatch; playerColor?: Color; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Clear disconnect timer
    const timer = room.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      room.disconnectTimers.delete(playerId);
    }

    player.socketId = newSocketId;
    player.connected = true;

    return {
      success: true,
      matchState: room.match?.toSerializable(),
      playerColor: player.color,
    };
  }

  /**
   * Remove a room entirely
   */
  removeRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      for (const timer of room.disconnectTimers.values()) {
        clearTimeout(timer);
      }
      this.rooms.delete(roomCode);
    }
  }

  /**
   * Get room by code
   */
  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }
}
