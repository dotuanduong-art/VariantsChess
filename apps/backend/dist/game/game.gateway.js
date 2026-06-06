"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const game_service_js_1 = require("./game.service.js");
const game_core_1 = require("game-core");
let GameGateway = class GameGateway {
    gameService;
    server;
    constructor(gameService) {
        this.gameService = gameService;
    }
    scheduleTurnTimeout(roomCode) {
        const room = this.gameService.getRoom(roomCode);
        if (!room || !room.match)
            return;
        const state = room.match.toSerializable();
        if (state.status !== 'playing')
            return;
        if (state.moveHistory.length === 0) {
            this.gameService.clearTurnTimeout(roomCode);
            return;
        }
        const delay = state.currentTurn === game_core_1.Color.White ? state.whiteTimeLeft : state.blackTimeLeft;
        this.gameService.setTurnTimeout(roomCode, delay, () => {
            const match = this.gameService.getRoom(roomCode)?.match;
            if (!match)
                return;
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
    handleCreateRoom(client) {
        const { roomCode, playerId } = this.gameService.createRoom(client.id);
        client.join(roomCode);
        client.emit('room-created', { roomCode, playerId });
        console.log(`Room ${roomCode} created by ${playerId}`);
    }
    handleJoinRoom(client, data) {
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
            playerColor: playerObj ? playerObj.color : game_core_1.Color.Black,
            players: result.players?.map(p => ({ id: p.id, color: p.color })),
        });
        client.to(data.roomCode).emit('player-joined', {
            playerId: result.playerId,
            players: result.players?.map(p => ({ id: p.id, color: p.color })),
        });
        const startResult = this.gameService.startMatch(data.roomCode);
        if (startResult.success) {
            this.server.to(data.roomCode).emit('match-started', {
                board: startResult.matchState.board,
                currentTurn: startResult.matchState.currentTurn,
                status: startResult.matchState.status,
                whiteTimeLeft: startResult.matchState.whiteTimeLeft,
                blackTimeLeft: startResult.matchState.blackTimeLeft,
                lastMoveTimestamp: startResult.matchState.lastMoveTimestamp,
            });
            this.scheduleTurnTimeout(data.roomCode);
            console.log(`Match started in room ${data.roomCode}`);
        }
    }
    handleChangeColor(client, data) {
        const colorVal = data.color === 'White' ? game_core_1.Color.White : game_core_1.Color.Black;
        const result = this.gameService.changePlayerColor(data.roomCode, data.playerId, colorVal);
        if (!result.success) {
            client.emit('error', { message: result.error });
            return;
        }
        this.server.to(data.roomCode).emit('player-color-changed', {
            playerId: data.playerId,
            color: data.color,
        });
    }
    handleMove(client, data) {
        const result = this.gameService.makeMove(data.roomCode, data.playerId, data.from, data.to);
        if (!result.success) {
            client.emit('move-rejected', { reason: result.error });
            return;
        }
        this.server.to(data.roomCode).emit('move-made', {
            from: data.from,
            to: data.to,
            board: result.matchState.board,
            currentTurn: result.matchState.currentTurn,
            capturedPiece: result.capturedPiece,
            whiteTimeLeft: result.matchState.whiteTimeLeft,
            blackTimeLeft: result.matchState.blackTimeLeft,
            lastMoveTimestamp: result.matchState.lastMoveTimestamp,
        });
        if (result.isKingCaptured && result.winner) {
            this.gameService.clearTurnTimeout(data.roomCode);
            this.server.to(data.roomCode).emit('match-ended', {
                winner: result.winner,
            });
            console.log(`Match ended in room ${data.roomCode}. Winner: ${result.winner}`);
        }
        else if (result.matchState?.status === 'finished') {
            this.gameService.clearTurnTimeout(data.roomCode);
            this.server.to(data.roomCode).emit('match-ended', {
                winner: result.matchState.winner,
                reason: 'Time out',
            });
        }
        else {
            this.scheduleTurnTimeout(data.roomCode);
        }
    }
    handleReconnect(client, data) {
        const result = this.gameService.handleReconnect(data.roomCode, data.playerId, client.id);
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
    handleSurrender(client, data) {
        const room = this.gameService.getRoom(data.roomCode);
        if (!room)
            return;
        const surrenderedPlayer = room.players.find(p => p.id === data.playerId);
        if (!surrenderedPlayer)
            return;
        const winnerColor = surrenderedPlayer.color === game_core_1.Color.White ? game_core_1.Color.Black : game_core_1.Color.White;
        this.gameService.clearTurnTimeout(data.roomCode);
        this.server.to(data.roomCode).emit('match-ended', {
            winner: winnerColor,
            reason: 'Opponent surrendered',
        });
        console.log(`Player ${data.playerId} surrendered in room ${data.roomCode}. Winner: ${winnerColor}`);
    }
    handleDisconnect(client) {
        const info = this.gameService.handleDisconnect(client.id);
        if (!info)
            return;
        console.log(`Player ${info.playerId} disconnected from room ${info.roomCode}`);
        client.to(info.roomCode).emit('player-disconnected', {
            playerId: info.playerId,
        });
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
};
exports.GameGateway = GameGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('create-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleCreateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('change-color'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleChangeColor", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('move'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleMove", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('reconnect-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleReconnect", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('surrender'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleSurrender", null);
__decorate([
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleDisconnect", null);
exports.GameGateway = GameGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: ['http://localhost:3000'],
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [game_service_js_1.GameService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map