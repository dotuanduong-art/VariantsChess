import { Match, Color, type SerializedMatch } from 'game-core';
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
export declare class GameService {
    private rooms;
    private generateRoomCode;
    private generatePlayerId;
    createRoom(socketId: string): {
        roomCode: string;
        playerId: string;
    };
    joinRoom(roomCode: string, socketId: string): {
        success: boolean;
        playerId?: string;
        error?: string;
        players?: Player[];
    };
    changePlayerColor(roomCode: string, playerId: string, color: Color): {
        success: boolean;
        error?: string;
    };
    startMatch(roomCode: string): {
        success: boolean;
        matchState?: SerializedMatch;
        error?: string;
    };
    makeMove(roomCode: string, playerId: string, from: string, to: string): {
        success: boolean;
        matchState?: SerializedMatch;
        error?: string;
        capturedPiece?: {
            type: string;
            color: string;
        };
        isKingCaptured?: boolean;
        winner?: Color;
    };
    getRoomBySocketId(socketId: string): Room | undefined;
    getPlayerBySocketId(socketId: string): Player | undefined;
    handleDisconnect(socketId: string): {
        roomCode: string;
        playerId: string;
    } | null;
    setDisconnectTimer(roomCode: string, playerId: string, callback: () => void): void;
    clearTurnTimeout(roomCode: string): void;
    setTurnTimeout(roomCode: string, delay: number, callback: () => void): void;
    handleReconnect(roomCode: string, playerId: string, newSocketId: string): {
        success: boolean;
        matchState?: SerializedMatch;
        playerColor?: Color;
        error?: string;
    };
    removeRoom(roomCode: string): void;
    getRoom(roomCode: string): Room | undefined;
}
