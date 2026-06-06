// ============================================================
// game-core - Public API
// ============================================================

// Board
export { Board, BOARD_SIZE } from './board/Board';
export type { SerializedBoard } from './board/Board';
export { toAlgebraic, fromAlgebraic, isInBounds, posEquals } from './board/Position';
export type { Position } from './board/Position';

// Pieces
export { PieceType, Color, oppositeColor } from './pieces/Piece';
export type { Piece } from './pieces/Piece';
export { createInitialBoard } from './pieces/initialLayout';

// Movement
export { getLegalMoves } from './movement/MoveGenerator';

// Validation
export { validateMove } from './validation/MoveValidator';
export type { ValidationResult } from './validation/MoveValidator';

// Match
export { Match } from './match/Match';
export type { MatchStatus, MoveResult, SerializedMatch } from './match/Match';
