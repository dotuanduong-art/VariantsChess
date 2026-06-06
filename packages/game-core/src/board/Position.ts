// ============================================================
// Position - Coordinate system for the 15x15 board
// ============================================================

export interface Position {
  col: number; // 0-14
  row: number; // 0-14
}

const COL_LABELS = 'ABCDEFGHIJKLMNO';

/**
 * Convert a Position to algebraic notation (e.g., { col: 0, row: 0 } → "A1")
 */
export function toAlgebraic(pos: Position): string {
  return `${COL_LABELS[pos.col]}${pos.row + 1}`;
}

/**
 * Convert algebraic notation to a Position (e.g., "A1" → { col: 0, row: 0 })
 */
export function fromAlgebraic(notation: string): Position {
  const col = COL_LABELS.indexOf(notation[0].toUpperCase());
  const row = parseInt(notation.slice(1), 10) - 1;
  if (col === -1 || isNaN(row)) {
    throw new Error(`Invalid algebraic notation: ${notation}`);
  }
  return { col, row };
}

/**
 * Check if a position is within the 15x15 board bounds
 */
export function isInBounds(pos: Position): boolean {
  return pos.col >= 0 && pos.col < 15 && pos.row >= 0 && pos.row < 15;
}

/**
 * Check if two positions are equal
 */
export function posEquals(a: Position, b: Position): boolean {
  return a.col === b.col && a.row === b.row;
}
