import { OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service.js';
import { Position } from 'game-core';
export declare class GameGateway implements OnGatewayDisconnect {
    private readonly gameService;
    server: Server;
    constructor(gameService: GameService);
    private emitStateToRoom;
    private scheduleTurnTimeout;
    handleCreateRoom(client: Socket): void;
    handleJoinRoom(client: Socket, data: {
        roomCode: string;
    }): void;
    handleChangeColor(client: Socket, data: {
        roomCode: string;
        playerId: string;
        color: string;
    }): void;
    handleSelectVariant(client: Socket, data: {
        roomCode: string;
        playerId: string;
        variantId: string | null;
    }): void;
    handleConfirmVariant(client: Socket, data: {
        roomCode: string;
        playerId: string;
    }): void;
    handleEndTurn(client: Socket, data: {
        roomCode: string;
        playerId: string;
    }): void;
    handleMove(client: Socket, data: {
        roomCode: string;
        playerId: string;
        from: string;
        to: string;
        moveType?: string;
    }): void;
    handleSacrificePiece(client: Socket, data: {
        roomCode: string;
        playerId: string;
        position: Position;
        pieceId: string;
    }): void;
    handleGetEnemyPieceMoves(client: Socket, data: {
        roomCode: string;
        playerId: string;
        position: Position;
    }): void;
    handleUseSkill(client: Socket, data: {
        roomCode: string;
        playerId: string;
        skillId: string;
        targets: any[];
    }): void;
    handlePassSkill(client: Socket, data: {
        roomCode: string;
        playerId: string;
    }): void;
    handleReconnect(client: Socket, data: {
        roomCode: string;
        playerId: string;
    }): void;
    handleSurrender(client: Socket, data: {
        roomCode: string;
        playerId: string;
    }): void;
    handleDisconnect(client: Socket): void;
    private handleDraftTimeout;
    private proceedToReveal;
    private proceedToLoading;
    private proceedToMatchStart;
}
