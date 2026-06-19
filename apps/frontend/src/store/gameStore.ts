// ============================================================
// Game Store - Zustand state management
// ============================================================

import { create } from 'zustand';
import type { SerializedBoard, Piece, Position, SkillTarget, SkillTargetRequirement } from 'game-core';
import { Color, fromAlgebraic, toAlgebraic, getLegalMoves, Board } from 'game-core';
import { getSocket, connectSocket, disconnectSocket } from '../lib/socket';
import { VARIANTS_LIST, SkillInfo } from '../lib/variantsData';

export type GamePhase = 'lobby' | 'waiting' | 'draft' | 'reveal' | 'loading' | 'playing' | 'finished';

export interface CapturedPiece {
  type: string;
  color: string;
}

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
  capturedPieces: CapturedPiece[];
  moveLog: string[];
  graveyard: any[];
  
  // Timer
  whiteTimeLeft: number;
  blackTimeLeft: number;
  lastUpdateLocalTime: number;

  // Draft Phase UI
  draftEndTime: number | null;
  draftConfirmed: boolean;
  opponentConfirmed: boolean;
  whiteVariantId: string | null;
  blackVariantId: string | null;

  // UI
  selectedSquare: Position | null;
  legalMoves: Position[];
  errorMessage: string | null;
  opponentDisconnected: boolean;
  activeSkillId: string | null;
  lightningStrikeTargets: string[];
  dynamiteExplosionTargets: string[];


  // Target Selection state
  targetSelectionMode: boolean;
  validTargets: Position[];
  pendingTargets: SkillTarget[];
  requiredTargetCount: number;
  currentRequirementIndex: number;
  availableSkillTargets: Record<string, {
    requirements: SkillTargetRequirement[];
    validPositions: Position[][];
  }>;

  // Keybindings settings
  keybindings: {
    skill1: string;
    skill2: string;
    ultimate: string;
  };
  setKeybinding: (type: 'skill1' | 'skill2' | 'ultimate', key: string) => void;

  // Synchronized Engine State
  turnNumber: number;
  hasMoved: boolean;
  skillsUsedThisTurn: number;
  whiteAP: number;
  blackAP: number;
  variantState: Record<string, any>;
  whitePlayerEffects: any[];
  blackPlayerEffects: any[];

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
  selectVariant: (variantId: string | null) => void;
  confirmVariant: () => void;
  endTurn: () => void;
  activeSkillDetail: { skill: SkillInfo; variantId: string; x: number; y: number } | null;
  setSkillDetail: (detail: { skill: SkillInfo; variantId: string; x: number; y: number } | null) => void;
  selectSkill: (skillId: string) => void;
  cancelSkill: () => void;
  selectTarget: (pos: Position, pieceId?: string) => void;
}

const getInitialKeybindings = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('chess_variant_keybindings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // use default
      }
    }
  }
  return {
    skill1: 'q',
    skill2: 'w',
    ultimate: 'e',
  };
};

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
  capturedPieces: [],
  moveLog: [],
  graveyard: [],
  whiteTimeLeft: 15 * 60 * 1000,
  blackTimeLeft: 15 * 60 * 1000,
  lastUpdateLocalTime: 0,
  draftEndTime: null,
  draftConfirmed: false,
  opponentConfirmed: false,
  whiteVariantId: null,
  blackVariantId: null,
  selectedSquare: null,
  legalMoves: [],
  errorMessage: null,
  opponentDisconnected: false,
  activeSkillId: null,
  lightningStrikeTargets: [],
  dynamiteExplosionTargets: [],
  targetSelectionMode: false,
  validTargets: [],
  pendingTargets: [],
  requiredTargetCount: 0,
  currentRequirementIndex: 0,
  availableSkillTargets: {},
  turnNumber: 1,
  hasMoved: false,
  skillsUsedThisTurn: 0,
  whiteAP: 0,
  blackAP: 0,
  variantState: {},
  whitePlayerEffects: [],
  blackPlayerEffects: [],
  keybindings: getInitialKeybindings(),
  activeSkillDetail: null,

  // ─── Actions ─────────────────────────────────────────────

  setKeybinding: (type, key) => {
    const updated = { ...get().keybindings, [type]: key.toLowerCase() };
    set({ keybindings: updated });
    if (typeof window !== 'undefined') {
      localStorage.setItem('chess_variant_keybindings', JSON.stringify(updated));
    }
  },

  setSkillDetail: (detail) => {
    set({ activeSkillDetail: detail });
  },

  selectSkill: (skillId: string) => {
    const state = get();
    const skillData = state.availableSkillTargets[skillId];
    if (!skillData) {
      console.warn(`No target definition for skill ${skillId}`);
      return;
    }

    const { requirements, validPositions } = skillData;
    const requiredCount = requirements.length;

    if (requiredCount === 0) {
      // Direct execute if 0 targets needed
      const socket = getSocket();
      socket.emit('use-skill', {
        roomCode: state.roomCode,
        playerId: state.playerId,
        skillId,
        targets: [],
      });
      // Ensure we clear selected skill
      set({ activeSkillId: null, targetSelectionMode: false, validTargets: [], pendingTargets: [], requiredTargetCount: 0, currentRequirementIndex: 0 });
    } else {
      // Clear movement selection and enter targeting mode
      set({
        activeSkillId: skillId,
        targetSelectionMode: true,
        validTargets: validPositions[0] || [],
        pendingTargets: [],
        requiredTargetCount: requiredCount,
        currentRequirementIndex: 0,
        selectedSquare: null,
        legalMoves: [],
      });
    }
  },

  cancelSkill: () => {
    set({
      activeSkillId: null,
      targetSelectionMode: false,
      validTargets: [],
      pendingTargets: [],
      requiredTargetCount: 0,
      currentRequirementIndex: 0,
    });
  },

  selectTarget: (pos: Position, pieceId?: string) => {
    const state = get();
    if (!state.targetSelectionMode || !state.activeSkillId) return;

    const skillData = state.availableSkillTargets[state.activeSkillId];
    if (!skillData) return;

    const { requirements, validPositions } = skillData;
    const currentReq = requirements[state.currentRequirementIndex];
    if (!currentReq) return;

    // Build the new target object
    const newTarget: SkillTarget = {
      type: currentReq.type,
      position: pos,
    };
    if (pieceId) {
      newTarget.pieceId = pieceId;
    }

    const nextPending = [...state.pendingTargets, newTarget];

    if (nextPending.length >= state.requiredTargetCount) {
      // Emit use-skill action
      const socket = getSocket();
      socket.emit('use-skill', {
        roomCode: state.roomCode,
        playerId: state.playerId,
        skillId: state.activeSkillId,
        targets: nextPending,
      });
      // Clear targeting mode
      get().cancelSkill();
    } else {
      // Update store state for next requirement selection
      const nextIndex = state.currentRequirementIndex + 1;
      set({
        pendingTargets: nextPending,
        currentRequirementIndex: nextIndex,
        validTargets: validPositions[nextIndex] || [],
      });
    }
  },

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
 
    // Handle Electric Terrain turn timeout on frontend
    const isElectricTerrainActive = () => {
      if (!state.board) return false;
      try {
        const boardClass = Board.fromSerializable(state.board);
        const cellEffects = boardClass.getAllCellEffects();
        for (const list of cellEffects.values()) {
          if (list.some((e: any) => e.type === 'electric_terrain')) {
            return true;
          }
        }
      } catch {
        // ignore
      }
      return false;
    };
 
    const hasHistory = state.lastMove !== null;
    if (isElectricTerrainActive() && hasHistory) {
      const elapsed = Date.now() - state.lastUpdateLocalTime;
      if (elapsed >= 3000) {
        return;
      }
    }

    // Handle skill targeting mode
    if (state.targetSelectionMode) {
      const isPosEquals = (p1: Position, p2: Position) => p1.col === p2.col && p1.row === p2.row;
      const isValid = state.validTargets.some(t => isPosEquals(t, pos));
      if (isValid) {
        let pieceId: string | undefined = undefined;
        if (state.board) {
          try {
            const boardClass = Board.fromSerializable(state.board);
            const clickedPiece = boardClass.getPiece(pos);
            if (clickedPiece) {
              pieceId = clickedPiece.id;
            }
          } catch (e) {
            console.error('Error getting piece in targeting', e);
          }
        }
        state.selectTarget(pos, pieceId);
      } else {
        state.cancelSkill();
      }
      return;
    }

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
      capturedPieces: [],
      moveLog: [],
      draftEndTime: null,
      draftConfirmed: false,
      opponentConfirmed: false,
      whiteVariantId: null,
      blackVariantId: null,
      selectedSquare: null,
      legalMoves: [],
      errorMessage: null,
      opponentDisconnected: false,
      activeSkillId: null,
      turnNumber: 1,
      hasMoved: false,
      skillsUsedThisTurn: 0,
      whiteAP: 0,
      blackAP: 0,
      variantState: {},
      lightningStrikeTargets: [],
      dynamiteExplosionTargets: [],
      graveyard: [],
      activeSkillDetail: null,
      targetSelectionMode: false,
      validTargets: [],
      pendingTargets: [],
      requiredTargetCount: 0,
      currentRequirementIndex: 0,
      availableSkillTargets: {},
    });
  },

  selectVariant: (variantId: string | null) => {
    const state = get();
    if (!state.roomCode || !state.playerId) return;
    const socket = getSocket();
    socket.emit('select-variant', {
      roomCode: state.roomCode,
      playerId: state.playerId,
      variantId,
    });
  },

  confirmVariant: () => {
    const state = get();
    if (!state.roomCode || !state.playerId) return;
    const socket = getSocket();
    socket.emit('confirm-variant', {
      roomCode: state.roomCode,
      playerId: state.playerId,
    });
    set({ draftConfirmed: true });
  },

  endTurn: () => {
    const state = get();
    if (!state.roomCode || !state.playerId) return;
    const socket = getSocket();
    socket.emit('end-turn', {
      roomCode: state.roomCode,
      playerId: state.playerId,
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

    socket.on('draft-started', (data: { roomCode: string; draftEndTime: number }) => {
      set({
        phase: 'draft',
        draftEndTime: data.draftEndTime,
        draftConfirmed: false,
        opponentConfirmed: false,
        whiteVariantId: null,
        blackVariantId: null,
      });
    });

    socket.on('player-variant-selected', (data: { playerId: string; confirmed: boolean }) => {
      // Expose choosing state if needed
    });

    socket.on('player-variant-confirmed', (data: { playerId: string; confirmed: boolean }) => {
      const state = get();
      if (data.playerId === state.playerId) {
        set({ draftConfirmed: true });
      } else {
        set({ opponentConfirmed: true });
      }
    });

    socket.on('draft-completed', (data: { whitePlayerId: string; whiteVariantId: string; blackPlayerId: string; blackVariantId: string }) => {
      const state = get();
      set({
        phase: 'reveal',
        whiteVariantId: data.whiteVariantId,
        blackVariantId: data.blackVariantId,
      });
    });

    socket.on('loading-started', () => {
      set({ phase: 'loading' });
    });

    socket.on(
      'match-started',
      (data: {
        board: SerializedBoard;
        currentTurn: Color;
        status: string;
        whiteTimeLeft: number;
        blackTimeLeft: number;
        turnNumber?: number;
        hasMoved?: boolean;
        skillsUsedThisTurn?: number;
        whiteAP?: number;
        blackAP?: number;
        variantState?: Record<string, any>;
        whiteVariantId?: string | null;
        blackVariantId?: string | null;
      }) => {
        set({
          board: data.board,
          currentTurn: data.currentTurn,
          phase: 'playing',
          errorMessage: null,
          capturedPieces: [],
          moveLog: [],
          whiteTimeLeft: data.whiteTimeLeft,
          blackTimeLeft: data.blackTimeLeft,
          lastUpdateLocalTime: Date.now(),
          draftConfirmed: false,
          opponentConfirmed: false,
          turnNumber: data.turnNumber ?? 1,
          hasMoved: data.hasMoved ?? false,
          skillsUsedThisTurn: data.skillsUsedThisTurn ?? 0,
          whiteAP: data.whiteAP ?? 0,
          blackAP: data.blackAP ?? 0,
          variantState: data.variantState ?? {},
          whiteVariantId: data.whiteVariantId ?? null,
          blackVariantId: data.blackVariantId ?? null,
          whitePlayerEffects: (data as any).whitePlayerEffects ?? [],
          blackPlayerEffects: (data as any).blackPlayerEffects ?? [],
          graveyard: (data as any).graveyard ?? [],
          availableSkillTargets: (data as any).availableSkillTargets ?? {},
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
        turnNumber: number;
        hasMoved: boolean;
        skillsUsedThisTurn: number;
        whiteAP: number;
        blackAP: number;
        variantState: Record<string, any>;
        whiteVariantId: string | null;
        blackVariantId: string | null;
      }) => {
        const newCaptured = data.capturedPiece
          ? [...get().capturedPieces, data.capturedPiece]
          : get().capturedPieces;
          
        const moverColor = get().currentTurn;
        const newMoveLog = [...get().moveLog];
        if (data.from && data.to) {
          newMoveLog.push(`${moverColor}: ${data.from} -> ${data.to}${data.capturedPiece ? ' (x)' : ''}`);
        }
        
        set({
          board: data.board,
          currentTurn: data.currentTurn,
          lastMove: data.from && data.to ? { from: data.from, to: data.to } : get().lastMove,
          capturedPieces: newCaptured,
          moveLog: newMoveLog,
          selectedSquare: null,
          legalMoves: [],
          whiteTimeLeft: data.whiteTimeLeft,
          blackTimeLeft: data.blackTimeLeft,
          lastUpdateLocalTime: Date.now(),
          turnNumber: data.turnNumber,
          hasMoved: data.hasMoved,
          skillsUsedThisTurn: data.skillsUsedThisTurn,
          whiteAP: data.whiteAP,
          blackAP: data.blackAP,
          variantState: data.variantState,
          whiteVariantId: data.whiteVariantId,
          blackVariantId: data.blackVariantId,
          whitePlayerEffects: (data as any).whitePlayerEffects ?? [],
          blackPlayerEffects: (data as any).blackPlayerEffects ?? [],
          graveyard: (data as any).graveyard ?? [],
          availableSkillTargets: (data as any).availableSkillTargets ?? {},
        });
      }
    );

    socket.on(
      'skill-used',
      (data: {
        skillId: string;
        playerId: string;
        board: SerializedBoard;
        currentTurn: Color;
        whiteTimeLeft: number;
        blackTimeLeft: number;
        turnNumber: number;
        hasMoved: boolean;
        skillsUsedThisTurn: number;
        whiteAP: number;
        blackAP: number;
        variantState: Record<string, any>;
        whiteVariantId: string | null;
        blackVariantId: string | null;
        availableSkillTargets?: any;
      }) => {
        const skillName = (() => {
          for (const variant of VARIANTS_LIST) {
            if (variant.passive.id === data.skillId) return variant.passive.name;
            if (variant.skill1.id === data.skillId) return variant.skill1.name;
            if (variant.skill2.id === data.skillId) return variant.skill2.name;
            if (variant.ultimate.id === data.skillId) return variant.ultimate.name;
          }
          return data.skillId;
        })();

        const activeColor = get().currentTurn;
        const skillString = `${activeColor}: Kích hoạt kỹ năng ${skillName}`;

        if (data.skillId === 'lightning_raigeki') {
          const currentBoard = get().board;
          const targets: string[] = [];
          if (currentBoard) {
            try {
              const boardClass = Board.fromSerializable(currentBoard);
              const casterColor = data.playerId === get().playerId ? get().playerColor : (get().playerColor === Color.White ? Color.Black : Color.White);
              const opponentColor = casterColor === Color.White ? Color.Black : Color.White;
              for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                  const pos = { col: c, row: r };
                  const piece = boardClass.getPiece(pos);
                  if (piece && piece.color === opponentColor && piece.effects) {
                    if (piece.effects.some((e: any) => e.type === 'stun')) {
                      targets.push(`${c},${r}`);
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error finding raigeki targets', e);
            }
          }

          if (targets.length > 0) {
            set({ lightningStrikeTargets: targets });

            setTimeout(() => {
              set({
                board: data.board,
                currentTurn: data.currentTurn,
                moveLog: [...get().moveLog, skillString],
                selectedSquare: null,
                legalMoves: [],
                whiteTimeLeft: data.whiteTimeLeft,
                blackTimeLeft: data.blackTimeLeft,
                lastUpdateLocalTime: Date.now(),
                turnNumber: data.turnNumber,
                hasMoved: data.hasMoved,
                skillsUsedThisTurn: data.skillsUsedThisTurn,
                whiteAP: data.whiteAP,
                blackAP: data.blackAP,
                variantState: data.variantState,
                whiteVariantId: data.whiteVariantId,
                blackVariantId: data.blackVariantId,
                lightningStrikeTargets: [],
                graveyard: (data as any).graveyard ?? [],
                availableSkillTargets: data.availableSkillTargets ?? {},
              });
              get().cancelSkill();
            }, 1000);
            return;
          }
        }

        if (data.skillId === 'dynamite_detonation') {
          const currentBoard = get().board;
          const targets: string[] = [];
          if (currentBoard) {
            try {
              const boardClass = Board.fromSerializable(currentBoard);
              for (let r = 0; r < 15; r++) {
                for (let c = 0; c < 15; c++) {
                  const pos = { col: c, row: r };
                  const piece = boardClass.getPiece(pos);
                  if (piece && piece.type !== 'King' && piece.effects) {
                    if (piece.effects.some((e: any) => e.type === 'bomb')) {
                      // 3x3 explosion area centered on the bomb piece
                      for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                          const col = c + dc;
                          const row = r + dr;
                          if (col >= 0 && col < 15 && row >= 0 && row < 15) {
                            const coord = `${col},${row}`;
                            if (!targets.includes(coord)) {
                              targets.push(coord);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error finding detonation targets', e);
            }
          }

          if (targets.length > 0) {
            set({ dynamiteExplosionTargets: targets });

            setTimeout(() => {
              set({
                board: data.board,
                currentTurn: data.currentTurn,
                moveLog: [...get().moveLog, skillString],
                selectedSquare: null,
                legalMoves: [],
                whiteTimeLeft: data.whiteTimeLeft,
                blackTimeLeft: data.blackTimeLeft,
                lastUpdateLocalTime: Date.now(),
                turnNumber: data.turnNumber,
                hasMoved: data.hasMoved,
                skillsUsedThisTurn: data.skillsUsedThisTurn,
                whiteAP: data.whiteAP,
                blackAP: data.blackAP,
                variantState: data.variantState,
                whiteVariantId: data.whiteVariantId,
                blackVariantId: data.blackVariantId,
                whitePlayerEffects: (data as any).whitePlayerEffects ?? [],
                blackPlayerEffects: (data as any).blackPlayerEffects ?? [],
                dynamiteExplosionTargets: [],
                graveyard: (data as any).graveyard ?? [],
                availableSkillTargets: data.availableSkillTargets ?? {},
              });
              get().cancelSkill();
            }, 1000);
            return;
          }
        }

        set({
          board: data.board,
          currentTurn: data.currentTurn,
          moveLog: [...get().moveLog, skillString],
          selectedSquare: null,
          legalMoves: [],
          whiteTimeLeft: data.whiteTimeLeft,
          blackTimeLeft: data.blackTimeLeft,
          lastUpdateLocalTime: Date.now(),
          turnNumber: data.turnNumber,
          hasMoved: data.hasMoved,
          skillsUsedThisTurn: data.skillsUsedThisTurn,
          whiteAP: data.whiteAP,
          blackAP: data.blackAP,
          variantState: data.variantState,
          whiteVariantId: data.whiteVariantId,
          blackVariantId: data.blackVariantId,
          whitePlayerEffects: (data as any).whitePlayerEffects ?? [],
          blackPlayerEffects: (data as any).blackPlayerEffects ?? [],
          graveyard: (data as any).graveyard ?? [],
          availableSkillTargets: data.availableSkillTargets ?? {},
        });
        get().cancelSkill();
      }
    );

    socket.on('skill-rejected', (data: { reason: string }) => {
      set({
        targetSelectionMode: false,
        validTargets: [],
        pendingTargets: [],
        requiredTargetCount: 0,
        currentRequirementIndex: 0,
        errorMessage: `Skill rejected: ${data.reason}`
      });
      setTimeout(() => set({ errorMessage: null }), 3000);
    });

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
          turnNumber?: number;
          hasMoved?: boolean;
          skillsUsedThisTurn?: number;
          whiteAP?: number;
          blackAP?: number;
          variantState?: Record<string, any>;
          whiteVariantId?: string | null;
          blackVariantId?: string | null;
          graveyard?: any[];
        } | null;
        roomPhase?: GamePhase;
        draftEndTime?: number;
      }) => {
        const phase = data.matchState
          ? data.matchState.status === 'finished'
            ? 'finished'
            : 'playing'
          : data.roomPhase || 'waiting';

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
          draftEndTime: data.draftEndTime ?? null,
          turnNumber: data.matchState?.turnNumber ?? 1,
          hasMoved: data.matchState?.hasMoved ?? false,
          skillsUsedThisTurn: data.matchState?.skillsUsedThisTurn ?? 0,
          whiteAP: data.matchState?.whiteAP ?? 0,
          blackAP: data.matchState?.blackAP ?? 0,
          variantState: data.matchState?.variantState ?? {},
          whiteVariantId: data.matchState?.whiteVariantId ?? null,
          blackVariantId: data.matchState?.blackVariantId ?? null,
          whitePlayerEffects: (data.matchState as any)?.whitePlayerEffects ?? [],
          blackPlayerEffects: (data.matchState as any)?.blackPlayerEffects ?? [],
          graveyard: (data.matchState as any)?.graveyard ?? [],
          availableSkillTargets: (data.matchState as any)?.availableSkillTargets ?? {},
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
