import { Match, Color, type SerializedMatch } from 'game-core';
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
    selectVariant(roomCode: string, playerId: string, variantId: string | null): {
        success: boolean;
        error?: string;
    };
    confirmVariant(roomCode: string, playerId: string): {
        success: boolean;
        error?: string;
        allConfirmed?: boolean;
    };
    clearDraftTimers(room: Room): void;
    useSkill(roomCode: string, playerId: string, skillId: string, targets: any[]): {
        success: boolean;
        matchState?: SerializedMatch;
        error?: string;
        actions?: any[];
    };
    private canPlayerUseAnySkill;
    makeMove(roomCode: string, playerId: string, from: string, to: string, moveType?: string): {
        success: boolean;
        matchState?: SerializedMatch;
        error?: string;
        capturedPiece?: {
            type: string;
            color: string;
        };
        isKingCaptured?: boolean;
        winner?: Color;
        isStealthMove?: boolean;
    };
    passSkill(roomCode: string, playerId: string): {
        success: boolean;
        matchState?: SerializedMatch;
        error?: string;
    };
    endTurn(roomCode: string, playerId: string): {
        success: boolean;
        matchState?: SerializedMatch;
        error?: string;
    };
    handleTimeoutSkip(roomCode: string, playerColor: Color): {
        success: boolean;
        matchState?: SerializedMatch;
        reason?: string;
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
