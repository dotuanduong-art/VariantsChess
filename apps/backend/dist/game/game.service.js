"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const common_1 = require("@nestjs/common");
const game_core_1 = require("game-core");
let GameService = class GameService {
    rooms = new Map();
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code;
        do {
            code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        } while (this.rooms.has(code));
        return code;
    }
    generatePlayerId() {
        return `player_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    createRoom(socketId) {
        const code = this.generateRoomCode();
        const playerId = this.generatePlayerId();
        const player = {
            id: playerId,
            socketId,
            color: game_core_1.Color.White,
            connected: true,
        };
        const room = {
            code,
            players: [player],
            match: null,
            disconnectTimers: new Map(),
            phase: 'waiting',
        };
        this.rooms.set(code, room);
        return { roomCode: code, playerId };
    }
    joinRoom(roomCode, socketId) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }
        if (room.players.length >= 2) {
            return { success: false, error: 'Room is full' };
        }
        const playerId = this.generatePlayerId();
        const hostColor = room.players[0]?.color ?? game_core_1.Color.White;
        const guestColor = hostColor === game_core_1.Color.White ? game_core_1.Color.Black : game_core_1.Color.White;
        const player = {
            id: playerId,
            socketId,
            color: guestColor,
            connected: true,
        };
        room.players.push(player);
        return { success: true, playerId, players: room.players };
    }
    changePlayerColor(roomCode, playerId, color) {
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
        const otherPlayer = room.players.find(p => p.id !== playerId);
        if (otherPlayer) {
            otherPlayer.color = color === game_core_1.Color.White ? game_core_1.Color.Black : game_core_1.Color.White;
        }
        return { success: true };
    }
    startMatch(roomCode) {
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
        room.match = new game_core_1.Match();
        room.phase = 'playing';
        this.clearDraftTimers(room);
        const whitePlayer = room.players.find(p => p.color === game_core_1.Color.White);
        const blackPlayer = room.players.find(p => p.color === game_core_1.Color.Black);
        room.match.setVariants(whitePlayer?.variantId || null, blackPlayer?.variantId || null);
        room.match.start();
        return { success: true, matchState: room.match.toSerializable() };
    }
    selectVariant(roomCode, playerId, variantId) {
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
    confirmVariant(roomCode, playerId) {
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
        if (!player.variantId) {
            player.variantId = 'lightning';
        }
        player.variantConfirmed = true;
        const allConfirmed = room.players.length === 2 && room.players.every(p => p.variantConfirmed);
        return { success: true, allConfirmed };
    }
    clearDraftTimers(room) {
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
    useSkill(roomCode, playerId, skillId, targets) {
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
    canPlayerUseAnySkill(match, color) {
        const state = match.getGameState();
        const variantId = color === game_core_1.Color.White ? state.whiteVariantId : state.blackVariantId;
        if (!variantId)
            return false;
        const variant = match.getVariantRegistry().get(variantId);
        if (!variant)
            return false;
        const playerAP = color === game_core_1.Color.White ? state.whiteAP : state.blackAP;
        for (const skill of variant.skills) {
            const cost = typeof skill.apCost === 'function' ? skill.apCost(state, color) : skill.apCost;
            if (playerAP >= cost) {
                return true;
            }
        }
        return false;
    }
    makeMove(roomCode, playerId, from, to, moveType) {
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
        const fromPos = (0, game_core_1.fromAlgebraic)(from);
        const toPos = (0, game_core_1.fromAlgebraic)(to);
        const result = room.match.makeMove(player.color, fromPos, toPos, moveType);
        if (!result.success) {
            return { success: false, error: result.reason };
        }
        return {
            success: true,
            matchState: room.match.toSerializable(),
            capturedPiece: result.capturedPiece,
            isKingCaptured: result.isKingCaptured,
            winner: room.match.getWinner() ?? undefined,
            isStealthMove: result.isStealthMove,
        };
    }
    passSkill(roomCode, playerId) {
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
    endTurn(roomCode, playerId) {
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
    handleTimeoutSkip(roomCode, playerColor) {
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
    getRoomBySocketId(socketId) {
        for (const room of this.rooms.values()) {
            if (room.players.some(p => p.socketId === socketId)) {
                return room;
            }
        }
        return undefined;
    }
    getPlayerBySocketId(socketId) {
        for (const room of this.rooms.values()) {
            const player = room.players.find(p => p.socketId === socketId);
            if (player)
                return player;
        }
        return undefined;
    }
    handleDisconnect(socketId) {
        const room = this.getRoomBySocketId(socketId);
        if (!room)
            return null;
        const player = room.players.find(p => p.socketId === socketId);
        if (!player)
            return null;
        player.connected = false;
        return { roomCode: room.code, playerId: player.id };
    }
    setDisconnectTimer(roomCode, playerId, callback) {
        const room = this.rooms.get(roomCode);
        if (!room)
            return;
        const timer = setTimeout(callback, 60_000);
        room.disconnectTimers.set(playerId, timer);
    }
    clearTurnTimeout(roomCode) {
        const room = this.rooms.get(roomCode);
        if (room?.turnTimeout) {
            clearTimeout(room.turnTimeout);
            room.turnTimeout = undefined;
        }
    }
    setTurnTimeout(roomCode, delay, callback) {
        const room = this.rooms.get(roomCode);
        if (!room)
            return;
        this.clearTurnTimeout(roomCode);
        room.turnTimeout = setTimeout(callback, delay);
    }
    handleReconnect(roomCode, playerId, newSocketId) {
        const room = this.rooms.get(roomCode);
        if (!room) {
            return { success: false, error: 'Room not found' };
        }
        const player = room.players.find(p => p.id === playerId);
        if (!player) {
            return { success: false, error: 'Player not found' };
        }
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
    removeRoom(roomCode) {
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
    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }
};
exports.GameService = GameService;
exports.GameService = GameService = __decorate([
    (0, common_1.Injectable)()
], GameService);
//# sourceMappingURL=game.service.js.map