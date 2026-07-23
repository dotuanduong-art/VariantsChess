export interface Position {
    col: number;
    row: number;
}
export interface LegalMove extends Position {
    moveType?: 'normal' | 'capture' | 'zombie_bite';
}
/**
 * Convert a Position to algebraic notation (e.g., { col: 0, row: 0 } → "A1")
 */
export declare function toAlgebraic(pos: Position): string;
/**
 * Convert algebraic notation to a Position (e.g., "A1" → { col: 0, row: 0 })
 */
export declare function fromAlgebraic(notation: string): Position;
/**
 * Check if a position is within the 15x15 board bounds
 */
export declare function isInBounds(pos: Position): boolean;
/**
 * Check if two positions are equal
 */
export declare function posEquals(a: Position, b: Position): boolean;
//# sourceMappingURL=Position.d.ts.map