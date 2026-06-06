// ============================================================
// Game Store - Zustand state management
// ============================================================

import { create } from 'zustand';
import type { SerializedBoard, Piece, Position } from 'game-core';
import { Color, fromAlgebraic, toAlgebraic, getLegalMoves, Board } from 'game-core';
import { getSocket, connectSocket, disconnectSocket } from '../lib/socket';

export type GamePhase = 'lobby' | 'waiting' | 'playing' | 'finished';

interface GameState {
  // Connection
  roomCode: string | null;
  playerId: string | null;
  playerColor: Color | null;

  // Game
  board: SerializedBoard | null;
  currentTurn: Color | null;
  phase: GamePhase;
  winner: Color | null;
  lastMove: { from: string; to: string } | null;
  
  // Timer
  whiteTimeLeft: number;
  blackTimeLeft: number;
  lastUpdateLocalTime: number;

  // UI
  selectedSquare: Position | null;
  legalMoves: Position[];
  errorMessage: string | null;
  opponentDisconnected: boolean;

  // Actions
  createRoom: () => void;
  joinRoom: (roomCode: string) => void;
  selectSquare: (pos: Position) => void;
  clearSelection: () => void;
  reconnect: () => void;
  resetGame: () => void;
  togglePlayerColor: () => void;
  surrender: () => void;
  initSocketListeners: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  roomCode: null,
  playerId: null,
  playerColor: null,
  board: null,
  currentTurn: null,
  phase: 'lobby',
  winner: null,
  lastMove: null,
  whiteTimeLeft: 15 * 60 * 1000,
  blackTimeLeft: 15 * 60 * 1000,
  lastUpdateLocalTime: 0,
  selectedSquare: null,
  legalMoves: [],
  errorMessage: null,
  opponentDisconnected: false,

  // ─── Actions ─────────────────────────────────────────────

  createRoom: () => {
    connectSocket();
    const socket = getSocket();
    socket.emit('create-room');
  },

  joinRoom: (roomCode: string) => {
    connectSocket();
    const socket = getSocket();
    socket.emit('join-room', { roomCode: roomCode.toUpperCase() });
  },

  selectSquare: (pos: Position) => {
    const state = get();

    // Can only interact during playing phase and on our turn
    if (state.phase !== 'playing' || state.currentTurn !== state.playerColor) {
      return;
    }

    if (!state.board) return;

    const board = Board.fromSerializable(state.board);
    const clickedPiece = board.getPiece(pos);

    // If we already have a selection, try to move there
    if (state.selectedSquare) {
      const isLegalTarget = state.legalMoves.some(
        m => m.col === pos.col && m.row === pos.row
      );

      if (isLegalTarget) {
        // Send move to server
        const socket = getSocket();
        const from = toAlgebraic(state.selectedSquare);
        const to = toAlgebraic(pos);

        socket.emit('move', {
          roomCode: state.roomCode,
          playerId: state.playerId,
          from,
          to,
        });

        set({ selectedSquare: null, legalMoves: [] });
        return;
      }

      // If clicking own piece, reselect it
      if (clickedPiece && clickedPiece.color === state.playerColor) {
        const moves = getLegalMoves(board, pos);
        set({ selectedSquare: pos, legalMoves: moves });
        return;
      }

      // Otherwise deselect
      set({ selectedSquare: null, legalMoves: [] });
      return;
    }

    // No selection - select a piece if it's ours
    if (clickedPiece && clickedPiece.color === state.playerColor) {
      const moves = getLegalMoves(board, pos);
      set({ selectedSquare: pos, legalMoves: moves });
    }
  },

  clearSelection: () => {
    set({ selectedSquare: null, legalMoves: [] });
  },

  reconnect: () => {
    const roomCode = sessionStorage.getItem('roomCode');
    const playerId = sessionStorage.getItem('playerId');
    if (roomCode && playerId) {
      connectSocket();
      const socket = getSocket();
      socket.emit('reconnect-room', { roomCode, playerId });
    }
  },

  resetGame: () => {
    disconnectSocket();
    sessionStorage.removeItem('roomCode');
    sessionStorage.removeItem('playerId');
    set({
      roomCode: null,
      playerId: null,
      playerColor: null,
      board: null,
      currentTurn: null,
      phase: 'lobby',
      winner: null,
      lastMove: null,
      selectedSquare: null,
      legalMoves: [],
      errorMessage: null,
      opponentDisconnected: false,
    });
  },

  togglePlayerColor: () => {
    const state = get();
    if (state.phase !== 'waiting' || !state.roomCode || !state.playerId || !state.playerColor) {
      return;
    }
    const newColor = state.playerColor === Color.White ? Color.Black : Color.White;

    // Send request to server to change color
    const socket = getSocket();
    socket.emit('change-color', {
      roomCode: state.roomCode,
      playerId: state.playerId,
      color: newColor,
    });
  },

  surrender: () => {
    const state = get();
    if (state.phase !== 'playing' || !state.roomCode || !state.playerId) return;
    const socket = getSocket();
    socket.emit('surrender', {
      roomCode: state.roomCode,
      playerId: state.playerId,
    });
  },

  // ─── Socket Listeners ───────────────────────────────────

  initSocketListeners: () => {
    connectSocket();
    const socket = getSocket();

    socket.on('room-created', (data: { roomCode: string; playerId: string }) => {
      sessionStorage.setItem('roomCode', data.roomCode);
      sessionStorage.setItem('playerId', data.playerId);
      set({
        roomCode: data.roomCode,
        playerId: data.playerId,
        playerColor: Color.White,
        phase: 'waiting',
        errorMessage: null,
      });
    });

    socket.on('room-joined', (data: { roomCode: string; playerId: string; playerColor: Color }) => {
      sessionStorage.setItem('roomCode', data.roomCode);
      sessionStorage.setItem('playerId', data.playerId);
      set({
        roomCode: data.roomCode,
        playerId: data.playerId,
        playerColor: data.playerColor,
        phase: 'waiting',
        errorMessage: null,
      });
    });

    socket.on('player-color-changed', (data: { playerId: string; color: Color }) => {
      const state = get();
      if (data.playerId === state.playerId) {
        set({ playerColor: data.color });
      } else {
        // If the opponent changed color, we take the opposite color to stay in sync
        const oppositeColor = data.color === Color.White ? Color.Black : Color.White;
        set({ playerColor: oppositeColor });
      }
    });

    socket.on('player-joined', () => {
      // Another player joined our room
    });

    socket.on(
      'match-started',
      (data: { board: SerializedBoard; currentTurn: Color; status: string; whiteTimeLeft: number; blackTimeLeft: number }) => {
        set({
          board: data.board,
          currentTurn: data.currentTurn,
          phase: 'playing',
          errorMessage: null,
          whiteTimeLeft: data.whiteTimeLeft,
          blackTimeLeft: data.blackTimeLeft,
          lastUpdateLocalTime: Date.now(),
        });
      }
    );

    socket.on(
      'move-made',
      (data: {
        from: string;
        to: string;
        board: SerializedBoard;
        currentTurn: Color;
        capturedPiece?: { type: string; color: string };
        whiteTimeLeft: number;
        blackTimeLeft: number;
      }) => {
        set({
          board: data.board,
          currentTurn: data.currentTurn,
          lastMove: { from: data.from, to: data.to },
          selectedSquare: null,
          legalMoves: [],
          whiteTimeLeft: data.whiteTimeLeft,
          blackTimeLeft: data.blackTimeLeft,
          lastUpdateLocalTime: Date.now(),
        });
      }
    );

    socket.on('move-rejected', (data: { reason: string }) => {
      set({ errorMessage: `Move rejected: ${data.reason}` });
      setTimeout(() => set({ errorMessage: null }), 3000);
    });

    socket.on('match-ended', (data: { winner: Color; reason?: string }) => {
      set({
        phase: 'finished',
        winner: data.winner,
        selectedSquare: null,
        legalMoves: [],
      });
    });

    socket.on('player-disconnected', () => {
      set({ opponentDisconnected: true });
    });

    socket.on('player-reconnected', () => {
      set({ opponentDisconnected: false });
    });

    socket.on(
      'reconnected',
      (data: {
        roomCode: string;
        playerId: string;
        playerColor: Color;
        matchState: {
          board: SerializedBoard;
          currentTurn: Color;
          status: string;
          winner: Color | null;
          whiteTimeLeft: number;
          blackTimeLeft: number;
          moveHistory?: { from: string; to: string }[];
        } | null;
      }) => {
        const phase = data.matchState
          ? data.matchState.status === 'finished'
            ? 'finished'
            : 'playing'
          : 'waiting';

        const history = data.matchState?.moveHistory ?? [];
        const lastMove = history.length > 0 ? history[history.length - 1] : null;

        set({
          roomCode: data.roomCode,
          playerId: data.playerId,
          playerColor: data.playerColor,
          board: data.matchState?.board ?? null,
          currentTurn: data.matchState?.currentTurn ?? null,
          phase: phase as GamePhase,
          winner: data.matchState?.winner ?? null,
          errorMessage: null,
          whiteTimeLeft: data.matchState?.whiteTimeLeft ?? 15 * 60 * 1000,
          blackTimeLeft: data.matchState?.blackTimeLeft ?? 15 * 60 * 1000,
          lastUpdateLocalTime: Date.now(),
          lastMove,
        });
      }
    );

    socket.on('error', (data: { message: string }) => {
      set({ errorMessage: data.message });
      setTimeout(() => set({ errorMessage: null }), 5000);
    });

    // Try to reconnect on socket connect if we have session data
    socket.on('connect', () => {
      const roomCode = sessionStorage.getItem('roomCode');
      const playerId = sessionStorage.getItem('playerId');
      const currentPhase = get().phase;

      if (roomCode && playerId && currentPhase === 'lobby') {
        socket.emit('reconnect-room', { roomCode, playerId });
      }
    });
  },
}));
