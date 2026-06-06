// ============================================================
// Match - Game session management
// ============================================================

import { Board, SerializedBoard } from '../board/Board';
import { Position, toAlgebraic } from '../board/Position';
import { Color, PieceType, oppositeColor } from '../pieces/Piece';
import { createInitialBoard } from '../pieces/initialLayout';
import { validateMove } from '../validation/MoveValidator';
import { getLegalMoves } from '../movement/MoveGenerator';

export type MatchStatus = 'waiting' | 'playing' | 'finished';

export interface MoveResult {
  success: boolean;
  reason?: string;
  capturedPiece?: { type: PieceType; color: Color };
  isKingCaptured?: boolean;
}

export interface SerializedMatch {
  board: SerializedBoard;
  currentTurn: Color;
  status: MatchStatus;
  winner: Color | null;
  moveHistory: { from: string; to: string }[];
  whiteTimeLeft: number;
  blackTimeLeft: number;
  lastMoveTimestamp: number;
}

export class Match {
  private board: Board;
  private currentTurn: Color;
  private status: MatchStatus;
  private winner: Color | null;
  private moveHistory: { from: string; to: string }[];
  private whiteTimeLeft: number;
  private blackTimeLeft: number;
  private lastMoveTimestamp: number;

  constructor() {
    this.board = createInitialBoard();
    this.currentTurn = Color.White;
    this.status = 'waiting';
    this.winner = null;
    this.moveHistory = [];
    this.whiteTimeLeft = 15 * 60 * 1000; // 15 mins
    this.blackTimeLeft = 15 * 60 * 1000;
    this.lastMoveTimestamp = 0;
  }

  /**
   * Start the match
   */
  start(): void {
    if (this.status !== 'waiting') {
      throw new Error('Match already started');
    }
    this.status = 'playing';
    this.lastMoveTimestamp = Date.now();
  }

  /**
   * Attempt to make a move. Returns the result.
   */
  makeMove(playerColor: Color, from: Position, to: Position): MoveResult {
    if (this.status !== 'playing') {
      return { success: false, reason: 'Match is not in progress' };
    }

    const now = Date.now();
    const elapsed = this.moveHistory.length === 0 ? 0 : now - this.lastMoveTimestamp;

    // Validate
    const validation = validateMove(this.board, this.currentTurn, playerColor, from, to);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    // Process time
    if (this.currentTurn === Color.White) {
      this.whiteTimeLeft -= elapsed;
      if (this.whiteTimeLeft <= 0) {
        this.status = 'finished';
        this.winner = Color.Black;
        this.whiteTimeLeft = 0;
        return { success: false, reason: 'Time out' };
      }
      this.whiteTimeLeft += 10000; // +10 seconds increment
    } else {
      this.blackTimeLeft -= elapsed;
      if (this.blackTimeLeft <= 0) {
        this.status = 'finished';
        this.winner = Color.White;
        this.blackTimeLeft = 0;
        return { success: false, reason: 'Time out' };
      }
      this.blackTimeLeft += 10000; // +10 seconds increment
    }

    this.lastMoveTimestamp = now;

    // Execute move
    const captured = this.board.movePiece(from, to);

    // Record move
    this.moveHistory.push({ from: toAlgebraic(from), to: toAlgebraic(to) });

    // Check for king capture
    let isKingCaptured = false;
    if (captured && captured.type === PieceType.King) {
      isKingCaptured = true;
      this.status = 'finished';
      this.winner = playerColor;
    }

    // Switch turns
    if (!isKingCaptured) {
      this.currentTurn = oppositeColor(this.currentTurn);
    }

    return {
      success: true,
      capturedPiece: captured ? { type: captured.type, color: captured.color } : undefined,
      isKingCaptured,
    };
  }

  /**
   * Get legal moves for a position (used by frontend for highlighting)
   */
  getLegalMovesAt(pos: Position): Position[] {
    return getLegalMoves(this.board, pos);
  }

  getBoard(): Board {
    return this.board;
  }

  getCurrentTurn(): Color {
    return this.currentTurn;
  }

  getStatus(): MatchStatus {
    return this.status;
  }

  getWinner(): Color | null {
    return this.winner;
  }

  getMoveHistory(): { from: string; to: string }[] {
    return [...this.moveHistory];
  }

  /**
   * Check if the current player has run out of time
   */
  checkTimeout(): Color | null {
    if (this.status !== 'playing') return null;
    if (this.moveHistory.length === 0) return null;
    
    const now = Date.now();
    const elapsed = now - this.lastMoveTimestamp;
    
    if (this.currentTurn === Color.White && this.whiteTimeLeft - elapsed <= 0) {
      this.status = 'finished';
      this.winner = Color.Black;
      this.whiteTimeLeft = 0;
      return Color.Black;
    } else if (this.currentTurn === Color.Black && this.blackTimeLeft - elapsed <= 0) {
      this.status = 'finished';
      this.winner = Color.White;
      this.blackTimeLeft = 0;
      return Color.White;
    }
    
    return null;
  }

  /**
   * Serialize the entire match state for network transfer
   */
  toSerializable(): SerializedMatch {
    return {
      board: this.board.toSerializable(),
      currentTurn: this.currentTurn,
      status: this.status,
      winner: this.winner,
      moveHistory: [...this.moveHistory],
      whiteTimeLeft: this.whiteTimeLeft,
      blackTimeLeft: this.blackTimeLeft,
      lastMoveTimestamp: this.lastMoveTimestamp,
    };
  }
}
