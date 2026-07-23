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
    emitStateToRoom(roomCode, event, extraData = {}) {
        const room = this.gameService.getRoom(roomCode);
        if (!room || !room.match)
            return;
        for (const player of room.players) {
            const playerState = room.match.serializeForPlayer(player.color);
            let payload = {
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
        const matchState = room.match.getGameState();
        const hasTimeoutOverride = matchState.variantState.turnTimeoutOverride !== undefined && matchState.variantState.turnTimeoutOverride !== null;
        const delay = hasTimeoutOverride ? room.match.getTurnTimeoutMs() : (state.currentTurn === game_core_1.Color.White ? state.whiteTimeLeft : state.blackTimeLeft);
        this.gameService.setTurnTimeout(roomCode, delay, () => {
            const activeRoom = this.gameService.getRoom(roomCode);
            if (!activeRoom || !activeRoom.match)
                return;
            const activeMatchState = activeRoom.match.getGameState();
            const activeHasOverride = activeMatchState.variantState.turnTimeoutOverride !== undefined && activeMatchState.variantState.turnTimeoutOverride !== null;
            if (activeHasOverride) {
                const currentTurnColor = activeRoom.match.getCurrentTurn();
                const result = this.gameService.handleTimeoutSkip(roomCode, currentTurnColor);
                if (result.success) {
                    this.emitStateToRoom(roomCode, 'move-made');
                    this.scheduleTurnTimeout(roomCode);
                }
                else {
                    console.error(`Failed to handle timeout skip: ${result.reason}`);
                }
            }
            else {
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
        const room = this.gameService.getRoom(data.roomCode);
        if (room && room.players.length === 2 && room.phase === 'waiting') {
            room.phase = 'draft';
            room.draftEndTime = Date.now() + 60000;
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
    handleSelectVariant(client, data) {
        const result = this.gameService.selectVariant(data.roomCode, data.playerId, data.variantId);
        if (!result.success) {
            client.emit('error', { message: result.error });
            return;
        }
        this.server.to(data.roomCode).emit('player-variant-selected', {
            playerId: data.playerId,
            variantId: null,
            confirmed: false,
        });
    }
    handleConfirmVariant(client, data) {
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
    handleEndTurn(client, data) {
        const result = this.gameService.endTurn(data.roomCode, data.playerId);
        if (!result.success) {
            client.emit('error', { message: result.error });
            return;
        }
        this.emitStateToRoom(data.roomCode, 'move-made');
        this.scheduleTurnTimeout(data.roomCode);
    }
    handleMove(client, data) {
        const result = this.gameService.makeMove(data.roomCode, data.playerId, data.from, data.to, data.moveType);
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
    handleSacrificePiece(client, data) {
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
    handleGetEnemyPieceMoves(client, data) {
        const room = this.gameService.getRoom(data.roomCode);
        if (!room || !room.match) {
            client.emit('error', { message: 'Room or match not found' });
            return;
        }
        const moves = room.match.getLegalMovesAt(data.position);
        client.emit('enemy-piece-moves', { position: data.position, moves });
    }
    handleUseSkill(client, data) {
        const result = this.gameService.useSkill(data.roomCode, data.playerId, data.skillId, data.targets);
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
            }
            else {
                this.scheduleTurnTimeout(data.roomCode);
            }
        }
    }
    handlePassSkill(client, data) {
        const result = this.gameService.passSkill(data.roomCode, data.playerId);
        if (!result.success) {
            client.emit('error', { message: result.error });
            return;
        }
        this.emitStateToRoom(data.roomCode, 'move-made');
        this.scheduleTurnTimeout(data.roomCode);
    }
    handleReconnect(client, data) {
        const result = this.gameService.handleReconnect(data.roomCode, data.playerId, client.id);
        if (!result.success) {
            client.emit('error', { message: result.error });
            return;
        }
        const room = this.gameService.getRoom(data.roomCode);
        const serializedState = room?.match ? room.match.serializeForPlayer(result.playerColor) : undefined;
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
    handleDraftTimeout(roomCode) {
        const room = this.gameService.getRoom(roomCode);
        if (!room || room.phase !== 'draft')
            return;
        for (const player of room.players) {
            if (!player.variantConfirmed) {
                this.gameService.confirmVariant(roomCode, player.id);
            }
        }
        this.proceedToReveal(roomCode);
    }
    proceedToReveal(roomCode) {
        const room = this.gameService.getRoom(roomCode);
        if (!room)
            return;
        room.phase = 'reveal';
        this.gameService.clearDraftTimers(room);
        const whitePlayer = room.players.find(p => p.color === game_core_1.Color.White);
        const blackPlayer = room.players.find(p => p.color === game_core_1.Color.Black);
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
    proceedToLoading(roomCode) {
        const room = this.gameService.getRoom(roomCode);
        if (!room)
            return;
        room.phase = 'loading';
        this.server.to(roomCode).emit('loading-started');
        room.loadingTimer = setTimeout(() => {
            this.proceedToMatchStart(roomCode);
        }, 5000);
    }
    proceedToMatchStart(roomCode) {
        const startResult = this.gameService.startMatch(roomCode);
        if (startResult.success) {
            this.emitStateToRoom(roomCode, 'match-started');
            this.scheduleTurnTimeout(roomCode);
            console.log(`Match started after loading in room ${roomCode}`);
        }
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
    (0, websockets_1.SubscribeMessage)('select-variant'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleSelectVariant", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('confirm-variant'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleConfirmVariant", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('end-turn'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleEndTurn", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('move'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleMove", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sacrifice-piece'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleSacrificePiece", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('get-enemy-piece-moves'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleGetEnemyPieceMoves", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('use-skill'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handleUseSkill", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('pass-skill'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], GameGateway.prototype, "handlePassSkill", null);
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
            origin: true,
            credentials: true,
        },
    }),
    __metadata("design:paramtypes", [game_service_js_1.GameService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map