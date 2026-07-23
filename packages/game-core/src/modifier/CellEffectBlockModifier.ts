import { MoveModifier, MoveModifierContext } from './MoveModifier';
import { Position } from '../board/Position';
import { Board } from '../board/Board';
import { Color } from '../pieces/Piece';

/**
 * Checks if a sliding path is blocked by a cell effect (e.g. mountain, flame)
 * or a special piece (e.g. mountain special piece).
 */
export function isSlidingBlocked(board: Board, pos: Position, moverColor?: Color): boolean {
  const cellEffects = board.getCellEffects(pos);
  if (cellEffects.some(e => e.type === 'mountain' || e.type === 'flame')) {
    return true;
  }
  if (moverColor !== undefined) {
    if (cellEffects.some(e => e.type === 'outworld' && e.sourcePlayer !== moverColor)) {
      return true;
    }
  }
  const piece = board.getPiece(pos);
  if (piece && piece.specialType === 'mountain') {
    return true;
  }
  return false;
}

export class CellEffectBlockModifier implements MoveModifier {
  id = 'cell_effect_block';
  priority = 50;
  source = 'modifier:cell_effect';

  modify(moves: Position[], context: MoveModifierContext): Position[] {
    const moverColor = context.piece.color;
    return moves.filter(pos => {
      const cellEffects = context.board.getCellEffects(pos);
      // Flame blocks landing for ALL pieces (Knight, Pawn, King, Rook, Bishop, etc.)
      if (cellEffects.some(e => e.type === 'flame')) {
        return false;
      }
      // Outworld blocks landing for enemy pieces
      if (cellEffects.some(e => e.type === 'outworld' && e.sourcePlayer !== moverColor)) {
        return false;
      }
      return true;
    });
  }
}
