import { Position } from '../board/Position';
export type RegionShape = 'square' | 'cross' | 'x_shape' | 'rect' | 'ring';
export type Direction = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';
export interface RegionParams {
    center: Position;
    shape: RegionShape;
    size: number;
    width?: number;
    height?: number;
    direction?: Direction;
    includeCenter?: boolean;
}
/**
 * Get all positions in the specified region, clamped to board bounds.
 */
export declare function getRegion(params: RegionParams): Position[];
/**
 * NxN square centered on `center`.
 * Example: size=3 → 1 square in each direction from center (3×3 = 9 cells max).
 */
export declare function getSquareRegion(center: Position, size: number): Position[];
/**
 * Cross-shaped region (+ pattern) centered on `center`.
 * `armLength` is the number of squares in each arm from center.
 * Example: armLength=2 → extends 2 squares in each of N/S/E/W.
 */
export declare function getCrossRegion(center: Position, armLength: number): Position[];
/**
 * X-shaped region (× pattern) centered on `center`.
 * `armLength` is the number of squares in each diagonal arm from center.
 */
export declare function getXRegion(center: Position, armLength: number): Position[];
/**
 * Directional rectangle from a starting position.
 * Generates a rectangle of `width` × `length` extending in `direction` from `start`.
 * Width is perpendicular to direction, centered on the line of extension.
 * Used by Thunder Dragon Ultimate (3×8 from king), Dragon Sentinel Ultimate (15×1), etc.
 */
export declare function getDirectionalRect(start: Position, direction: Direction, width: number, length: number): Position[];
/**
 * Ring region — border of an NxN square (excludes interior).
 * Used by some effect AoE that only targets the perimeter.
 */
export declare function getRingRegion(center: Position, size: number): Position[];
/**
 * Check if a position is within a region.
 */
export declare function isInRegion(pos: Position, region: Position[]): boolean;
//# sourceMappingURL=Region.d.ts.map