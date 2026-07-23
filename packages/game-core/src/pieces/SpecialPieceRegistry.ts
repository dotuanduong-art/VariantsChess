import { Board, BOARD_SIZE } from '../board/Board';
import { Position } from '../board/Position';
import { Piece, Color } from './Piece';
import { Action } from '../action/Action';

export interface SpecialPieceDefinition {
  id: string;                    // e.g. 'totem', 'walker'
  displayName: string;
  getLegalMoves?: (board: Board, pos: Position, piece: Piece) => Position[];
  captureApReward?: number;
  lossApReward?: number;
  canBeAttacked?: boolean;       // Defaults to true if not defined
  onDestroyed?: (piece: Piece, position: Position, enqueueAction: (action: Action) => void) => void;
}

export class SpecialPieceRegistry {
  private static instance: SpecialPieceRegistry;
  private definitions: Map<string, SpecialPieceDefinition> = new Map();

  private constructor() {}

  static getInstance(): SpecialPieceRegistry {
    if (!SpecialPieceRegistry.instance) {
      SpecialPieceRegistry.instance = new SpecialPieceRegistry();
    }
    return SpecialPieceRegistry.instance;
  }

  register(definition: SpecialPieceDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  get(specialType: string): SpecialPieceDefinition | undefined {
    return this.definitions.get(specialType);
  }

  clear(): void {
    this.definitions.clear();
  }
}

export const specialPieceRegistry = SpecialPieceRegistry.getInstance();

export function countSpecialPieces(board: Board, player: Color, specialType: string): number {
  let count = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const p = board.getPiece({ col, row });
      if (p && p.color === player && p.specialType === specialType) {
        count++;
      }
    }
  }
  return count;
}
