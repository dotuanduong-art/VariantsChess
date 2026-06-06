export { Board, BOARD_SIZE } from './board/Board';
export type { SerializedBoard } from './board/Board';
export { toAlgebraic, fromAlgebraic, isInBounds, posEquals } from './board/Position';
export type { Position } from './board/Position';
export { PieceType, Color, oppositeColor } from './pieces/Piece';
export type { Piece } from './pieces/Piece';
export { createInitialBoard } from './pieces/initialLayout';
export { getLegalMoves } from './movement/MoveGenerator';
export { validateMove } from './validation/MoveValidator';
export type { ValidationResult } from './validation/MoveValidator';
export { Match } from './match/Match';
export type { MatchStatus, MoveResult, SerializedMatch } from './match/Match';
//# sourceMappingURL=index.d.ts.map