// ============================================================
// Board - 15x15 chess board representation
// ============================================================

import { Position, isInBounds } from './Position';
import { Piece } from '../pieces/Piece';

export const BOARD_SIZE = 15;

export interface SerializedBoard {
  grid: (Piece | null)[][];
}

export class Board {
  private grid: (Piece | null)[][];

  constructor() {
    this.grid = Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => null)
    );
  }

  /**
   * Get the piece at a position, or null if empty
   */
  getPiece(pos: Position): Piece | null {
    if (!isInBounds(pos)) return null;
    return this.grid[pos.row][pos.col];
  }

  /**
   * Place a piece at a position
   */
  setPiece(pos: Position, piece: Piece | null): void {
    if (!isInBounds(pos)) {
      throw new Error(`Position out of bounds: (${pos.col}, ${pos.row})`);
    }
    this.grid[pos.row][pos.col] = piece;
  }

  /**
   * Remove a piece from a position and return it
   */
  removePiece(pos: Position): Piece | null {
    const piece = this.getPiece(pos);
    if (piece) {
      this.grid[pos.row][pos.col] = null;
    }
    return piece;
  }

  /**
   * Move a piece from one position to another. Returns captured piece if any.
   */
  movePiece(from: Position, to: Position): Piece | null {
    const piece = this.removePiece(from);
    if (!piece) {
      throw new Error(`No piece at position (${from.col}, ${from.row})`);
    }
    const captured = this.removePiece(to);
    this.setPiece(to, piece);
    return captured;
  }

  /**
   * Create a deep copy of the board
   */
  clone(): Board {
    const newBoard = new Board();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const piece = this.grid[row][col];
        if (piece) {
          newBoard.grid[row][col] = { ...piece };
        }
      }
    }
    return newBoard;
  }

  /**
   * Serialize the board for network transfer
   */
  toSerializable(): SerializedBoard {
    return {
      grid: this.grid.map(row => row.map(piece => (piece ? { ...piece } : null))),
    };
  }

  /**
   * Restore a board from serialized data
   */
  static fromSerializable(data: SerializedBoard): Board {
    const board = new Board();
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const piece = data.grid[row]?.[col];
        if (piece) {
          board.grid[row][col] = { ...piece };
        }
      }
    }
    return board;
  }
}
