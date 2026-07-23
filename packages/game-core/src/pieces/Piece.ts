// ============================================================
// Piece - Types and enums for chess pieces
// ============================================================

export enum PieceType {
  King = 'King',
  Queen = 'Queen',
  Rook = 'Rook',
  Bishop = 'Bishop',
  Knight = 'Knight',
  Pawn = 'Pawn',
}

export enum Color {
  White = 'White',
  Black = 'Black',
}

import { Effect } from '../effect/Effect';

export interface Piece {
  id: string;
  type: PieceType | string;
  color: Color;
  effects: Effect[];
  specialType?: string;
}

/**
 * Get the opponent's color
 */
export function oppositeColor(color: Color): Color {
  return color === Color.White ? Color.Black : Color.White;
}

/**
 * Get the owner/controller of a piece, taking Walker shared control metadata into account.
 */
export function getPieceOwner(piece: Piece): Color {
  const walkerEffect = piece.effects?.find(e => e.type === 'walker');
  if (walkerEffect && walkerEffect.metadata && walkerEffect.metadata.controlledBy) {
    return walkerEffect.metadata.controlledBy as Color;
  }
  const puppetEffect = piece.effects?.find(e => e.type === 'puppet_control');
  if (puppetEffect && puppetEffect.metadata && puppetEffect.metadata.controlledBy) {
    return puppetEffect.metadata.controlledBy as Color;
  }
  return piece.color;
}
