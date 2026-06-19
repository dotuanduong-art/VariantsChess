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
  variantId?: string | null;
  variantConfirmed?: boolean;
}

export interface Room {
  code: string;
  players: Player[];
  match: Match | null;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  turnTimeout?: NodeJS.Timeout;
  draftTimer?: NodeJS.Timeout;
  revealTimer?: NodeJS.Timeout;
  loadingTimer?: NodeJS.Timeout;
  draftEndTime?: number;
  phase?: 'waiting' | 'draft' | 'reveal' | 'loading' | 'playing' | 'finished';
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
      phase: 'waiting',
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
    room.phase = 'playing';
    this.clearDraftTimers(room);
    
    // Load variants selected during lobby phase
    const whitePlayer = room.players.find(p => p.color === Color.White);
    const blackPlayer = room.players.find(p => p.color === Color.Black);
    room.match.setVariants(whitePlayer?.variantId || null, blackPlayer?.variantId || null);

    room.match.start();

    return { success: true, matchState: room.match.toSerializable() };
  }

  /**
   * Select a variant for a player in a room
   */
  selectVariant(
    roomCode: string,
    playerId: string,
    variantId: string | null
  ): { success: boolean; error?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    if (room.match) {
      return { success: false, error: 'Cannot change variant after match starts' };
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found in room' };
    }

    if (player.variantConfirmed) {
      return { success: false, error: 'Variant already confirmed' };
    }

    player.variantId = variantId;
    return { success: true };
  }

  /**
   * Confirm variant choice for a player
   */
  confirmVariant(
    roomCode: string,
    playerId: string
  ): { success: boolean; error?: string; allConfirmed?: boolean } {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }
    if (room.phase !== 'draft') {
      return { success: false, error: 'Not in draft phase' };
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, error: 'Player not found in room' };
    }

    // Default to 'lightning' if none selected
    if (!player.variantId) {
      player.variantId = 'lightning';
    }

    player.variantConfirmed = true;

    const allConfirmed = room.players.length === 2 && room.players.every(p => p.variantConfirmed);
    return { success: true, allConfirmed };
  }

  /**
   * Clear all draft/reveal/loading timers for a room
   */
  clearDraftTimers(room: Room): void {
    if (room.draftTimer) {
      clearTimeout(room.draftTimer);
      room.draftTimer = undefined;
    }
    if (room.revealTimer) {
      clearTimeout(room.revealTimer);
      room.revealTimer = undefined;
    }
    if (room.loadingTimer) {
      clearTimeout(room.loadingTimer);
      room.loadingTimer = undefined;
    }
  }

  /**
   * Execute a variant skill
   */
  useSkill(
    roomCode: string,
    playerId: string,
    skillId: string,
    targets: any[]
  ): {
    success: boolean;
    matchState?: SerializedMatch;
    error?: string;
    actions?: any[];
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

    const result = room.match.useSkill(player.color, skillId, targets);
    if (!result.success) {
      return { success: false, error: result.reason };
    }

    return {
      success: true,
      matchState: room.match.toSerializable(),
      actions: result.actions,
    };
  }

  /**
   * Helper to check if a player can afford any variant skill
   */
  private canPlayerUseAnySkill(match: Match, color: Color): boolean {
    const state = match.getGameState();
    const variantId = color === Color.White ? state.whiteVariantId : state.blackVariantId;
    if (!variantId) return false;

    const variant = match.getVariantRegistry().get(variantId);
    if (!variant) return false;

    const playerAP = color === Color.White ? state.whiteAP : state.blackAP;
    for (const skill of variant.skills) {
      const cost = typeof skill.apCost === 'function' ? skill.apCost(state, color) : skill.apCost;
      if (playerAP >= cost) {
        return true;
      }
    }
    return false;
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
   * Process a pass skill action
   */
  passSkill(
    roomCode: string,
    playerId: string
  ): { success: boolean; matchState?: SerializedMatch; error?: string } {
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

    const result = room.match.submitAction({ type: 'PASS_SKILL', player: player.color });
    if (!result.success) {
      return { success: false, error: result.reason };
    }

    return {
      success: true,
      matchState: room.match.toSerializable(),
    };
  }

  /**
   * Process an explicit manual end turn action
   */
  endTurn(
    roomCode: string,
    playerId: string
  ): { success: boolean; matchState?: SerializedMatch; error?: string } {
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

    const result = room.match.submitAction({ type: 'END_TURN', player: player.color });
    if (!result.success) {
      return { success: false, error: result.reason };
    }

    return {
      success: true,
      matchState: room.match.toSerializable(),
    };
  }

  /**
   * Process a timeout skip for a player under Electric Terrain
   */
  handleTimeoutSkip(
    roomCode: string,
    playerColor: Color
  ): { success: boolean; matchState?: SerializedMatch; reason?: string } {
    const room = this.rooms.get(roomCode);
    if (!room || !room.match) {
      return { success: false, reason: 'Room or match not found' };
    }
 
    const result = room.match.handleTimeoutSkip(playerColor);
    return {
      success: result.success,
      matchState: room.match.toSerializable(),
      reason: result.reason,
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
      this.clearDraftTimers(room);
      this.clearTurnTimeout(roomCode);
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
