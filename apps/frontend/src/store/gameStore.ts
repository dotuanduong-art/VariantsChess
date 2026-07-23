// ============================================================
// Game Store - Zustand state management
// ============================================================

import { create } from 'zustand';
import type { SerializedBoard, Piece, Position, SkillTarget, SkillTargetRequirement } from 'game-core';
import { Color, PieceType, fromAlgebraic, toAlgebraic, getLegalMoves, getBaseMovesForType, Board } from 'game-core';
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
    currentCost?: number;
  }>;
  opponentSkillCosts: Record<string, number>;

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
  skillsUsedThisTurnIds: string[];
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
  sacrificePiece: (pos: Position, pieceId: string) => void;
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

function getShiftingPeaksDestinations(
  board: Board,
  playerColor: Color,
  from: Position
): Position[] {
  const validDests: Position[] = [];
  const BOARD_SIZE = 15;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const to = { col: c, row: r };
      if (to.col === from.col && to.row === from.row) continue;

      const dcol = to.col - from.col;
      const drow = to.row - from.row;
      const absCol = Math.abs(dcol);
      const absRow = Math.abs(drow);

      const isOrthogonal = dcol === 0 || drow === 0;
      const isDiagonal = absCol === absRow;
      if (!isOrthogonal && !isDiagonal) continue;

      const stepCol = Math.sign(dcol);
      const stepRow = Math.sign(drow);
      const steps = Math.max(absCol, absRow);

      // B (to) must be empty
      if (board.getPiece(to)) continue;

      // Build path cells (excluding 'from', including 'to')
      const path: Position[] = [];
      let blocked = false;
      for (let k = 1; k <= steps; k++) {
        const cell = { col: from.col + k * stepCol, row: from.row + k * stepRow };
        path.push(cell);
        const piece = board.getPiece(cell);
        if (piece) {
          if (piece.color === playerColor) {
            blocked = true;
            break;
          }
          if (piece.specialType === 'mountain') {
            blocked = true;
            break;
          }
        }
      }
      if (blocked) continue;

      // Find enemy pieces on path (excluding destination 'to' because 'to' is empty)
      const enemyPiecesOnPath: { piece: Piece; startPos: Position; dist: number }[] = [];
      for (let k = 1; k < steps; k++) {
        const cell = path[k - 1];
        const piece = board.getPiece(cell);
        if (piece) {
          enemyPiecesOnPath.push({ piece, startPos: cell, dist: k });
        }
      }

      // Sort by distance descending (furthest first)
      enemyPiecesOnPath.sort((a, b) => b.dist - a.dist);

      const occupiedKeys = new Set<string>();

      // Add all static obstacles (all pieces not on the path, plus target Mountain at 'from' since it is moving)
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          const cell = { col, row };
          const p = board.getPiece(cell);
          if (p && p.id !== board.getPiece(from)?.id) {
            const isPushed = enemyPiecesOnPath.some(item => item.piece.id === p.id);
            if (!isPushed) {
              occupiedKeys.add(`${col},${row}`);
            }
          }
        }
      }

      const pushes: { pieceId: string; from: Position; to: Position }[] = [];
      let pushValid = true;

      // Simulate pushing from furthest to closest
      for (const item of enemyPiecesOnPath) {
        let curr = { ...item.startPos };
        let stepsPushed = 0;
        while (stepsPushed < 3) {
          const next = { col: curr.col + stepCol, row: curr.row + stepRow };
          if (next.col < 0 || next.col >= BOARD_SIZE || next.row < 0 || next.row >= BOARD_SIZE) {
            break; // hit edge of board
          }
          const nextKey = `${next.col},${next.row}`;
          if (occupiedKeys.has(nextKey)) {
            break; // hit obstacle
          }
          curr = next;
          stepsPushed++;
        }

        occupiedKeys.add(`${curr.col},${curr.row}`);
        pushes.push({ pieceId: item.piece.id, from: item.startPos, to: curr });
      }

      // If any pushed piece ends up on the path (including 'to'), it is invalid
      for (const push of pushes) {
        const isOnPath = path.some(cell => cell.col === push.to.col && cell.row === push.to.row);
        if (isOnPath) {
          pushValid = false;
          break;
        }
      }

      if (pushValid) {
        validDests.push(to);
      }
    }
  }

  return validDests;
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
  opponentSkillCosts: {},
  turnNumber: 1,
  hasMoved: false,
  skillsUsedThisTurn: 0,
  skillsUsedThisTurnIds: [],
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
      let initialTargets = validPositions[0] || [];
      if (skillId === 'earth_shifting_peaks' && state.board && state.playerColor) {
        const board = Board.fromSerializable(state.board);
        initialTargets = initialTargets.filter(pos => {
          const piece = board.getPiece(pos);
          return piece && piece.specialType === 'mountain' && piece.color === state.playerColor;
        });
      }
      set({
        activeSkillId: skillId,
        targetSelectionMode: true,
        validTargets: initialTargets,
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
      let nextValidTargets = validPositions[nextIndex] || [];
      if (state.activeSkillId === 'verdant_dragon_ultimate' || state.activeSkillId === 'lord_reinforcements') {
        nextValidTargets = nextValidTargets.filter(p =>
          !nextPending.some(pt => pt.position && pt.position.col === p.col && pt.position.row === p.row)
        );
      }

      if (state.activeSkillId === 'earth_shifting_peaks' && nextIndex === 1 && state.board && state.playerColor) {
        const board = Board.fromSerializable(state.board);
        const fromPos = nextPending[0].position;
        if (fromPos) {
          nextValidTargets = getShiftingPeaksDestinations(board, state.playerColor, fromPos);
        }
      }

      if (state.activeSkillId === 'turtle_transference' && nextIndex === 1 && state.board && state.playerColor) {
        const board = Board.fromSerializable(state.board);
        const fromPos = nextPending[0].position;
        if (fromPos) {
          const sourcePiece = board.getPiece(fromPos);
          if (sourcePiece) {
            const isSourceEnemy = sourcePiece.color !== state.playerColor;
            
            // Find the transferable effect
            const effect = sourcePiece.effects?.find((e: any) => {
              const isTransferableType = ['stun', 'shield', 'blessing', 'electron', 'ghost'].includes(e.type);
              if (!isTransferableType) return false;
              return isSourceEnemy ? !e.isDebuff : e.isDebuff;
            });

            if (effect) {
              nextValidTargets = nextValidTargets.filter(p => {
                // Cannot be the source piece itself
                if (p.col === fromPos.col && p.row === fromPos.row) return false;

                const destPiece = board.getPiece(p);
                if (!destPiece) return false;

                // Cannot be King
                if (destPiece.type === PieceType.King) return false;

                const isDestEnemy = destPiece.color !== state.playerColor;

                if (isSourceEnemy) {
                  // Transferring buff from enemy -> must be to ally
                  if (isDestEnemy) return false;
                } else {
                  // Transferring debuff from ally -> must be to enemy
                  if (!isDestEnemy) return false;

                  // Aegis target check for destination piece if it is an enemy receiving a debuff
                  const destHasAegis = destPiece.effects?.some((e: any) => e.type === 'aegis');
                  if (destHasAegis) return false;
                }

                return true;
              });
            } else {
              nextValidTargets = [];
            }
          }
        }
      }
      if (state.activeSkillId === 'time_prediction' && nextIndex === 1) {
        const socket = getSocket();
        socket.emit('get-enemy-piece-moves', {
          roomCode: state.roomCode,
          playerId: state.playerId,
          position: pos,
        });
        nextValidTargets = [];
      }
      set({
        pendingTargets: nextPending,
        currentRequirementIndex: nextIndex,
        validTargets: nextValidTargets,
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

    const getMovesForPiece = (p: Position): Position[] => {
      const piece = board.getPiece(p);
      if (!piece) return [];
      
      const color = piece.color;
      const variantId = color === Color.White ? state.whiteVariantId : state.blackVariantId;
      
      if (piece.type === PieceType.King && variantId === 'cannibal') {
        const isUltimate = state.variantState.ultimateActive === true;
        if (isUltimate) {
          const queenMoves = getBaseMovesForType(board, p, PieceType.Queen, color, true);
          const knightMoves = getBaseMovesForType(board, p, PieceType.Knight, color, true);
          const combined = [...queenMoves, ...knightMoves];
          const seen = new Set<string>();
          return combined.filter(m => {
            const key = `${m.col},${m.row}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
        
        const moveType = state.variantState.kingCurrentMoveType || PieceType.King;
        return getBaseMovesForType(board, p, moveType, color, true);
      }
      
      const baseMoves = getLegalMoves(board, p);
      let moves = [...baseMoves];

      if (piece.effects?.some((e: any) => e.type === 'zombie')) {
        moves = moves.map((pos: any) => {
          const target = board.getPiece(pos);
          const lm = { ...pos } as any;
          if (target) {
            const targetOwner = target.effects?.find((e: any) => e.type === 'walker')?.metadata?.controlledBy || target.color;
            const moverOwner = piece.effects?.find((e: any) => e.type === 'walker')?.metadata?.controlledBy || piece.color;
            if (targetOwner !== moverOwner) {
              const hasWalker = target.effects?.some((e: any) => e.type === 'walker');
              if (!hasWalker) {
                lm.moveType = 'zombie_bite';
              } else {
                lm.moveType = 'capture';
              }
            } else {
              lm.moveType = 'capture';
            }
          } else {
            lm.moveType = 'normal';
          }
          return lm;
        });
      }

      if (piece.effects?.some((e: any) => e.type === 'walker')) {
        moves = moves.filter((pos: any) => board.getPiece(pos) === null);
      }

      return moves;
    };

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

        const targetMove = state.legalMoves.find(
          m => m.col === pos.col && m.row === pos.row
        ) as any;
        const moveType = targetMove?.moveType;

        socket.emit('move', {
          roomCode: state.roomCode,
          playerId: state.playerId,
          from,
          to,
          moveType,
        });

        set({ selectedSquare: null, legalMoves: [] });
        return;
      }

      // If clicking own piece (or controlled Walker/Puppet), reselect it
      const canReselect = clickedPiece && (
        clickedPiece.color === state.playerColor ||
        clickedPiece.effects?.some((e: any) => e.type === 'walker' && e.metadata?.controlledBy === state.playerColor) ||
        clickedPiece.effects?.some((e: any) => e.type === 'puppet_control' && e.metadata?.controlledBy === state.playerColor)
      );

      if (canReselect) {
        const moves = getMovesForPiece(pos);
        set({ selectedSquare: pos, legalMoves: moves });
        return;
      }

      // Otherwise deselect
      set({ selectedSquare: null, legalMoves: [] });
      return;
    }

    // No selection - select a piece if it's ours or a controlled Walker/Puppet
    const canSelect = clickedPiece && (
      clickedPiece.color === state.playerColor ||
      clickedPiece.effects?.some((e: any) => e.type === 'walker' && e.metadata?.controlledBy === state.playerColor) ||
      clickedPiece.effects?.some((e: any) => e.type === 'puppet_control' && e.metadata?.controlledBy === state.playerColor)
    );

    if (canSelect) {
      const moves = getMovesForPiece(pos);
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
      skillsUsedThisTurnIds: [],
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
      opponentSkillCosts: {},
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

  sacrificePiece: (pos: Position, pieceId: string) => {
    const state = get();
    if (!state.roomCode || !state.playerId) return;
    const socket = getSocket();
    socket.emit('sacrifice-piece', {
      roomCode: state.roomCode,
      playerId: state.playerId,
      position: pos,
      pieceId,
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
          skillsUsedThisTurnIds: (data as any).skillsUsedThisTurnIds ?? [],
          whiteAP: data.whiteAP ?? 0,
          blackAP: data.blackAP ?? 0,
          variantState: data.variantState ?? {},
          whiteVariantId: data.whiteVariantId ?? null,
          blackVariantId: data.blackVariantId ?? null,
          whitePlayerEffects: (data as any).whitePlayerEffects ?? [],
          blackPlayerEffects: (data as any).blackPlayerEffects ?? [],
          graveyard: (data as any).graveyard ?? [],
          availableSkillTargets: (data as any).availableSkillTargets ?? {},
          opponentSkillCosts: (data as any).opponentSkillCosts ?? {},
          activeSkillId: null,
          targetSelectionMode: false,
          validTargets: [],
          pendingTargets: [],
          requiredTargetCount: 0,
          currentRequirementIndex: 0,
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
        const currentBoard = get().board;
        let isRepelled = false;
        let fromPos: Position | null = null;
        let toPos: Position | null = null;

        if (data.from && data.to && currentBoard) {
          try {
            fromPos = fromAlgebraic(data.from);
            toPos = fromAlgebraic(data.to);
            const originalPiece = currentBoard.grid[fromPos.row]?.[fromPos.col];
            const finalPiece = data.board.grid[fromPos.row]?.[fromPos.col];
            if (originalPiece && finalPiece && originalPiece.id === finalPiece.id) {
              isRepelled = true;
            }
          } catch (e) {
            console.error('Error checking repel state', e);
          }
        }

        const newCaptured = data.capturedPiece
          ? [...get().capturedPieces, data.capturedPiece]
          : get().capturedPieces;
          
        const moverColor = get().currentTurn;
        const newMoveLog = [...get().moveLog];
        if (data.from && data.to) {
          newMoveLog.push(`${moverColor}: ${data.from} -> ${data.to}${data.capturedPiece ? ' (x)' : ''}`);
        } else if ((data as any).stealthMove) {
          newMoveLog.push(`${moverColor}: (Tàng hình)`);
        }
        
        if (isRepelled && fromPos && toPos) {
          // Construct intermediate board state where the piece is at toPos
          const intermediateBoard: SerializedBoard = JSON.parse(JSON.stringify(data.board));
          const piece = intermediateBoard.grid[fromPos.row]?.[fromPos.col];
          if (piece) {
            // Ensure target rows exist
            if (!intermediateBoard.grid[toPos.row]) {
              intermediateBoard.grid[toPos.row] = [];
            }
            intermediateBoard.grid[toPos.row][toPos.col] = piece;
            intermediateBoard.grid[fromPos.row][fromPos.col] = null;
          }

          set({
            board: intermediateBoard,
            currentTurn: data.currentTurn,
            lastMove: (data as any).stealthMove ? null : (data.from && data.to ? { from: data.from, to: data.to } : get().lastMove),
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
            skillsUsedThisTurnIds: (data as any).skillsUsedThisTurnIds ?? [],
            whiteAP: data.whiteAP,
            blackAP: data.blackAP,
            variantState: data.variantState,
            whiteVariantId: data.whiteVariantId,
            blackVariantId: data.blackVariantId,
            whitePlayerEffects: (data as any).whitePlayerEffects ?? [],
            blackPlayerEffects: (data as any).blackPlayerEffects ?? [],
            graveyard: (data as any).graveyard ?? [],
            availableSkillTargets: (data as any).availableSkillTargets ?? {},
            opponentSkillCosts: (data as any).opponentSkillCosts ?? {},
            activeSkillId: null,
            targetSelectionMode: false,
            validTargets: [],
            pendingTargets: [],
            requiredTargetCount: 0,
            currentRequirementIndex: 0,
          });

          // Wait 400ms and restore final board state
          setTimeout(() => {
            set({ board: data.board });
          }, 400);
        } else {
          set({
            board: data.board,
            currentTurn: data.currentTurn,
            lastMove: (data as any).stealthMove ? null : (data.from && data.to ? { from: data.from, to: data.to } : get().lastMove),
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
            skillsUsedThisTurnIds: (data as any).skillsUsedThisTurnIds ?? [],
            whiteAP: data.whiteAP,
            blackAP: data.blackAP,
            variantState: data.variantState,
            whiteVariantId: data.whiteVariantId,
            blackVariantId: data.blackVariantId,
            whitePlayerEffects: (data as any).whitePlayerEffects ?? [],
            blackPlayerEffects: (data as any).blackPlayerEffects ?? [],
            graveyard: (data as any).graveyard ?? [],
            availableSkillTargets: (data as any).availableSkillTargets ?? {},
            opponentSkillCosts: (data as any).opponentSkillCosts ?? {},
            activeSkillId: null,
            targetSelectionMode: false,
            validTargets: [],
            pendingTargets: [],
            requiredTargetCount: 0,
            currentRequirementIndex: 0,
          });
        }
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
                skillsUsedThisTurnIds: (data as any).skillsUsedThisTurnIds ?? [],
                whiteAP: data.whiteAP,
                blackAP: data.blackAP,
                variantState: data.variantState,
                whiteVariantId: data.whiteVariantId,
                blackVariantId: data.blackVariantId,
                lightningStrikeTargets: [],
                graveyard: (data as any).graveyard ?? [],
                availableSkillTargets: data.availableSkillTargets ?? {},
                opponentSkillCosts: (data as any).opponentSkillCosts ?? {},
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
                skillsUsedThisTurnIds: (data as any).skillsUsedThisTurnIds ?? [],
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
                opponentSkillCosts: (data as any).opponentSkillCosts ?? {},
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
          skillsUsedThisTurnIds: (data as any).skillsUsedThisTurnIds ?? [],
          whiteAP: data.whiteAP,
          blackAP: data.blackAP,
          variantState: data.variantState,
          whiteVariantId: data.whiteVariantId,
          blackVariantId: data.blackVariantId,
          whitePlayerEffects: (data as any).whitePlayerEffects ?? [],
          blackPlayerEffects: (data as any).blackPlayerEffects ?? [],
          graveyard: (data as any).graveyard ?? [],
          availableSkillTargets: data.availableSkillTargets ?? {},
          opponentSkillCosts: (data as any).opponentSkillCosts ?? {},
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
          moveHistory?: { from: string; to: string; isStealth?: boolean; moverColor?: Color }[];
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
        const lastMove = (history.length > 0 && history[history.length - 1].from && history[history.length - 1].to)
          ? history[history.length - 1]
          : null;

        const moveLog: string[] = [];
        for (const entry of history) {
          if (entry.from && entry.to) {
            moveLog.push(`${entry.moverColor}: ${entry.from} -> ${entry.to}`);
          } else if (entry.isStealth) {
            moveLog.push(`${entry.moverColor}: (Tàng hình)`);
          }
        }

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
          moveLog,
          draftEndTime: data.draftEndTime ?? null,
          turnNumber: data.matchState?.turnNumber ?? 1,
          hasMoved: data.matchState?.hasMoved ?? false,
          skillsUsedThisTurn: data.matchState?.skillsUsedThisTurn ?? 0,
          skillsUsedThisTurnIds: (data.matchState as any)?.skillsUsedThisTurnIds ?? [],
          whiteAP: data.matchState?.whiteAP ?? 0,
          blackAP: data.matchState?.blackAP ?? 0,
          variantState: data.matchState?.variantState ?? {},
          whiteVariantId: data.matchState?.whiteVariantId ?? null,
          blackVariantId: data.matchState?.blackVariantId ?? null,
          whitePlayerEffects: (data.matchState as any)?.whitePlayerEffects ?? [],
          blackPlayerEffects: (data.matchState as any)?.blackPlayerEffects ?? [],
          graveyard: (data.matchState as any)?.graveyard ?? [],
          availableSkillTargets: (data.matchState as any)?.availableSkillTargets ?? {},
          opponentSkillCosts: (data.matchState as any)?.opponentSkillCosts ?? {},
          activeSkillId: null,
          targetSelectionMode: false,
          validTargets: [],
          pendingTargets: [],
          requiredTargetCount: 0,
          currentRequirementIndex: 0,
        });
      }
    );

    socket.on('enemy-piece-moves', (data: { position: Position; moves: Position[] }) => {
      const state = get();
      if (state.targetSelectionMode && state.activeSkillId === 'time_prediction' && state.currentRequirementIndex === 1) {
        set({ validTargets: data.moves });
      }
    });

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
