import { OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service.js';
export declare class GameGateway implements OnGatewayDisconnect {
    private readonly gameService;
    server: Server;
    constructor(gameService: GameService);
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
    handleMove(client: Socket, data: {
        roomCode: string;
        playerId: string;
        from: string;
        to: string;
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
}
